import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { toFunctionSelector, toHex, type Hex } from "viem";
import {
  buildIncompleteExplanation,
  buildReport,
  buildTemplateExplanation,
  canonicalReportJson,
  collectEvidence,
  createExplainService,
  EXPLAIN_PROMPT_VERSION,
  explainCacheKey,
  buildExplainInput,
  parseReportBody,
  ReadError,
  reportHash,
  type ExplainInput,
  type ExplainProvider,
  type ReportBody,
} from "../src";
import { IMPL, OWNER, TARGET, mock } from "./mock";

const push = (sig: string) => "63" + toFunctionSelector(sig).slice(2);

async function buildFixtureReport(
  override?: Parameters<typeof mock>[0],
): Promise<{
  body: ReportBody;
  band: string;
  reportHash: string;
}> {
  const collection = await collectEvidence(mock(override).transport, {
    address: TARGET,
  });
  const report = buildReport(collection);
  if (report.status !== "complete") {
    throw new Error(`Expected complete report, got ${report.status}`);
  }
  return {
    body: report.body,
    band: report.band,
    reportHash: report.reportHash,
  };
}

function makeMintableReport() {
  const mintRuntime = ("0x" + push("mint(address,uint256)") + "14") as Hex;
  return buildFixtureReport((method, params) => {
    if (method === "eth_getCode" && params[0] === TARGET) return mintRuntime;
    if (method === "eth_getCode" && params[0] === OWNER) return "0x";
  });
}

function makeDecoyZeroReport() {
  // PUSH4 mint(address,uint256) without nearby EQ -> score 0
  const decoyRuntime = ("0x" + push("mint(address,uint256)") + "00") as Hex;
  return buildFixtureReport((method, params) => {
    if (method === "eth_getCode" && params[0] === TARGET) return decoyRuntime;
    if (method === "eth_call") {
      const call = params[0] as { data: Hex };
      // Revert owner() so only R-SOURCE-UNKNOWN remains (score 0)
      if (call.data === "0x8da5cb5b") throw new ReadError("execution-revert");
    }
  });
}

function makeValidAiPayload(input: ExplainInput, tag = "valid") {
  return {
    overview: `Signal score is ${input.signalScore} / 100 (${input.band}) [${tag}]; weights reflect observed capability indicators only.`,
    items: input.findings.map((f) => ({
      findingId: f.id,
      citedEvidenceIds: [...f.evidenceIds],
      summary: `${f.id} observed via ${f.evidenceIds.join(", ")} [${tag}]; access control remains unverified.`,
      suggestedCheckIds: f.allowedCheckIds.slice(0, 1),
    })),
    coverageNote: `Reviewed ${input.coverage.checked.length} checked items [${tag}].`,
  };
}

function publicationTuple(body: ReportBody) {
  return {
    target: body.address,
    score: body.signalScore,
    codehash: body.codehash,
    implementation:
      body.proxy.implementation ?? "0x0000000000000000000000000000000000000000",
    reportHash: reportHash(body),
    rulesetVersion: body.rulesetVersion,
    blockNumber: body.blockNumber,
    blockHash: body.blockHash,
  };
}

it("keeps canonical report, hash, score, coverage, and publication tuple identical across AI modes and retains locked vector", async () => {
  const vectorJson = await readFile(
    new URL("../../../fixtures/canonical-report-v1.json", import.meta.url),
    "utf8",
  );
  const vectorBody = parseReportBody(JSON.parse(vectorJson));
  expect(reportHash(vectorBody)).toBe(
    "0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd",
  );

  const mintable = await makeMintableReport();
  expect(mintable.body.signalScore).toBe(35);

  const validProvider: ExplainProvider = {
    model: "mock-gemini",
    async explain(input) {
      return makeValidAiPayload(input);
    },
  };
  const failingProvider: ExplainProvider = {
    model: "mock-gemini",
    async explain() {
      throw new Error("outage");
    },
  };

  const offService = createExplainService({
    enabled: false,
    provider: validProvider,
  });
  const missingKeyService = createExplainService({
    enabled: true,
    provider: null,
  });
  const okService = createExplainService({
    enabled: true,
    provider: validProvider,
  });
  const failService = createExplainService({
    enabled: true,
    provider: failingProvider,
    maxAttempts: 1,
  });

  const beforeJson = canonicalReportJson(mintable.body);
  const beforeHash = reportHash(mintable.body);
  const beforeTuple = publicationTuple(mintable.body);

  const results = await Promise.all([
    offService.explainReport(mintable.body),
    missingKeyService.explainReport(mintable.body),
    okService.explainReport(mintable.body),
    failService.explainReport(mintable.body),
  ]);

  expect(results.map((r) => r.explanation.provenance)).toEqual([
    "template",
    "template",
    "ai-assisted",
    "template",
  ]);
  for (const res of results) {
    expect(res.explanation.reportHash).toBe(beforeHash);
    expect(res.explanation.signalScore).toBe(35);
    expect(res.explanation.band).toBe("Some signals");
  }
  expect(canonicalReportJson(mintable.body)).toBe(beforeJson);
  expect(reportHash(mintable.body)).toBe(beforeHash);
  expect(publicationTuple(mintable.body)).toEqual(beforeTuple);
});

