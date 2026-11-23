import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTemplateExplanation,
  canonicalReportJson,
  EXPLAIN_PROMPT_VERSION_V3,
  parseReportBody,
  reportHash,
  type ExplainInput,
  type ExplainLanguage,
  type ReportBody,
} from "@avaguard/analyzer";
import {
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  keccak256,
  zeroAddress,
  type Hex,
} from "viem";
import vector from "../../../fixtures/canonical-report-v1.json";
import { POST } from "../app/api/explain/route";
import {
  createUpstashExplainCache,
  type UpstashRedisClientLike,
} from "../lib/explain-redis";
import { createExplainRuntime } from "../lib/explain-server";
import { formatReportMarkdown } from "../lib/export-markdown";
import { publication } from "../lib/publication";
import { registryAbi } from "../lib/registry-abi";

const RUNTIME_KEY = Symbol.for("avaguard.m6.explainRuntime");
const STRONG_SECRET = "0123456789abcdef0123456789abcdef";
const SAMPLE_REGISTRY = "0x1111111111111111111111111111111111111111";
const SAMPLE_ATTESTER = "0x2222222222222222222222222222222222222222";
const MATCHING_RUNTIME: Hex = "0x6001600055";
const MATCHING_RUNTIME_HASH = keccak256(MATCHING_RUNTIME);

function clearExplainRuntime() {
  delete (globalThis as Record<symbol, unknown>)[RUNTIME_KEY];
}

