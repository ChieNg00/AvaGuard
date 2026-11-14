import { afterEach, expect, it, vi } from "vitest";
import {
  buildTemplateExplanation,
  canonicalReportJson,
  MAX_EXPLAIN_INPUT_BYTES,
  parseReportBody,
  reportHash,
  type ExplainInput,
  type ReportBody,
} from "@avaguard/analyzer";
import vector from "../../../fixtures/canonical-report-v1.json";
import { publication } from "../lib/publication";
import {
  createExplainRuntime,
  createLoopbackHttpExplainProvider,
  getExplainRuntime,
} from "../lib/explain-server";
import { POST } from "../app/api/explain/route";
import { scan } from "../app/actions";

const reportHook = vi.hoisted(() => ({
  overrideCompleteBody: null as ReportBody | null,
}));

vi.mock("@avaguard/analyzer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avaguard/analyzer")>();
  return {
    ...actual,
    collectEvidence: async (transport: unknown, opts: unknown) => {
      if (reportHook.overrideCompleteBody) {
        return { stubbed: true } as unknown as Awaited<
          ReturnType<typeof actual.collectEvidence>
        >;
      }
      return actual.collectEvidence(
        transport as Parameters<typeof actual.collectEvidence>[0],
        opts as Parameters<typeof actual.collectEvidence>[1],
      );
    },
    buildReport: (collection: unknown) => {
      if (reportHook.overrideCompleteBody) {
        const body = reportHook.overrideCompleteBody;
        const band =
          body.signalScore < 25
            ? ("Few signals" as const)
            : body.signalScore < 60
              ? ("Some signals" as const)
              : ("Many signals" as const);
        return {
          ...body,
          status: "complete" as const,
          band,
          reportHash: actual.reportHash(body),
          body,
        };
      }
      return actual.buildReport(
        collection as Parameters<typeof actual.buildReport>[0],
      );
    },
  };
});

afterEach(() => {
  reportHook.overrideCompleteBody = null;
  vi.unstubAllEnvs();
});

function makeValidPayload(input: ExplainInput) {
  return {
    items: input.findings.map((f) => ({
      findingId: f.id,
      citedEvidenceIds: [...f.evidenceIds],
      ...(f.allowedCheckIds.length > 0
        ? { suggestedCheckIds: [f.allowedCheckIds[0]] }
        : {}),
    })),
  };
}

it("registers trusted projections by hash, enforces TTL/LRU bounds, and refuses unknown or malformed hashes", async () => {
  const body = parseReportBody(vector);
  const hash = reportHash(body);
  let clock = 1_000_000;
  let calls = 0;

  const runtime = createExplainRuntime({
    enabled: true,
    projectionTtlMs: 5_000,
    maxProjections: 1,
    now: () => clock,
    provider: {
      model: "mock-model",
      async explain(input) {
        calls++;
        return makeValidPayload(input);
      },
    },
  });

  expect(await runtime.explainByHash("not-a-hash")).toEqual({
    ok: false,
    status: 400,
    error: "Invalid report hash.",
  });
  expect(await runtime.explainByHash(hash)).toEqual({
    ok: false,
    status: 404,
    error: "Explanation projection unavailable or expired.",
  });
  expect(calls).toBe(0);

  const registered = runtime.registerBody(body);
  expect(registered.reportHash).toBe(hash);
  expect(registered.template.provenance).toBe("template");

  const ok = await runtime.explainByHash(hash.toUpperCase());
  expect(ok.ok).toBe(true);
  if (ok.ok) {
    expect(ok.explanation.provenance).toBe("ai-assisted");
    expect(ok.explanation.reportHash).toBe(hash);
  }
  expect(calls).toBe(1);

  // Evicts older entry when maxProjections=1
  const other = structuredClone(body);
  other.blockNumber = "33";
  for (const e of other.evidence) e.snapshot.blockNumber = "33";
  const otherHash = reportHash(other);
  runtime.registerBody(other);
  expect(runtime.projectionCount()).toBe(1);
  expect((await runtime.explainByHash(hash)).ok).toBe(false);

  // Expires after TTL
  clock += 6_000;
  expect((await runtime.explainByHash(otherHash)).ok).toBe(false);
  expect(calls).toBe(1);
});