it("explains MintableToken (35) and DecoyConstantToken (0) accurately and skips provider calls for disabled, missing-key, and incomplete scans", async () => {
  const mintable = await makeMintableReport();
  const decoy = await makeDecoyZeroReport();

  const templateMint = buildTemplateExplanation(mintable.body);
  expect(templateMint.provenance).toBe("template");
  expect(templateMint.signalScore).toBe(35);
  expect(templateMint.overview).toContain("35 / 100");
  expect(templateMint.overview).toContain("R-MINT (+25)");
  expect(templateMint.overview).toContain("R-OWNER-EOA (+10)");

  const mintFinding = templateMint.findings.find(
    (f) => f.findingId === "R-MINT",
  )!;
  expect(mintFinding.weight).toBe(25);
  expect(mintFinding.evidenceIds).toEqual(["dispatch-mint(address,uint256)"]);
  expect(mintFinding.confidenceNote).toContain("dispatcher-match");
  expect(mintFinding.summary).toContain("dispatch-mint(address,uint256)");
  expect(mintFinding.summary).toContain("unverified");

  const ownerFinding = templateMint.findings.find(
    (f) => f.findingId === "R-OWNER-EOA",
  )!;
  expect(ownerFinding.weight).toBe(10);
  expect(ownerFinding.evidenceIds).toEqual(["owner", "owner-code"]);
  expect(ownerFinding.summary).toContain("no deployed bytecode");

  const templateZero = buildTemplateExplanation(decoy.body);
  expect(templateZero.signalScore).toBe(0);
  expect(templateZero.findings.map((f) => f.findingId)).toEqual([
    "R-SOURCE-UNKNOWN",
  ]);
  expect(templateZero.overview).toContain("0 / 100");
  expect(templateZero.overview).not.toMatch(/\b(safe|secure|harmless)\b/i);

  let providerCalls = 0;
  const countedProvider: ExplainProvider = {
    model: "mock-gemini",
    async explain(input) {
      providerCalls++;
      return makeValidAiPayload(input, "ok");
    },
  };

  await createExplainService({
    enabled: false,
    provider: countedProvider,
  }).explainReport(mintable.body);
  await createExplainService({
    enabled: true,
    provider: null,
  }).explainReport(mintable.body);
  expect(providerCalls).toBe(0);

  const notAnalyzable = buildReport(
    await collectEvidence(
      mock((m) => (m === "eth_getCode" ? "0x" : undefined)).transport,
      { address: TARGET },
    ),
  );
  expect(notAnalyzable.status).toBe("not-analyzable");
  if (notAnalyzable.status === "complete") throw new Error("unexpected");
  const noCodeExplain = buildIncompleteExplanation(notAnalyzable);
  expect(noCodeExplain.signalScore).toBeNull();
  expect(noCodeExplain.band).toBeNull();
  expect(noCodeExplain.provenance).toBe("template");
  expect(noCodeExplain.overview).toContain("no-bytecode");

  const inconclusive = buildReport(
    await collectEvidence(
      mock((m) => {
        if (m === "eth_getCode") throw new ReadError("transport");
      }).transport,
      { address: TARGET },
    ),
  );
  expect(inconclusive.status).toBe("inconclusive");
  if (inconclusive.status === "complete") throw new Error("unexpected");
  const incExplain = buildIncompleteExplanation(inconclusive);
  expect(incExplain.signalScore).toBeNull();
  expect(incExplain.band).toBeNull();
  expect(incExplain.overview).toContain("transport");
  expect(providerCalls).toBe(0);

  const aiSuccess = await createExplainService({
    enabled: true,
    provider: countedProvider,
  }).explainReport(mintable.body);
  expect(providerCalls).toBe(1);
  expect(aiSuccess.explanation.provenance).toBe("ai-assisted");
  expect(aiSuccess.explanation.model).toBe("mock-gemini");
  expect(aiSuccess.explanation.promptVersion).toBe(EXPLAIN_PROMPT_VERSION);
});

