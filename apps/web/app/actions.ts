"use server";
import {
  addressSchema,
  buildIncompleteExplanation,
  buildReport,
  buildTemplateExplanation,
  collectEvidence,
  createHttpTransport,
  decimalSchema,
  hashSchema,
  replayReport,
  parseReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import { createPublicClient, getAddress, http, keccak256 } from "viem";
import { getExplainRuntime } from "../lib/explain-server";
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
export async function scan(target: string) {
  return safely(async () => {
    const serverConfig = getServerConfig();
    const result = buildReport(
      await collectEvidence(createHttpTransport(endpoint(serverConfig).href), {
        address: address(target).toLowerCase(),
      }),
    );
    if (result.status === "complete") {
      const runtime = getExplainRuntime();
      const fallbackUnavailable = (reason: string): ReportExplanation => ({
        provenance: "template",
        reportHash: result.reportHash,
        rulesetVersion: result.body.rulesetVersion,
        signalScore: result.body.signalScore,
        band: result.band,
        overview:
          "Template explanation is unavailable for part of this report; deterministic report fields, canonical JSON export, and publication remain available.",
        findings: [],
        coverageSummary: "",
        fallbackReason: reason,
      });

      let explanation: ReportExplanation;
      let aiEnabled = false;

      if (runtime.isAiEnabled()) {
        const reg = runtime.tryRegisterBody(result.body);
        if (reg.ok) {
          explanation = reg.template;
          aiEnabled = true;
        } else {
          const reason =
            reg.code === "oversized-input"
              ? "AI explanation skipped: report projection exceeds the 16,384-byte input limit; showing template."
              : "AI explanation unavailable for this report; showing template.";
          try {
            explanation = buildTemplateExplanation(result.body, reason);
          } catch {
            explanation = fallbackUnavailable(reason);
          }
        }
      } else {
        try {
          explanation = buildTemplateExplanation(result.body);
        } catch {
          explanation = fallbackUnavailable(
            "Template explanation unavailable for this report.",
          );
        }
      }

      return {
        status: result.status,
        band: result.band,
        body: result.body,
        reportHash: result.reportHash,
        explanation,
        aiEnabled,
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
    return {
      report: {
        ...item.report,
        blockNumber: item.report.blockNumber.toString(),
      },
      attester: item.attester,
      publishedAt: item.publishedAt.toString(),
      count: count.toString(),
      stale,
    };
  });
}
