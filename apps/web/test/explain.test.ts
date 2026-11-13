import { afterEach, expect, it, vi } from "vitest";
import { parseReportBody, reportHash, type ExplainInput } from "@avaguard/analyzer";
import vector from "../../../fixtures/canonical-report-v1.json";
import {
  createExplainRuntime,
  createLoopbackHttpExplainProvider,
  getExplainRuntime,
} from "../lib/explain-server";
import { POST } from "../app/api/explain/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeValidPayload(input: ExplainInput, tag = "web") {
  return {
    overview: `Signal score is ${input.signalScore} / 100 (${input.band}) [${tag}].`,
    items: input.findings.map((f) => ({
      findingId: f.id,
      citedEvidenceIds: [...f.evidenceIds],
      summary: `${f.id} observed via ${f.evidenceIds.join(", ")} [${tag}]; access control unknown.`,
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
        return makeValidPayload(input, "trusted");
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
        ? JSON.stringify(makeValidPayload(sent.input, "loopback"))
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