it("rejects malformed JSON, invalid schema, invented/duplicate findings, bad/cross-finding citations, and unsupported safety claims", async () => {
  const mintable = await makeMintableReport();
  const { input } = buildExplainInput(mintable.body);

  const badCases: Array<{ name: string; marker: string; payload: unknown }> = [
    {
      name: "malformed JSON string",
      marker: "REJECTED_RAW_JSON_MARKER",
      payload: "{not-json REJECTED_RAW_JSON_MARKER",
    },
    {
      name: "unknown top-level field (signalScore override attempt)",
      marker: "REJECTED_SCORE_OVERRIDE",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_SCORE_OVERRIDE"),
        signalScore: 0,
      },
    },
    {
      name: "invented finding",
      marker: "REJECTED_INVENTED_FINDING",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_INVENTED_FINDING"),
        items: [
          ...makeValidAiPayload(input).items,
          {
            findingId: "R-INVENTED",
            citedEvidenceIds: ["owner"],
            summary: "REJECTED_INVENTED_FINDING",
          },
        ],
      },
    },
    {
      name: "duplicate finding",
      marker: "REJECTED_DUP_FINDING",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_DUP_FINDING"),
        items: [
          makeValidAiPayload(input).items[0],
          makeValidAiPayload(input).items[0],
        ],
      },
    },
    {
      name: "nonexistent evidence ID",
      marker: "REJECTED_DANGLING_ID",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_DANGLING_ID"),
        items: makeValidAiPayload(input).items.map((item) =>
          item.findingId === "R-MINT"
            ? {
                ...item,
                citedEvidenceIds: ["nonexistent-evidence"],
                summary: "REJECTED_DANGLING_ID",
              }
            : item,
        ),
      },
    },
    {
      name: "valid evidence ID attached to the wrong finding (cross-finding citation)",
      marker: "REJECTED_CROSS_FINDING",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_CROSS_FINDING"),
        items: makeValidAiPayload(input).items.map((item) =>
          item.findingId === "R-MINT"
            ? {
                ...item,
                citedEvidenceIds: ["owner"],
                summary: "REJECTED_CROSS_FINDING",
              }
            : item,
        ),
      },
    },
    {
      name: "cross-finding suggestedCheckId",
      marker: "REJECTED_CROSS_CHECK",
      payload: {
        ...makeValidAiPayload(input, "REJECTED_CROSS_CHECK"),
        items: makeValidAiPayload(input).items.map((item) =>
          item.findingId === "R-OWNER-EOA"
            ? {
                ...item,
                suggestedCheckIds: ["mint-authority"],
                summary: "REJECTED_CROSS_CHECK",
              }
            : item,
        ),
      },
    },
    {
      name: "unsupported safety claim",
      marker: "This contract is safe and audited",
      payload: {
        ...makeValidAiPayload(input),
        overview: "This contract is safe and audited with zero risk.",
      },
    },
    {
      name: "unsupported access control claim",
      marker: "owner can mint freely",
      payload: {
        ...makeValidAiPayload(input),
        items: makeValidAiPayload(input).items.map((item) =>
          item.findingId === "R-MINT"
            ? {
                ...item,
                summary: "Because owner is present, the owner can mint freely.",
              }
            : item,
        ),
      },
    },
  ];

  for (const testCase of badCases) {
    const service = createExplainService({
      enabled: true,
      maxAttempts: 1,
      provider: {
        model: "mock-gemini",
        async explain() {
          return testCase.payload;
        },
      },
    });
    const res = await service.explainReport(mintable.body);
    expect(res.explanation.provenance, testCase.name).toBe("template");
    expect(res.explanation.fallbackReason, testCase.name).toBeTruthy();
    expect(JSON.stringify(res.explanation), testCase.name).not.toContain(
      testCase.marker,
    );
  }
});

