"use server";
import {
  addressSchema,
  buildIncompleteExplanation,
  buildReport,
  buildTemplateExplanation,
  collectEvidence,
  createHttpTransport,
  decimalSchema,
  EXPLAIN_PROMPT_VERSION,
  hashSchema,
  replayReport,
  parseReportBody,
  reportHash,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  toFunctionSelector,
  type Hex,
} from "viem";
import { getExplainRuntime } from "../lib/explain-server";
import { agrees } from "../lib/publication";
import { registryAbi as abi, registryRuntimeHash } from "../lib/registry-abi";
import { getServerConfig } from "../lib/server-config";

class DisplayError extends Error {}
async function safely<T>(action: () => Promise<T>) {
  try {
    return { ok: true, data: await action() } as const;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof DisplayError
          ? e.message
          : "Read unavailable. Check the configured RPC and registry.",
    } as const;
  }
}
function endpoint(config = getServerConfig()) {
  if (!config.rpc.ok) throw new DisplayError(config.rpc.error);
  return config.rpc.url;
}
function address(value: string) {
  const result = addressSchema.safeParse(value.toLowerCase());
  if (!result.success)
    throw new DisplayError(
      "Enter a 0x-prefixed address with 40 hexadecimal characters.",
    );
  return getAddress(result.data);
}
async function registry(config = getServerConfig()) {
  const url = endpoint(config);
  if (!config.registry.ok) throw new DisplayError(config.registry.error);
  const target = config.registry.address;
  const client = createPublicClient({
    transport: http(url.href, {
      timeout: 5000,
      retryCount: 0,
      fetchOptions: { cache: "no-store", redirect: "error" },
    }),
  });
  const [chainId, code] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: target }),
  ]);
  if (chainId !== 43113)
    throw new DisplayError("Reader is on the wrong network.");
  if (!code || keccak256(code) !== registryRuntimeHash)
    throw new DisplayError("Configured registry runtime mismatch.");
  return {
    client,
    config: { address: target, abi },
    codehash: keccak256(code),
  };
}
function prepareExplanationForBody(
  body: ReportBody,
  hash: string,
  band: string,
): {
  explanation: ReportExplanation;
  aiEnabled: boolean;
  aiPromptVersion: string;
  explainToken: string | null;
} {
  const runtime = getExplainRuntime();
  const fallbackUnavailable = (reason: string): ReportExplanation => ({
    provenance: "template",
    reportHash: hash,
    rulesetVersion: body.rulesetVersion,
    signalScore: body.signalScore,
    band,
    overview:
      "Template explanation is unavailable for part of this report; deterministic report fields, canonical JSON export, and publication remain available.",
    findings: [],
    coverageSummary: "",
    fallbackReason: reason,
  });

  let explanation: ReportExplanation;
  let aiEnabled = false;
  let explainToken: string | null = null;
  const aiPromptVersion =
    typeof runtime.promptVersion === "function"
      ? runtime.promptVersion()
      : EXPLAIN_PROMPT_VERSION;

  if (runtime.isAiEnabled()) {
    const reg = runtime.tryRegisterBody(body);
    if (reg.ok) {
      explanation = reg.template;
      aiEnabled = true;
      explainToken = reg.explainToken;
    } else {
      const reason =
        reg.code === "oversized-input"
          ? "AI explanation skipped: report projection exceeds the 16,384-byte input limit; showing template."
          : "AI explanation unavailable for this report; showing template.";
      try {
        explanation = buildTemplateExplanation(body, reason);
      } catch {
        explanation = fallbackUnavailable(reason);
      }
    }
  } else {
    try {
      explanation = buildTemplateExplanation(body);
    } catch {
      explanation = fallbackUnavailable(
        "Template explanation unavailable for this report.",
      );
    }
  }

  return {
    explanation,
    aiEnabled,
    aiPromptVersion,
    explainToken,
  };
}

export async function scan(target: string) {
  return safely(async () => {
    const serverConfig = getServerConfig();
    const result = buildReport(
      await collectEvidence(createHttpTransport(endpoint(serverConfig).href), {
        address: address(target).toLowerCase(),
      }),
    );
    if (result.status === "complete") {
      const prepared = prepareExplanationForBody(
        result.body,
        result.reportHash,
        result.band,
      );

      return {
        status: result.status,
        band: result.band,
        body: result.body,
        reportHash: result.reportHash,
        ...prepared,
        publication: serverConfig.publication,
      } as const;
    }
    return {
      ...result,
      explanation: buildIncompleteExplanation(result),
      publication: serverConfig.publication,
    } as const;
  });
}

const UNKNOWN_REPORT_SELECTOR = toFunctionSelector("UnknownReport()");

function isUnknownReportRevert(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cursor: unknown = err;
  while (cursor && typeof cursor === "object" && !seen.has(cursor)) {
    seen.add(cursor);
    const record = cursor as {
      shortMessage?: unknown;
      message?: unknown;
      raw?: unknown;
      data?: unknown;
      cause?: unknown;
    };
    if (
      record.data &&
      typeof record.data === "object" &&
      (record.data as { errorName?: unknown }).errorName === "UnknownReport"
    ) {
      return true;
    }
    if (
      typeof record.data === "string" &&
      record.data.toLowerCase().startsWith(UNKNOWN_REPORT_SELECTOR)
    ) {
      return true;
    }
    if (
      typeof record.raw === "string" &&
      record.raw.toLowerCase().startsWith(UNKNOWN_REPORT_SELECTOR)
    ) {
      return true;
    }
    if (
      (typeof record.shortMessage === "string" &&
        record.shortMessage.includes("UnknownReport")) ||
      (typeof record.message === "string" &&
        record.message.includes("UnknownReport"))
    ) {
      return true;
    }
    cursor = record.cause;
  }
  return false;
}