it("refuses non-loopback HTTP explain endpoints and maps provider failures cleanly", async () => {
  expect(() =>
    createLoopbackHttpExplainProvider({
      endpoint: new URL("https://generativelanguage.googleapis.com/v1"),
    }),
  ).toThrow(/loopback/);
  expect(() =>
    createLoopbackHttpExplainProvider({
      endpoint: new URL("http://example.com:8080/explain"),
    }),
  ).toThrow(/loopback/);

  const body = parseReportBody(vector);
  const hash = reportHash(body);

  let statusToReturn = 200;
  let bodyToReturn = "";
  const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
    const sent = JSON.parse(String(init?.body)) as {
      input: ExplainInput;
      model: string;
      promptVersion: string;
    };
    bodyToReturn =
      statusToReturn === 200
        ? JSON.stringify(makeValidPayload(sent.input))
        : "{}";
    if (statusToReturn === 299) {
      return new Response("x".repeat(9000), { status: 200 });
    }
    if (statusToReturn === 298) {
      return new Response("{bad", { status: 200 });
    }
    return new Response(bodyToReturn, { status: statusToReturn });
  });

  const provider = createLoopbackHttpExplainProvider({
    endpoint: new URL("http://127.0.0.1:19999/explain"),
    fetchImpl: fetchMock,
  });

  const runtime = createExplainRuntime({
    enabled: true,
    maxAttempts: 1,
    provider,
  });
  runtime.registerBody(body);

  statusToReturn = 429;
  const r429 = await runtime.explainByHash(hash);
  expect(r429.ok).toBe(true);
  if (r429.ok) {
    expect(r429.explanation.provenance).toBe("template");
    expect(r429.explanation.fallbackReason).toMatch(/rate limit/i);
  }

  statusToReturn = 503;
  const r503 = await runtime.explainByHash(hash);
  expect(r503.ok && r503.explanation.provenance).toBe("template");

  statusToReturn = 299;
  const rOversized = await runtime.explainByHash(hash);
  expect(rOversized.ok && rOversized.explanation.provenance).toBe("template");

  statusToReturn = 298;
  const rMalformed = await runtime.explainByHash(hash);
  expect(rMalformed.ok && rMalformed.explanation.provenance).toBe("template");

  statusToReturn = 200;
  const rOk = await runtime.explainByHash(hash);
  expect(rOk.ok && rOk.explanation.provenance).toBe("ai-assisted");
});

it("does not enable live AI when an ambient key exists without explicit local loopback setup", () => {
  vi.stubEnv("GEMINI_API_KEY", "ambient-key-must-be-ignored");
  vi.stubEnv("AVAGUARD_AI_ENABLED", "");
  vi.stubEnv("AVAGUARD_LOCAL_EXPLAIN_URL", "");
  const key = Symbol.for("avaguard.m6.explainRuntime");
  delete (globalThis as Record<symbol, unknown>)[key];
  expect(getExplainRuntime().isAiEnabled()).toBe(false);
});

it("enforces request size, schema, and server projection trust on POST /api/explain", async () => {
  const key = Symbol.for("avaguard.m6.explainRuntime");
  delete (globalThis as Record<symbol, unknown>)[key];

  const oversized = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: JSON.stringify({ reportHash: "0x" + "a".repeat(64), extra: "x".repeat(600) }),
    }),
  );
  expect(oversized.status).toBe(413);

  const malformed = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: "{",
    }),
  );
  expect(malformed.status).toBe(400);

  const missing = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: JSON.stringify({ reportHash: "0x" + "b".repeat(64) }),
    }),
  );
  expect(missing.status).toBe(404);

  const body = parseReportBody(vector);
  const { reportHash: registeredHash } = getExplainRuntime().registerBody(body);
  const hit = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: JSON.stringify({ reportHash: registeredHash }),
    }),
  );
  expect(hit.status).toBe(200);
  const data = (await hit.json()) as {
    ok: boolean;
    explanation: { provenance: string; reportHash: string };
  };
  expect(data.ok).toBe(true);
  expect(data.explanation.provenance).toBe("template");
  expect(data.explanation.reportHash).toBe(registeredHash);
});

