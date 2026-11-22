import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  MAX_EXPLAIN_OUTPUT_BYTES,
  type ExplainSharedCache,
} from "@avaguard/analyzer";

export const DEFAULT_REDIS_CACHE_TTL_SECONDS = 86_400;
export const DEFAULT_REDIS_OP_TIMEOUT_MS = 1_500;
export const DEFAULT_RATE_LIMIT_PER_MIN = 10;
export const DEFAULT_RATE_LIMIT_GLOBAL_PER_MIN = 60;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const EXPLAIN_RATE_LIMIT_FALLBACK_REASON =
  "AI rate limit reached; showing template.";

const MIN_CACHE_TTL_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 604_800;
const MAX_LOCAL_RATE_COUNTERS = 1_024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const utf8Encoder = new TextEncoder();

export interface UpstashRedisClientLike {
  get(key: string): Promise<unknown>;
  set(
    key: string,
    value: string,
    opts?: { ex: number },
  ): Promise<unknown>;
  eval?(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<unknown>;
  incr?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<unknown>;
}

export type ExplainRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  scope: "ip" | "global";
};

export interface ExplainRateLimiter {
  check(clientIp?: string): Promise<ExplainRateLimitResult>;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const boundedMs = Math.max(10, timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Redis operation timed out."));
        }, boundedMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Validates credentials and constructs an Upstash REST Redis client with
 * automatic deserialization and multi-attempt retries disabled so timeout
 * and size guards remain deterministic on serverless functions.
 */
export function createUpstashRedisClient(options: {
  url: string;
  token: string;
}): UpstashRedisClientLike {
  const trimmedUrl = options.url.trim();
  const trimmedToken = options.token.trim();
  if (!trimmedUrl) {
    throw new Error("Upstash Redis REST URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    throw new Error("Invalid Upstash Redis REST URL.");
  }

  const isLoopbackHttp =
    parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLoopbackHttp) {
    throw new Error(
      "Upstash Redis REST URL must use https or loopback http.",
    );
  }

  if (!trimmedToken) {
    throw new Error("Upstash Redis REST token is required.");
  }

  return new Redis({
    url: parsed.href,
    token: trimmedToken,
    automaticDeserialization: false,
    retry: false,
  });
}

/**
 * Wraps Upstash Redis as a bounded L2 shared cache for raw AI provider payloads.
 * Callers re-validate all returned values with `validateAiResponse` against their
 * trusted server `ExplainInput`, so Redis stays untrusted storage.
 */
export function createUpstashExplainCache(options: {
  redis: UpstashRedisClientLike;
  ttlSeconds?: number;
  timeoutMs?: number;
  keyPrefix?: string;
}): ExplainSharedCache {
  const rawTtl = options.ttlSeconds ?? DEFAULT_REDIS_CACHE_TTL_SECONDS;
  const ttlSeconds = Number.isFinite(rawTtl)
    ? Math.min(
        MAX_CACHE_TTL_SECONDS,
        Math.max(MIN_CACHE_TTL_SECONDS, Math.trunc(rawTtl)),
      )
    : DEFAULT_REDIS_CACHE_TTL_SECONDS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REDIS_OP_TIMEOUT_MS;
  const keyPrefix = options.keyPrefix ?? "avaguard:explain:cache:v1:";

  return {
    async get(key: string): Promise<unknown | null> {
      try {
        const stored = await withTimeout(
          options.redis.get(keyPrefix + key),
          timeoutMs,
        );
        if (stored === null || stored === undefined) {
          return null;
        }
        if (typeof stored === "string") {
          if (
            utf8Encoder.encode(stored).byteLength > MAX_EXPLAIN_OUTPUT_BYTES
          ) {
            return null;
          }
          try {
            return JSON.parse(stored) as unknown;
          } catch {
            return null;
          }
        }
        if (typeof stored === "object") {
          try {
            const serialized = JSON.stringify(stored);
            if (
              !serialized ||
              utf8Encoder.encode(serialized).byteLength > MAX_EXPLAIN_OUTPUT_BYTES
            ) {
              return null;
            }
            return stored;
          } catch {
            return null;
          }
        }
        return null;
      } catch {
        return null;
      }
    },

    async set(key: string, rawPayload: unknown): Promise<void> {
      let serialized: string;
      try {
        serialized = JSON.stringify(rawPayload);
      } catch {
        return;
      }
      if (
        !serialized ||
        utf8Encoder.encode(serialized).byteLength > MAX_EXPLAIN_OUTPUT_BYTES
      ) {
        return;
      }
      try {
        await withTimeout(
          options.redis.set(keyPrefix + key, serialized, { ex: ttlSeconds }),
          timeoutMs,
        );
      } catch {
        // Ignore L2 cache write failures so valid explanations still return.
      }
    },
  };
}

/**
 * Extracts the client IP from trusted reverse-proxy headers (Vercel / standard
 * forwarded headers), defaulting to loopback when absent in local dev or tests.
 */
export function extractClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];
  for (const header of candidates) {
    if (!header) continue;
    const first = header.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 128).toLowerCase();
    }
  }
  return "127.0.0.1";
}