/**
 * Verifies an imported canonical report against a published RiskRegistry commitment
 * before registering an explain projection or minting a bounded HMAC explain token.
 */
export async function prepareImportedExplanation(
  rawBody: unknown,
  expectedHash: string,
) {
  return safely(async () => {
    const expected = hashSchema.safeParse(
      typeof expectedHash === "string" ? expectedHash.toLowerCase() : "",
    );
    if (!expected.success) {
      throw new DisplayError("Invalid report hash.");
    }
    const parsedHash = expected.data;

    let body: ReportBody;
    try {
      body = parseReportBody(rawBody);
    } catch {
      throw new DisplayError("Invalid canonical report body.");
    }

    const computedHash = reportHash(body);
    if (computedHash !== parsedHash) {
      throw new DisplayError("Report hash mismatch.");
    }

    let onChain: {
      report: {
        target: Hex;
        score: number;
        codehash: Hex;
        implementation: Hex;
        reportHash: Hex;
        rulesetVersion: number;
        blockNumber: bigint;
        blockHash: Hex;
      };
      attester: Hex;
      publishedAt: bigint;
    };
    try {
      const { client, config } = await registry();
      onChain = await client.readContract({
        ...config,
        functionName: "getReport",
        args: [parsedHash as Hex],
      });
    } catch (err) {
      if (err instanceof DisplayError) {
        throw err;
      }
      if (isUnknownReportRevert(err)) {
        throw new DisplayError("Report commitment not found in registry.");
      }
      throw new DisplayError("Could not verify the commitment. Please retry.");
    }

    if (
      onChain.publishedAt <= 0n ||
      onChain.report.reportHash.toLowerCase() !== parsedHash
    ) {
      throw new DisplayError("Report commitment not found in registry.");
    }

    if (
      !agrees(body, {
        ...onChain.report,
        blockNumber: onChain.report.blockNumber.toString(),
      })
    ) {
      throw new DisplayError(
        "Imported report disagrees with the on-chain commitment.",
      );
    }

    const band =
      body.signalScore < 25
        ? "Few signals"
        : body.signalScore < 60
          ? "Some signals"
          : "Many signals";

    return {
      reportHash: computedHash,
      ...prepareExplanationForBody(body, computedHash, band),
    } as const;
  });
}
export async function replay(input: unknown, hash: string) {
  return safely(async () =>
    replayReport(
      createHttpTransport(endpoint().href),
      parseReportBody(input),
      hashSchema.parse(hash),
    ),
  );
}
export async function walletContext(block: string, hash: string) {
  return safely(async () => {
    const serverConfig = getServerConfig();
    if (!serverConfig.publication.enabled) {
      throw new DisplayError(serverConfig.publication.reason);
    }
    const { client, config, codehash } = await registry(serverConfig);
    const snapshotPromise = client.getBlock({
      blockNumber: BigInt(decimalSchema.parse(block)),
    });
    if (serverConfig.publication.mode === "local") {
      const [snapshot, version] = await Promise.all([
        snapshotPromise,
        client.request({ method: "web3_clientVersion" }),
      ]);
      if (!/anvil/i.test(version) || snapshot.hash !== hashSchema.parse(hash)) {
        throw new DisplayError("Reader registry or snapshot mismatch.");
      }
    } else {
      const snapshot = await snapshotPromise;
      if (snapshot.hash !== hashSchema.parse(hash)) {
        throw new DisplayError("Reader registry or snapshot mismatch.");
      }
    }
    return {
      address: config.address,
      codehash,
      mode: serverConfig.publication.mode,
    };
  });
}
export async function lookup(value: string, index?: string) {
  return safely(async () => {
    const target = address(value);
    const { client, config } = await registry();
    const blockNumber = await client.getBlockNumber();
    const read = { ...config, blockNumber };
    const count = await client.readContract({
      ...read,
      functionName: "reportCount",
      args: [target],
    });
    if (count === 0n) return null;
    const i =
      index === undefined ? undefined : BigInt(decimalSchema.parse(index));
    if (i !== undefined && i >= count)
      throw new DisplayError("History index is outside the publication range.");
    const item =
      i === undefined
        ? await client.readContract({
            ...read,
            functionName: "latestReport",
            args: [target],
          })
        : await client.readContract({
            ...read,
            functionName: "getReport",
            args: [
              await client.readContract({
                ...read,
                functionName: "reportHashAt",
                args: [target, i],
              }),
            ],
          });
    const stale = await client.readContract({
      ...read,
      functionName: "isCodeStale",
      args: [item.report.reportHash],
    });
    const runtime = getExplainRuntime();
    const aiEnabled =
      typeof runtime.isAiEnabled === "function" ? runtime.isAiEnabled() : false;
    const aiPromptVersion =
      typeof runtime.promptVersion === "function"
        ? runtime.promptVersion()
        : EXPLAIN_PROMPT_VERSION;
    return {
      report: {
        ...item.report,
        blockNumber: item.report.blockNumber.toString(),
      },
      attester: item.attester,
      publishedAt: item.publishedAt.toString(),
      count: count.toString(),
      stale,
      aiEnabled,
      aiPromptVersion,
    };
  });
}