afterEach(() => {
  clearExplainRuntime();
  vi.doUnmock("../lib/registry-abi");
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function makeValidV3Payload(
  input: ExplainInput,
  language: ExplainLanguage = "en",
) {
  return {
    narrativeOverview:
      language === "vi"
        ? `Báo cáo ghi nhận điểm tín hiệu ${input.signalScore} / 100 tại khối ${input.blockNumber}.`
        : `Snapshot signal score is ${input.signalScore} / 100 at block ${input.blockNumber}.`,
    items: input.findings.map((f) => ({
      findingId: f.id,
      citedEvidenceIds: [...f.evidenceIds],
      ...(f.allowedCheckIds.length > 0
        ? { suggestedCheckIds: [f.allowedCheckIds[0]] }
        : {}),
      narrative:
        language === "vi"
          ? `Tín hiệu ${f.id} cần đối chiếu trực tiếp với bằng chứng.`
          : `Observed signal ${f.id} should be checked against deterministic evidence.`,
    })),
  };
}

class InMemoryRedis implements UpstashRedisClientLike {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<unknown> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }
}

async function setupMockedActions(options: {
  getReportBehavior:
    | {
        kind: "match";
        scoreOverride?: number;
        publishedAt?: bigint;
      }
    | { kind: "unknown-report" }
    | { kind: "http-503" };
  stale?: boolean;
}) {
  const body = parseReportBody(vector);
  const tuple = publication(body);
  const rpcMethods: string[] = [];

  vi.stubGlobal("fetch", async (_url: unknown, init?: { body?: string }) => {
    const payload = JSON.parse(init?.body ?? "{}") as {
      id: number;
      method: string;
      params?: Array<{ to?: string; data?: Hex } | string>;
    };
    rpcMethods.push(payload.method);

    if (payload.method === "eth_chainId") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: "0xa869" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (payload.method === "eth_getCode") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: payload.id,
          result: MATCHING_RUNTIME,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (payload.method === "eth_blockNumber") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: "0x64" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (payload.method === "eth_call") {
      const callObj = payload.params?.[0] as { data?: Hex } | undefined;
      const decoded = callObj?.data
        ? decodeFunctionData({ abi: registryAbi, data: callObj.data })
        : null;

      if (decoded?.functionName === "getReport") {
        if (options.getReportBehavior.kind === "http-503") {
          return new Response("Service Unavailable", { status: 503 });
        }
        if (options.getReportBehavior.kind === "unknown-report") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: payload.id,
              error: {
                code: 3,
                message: "execution reverted",
                data: encodeErrorResult({
                  abi: registryAbi,
                  errorName: "UnknownReport",
                }),
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        const commitmentResult = {
          report: {
            ...tuple,
            score:
              options.getReportBehavior.scoreOverride ?? Number(tuple.score),
          },
          attester: SAMPLE_ATTESTER as Hex,
          publishedAt: options.getReportBehavior.publishedAt ?? 1_700_000_000n,
        };
        const encoded = encodeFunctionResult({
          abi: registryAbi,
          functionName: "getReport",
          result: commitmentResult,
        });
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: encoded }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (decoded?.functionName === "reportCount") {
        const encoded = encodeFunctionResult({
          abi: registryAbi,
          functionName: "reportCount",
          result: 1n,
        });
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: encoded }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (decoded?.functionName === "latestReport") {
        const encoded = encodeFunctionResult({
          abi: registryAbi,
          functionName: "latestReport",
          result: {
            report: tuple,
            attester: SAMPLE_ATTESTER as Hex,
            publishedAt: 1_700_000_000n,
          },
        });
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: encoded }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (decoded?.functionName === "isCodeStale") {
        const encoded = encodeFunctionResult({
          abi: registryAbi,
          functionName: "isCodeStale",
          result: Boolean(options.stale),
        });
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: encoded }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: payload.id,
        result: zeroAddress,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  vi.stubEnv("AVAGUARD_ENV", "fuji");
  vi.stubEnv("FUJI_RPC_URL", "https://fuji-rpc.test/ext/bc/C/rpc");
  vi.stubEnv("REGISTRY_ADDRESS", SAMPLE_REGISTRY);

  vi.resetModules();
  vi.doMock("../lib/registry-abi", async () => {
    const actual = await vi.importActual<typeof import("../lib/registry-abi")>(
      "../lib/registry-abi",
    );
    return {
      ...actual,
      registryRuntimeHash: MATCHING_RUNTIME_HASH,
    };
  });

  const actions = await import("../app/actions");
  return { actions, body, tuple, rpcMethods };
}

describe("Verified /lookup AI explanation gating", () => {
  it("mints an HMAC explain token for an on-chain verified report and shares EN/VI explanations via Redis L2", async () => {
    const redis = new InMemoryRedis();
    const cache = createUpstashExplainCache({ redis });

    let runtimeACalls = 0;
    const runtimeA = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      sharedCache: cache,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          runtimeACalls++;
          return makeValidV3Payload(input, opts.language ?? "en");
        },
      },
    });
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = runtimeA;

    const { actions, body, tuple } = await setupMockedActions({
      getReportBehavior: { kind: "match" },
    });

    const lookupRes = await actions.lookup(body.address);
    expect(lookupRes.ok).toBe(true);
    if (!lookupRes.ok || !lookupRes.data) {
      throw new Error("Expected verified lookup commitment");
    }
    expect(lookupRes.data.aiEnabled).toBe(true);
    expect(lookupRes.data.aiPromptVersion).toBe(EXPLAIN_PROMPT_VERSION_V3);

    const prepRes = await actions.prepareImportedExplanation(
      body,
      tuple.reportHash,
    );
    expect(prepRes.ok).toBe(true);
    if (!prepRes.ok) throw new Error("Expected prepareImportedExplanation ok");
    expect(prepRes.data.reportHash).toBe(tuple.reportHash);
    expect(prepRes.data.aiEnabled).toBe(true);
    expect(prepRes.data.aiPromptVersion).toBe(EXPLAIN_PROMPT_VERSION_V3);
    expect(prepRes.data.explainToken).toBeTruthy();

    // Generate EN + VI via POST /api/explain on instance A
    for (const lang of ["en", "vi"] as const) {
      const res = await POST(
        new Request("https://ava-guard.example/api/explain", {
          method: "POST",
          body: JSON.stringify({
            reportHash: tuple.reportHash,
            explainToken: prepRes.data.explainToken,
            language: lang,
          }),
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        ok: boolean;
        explanation: {
          provenance: string;
          language?: string;
          cached?: boolean;
          aiSummary?: string;
        };
      };
      expect(data.ok).toBe(true);
      expect(data.explanation.provenance).toBe("ai-assisted");
      expect(data.explanation.language).toBe(lang);
      expect(data.explanation.cached).toBe(false);
    }
    expect(runtimeACalls).toBe(2);

    // Instance B with empty L1 cache hits L2 Redis cleanly without calling Gemini again
    let runtimeBCalls = 0;
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] =
      createExplainRuntime({
        enabled: true,
        promptVersion: EXPLAIN_PROMPT_VERSION_V3,
        tokenSecret: STRONG_SECRET,
        sharedCache: cache,
        provider: {
          model: "gemini-3.5-flash-lite",
          async explain() {
            runtimeBCalls++;
            throw new Error("L2 cache hit must not invoke provider");
          },
        },
      });

    const cachedViRes = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        body: JSON.stringify({
          reportHash: tuple.reportHash,
          explainToken: prepRes.data.explainToken,
          language: "vi",
        }),
      }),
    );
    expect(cachedViRes.status).toBe(200);
    const cachedViJson = (await cachedViRes.json()) as {
      ok: boolean;
      explanation: {
        provenance: string;
        cached?: boolean;
        language?: string;
        aiSummary?: string;
      };
    };
    expect(cachedViJson.ok).toBe(true);
    expect(cachedViJson.explanation.provenance).toBe("ai-assisted");
    expect(cachedViJson.explanation.cached).toBe(true);
    expect(cachedViJson.explanation.language).toBe("vi");
    expect(runtimeBCalls).toBe(0);
  });

  it("distinguishes UnknownReport/publishedAt=0n from RPC HTTP 503 failures and lets retry recover cleanly", async () => {
    let providerCalls = 0;
    const runtime = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain() {
          providerCalls++;
          throw new Error("Should never invoke provider");
        },
      },
    });
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = runtime;

    // 1. Contract reverts with UnknownReport()
    const unknownSetup = await setupMockedActions({
      getReportBehavior: { kind: "unknown-report" },
    });
    const unknownRes = await unknownSetup.actions.prepareImportedExplanation(
      unknownSetup.body,
      unknownSetup.tuple.reportHash,
    );
    expect(unknownRes).toEqual({
      ok: false,
      error: "Report commitment not found in registry.",
    });

    // 2. Contract returns empty record with publishedAt = 0n
    const zeroTsSetup = await setupMockedActions({
      getReportBehavior: { kind: "match", publishedAt: 0n },
    });
    const zeroTsRes = await zeroTsSetup.actions.prepareImportedExplanation(
      zeroTsSetup.body,
      zeroTsSetup.tuple.reportHash,
    );
    expect(zeroTsRes).toEqual({
      ok: false,
      error: "Report commitment not found in registry.",
    });

    // 3. RPC returns HTTP 503 during getReport -> transient verify error, zero tokens issued
    const outageSetup = await setupMockedActions({
      getReportBehavior: { kind: "http-503" },
    });
    const outageRes = await outageSetup.actions.prepareImportedExplanation(
      outageSetup.body,
      outageSetup.tuple.reportHash,
    );
    expect(outageRes).toEqual({
      ok: false,
      error: "Could not verify the commitment. Please retry.",
    });
    expect(providerCalls).toBe(0);
    expect(runtime.projectionCount()).toBe(0);

    // 4. Subsequent retry once RPC recovers succeeds cleanly
    const recoveredSetup = await setupMockedActions({
      getReportBehavior: { kind: "match" },
    });
    const retryRes = await recoveredSetup.actions.prepareImportedExplanation(
      recoveredSetup.body,
      recoveredSetup.tuple.reportHash,
    );
    expect(retryRes.ok).toBe(true);
    if (!retryRes.ok) throw new Error("Expected retry after RPC recovery to pass");
    expect(retryRes.data.aiEnabled).toBe(true);
    expect(retryRes.data.explainToken).toBeTruthy();
  });

  it("rejects tampered hash, registry disagreement, and malformed body before issuing tokens", async () => {
    const runtime = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain() {
          throw new Error("Should never invoke provider");
        },
      },
    });
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = runtime;

    // 1. Hash mismatch short-circuits before RPC calls
    const mismatchSetup = await setupMockedActions({
      getReportBehavior: { kind: "match" },
    });
    const tamperedBody: ReportBody = structuredClone(mismatchSetup.body);
    tamperedBody.findings[0].explanation += " tampered";
    const mismatchRes = await mismatchSetup.actions.prepareImportedExplanation(
      tamperedBody,
      mismatchSetup.tuple.reportHash,
    );
    expect(mismatchRes).toEqual({
      ok: false,
      error: "Report hash mismatch.",
    });
    expect(mismatchSetup.rpcMethods).toHaveLength(0);

    // 2. Malformed body rejected cleanly before RPC calls
    const invalidRes = await mismatchSetup.actions.prepareImportedExplanation(
      { not: "a-report" },
      mismatchSetup.tuple.reportHash,
    );
    expect(invalidRes).toEqual({
      ok: false,
      error: "Invalid canonical report body.",
    });
    expect(mismatchSetup.rpcMethods).toHaveLength(0);

    // 3. On-chain score differs from imported body summary
    const disagreeSetup = await setupMockedActions({
      getReportBehavior: { kind: "match", scoreOverride: 99 },
    });
    const disagreeRes = await disagreeSetup.actions.prepareImportedExplanation(
      disagreeSetup.body,
      disagreeSetup.tuple.reportHash,
    );
    expect(disagreeRes).toEqual({
      ok: false,
      error: "Imported report disagrees with the on-chain commitment.",
    });
    expect(runtime.projectionCount()).toBe(0);
  });

  it("returns template explanation and null token when AI is disabled on the server", async () => {
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] =
      createExplainRuntime({
        enabled: false,
        provider: null,
        tokenSecret: STRONG_SECRET,
      });

    const { actions, body, tuple } = await setupMockedActions({
      getReportBehavior: { kind: "match" },
    });

    const res = await actions.prepareImportedExplanation(body, tuple.reportHash);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("Expected ok result");
    expect(res.data.aiEnabled).toBe(false);
    expect(res.data.explainToken).toBeNull();
    expect(res.data.explanation.provenance).toBe("template");
    expect(res.data.explanation.reportHash).toBe(tuple.reportHash);
  });
});