/**
 * Hashes a client IP with a server secret/salt so Redis rate-limit keys never
 * persist raw client IP addresses.
 */
export function hashClientIp(rawIp: string, salt?: string): string {
  const normalized = rawIp.trim().toLowerCase() || "127.0.0.1";
  return createHash("sha256")
    .update(`avaguard-rl-v1:${salt ?? ""}:${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

const RATE_LIMIT_LUA_SCRIPT = `
local ipCount = redis.call('INCR', KEYS[1])
if ipCount == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
local ipLimit = tonumber(ARGV[2])
if ipLimit > 0 and ipCount > ipLimit then
  local globalCount = tonumber(redis.call('GET', KEYS[2]) or '0')
  return { ipCount, globalCount }
end
local globalCount = redis.call('INCR', KEYS[2])
if globalCount == 1 then
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[1]))
end
return { ipCount, globalCount }
`.trim();

/**
 * Creates a two-tier fixed-window rate limiter (per-IP + global budget) backed by
 * Upstash Redis when available, with automatic fallback to bounded in-memory counters
 * when Redis is unconfigured, times out, or errors.
 */
export function createExplainRateLimiter(options: {
  redis?: UpstashRedisClientLike | null;
  ipLimit?: number;
  globalLimit?: number;
  windowMs?: number;
  timeoutMs?: number;
  salt?: string;
  now?: () => number;
  keyPrefix?: string;
} = {}): ExplainRateLimiter {
  const ipLimit = Math.max(
    1,
    Math.trunc(options.ipLimit ?? DEFAULT_RATE_LIMIT_PER_MIN),
  );
  const rawGlobal = options.globalLimit ?? DEFAULT_RATE_LIMIT_GLOBAL_PER_MIN;
  const globalLimit = Number.isFinite(rawGlobal) ? Math.trunc(rawGlobal) : 0;
  const windowMs = Math.max(
    1_000,
    Math.trunc(options.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS),
  );
  const windowSec = Math.max(1, Math.ceil(windowMs / 1_000));
  const timeoutMs = options.timeoutMs ?? DEFAULT_REDIS_OP_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const keyPrefix = options.keyPrefix ?? "avaguard:explain:rl:v1:";

  const localCounters = new Map<string, { count: number; resetMs: number }>();

  function pruneLocalCounters(currentMs: number) {
    for (const [k, entry] of localCounters.entries()) {
      if (currentMs >= entry.resetMs) {
        localCounters.delete(k);
      }
    }
    while (localCounters.size >= MAX_LOCAL_RATE_COUNTERS) {
      const oldest = localCounters.keys().next().value;
      if (oldest === undefined) break;
      localCounters.delete(oldest);
    }
  }

  function incrementLocal(key: string, currentMs: number, resetMs: number): number {
    const existing = localCounters.get(key);
    if (!existing || currentMs >= existing.resetMs) {
      pruneLocalCounters(currentMs);
      localCounters.set(key, { count: 1, resetMs });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  function readLocal(key: string, currentMs: number): number {
    const existing = localCounters.get(key);
    if (!existing || currentMs >= existing.resetMs) return 0;
    return existing.count;
  }

  function evaluateCounts(
    ipCount: number,
    globalCount: number,
    resetMs: number,
  ): ExplainRateLimitResult {
    const ipExceeded = ipCount > ipLimit;
    const globalExceeded = globalLimit > 0 && globalCount > globalLimit;
    if (globalExceeded && !ipExceeded) {
      return {
        allowed: false,
        limit: globalLimit,
        remaining: 0,
        resetMs,
        scope: "global",
      };
    }
    return {
      allowed: !ipExceeded && !globalExceeded,
      limit: ipLimit,
      remaining: Math.max(0, ipLimit - ipCount),
      resetMs,
      scope: "ip",
    };
  }

  async function incrementViaRedis(
    ipKey: string,
    globalKey: string,
  ): Promise<{ ipCount: number; globalCount: number }> {
    const redis = options.redis!;
    if (typeof redis.eval === "function") {
      const result = await withTimeout(
        redis.eval(RATE_LIMIT_LUA_SCRIPT, [ipKey, globalKey], [
          windowSec,
          ipLimit,
        ]),
        timeoutMs,
      );
      if (!Array.isArray(result) || result.length < 2) {
        throw new Error("Unexpected Redis rate-limit response.");
      }
      const ipCount = Number(result[0]);
      const globalCount = Number(result[1]);
      if (!Number.isFinite(ipCount) || !Number.isFinite(globalCount)) {
        throw new Error("Non-numeric Redis rate-limit counters.");
      }
      return { ipCount, globalCount };
    }

    if (typeof redis.incr !== "function") {
      throw new Error("Redis client lacks both eval and incr.");
    }

    const ipCount = await withTimeout(redis.incr(ipKey), timeoutMs);
    if (ipCount === 1 && typeof redis.expire === "function") {
      await withTimeout(redis.expire(ipKey, windowSec), timeoutMs);
    }
    if (ipCount > ipLimit) {
      const rawGlobalCount = await withTimeout(redis.get(globalKey), timeoutMs);
      const parsedGlobal = Number(rawGlobalCount ?? 0);
      return {
        ipCount,
        globalCount: Number.isFinite(parsedGlobal) ? parsedGlobal : 0,
      };
    }
    const globalCount = await withTimeout(redis.incr(globalKey), timeoutMs);
    if (globalCount === 1 && typeof redis.expire === "function") {
      await withTimeout(redis.expire(globalKey, windowSec), timeoutMs);
    }
    return { ipCount, globalCount };
  }

  return {
    async check(clientIp = "127.0.0.1"): Promise<ExplainRateLimitResult> {
      const currentMs = now();
      const bucket = Math.floor(currentMs / windowMs);
      const resetMs = (bucket + 1) * windowMs;
      const ipHash = hashClientIp(clientIp, options.salt);
      const ipKey = `${keyPrefix}ip:${ipHash}:${bucket}`;
      const globalKey = `${keyPrefix}global:${bucket}`;

      if (options.redis) {
        try {
          const { ipCount, globalCount } = await incrementViaRedis(
            ipKey,
            globalKey,
          );
          return evaluateCounts(ipCount, globalCount, resetMs);
        } catch {
          // Fall back cleanly to process-local counters if Redis fails or times out.
        }
      }

      const ipCount = incrementLocal(ipKey, currentMs, resetMs);
      const globalCount =
        ipCount > ipLimit
          ? readLocal(globalKey, currentMs)
          : incrementLocal(globalKey, currentMs, resetMs);
      return evaluateCounts(ipCount, globalCount, resetMs);
    },
  };
}