it("excludes untrusted metadata and free-text markers from projected provider requests and makes zero calls for rejected reports", async () => {
  const MARKER = "PROMPT_INJECTION_MARKER_DO_NOT_FOLLOW";
  const observedRequests: ExplainInput[] = [];

  const service = createExplainService({
    enabled: true,
    provider: {
      model: "mock-gemini",
      async explain(input) {
        observedRequests.push(input);
        return makeValidAiPayload(input, "clean");
      },
    },
  });

  // 1. Invalid/tampered imported body must reject before calling provider
  const mintable = await makeMintableReport();
  const tampered = structuredClone(mintable.body);
  tampered.signalScore = 0; // disagrees with findings
  tampered.findings[0].explanation = MARKER;
  await expect(service.explainReport(tampered)).rejects.toThrow();
  expect(observedRequests).toHaveLength(0);

  // 2. Trusted scan where on-chain name()/symbol() and free-text report fields contain the marker
  const encodedName =
    "0x0000000000000000000000000000000000000000000000000000000000000020" +
    toHex(BigInt(MARKER.length), { size: 32 }).slice(2) +
    Buffer.from(MARKER, "utf8").toString("hex").padEnd(128, "0");

  const withMetadataMarker = await buildFixtureReport((method, params) => {
    if (method === "eth_getCode" && params[0] === TARGET) {
      return ("0x" + push("mint(address,uint256)") + "14") as Hex;
    }
    if (method === "eth_call") {
      const call = params[0] as { data: Hex };
      if (call.data === "0x06fdde03") return encodedName;
    }
  });
  // Even if free-text explanation/reason fields contain marker
  withMetadataMarker.body.findings[0].explanation = MARKER;
  withMetadataMarker.body.proxy.reason = MARKER;
  withMetadataMarker.body.coverage.checked[0].reason = MARKER;

  const res = await service.explainReport(withMetadataMarker.body);
  expect(observedRequests).toHaveLength(1);
  expect(JSON.stringify(observedRequests[0])).not.toContain(MARKER);
  expect(JSON.stringify(res.explanation)).not.toContain(MARKER);
});

it("handles timeout, 429 rate-limit, outage, and oversized output within bounds and recovers on later retry", async () => {
  const mintable = await makeMintableReport();
  let calls = 0;
  let mode: "timeout" | "429" | "outage" | "oversized" | "recover" = "timeout";

  const service = createExplainService({
    enabled: true,
    requestTimeoutMs: 40,
    deadlineMs: 250,
    maxAttempts: 2,
    provider: {
      model: "mock-gemini",
      async explain(input, { signal }) {
        calls++;
        if (mode === "timeout") {
          await new Promise((_, reject) => {
            signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          });
        }
        if (mode === "429") {
          const { ExplainProviderError } = await import("../src");
          throw new ExplainProviderError("rate-limit", "429");
        }
        if (mode === "outage") {
          throw new Error("503");
        }
        if (mode === "oversized") {
          return JSON.stringify({
            overview: "x".repeat(9000),
            items: [],
          });
        }
        return makeValidAiPayload(input, "recovered");
      },
    },
  });

  for (const nextMode of ["timeout", "429", "outage", "oversized"] as const) {
    mode = nextMode;
    calls = 0;
    const r = await service.explainReport(mintable.body);
    expect(r.explanation.provenance).toBe("template");
    expect(r.explanation.fallbackReason).toBeTruthy();
    expect(calls).toBeLessThanOrEqual(2);
    expect(service.cacheSize()).toBe(0);
  }

  // Later retry after timeout/outage must succeed and cache
  mode = "recover";
  calls = 0;
  const recovered = await service.explainReport(mintable.body);
  expect(recovered.explanation.provenance).toBe("ai-assisted");
  expect(calls).toBe(1);
  expect(service.cacheSize()).toBe(1);
});

