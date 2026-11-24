import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExplainInput,
  canonicalReportJson,
  EXPLAIN_PROMPT_VERSION_V3,
  explainCacheKey,
  parseReportBody,
  reportHash,
  type ExplainInput,
  type ExplainLanguage,
  type ReportBody,
} from "@avaguard/analyzer";
import vector from "../../../fixtures/canonical-report-v1.json";
import { POST } from "../app/api/explain/route";
import {
  createExplainRateLimiter,
  createUpstashExplainCache,
  createUpstashRedisClient,
  DEFAULT_RATE_LIMIT_GLOBAL_PER_MIN,
  DEFAULT_RATE_LIMIT_PER_MIN,
  DEFAULT_REDIS_CACHE_TTL_SECONDS,
  EXPLAIN_RATE_LIMIT_FALLBACK_REASON,
  extractClientIp,
  hashClientIp,
  type UpstashRedisClientLike,
} from "../lib/explain-redis";
import { createExplainRuntime, getExplainRuntime } from "../lib/explain-server";
import { publication } from "../lib/publication";

const RUNTIME_KEY = Symbol.for("avaguard.m6.explainRuntime");
const STRONG_SECRET = "0123456789abcdef0123456789abcdef";

function clearExplainRuntime() {
  delete (globalThis as Record<symbol, unknown>)[RUNTIME_KEY];
}

afterEach(() => {
  clearExplainRuntime();
  vi.unstubAllEnvs();
});

function cloneWithBlock(base: ReportBody, blockNumber: string): ReportBody {
  const copy = structuredClone(base);
  copy.blockNumber = blockNumber;
  for (const e of copy.evidence) {
    e.snapshot.blockNumber = blockNumber;
  }
  return parseReportBody(copy);
}

function makeValidV3Selection(
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
          ? `Phát hiện tín hiệu ${f.id} cần đối chiếu bằng chứng đi kèm.`
          : `Observed signal ${f.id} requires evidence review.`,
    })),
  };
}

class InMemoryFakeRedis implements UpstashRedisClientLike {
  readonly kv = new Map<string, { value: string; ex?: number }>();
  readonly counters = new Map<string, { count: number; ttlSec?: number }>();
  readonly setCalls: Array<{ key: string; value: string; ex?: number }> = [];