it("keeps scan usable with template, export, hash, and publication intact when projected explain input exceeds 16,384 bytes", async () => {
  expect(MAX_EXPLAIN_INPUT_BYTES).toBe(16_384);

  const largeBody = structuredClone(parseReportBody(vector));
  const covGroups = [
    largeBody.coverage.checked,
    largeBody.coverage.notChecked,
    largeBody.coverage.unavailable,
    largeBody.coverage.notApplicable,
  ];
  for (let i = 0; i < 200; i++) {
    covGroups[i % 4].push({
      id: `oversized-projection-${String(i).padStart(3, "0")}-${"k".repeat(30)}`,
      reason: "Valid coverage entry pushing canonical explain projection past 16,384 bytes.",
    });
  }
  const validatedLarge = parseReportBody(largeBody);
  const expectedJson = canonicalReportJson(validatedLarge);
  const expectedHash = reportHash(validatedLarge);
  const expectedPub = publication(validatedLarge);
  const expectedTemplate = buildTemplateExplanation(validatedLarge);

  vi.stubEnv("FUJI_RPC_URL", "http://127.0.0.1:8545");
  reportHook.overrideCompleteBody = validatedLarge;

  const runtimeKey = Symbol.for("avaguard.m6.explainRuntime");
  let providerCalls = 0;
  const g = globalThis as Record<symbol, unknown>;

  // 1. AI disabled: scan succeeds, aiEnabled=false, 0 provider calls
  g[runtimeKey] = createExplainRuntime({
    enabled: false,
    provider: {
      model: "mock-model",
      async explain(input) {
        providerCalls++;
        return makeValidPayload(input);
      },
    },
  });
  const offScan = await scan(validatedLarge.address);
  expect(offScan.ok).toBe(true);
  if (!offScan.ok || offScan.data.status !== "complete") {
    throw new Error("Expected complete scan with AI disabled");
  }
  expect(offScan.data.aiEnabled).toBe(false);
  expect(offScan.data.reportHash).toBe(expectedHash);
  expect(offScan.data.body.signalScore).toBe(validatedLarge.signalScore);
  expect(canonicalReportJson(offScan.data.body)).toBe(expectedJson);
  expect(publication(offScan.data.body)).toEqual(expectedPub);
  expect(offScan.data.explanation.provenance).toBe("template");
  expect(offScan.data.explanation.overview).toBe(expectedTemplate.overview);
  expect(providerCalls).toBe(0);

  // 2. AI enabled with >16,384-byte projection: scan succeeds with concise status,
  // disables background AI request for that hash, never registers oversized projection, and makes 0 provider calls.
  g[runtimeKey] = createExplainRuntime({
    enabled: true,
    provider: {
      model: "mock-model",
      async explain(input) {
        providerCalls++;
        return makeValidPayload(input);
      },
    },
  });
  const onScan = await scan(validatedLarge.address);
  expect(onScan.ok).toBe(true);
  if (!onScan.ok || onScan.data.status !== "complete") {
    throw new Error("Expected complete scan when projection exceeds limit");
  }
  expect(onScan.data.aiEnabled).toBe(false);
  expect(onScan.data.reportHash).toBe(expectedHash);
  expect(onScan.data.body.signalScore).toBe(validatedLarge.signalScore);
  expect(canonicalReportJson(onScan.data.body)).toBe(expectedJson);
  expect(publication(onScan.data.body)).toEqual(expectedPub);
  expect(onScan.data.explanation.provenance).toBe("template");
  expect(onScan.data.explanation.fallbackReason).toMatch(/size limit|exceeds/i);
  expect(providerCalls).toBe(0);

  const apiRes = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: JSON.stringify({ reportHash: expectedHash }),
    }),
  );
  expect(apiRes.status).toBe(404);
  expect(providerCalls).toBe(0);
});

function makeTrackedStream(chunks: Uint8Array[]) {
  let index = 0;
  let pulledChunks = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (index < chunks.length) {
          pulledChunks++;
          controller.enqueue(chunks[index++]);
          return;
        }
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    stream,
    stats: () => ({
      pulledChunks,
      totalChunks: chunks.length,
      cancelled,
      stoppedEarly: pulledChunks < chunks.length,
    }),
  };
}

function splitUtf8Chunks(text: string, splitPoints: number[]) {
  const bytes = new TextEncoder().encode(text);
  const out: Uint8Array[] = [];
  let start = 0;
  for (const point of splitPoints) {
    out.push(bytes.slice(start, point));
    start = point;
  }
  out.push(bytes.slice(start));
  return { bytes, chunks: out };
}