describe("Evidence-bound Markdown report formatter", () => {
  it("formats deterministic template explanations without an AI Summary section and preserves hashes", () => {
    const body = parseReportBody(vector);
    const beforeCanonical = canonicalReportJson(body);
    const expectedHash = reportHash(body);
    const template = buildTemplateExplanation(body);

    const md = formatReportMarkdown(body, template);

    expect(canonicalReportJson(body)).toBe(beforeCanonical);
    expect(md).toContain("# AvaGuard Risk-Signal Report");
    expect(md).toContain("never safety certification or an audit");
    expect(md).toContain(`\`${expectedHash}\``);
    expect(md).toContain(`\`${body.address}\``);
    expect(md).toContain(`| Signal Score | ${body.signalScore} / 100 (`);
    expect(md).not.toContain("## AI Summary");
    expect(md).toContain("## Deterministic Overview & Coverage");
    expect(md).toContain("## Findings & Evidence");
    expect(md).toContain(template.overview);
    expect(md).toContain(template.coverageSummary);
    expect(md.endsWith("\n")).toBe(true);
  });

  it("formats AI-assisted Prompt v3 summaries, per-finding AI notes, commitment metadata, and escapes table cells", () => {
    const body = parseReportBody(vector);
    const template = buildTemplateExplanation(body);
    const aiExplanation = {
      ...template,
      provenance: "ai-assisted" as const,
      model: "gemini-3.5-flash-lite",
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      language: "vi" as const,
      cached: true,
      aiSummary: `Báo cáo ghi nhận điểm tín hiệu ${body.signalScore} / 100 với bằng chứng quan sát tại khối ${body.blockNumber}.`,
      findings: template.findings.map((f, index) =>
        index === 0
          ? {
              ...f,
              aiNote: "Tín hiệu cần kiểm tra đối chiếu với nguồn bằng chứng.",
            }
          : f,
      ),
    };

    const md = formatReportMarkdown(body, aiExplanation, {
      attester: "0x2222|line1\nline2",
      publishedAt: "1700000000",
      stale: true,
    });

    expect(md).toContain("## AI Summary");
    expect(md).toContain(
      "Model: `gemini-3.5-flash-lite` · Prompt v3 · Tiếng Việt · cached",
    );
    expect(md).toContain(
      "*AI-generated narrative — verify against deterministic evidence below.*",
    );
    expect(md).toContain(aiExplanation.aiSummary);
    expect(md).toContain(
      "- **AI note:** Tín hiệu cần kiểm tra đối chiếu với nguồn bằng chứng.",
    );
    expect(md).toContain("| On-Chain Attester | `0x2222\\|line1 line2` |");
    expect(md).toContain(
      "| Published At | 1700000000 (2023-11-14T22:13:20.000Z) |",
    );
    expect(md).toContain("| Target Runtime Code | changed |");
  });
});