  async get(key: string): Promise<unknown> {
    if (this.counters.has(key)) {
      return String(this.counters.get(key)!.count);
    }
    return this.kv.get(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    opts?: { ex: number },
  ): Promise<"OK"> {
    this.kv.set(key, { value, ex: opts?.ex });
    this.setCalls.push({ key, value, ex: opts?.ex });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const existing = this.counters.get(key);
    const next = (existing?.count ?? 0) + 1;
    this.counters.set(key, { count: next, ttlSec: existing?.ttlSec });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const existing = this.counters.get(key);
    if (!existing) return 0;
    existing.ttlSec = seconds;
    return 1;
  }

  async eval(
    _script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<[number, number]> {
    const [ipKey, globalKey] = keys;
    const windowSec = Number(args[0]);
    const ipLimit = Number(args[1]);
    const ipCount = await this.incr(ipKey);
    if (ipCount === 1) {
      await this.expire(ipKey, windowSec);
    }
    if (ipLimit > 0 && ipCount > ipLimit) {
      const globalCount = this.counters.get(globalKey)?.count ?? 0;
      return [ipCount, globalCount];
    }
    const globalCount = await this.incr(globalKey);
    if (globalCount === 1) {
      await this.expire(globalKey, windowSec);
    }
    return [ipCount, globalCount];
  }
}

describe("Upstash Redis L2 shared cache & rate limiting", () => {
  it("shares EN and VI Prompt v3 explanations across isolated instances via L2 Redis while preserving deterministic outputs", async () => {
    const body = parseReportBody(vector);
    const hash = reportHash(body);
    const beforeJson = canonicalReportJson(body);
    const beforePub = publication(body);
    const redis = new InMemoryFakeRedis();

    let runtimeACalls = 0;
    const runtimeA = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      sharedCache: createUpstashExplainCache({ redis }),
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          runtimeACalls++;
          return makeValidV3Selection(input, opts.language ?? "en");
        },
      },
    });

    const reg = runtimeA.registerBody(body);
    expect(reg.explainToken).toBeTruthy();

    const enMiss = await runtimeA.explainByToken(
      hash,
      reg.explainToken!,
      "en",
    );
    expect(enMiss.ok).toBe(true);
    if (!enMiss.ok) throw new Error("Expected EN success");
    expect(enMiss.explanation.provenance).toBe("ai-assisted");
    expect(enMiss.explanation.cached).toBe(false);
    expect(enMiss.explanation.language).toBe("en");

    const viMiss = await runtimeA.explainByToken(
      hash,
      reg.explainToken!,
      "vi",
    );
    expect(viMiss.ok).toBe(true);
    if (!viMiss.ok) throw new Error("Expected VI success");
    expect(viMiss.explanation.provenance).toBe("ai-assisted");
    expect(viMiss.explanation.cached).toBe(false);
    expect(viMiss.explanation.language).toBe("vi");
    expect(runtimeACalls).toBe(2);

    expect(redis.setCalls).toHaveLength(2);
    expect(redis.setCalls[0].ex).toBe(86_400);
    expect(redis.setCalls[0].key).toMatch(/^avaguard:explain:cache:v1:/);
    expect(redis.setCalls[0].key).not.toBe(redis.setCalls[1].key);

    // Isolated instance B has an empty L1 in-memory cache and only shares Redis L2.
    let runtimeBCalls = 0;
    const runtimeB = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      sharedCache: createUpstashExplainCache({ redis }),
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain() {
          runtimeBCalls++;
          throw new Error("L2 Redis hit must skip provider");
        },
      },
    });

    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = runtimeB;

    const enRes = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        body: JSON.stringify({
          reportHash: hash,
          explainToken: reg.explainToken,
          language: "en",
        }),
      }),
    );
    expect(enRes.status).toBe(200);
    const enJson = (await enRes.json()) as {
      ok: boolean;
      explanation: {
        provenance: string;
        cached?: boolean;
        language?: string;
        aiSummary?: string;
      };
    };
    expect(enJson.ok).toBe(true);
    expect(enJson.explanation.provenance).toBe("ai-assisted");
    expect(enJson.explanation.cached).toBe(true);
    expect(enJson.explanation.language).toBe("en");
    expect(enJson.explanation.aiSummary).toContain(String(body.signalScore));

    const viRes = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        body: JSON.stringify({
          reportHash: hash,
          explainToken: reg.explainToken,
          language: "vi",
        }),
      }),
    );
    expect(viRes.status).toBe(200);
    const viJson = (await viRes.json()) as {
      ok: boolean;
      explanation: {
        provenance: string;
        cached?: boolean;
        language?: string;
        aiSummary?: string;
      };
    };
    expect(viJson.ok).toBe(true);
    expect(viJson.explanation.provenance).toBe("ai-assisted");
    expect(viJson.explanation.cached).toBe(true);
    expect(viJson.explanation.language).toBe("vi");
    expect(viJson.explanation.aiSummary).toContain("Báo cáo ghi nhận");

    expect(runtimeBCalls).toBe(0);
    expect(canonicalReportJson(body)).toBe(beforeJson);
    expect(reportHash(body)).toBe(hash);
    expect(publication(body)).toEqual(beforePub);
  });

  it("rejects untrusted or poisoned Redis cache entries via local validation before recovery or fallback", async () => {
    const body = parseReportBody(vector);
    const hash = reportHash(body);
    const { input } = buildExplainInput(body);
    const cacheKey = explainCacheKey(
      input,
      EXPLAIN_PROMPT_VERSION_V3,
      "gemini-3.5-flash-lite",
      "vi",
    );

    const valid = makeValidV3Selection(input, "vi");
    const foreignEvidenceId =
      input.findings[0].evidenceIds[0] === "metadata-name"
        ? "block-header"
        : "metadata-name";

    const poisonedPayloads = [
      {
        name: "tampered findingId",
        marker: "R-INVENTED",
        payload: {
          ...valid,
          items: [{ ...valid.items[0], findingId: "R-INVENTED" }],
        },
      },
      {
        name: "cross-finding evidence citation",
        marker: foreignEvidenceId,
        payload: {
          ...valid,
          items: [
            {
              ...valid.items[0],
              citedEvidenceIds: [foreignEvidenceId],
            },
            ...valid.items.slice(1),
          ],
        },
      },
      {
        name: "mismatched signalScore citation",
        marker: "99 / 100",
        payload: {
          ...valid,
          narrativeOverview: "Báo cáo ghi nhận điểm tín hiệu 99 / 100 giả mạo.",
        },
      },
      {
        name: "disallowed Vietnamese safety claim",
        marker: "hoan toan an toan",
        payload: {
          ...valid,
          narrativeOverview: "Hop dong nay hoan toan an toan va khong co loi.",
        },
      },
    ];

    for (const testCase of poisonedPayloads) {
      const redis = new InMemoryFakeRedis();
      await redis.set(
        `avaguard:explain:cache:v1:${cacheKey}`,
        JSON.stringify(testCase.payload),
        { ex: 60 },
      );

      // 1. If provider also fails, runtimeB rejects poisoned Redis data and returns template safely.
      const failingRuntime = createExplainRuntime({
        enabled: true,
        promptVersion: EXPLAIN_PROMPT_VERSION_V3,
        tokenSecret: STRONG_SECRET,
        sharedCache: createUpstashExplainCache({ redis }),
        maxAttempts: 1,
        provider: {
          model: "gemini-3.5-flash-lite",
          async explain() {
            throw new Error("provider outage");
          },
        },
      });
      const reg = failingRuntime.registerBody(body);
      const fallbackRes = await failingRuntime.explainByToken(
        hash,
        reg.explainToken!,
        "vi",
      );
      expect(fallbackRes.ok, testCase.name).toBe(true);
      if (!fallbackRes.ok) throw new Error("Expected template fallback");
      expect(fallbackRes.explanation.provenance, testCase.name).toBe(
        "template",
      );
      expect(JSON.stringify(fallbackRes.explanation), testCase.name).not.toContain(
        testCase.marker,
      );

      // 2. If provider succeeds, runtimeB discards poisoned Redis entry and heals cache with valid response.
      let recoverCalls = 0;
      const recoveringRuntime = createExplainRuntime({
        enabled: true,
        promptVersion: EXPLAIN_PROMPT_VERSION_V3,
        tokenSecret: STRONG_SECRET,
        sharedCache: createUpstashExplainCache({ redis }),
        provider: {
          model: "gemini-3.5-flash-lite",
          async explain(reqInput, opts) {
            recoverCalls++;
            return makeValidV3Selection(reqInput, opts.language ?? "en");
          },
        },
      });
      const recovered = await recoveringRuntime.explainByToken(
        hash,
        reg.explainToken!,
        "vi",
      );
      expect(recovered.ok, testCase.name).toBe(true);
      if (!recovered.ok) throw new Error("Expected recovered AI response");
      expect(recoverCalls, testCase.name).toBe(1);
      expect(recovered.explanation.provenance, testCase.name).toBe(
        "ai-assisted",
      );
      expect(recovered.explanation.cached, testCase.name).toBe(false);
      expect(JSON.stringify(recovered.explanation), testCase.name).not.toContain(
        testCase.marker,
      );
    }
  });

  it("checks cache before rate limit, enforces per-IP and global quotas, and sets X-RateLimit headers", async () => {
    const base = parseReportBody(vector);
    const body1 = cloneWithBlock(base, "101");
    const body2 = cloneWithBlock(base, "102");
    const body3 = cloneWithBlock(base, "103");
    const body4 = cloneWithBlock(base, "104");

    const redis = new InMemoryFakeRedis();
    let clockMs = 1_200_000;
    let providerCalls = 0;

    const runtime = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      tokenSecret: STRONG_SECRET,
      sharedCache: createUpstashExplainCache({ redis }),
      rateLimiter: createExplainRateLimiter({
        redis,
        ipLimit: 2,
        globalLimit: 3,
        windowMs: 60_000,
        salt: STRONG_SECRET,
        now: () => clockMs,
      }),
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          providerCalls++;
          return makeValidV3Selection(input, opts.language ?? "en");
        },
      },
    });
    (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = runtime;

    const r1 = runtime.registerBody(body1);
    const r2 = runtime.registerBody(body2);
    const r3 = runtime.registerBody(body3);
    const r4 = runtime.registerBody(body4);

    // 1. IP A miss #1 -> allowed (remaining 1/2), global 1/3
    const res1 = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          reportHash: r1.reportHash,
          explainToken: r1.explainToken,
          language: "en",
        }),
      }),
    );
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(res1.headers.get("X-RateLimit-Reset")).toBe("1260");
    expect(res1.headers.get("Retry-After")).toBeNull();
    expect(providerCalls).toBe(1);

    // 2. IP A repeat of body1 -> cache hit BEFORE rate limiter -> 0 provider calls, quota unchanged!
    const cachedRepeat = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          reportHash: r1.reportHash,
          explainToken: r1.explainToken,
          language: "en",
        }),
      }),
    );
    expect(cachedRepeat.status).toBe(200);
    const cachedJson = (await cachedRepeat.json()) as {
      explanation: { provenance: string; cached?: boolean };
    };
    expect(cachedJson.explanation.provenance).toBe("ai-assisted");
    expect(cachedJson.explanation.cached).toBe(true);
    expect(providerCalls).toBe(1);

    // 3. IP A miss #2 (body2) -> allowed (remaining 0/2), global 2/3
    const res2 = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          reportHash: r2.reportHash,
          explainToken: r2.explainToken,
          language: "en",
        }),
      }),
    );
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(providerCalls).toBe(2);

    // 4. IP A miss #3 (body3) -> blocked by per-IP quota -> template fallback + Retry-After, 0 extra provider calls
    const res3Blocked = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          reportHash: r3.reportHash,
          explainToken: r3.explainToken,
          language: "en",
        }),
      }),
    );
    expect(res3Blocked.status).toBe(200);
    expect(res3Blocked.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(res3Blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(res3Blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    const blockedIpJson = (await res3Blocked.json()) as {
      explanation: { provenance: string; fallbackReason?: string };
    };
    expect(blockedIpJson.explanation.provenance).toBe("template");
    expect(blockedIpJson.explanation.fallbackReason).toBe(
      EXPLAIN_RATE_LIMIT_FALLBACK_REASON,
    );
    expect(providerCalls).toBe(2);

    // 5. IP B can still miss body3 because spam from IP A did NOT consume global slot #3!
    const resIpB = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.20, 10.0.0.1" },
        body: JSON.stringify({
          reportHash: r3.reportHash,
          explainToken: r3.explainToken,
          language: "en",
        }),
      }),
    );
    expect(resIpB.status).toBe(200);
    const ipBJson = (await resIpB.json()) as {
      explanation: { provenance: string };
    };
    expect(ipBJson.explanation.provenance).toBe("ai-assisted");
    expect(providerCalls).toBe(3);

    // 6. IP C tries uncached body4 -> blocked by global limit (3/3 exhausted)
    const resGlobalBlocked = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.30" },
        body: JSON.stringify({
          reportHash: r4.reportHash,
          explainToken: r4.explainToken,
          language: "en",
        }),
      }),
    );
    expect(resGlobalBlocked.status).toBe(200);
    expect(resGlobalBlocked.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(resGlobalBlocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(resGlobalBlocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    const globalBlockedJson = (await resGlobalBlocked.json()) as {
      explanation: { provenance: string; fallbackReason?: string };
    };
    expect(globalBlockedJson.explanation.provenance).toBe("template");
    expect(globalBlockedJson.explanation.fallbackReason).toBe(
      EXPLAIN_RATE_LIMIT_FALLBACK_REASON,
    );
    expect(providerCalls).toBe(3);

    // 7. IP C reading cached body3 still succeeds despite global rate-limit exhaustion!
    const resCachedDespiteLimit = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.30" },
        body: JSON.stringify({
          reportHash: r3.reportHash,
          explainToken: r3.explainToken,
          language: "en",
        }),
      }),
    );
    expect(resCachedDespiteLimit.status).toBe(200);
    const cachedBypassJson = (await resCachedDespiteLimit.json()) as {
      explanation: { provenance: string; cached?: boolean };
    };
    expect(cachedBypassJson.explanation.provenance).toBe("ai-assisted");
    expect(cachedBypassJson.explanation.cached).toBe(true);
    expect(providerCalls).toBe(3);

    // 8. Advancing into next fixed window resets quota.
    clockMs += 60_000;
    const resNextWindow = await POST(
      new Request("https://ava-guard.example/api/explain", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.30" },
        body: JSON.stringify({
          reportHash: r4.reportHash,
          explainToken: r4.explainToken,
          language: "en",
        }),
      }),
    );
    expect(resNextWindow.status).toBe(200);
    const nextWindowJson = (await resNextWindow.json()) as {
      explanation: { provenance: string };
    };
    expect(nextWindowJson.explanation.provenance).toBe("ai-assisted");
    expect(providerCalls).toBe(4);
  });

  it("hashes client IPs before storing Redis keys and falls back gracefully when Redis throws or times out", async () => {
    const body = parseReportBody(vector);
    const rawIp = "198.51.100.77";
    const redis = new InMemoryFakeRedis();
    const limiter = createExplainRateLimiter({
      redis,
      ipLimit: 5,
      globalLimit: 10,
      salt: STRONG_SECRET,
    });
    await limiter.check(rawIp);

    const counterKeys = [...redis.counters.keys()];
    expect(counterKeys.length).toBe(2);
    for (const key of counterKeys) {
      expect(key).not.toContain(rawIp);
      expect(key).toMatch(
        /^avaguard:explain:rl:v1:(?:ip:[0-9a-f]{32}|global):\d+$/,
      );
    }
    expect(hashClientIp(rawIp, STRONG_SECRET)).not.toBe(
      hashClientIp(rawIp, "different-secret-0123456789abcdef"),
    );

    const req = new Request("https://ava-guard.example/api/explain", {
      headers: {
        "x-forwarded-for": "198.51.100.77, 10.0.0.2",
        "x-real-ip": "10.0.0.2",
      },
    });
    expect(extractClientIp(req)).toBe("198.51.100.77");

    // Faulty/hanging Redis must never crash cache or bypass rate-limiting protections.
    const hangingRedis: UpstashRedisClientLike = {
      async get() {
        throw new Error("ECONNRESET");
      },
      async set() {
        return new Promise(() => {});
      },
      async eval() {
        return new Promise(() => {});
      },
    };

    const resilientCache = createUpstashExplainCache({
      redis: hangingRedis,
      timeoutMs: 25,
    });
    const resilientLimiter = createExplainRateLimiter({
      redis: hangingRedis,
      timeoutMs: 25,
      ipLimit: 1,
      globalLimit: 5,
    });

    let calls = 0;
    const runtime = createExplainRuntime({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      sharedCache: resilientCache,
      rateLimiter: resilientLimiter,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          calls++;
          return makeValidV3Selection(input, opts.language ?? "en");
        },
      },
    });

    const reg1 = runtime.registerBody(body);
    const first = await runtime.explainByHash(reg1.reportHash, "en", {
      clientIp: rawIp,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Expected first call to succeed");
    expect(first.explanation.provenance).toBe("ai-assisted");
    expect(calls).toBe(1);

    const body2 = cloneWithBlock(body, "202");
    const reg2 = runtime.registerBody(body2);
    const second = await runtime.explainByHash(reg2.reportHash, "en", {
      clientIp: rawIp,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("Expected second call to rate limit");
    expect(second.explanation.provenance).toBe("template");
    expect(second.explanation.fallbackReason).toBe(
      EXPLAIN_RATE_LIMIT_FALLBACK_REASON,
    );
    expect(calls).toBe(1);
  });

  it("configures Redis from UPSTASH_REDIS_REST_* or KV_REST_API_* env vars, exposes free-tier quota defaults, and rejects invalid Redis URLs safely", async () => {
    expect(DEFAULT_REDIS_CACHE_TTL_SECONDS).toBe(86_400);
    expect(DEFAULT_RATE_LIMIT_PER_MIN).toBe(6);
    expect(DEFAULT_RATE_LIMIT_GLOBAL_PER_MIN).toBe(15);

    const defaultLimitResult =
      await createExplainRateLimiter().check("203.0.113.99");
    expect(defaultLimitResult).toMatchObject({
      allowed: true,
      limit: 6,
      remaining: 5,
      scope: "ip",
    });

    expect(() =>
      createUpstashRedisClient({
        url: "http://untrusted-redis.example.com",
        token: "secret-token",
      }),
    ).toThrow(/https/i);
    expect(() =>
      createUpstashRedisClient({
        url: "https://example.upstash.io",
        token: "   ",
      }),
    ).toThrow(/token/i);
    expect(() =>
      createUpstashRedisClient({
        url: "http://127.0.0.1:8079",
        token: "local-test-token",
      }),
    ).not.toThrow();

    vi.stubEnv("AVAGUARD_AI_ENABLED", "1");
    vi.stubEnv("AVAGUARD_AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.stubEnv("AVAGUARD_AI_CACHE_TTL_SECONDS", "3600");
    vi.stubEnv("AVAGUARD_AI_RATELIMIT_PER_MIN", "5");
    vi.stubEnv("AVAGUARD_AI_RATELIMIT_GLOBAL_PER_MIN", "30");

    clearExplainRuntime();
    expect(getExplainRuntime().isAiEnabled()).toBe(true);

    // Fallback to Vercel KV legacy env var names
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "https://kv-fallback.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    clearExplainRuntime();
    expect(getExplainRuntime().isAiEnabled()).toBe(true);

    // Invalid Redis URL fails closed for Redis without crashing runtime
    vi.stubEnv("KV_REST_API_URL", "http://public-plain-http.example.com");
    clearExplainRuntime();
    expect(getExplainRuntime().isAiEnabled()).toBe(true);
  });
});