it("caches equivalent canonical explain inputs and invalidates on owner, implementation, coverage, promptVersion, and model changes", async () => {
  const baseMintCode = ("0x" + push("mint(address,uint256)") + "14") as Hex;
  const OTHER_OWNER = ("0x" + "5".repeat(40)) as Hex;
  const IMPL_2 = ("0x" + "6".repeat(40)) as Hex;

  const base = await buildFixtureReport((m, p) => {
    if (m === "eth_getCode" && p[0] === TARGET) return baseMintCode;
  });
  const sameDifferentOrder = structuredClone(base.body);
  sameDifferentOrder.evidence.reverse();
  sameDifferentOrder.findings.reverse();

  // Different owner at fixed target codehash
  const changedOwner = await buildFixtureReport((m, p) => {
    if (m === "eth_getCode" && p[0] === TARGET) return baseMintCode;
    if (m === "eth_getCode" && p[0] === OTHER_OWNER) return "0x";
    if (m === "eth_call" && (p[0] as { data: Hex }).data === "0x8da5cb5b") {
      return toHex(BigInt(OTHER_OWNER), { size: 32 });
    }
  });

  // Different proxy implementation at fixed target codehash
  const proxyImplA = await buildFixtureReport((m, p) => {
    if (m === "eth_getCode" && p[0] === TARGET) return "0x6000";
    if (
      m === "eth_getStorageAt" &&
      p[0] === TARGET &&
      p[1] ===
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    ) {
      return toHex(BigInt(IMPL), { size: 32 });
    }
    if (m === "eth_getCode" && p[0] === IMPL) return baseMintCode;
  });
  const proxyImplB = await buildFixtureReport((m, p) => {
    if (m === "eth_getCode" && p[0] === TARGET) return "0x6000";
    if (
      m === "eth_getStorageAt" &&
      p[0] === TARGET &&
      p[1] ===
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    ) {
      return toHex(BigInt(IMPL_2), { size: 32 });
    }
    if (m === "eth_getCode" && p[0] === IMPL_2) return baseMintCode;
  });
  expect(proxyImplA.body.codehash).toBe(proxyImplB.body.codehash);

  // Different coverage at fixed target codehash (e.g. truncated-push present vs absent)
  const changedCoverage = structuredClone(base.body);
  changedCoverage.coverage.notChecked.push({
    id: "truncated-push",
    reason: "Incomplete PUSH operand",
  });

  let providerCalls = 0;
  const makeService = (model: string, promptVersion: string) =>
    createExplainService({
      enabled: true,
      promptVersion,
      provider: {
        model,
        async explain(input) {
          providerCalls++;
          return makeValidAiPayload(input, `${model}-v${promptVersion}`);
        },
      },
    });

  const s1 = makeService("model-a", "1");
  const first = await s1.explainReport(base.body);
  expect(first.cacheHit).toBe(false);
  expect(providerCalls).toBe(1);

  // Equivalent canonical input hits cache
  const second = await s1.explainReport(sameDifferentOrder);
  expect(second.cacheHit).toBe(true);
  expect(second.explanation.cached).toBe(true);
  expect(providerCalls).toBe(1);

  // Disabling AI returns template even though cache has an entry
  const disabled = await s1.explainReport(base.body, { enabled: false });
  expect(disabled.explanation.provenance).toBe("template");
  expect(providerCalls).toBe(1);

  // Changing owner misses
  const ownerRes = await s1.explainReport(changedOwner.body);
  expect(ownerRes.cacheHit).toBe(false);
  expect(providerCalls).toBe(2);

  // Changing proxy implementation misses at fixed target codehash
  await s1.explainReport(proxyImplA.body);
  expect(providerCalls).toBe(3);
  const implBRes = await s1.explainReport(proxyImplB.body);
  expect(implBRes.cacheHit).toBe(false);
  expect(providerCalls).toBe(4);

  // Changing coverage misses at fixed target codehash
  const covRes = await s1.explainReport(changedCoverage);
  expect(covRes.cacheHit).toBe(false);
  expect(providerCalls).toBe(5);

  // Changing promptVersion independently produces a distinct cache key and misses
  const keyV1 = explainCacheKey(buildExplainInput(base.body).input, "1", "model-a");
  const keyV2 = explainCacheKey(buildExplainInput(base.body).input, "2", "model-a");
  const keyModelB = explainCacheKey(
    buildExplainInput(base.body).input,
    "1",
    "model-b",
  );
  expect(keyV1).not.toBe(keyV2);
  expect(keyV1).not.toBe(keyModelB);

  const promptV2Res = await s1.explainReport(base.body, { promptVersion: "2" });
  expect(promptV2Res.cacheHit).toBe(false);
  expect(providerCalls).toBe(6);

  const modelBRes = await makeService("model-b", "1").explainReport(base.body);
  expect(modelBRes.cacheHit).toBe(false);
  expect(providerCalls).toBe(7);
});