it("enforces the 512-byte POST /api/explain limit while streaming chunks without buffering overflow", async () => {
  const body = parseReportBody(vector);
  const hash = reportHash(body);
  const runtimeKey = Symbol.for("avaguard.m6.explainRuntime");
  let providerCalls = 0;
  let lookupObserved = false;
  const baseRuntime = createExplainRuntime({
    enabled: true,
    provider: {
      model: "mock-model",
      async explain(input) {
        providerCalls++;
        return makeValidPayload(input);
      },
    },
  });
  baseRuntime.registerBody(body);
  (globalThis as Record<symbol, unknown>)[runtimeKey] = {
    isAiEnabled: () => baseRuntime.isAiEnabled(),
    registerBody: (b: ReportBody) => baseRuntime.registerBody(b),
    tryRegisterBody: (b: ReportBody) => baseRuntime.tryRegisterBody(b),
    projectionCount: () => baseRuntime.projectionCount(),
    explainByHash: (h: string) => {
      lookupObserved = true;
      return baseRuntime.explainByHash(h);
    },
  };

  // 1. Exact 512-byte whitespace-padded JSON split across multiple chunks without Content-Length -> 200
  const baseJson = JSON.stringify({ reportHash: hash });
  const exact512 = baseJson + " ".repeat(512 - baseJson.length);
  const { bytes: exactBytes, chunks: exactChunks } = splitUtf8Chunks(
    exact512,
    [17, 128, 300],
  );
  expect(exactBytes.byteLength).toBe(512);
  const trackedExact = makeTrackedStream(exactChunks);
  const exactRes = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: trackedExact.stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(exactRes.status).toBe(200);
  expect(lookupObserved).toBe(true);
  expect(providerCalls).toBe(1);

  // 2. UTF-8 multi-byte character split across chunks (<= 512 bytes) decodes intact before schema check (400, zero lookup/provider calls)
  lookupObserved = false;
  providerCalls = 0;
  const utf8Json = `{"reportHash":"${hash}","note":"🔐€"}`;
  const utf8Bytes = new TextEncoder().encode(utf8Json);
  const emojiOffset = utf8Json.indexOf("🔐");
  const preEmojiByteLen = new TextEncoder().encode(
    utf8Json.slice(0, emojiOffset),
  ).byteLength;
  const trackedUtf8 = makeTrackedStream([
    utf8Bytes.slice(0, preEmojiByteLen + 2),
    utf8Bytes.slice(preEmojiByteLen + 2),
  ]);
  const utf8Res = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: trackedUtf8.stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(utf8Res.status).toBe(400);
  expect(lookupObserved).toBe(false);
  expect(providerCalls).toBe(0);

  // 3. 513-byte stream without Content-Length stops & cancels before consuming trailing chunks -> 413, zero lookup
  const over513 = baseJson + " ".repeat(513 - baseJson.length);
  const over513Bytes = new TextEncoder().encode(over513);
  expect(over513Bytes.byteLength).toBe(513);
  const tracked513 = makeTrackedStream([
    over513Bytes.slice(0, 512),
    over513Bytes.slice(512, 513),
    new TextEncoder().encode("trailing-1"),
    new TextEncoder().encode("trailing-2"),
  ]);
  const overRes = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      body: tracked513.stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(overRes.status).toBe(413);
  expect(tracked513.stats().cancelled).toBe(true);
  expect(tracked513.stats().stoppedEarly).toBe(true);
  expect(lookupObserved).toBe(false);
  expect(providerCalls).toBe(0);

  // 4. Understated Content-Length still enforces real byte count and cancels on overflow -> 413, zero lookup
  const trackedUnderstated = makeTrackedStream([
    over513Bytes.slice(0, 256),
    over513Bytes.slice(256, 513),
    new TextEncoder().encode("extra-unconsumed-chunk"),
  ]);
  const underRes = await POST(
    new Request("http://127.0.0.1/api/explain", {
      method: "POST",
      headers: { "content-length": "100" },
      body: trackedUnderstated.stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(underRes.status).toBe(413);
  expect(trackedUnderstated.stats().cancelled).toBe(true);
  expect(trackedUnderstated.stats().stoppedEarly).toBe(true);
  expect(lookupObserved).toBe(false);
  expect(providerCalls).toBe(0);
});

it("enforces the 8,192-byte loopback provider limit while streaming chunks, avoids caching/retries, and recovers", async () => {
  const body = parseReportBody(vector);
  const hash = reportHash(body);
  let mode:
    | "exact-8192"
    | "over-8193-no-cl"
    | "over-8193-understated-cl"
    | "utf8-split"
    | "recover" = "exact-8192";
  let fetchCalls = 0;
  let lastStats = () => ({
    pulledChunks: 0,
    totalChunks: 0,
    cancelled: false,
    stoppedEarly: false,
  });

  const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
    fetchCalls++;
    const sent = JSON.parse(String(init?.body)) as { input: ExplainInput };
    const validJson = JSON.stringify(makeValidPayload(sent.input));

    if (mode === "exact-8192") {
      const padded = validJson + " ".repeat(8192 - validJson.length);
      const { bytes, chunks } = splitUtf8Chunks(padded, [120, 4096, 7000]);
      expect(bytes.byteLength).toBe(8192);
      const tracked = makeTrackedStream(chunks);
      lastStats = tracked.stats;
      return new Response(tracked.stream, { status: 200 });
    }
    if (mode === "over-8193-no-cl" || mode === "over-8193-understated-cl") {
      const padded = validJson + " ".repeat(8193 - validJson.length);
      const overBytes = new TextEncoder().encode(padded);
      expect(overBytes.byteLength).toBe(8193);
      const tracked = makeTrackedStream([
        overBytes.slice(0, 4096),
        overBytes.slice(4096, 8192),
        overBytes.slice(8192, 8193),
        new TextEncoder().encode("trailing-unconsumed-1"),
        new TextEncoder().encode("trailing-unconsumed-2"),
      ]);
      lastStats = tracked.stats;
      return new Response(tracked.stream, {
        status: 200,
        headers:
          mode === "over-8193-understated-cl"
            ? { "content-length": "500" }
            : undefined,
      });
    }
    if (mode === "utf8-split") {
      const jsonWithUtf8 = `{"items":[],"note":"€🔐"}`;
      const bytes = new TextEncoder().encode(jsonWithUtf8);
      const tracked = makeTrackedStream([
        bytes.slice(0, jsonWithUtf8.indexOf("€") + 2),
        bytes.slice(jsonWithUtf8.indexOf("€") + 2),
      ]);
      lastStats = tracked.stats;
      return new Response(tracked.stream, { status: 200 });
    }
    return new Response(validJson, { status: 200 });
  });

  const provider = createLoopbackHttpExplainProvider({
    endpoint: new URL("http://127.0.0.1:19999/explain"),
    fetchImpl: fetchMock,
  });

  // Separate runtime instances so cache hits don't skip subsequent modes, plus recovery in same runtime.
  const runtimeExact = createExplainRuntime({
    enabled: true,
    maxAttempts: 2,
    provider,
  });
  runtimeExact.registerBody(body);
  mode = "exact-8192";
  const exactRes = await runtimeExact.explainByHash(hash);
  expect(exactRes.ok && exactRes.explanation.provenance).toBe("ai-assisted");
  expect(fetchCalls).toBe(1);

  for (const overMode of [
    "over-8193-no-cl",
    "over-8193-understated-cl",
  ] as const) {
    fetchCalls = 0;
    const runtime = createExplainRuntime({
      enabled: true,
      maxAttempts: 2,
      provider,
    });
    runtime.registerBody(body);
    mode = overMode;
    const overRes = await runtime.explainByHash(hash);
    expect(overRes.ok, overMode).toBe(true);
    if (overRes.ok) {
      expect(overRes.explanation.provenance, overMode).toBe("template");
      expect(overRes.explanation.fallbackReason, overMode).toMatch(/size bounds/);
    }
    expect(lastStats().cancelled, overMode).toBe(true);
    expect(lastStats().stoppedEarly, overMode).toBe(true);
    // Oversized response must not trigger a retry attempt or enter cache.
    expect(fetchCalls, overMode).toBe(1);

    // Valid response immediately after an oversized response succeeds without stale cache interference.
    mode = "recover";
    const recovered = await runtime.explainByHash(hash);
    expect(recovered.ok && recovered.explanation.provenance, overMode).toBe(
      "ai-assisted",
    );
    expect(fetchCalls, overMode).toBe(2);
  }

  // UTF-8 split across chunks decodes cleanly within limit (non-schema note rejects safely as schema fallback)
  fetchCalls = 0;
  const runtimeUtf8 = createExplainRuntime({
    enabled: true,
    maxAttempts: 2,
    provider,
  });
  runtimeUtf8.registerBody(body);
  mode = "utf8-split";
  const utf8Res = await runtimeUtf8.explainByHash(hash);
  expect(utf8Res.ok && utf8Res.explanation.provenance).toBe("template");
  expect(
    utf8Res.ok && utf8Res.explanation.fallbackReason,
  ).toMatch(/evidence or schema validation/);
});
