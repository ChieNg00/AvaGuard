import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildExplainInput,
  buildTemplateExplanationFromInput,
  canonicalExplainInputJson,
  createExplainService,
  EXPLAIN_PROMPT_VERSION,
  EXPLAIN_PROMPT_VERSION_V3,
  explainInputSchema,
  ExplainInputError,
  ExplainProviderError,
  hashSchema,
  MAX_EXPLAIN_INPUT_BYTES,
  MAX_EXPLAIN_OUTPUT_BYTES,
  type ExplainInput,
  type ExplainLanguage,
  type ExplainProvider,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import { BoundedReadError, readBoundedJson } from "./bounded-read";
import {
  createGeminiExplainProvider,
  DEFAULT_GEMINI_EXPLAIN_MODEL,
  GEMINI_MODEL_PATTERN,
} from "./gemini-explain-provider";

const PROJECTION_TTL_MS = 10 * 60 * 1000;
const MAX_PROJECTIONS = 64;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

export const MIN_EXPLAIN_SECRET_LENGTH = 32;
export const MAX_HASH_REQUEST_BYTES = 512;
export const MAX_TOKEN_REQUEST_BYTES = 24_576;
export const GEMINI_REQUEST_TIMEOUT_MS = 18_000;
export const GEMINI_DEADLINE_MS = 25_000;

const MAX_EXPLAIN_TOKEN_CHARS = 24_000;
const MAX_TOKEN_PAYLOAD_BYTES = MAX_EXPLAIN_INPUT_BYTES + 256;
const EXPLAIN_TOKEN_PATTERN = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;
const utf8Encoder = new TextEncoder();

type StoredProjection = {
  input: ExplainInput;
  template: ReportExplanation;
  createdAt: number;
};

export type ExplainRuntimeConfig = {
  enabled: boolean;
  provider: ExplainProvider | null;
  tokenSecret?: string | null;
  promptVersion?: string;
  requestTimeoutMs?: number;
  deadlineMs?: number;
  maxAttempts?: number;
  projectionTtlMs?: number;
  maxProjections?: number;
  now?: () => number;
};

/**
 * Signs a bounded, server-projected ExplainInput with HMAC-SHA256 for stateless
 * serverless execution across isolated route/action invocations.
 */
export function signExplainToken(
  input: ExplainInput,
  options: { secret: string; exp: number },
): string {
  if (options.secret.length < MIN_EXPLAIN_SECRET_LENGTH) {
    throw new Error(
      `Explain secret must be at least ${MIN_EXPLAIN_SECRET_LENGTH} characters.`,
    );
  }
  if (!Number.isSafeInteger(options.exp)) {
    throw new Error("Explain token expiration must be a safe integer.");
  }
  const validated = explainInputSchema.parse(input);
  const payloadB64 = Buffer.from(
    JSON.stringify({ v: 1, exp: options.exp, input: validated }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", options.secret)
    .update("v1." + payloadB64)
    .digest("base64url");
  return `v1.${payloadB64}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 signed explain token, enforcing expiry, schema validity,
 * canonical input size bounds, and exact reportHash binding.
 */
export function verifyExplainToken(
  token: string,
  options: {
    secret: string;
    expectedHash: string;
    nowMs: number;
    maxTtlMs: number;
  },
):
  | { ok: true; input: ExplainInput }
  | { ok: false; status: 400 | 404; error: string } {
  if (
    options.secret.length < MIN_EXPLAIN_SECRET_LENGTH ||
    token.length > MAX_EXPLAIN_TOKEN_CHARS
  ) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  const match = EXPLAIN_TOKEN_PATTERN.exec(token);
  if (!match) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  const [, payloadB64, sigB64] = match;
  const expectedMac = createHmac("sha256", options.secret)
    .update("v1." + payloadB64)
    .digest();
  const actualMac = Buffer.from(sigB64, "base64url");
  if (
    actualMac.length !== expectedMac.length ||
    !timingSafeEqual(actualMac, expectedMac)
  ) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  const payloadBytes = Buffer.from(payloadB64, "base64url");
  if (payloadBytes.byteLength > MAX_TOKEN_PAYLOAD_BYTES) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  let parsed: unknown;
  try {
    const jsonText = new TextDecoder("utf-8", { fatal: true }).decode(
      payloadBytes,
    );
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).length !== 3 ||
    record.v !== 1 ||
    typeof record.exp !== "number" ||
    !Number.isSafeInteger(record.exp)
  ) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  if (
    options.nowMs > record.exp ||
    record.exp > options.nowMs + options.maxTtlMs + 60_000
  ) {
    return {
      ok: false,
      status: 404,
      error: "Explanation projection unavailable or expired.",
    };
  }

  const parsedInput = explainInputSchema.safeParse(record.input);
  if (!parsedInput.success) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  if (parsedInput.data.reportHash !== options.expectedHash.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      error: "Explain token does not match report hash.",
    };
  }

  if (
    utf8Encoder.encode(canonicalExplainInputJson(parsedInput.data)).byteLength >
    MAX_EXPLAIN_INPUT_BYTES
  ) {
    return { ok: false, status: 400, error: "Invalid explain token." };
  }

  return { ok: true, input: parsedInput.data };
}

function readLocalEndpoint(): URL | null {
  if (
    process.env.AVAGUARD_ENV !== "local" ||
    process.env.AVAGUARD_AI_ENABLED !== "1"
  ) {
    return null;
  }
  const raw = process.env.AVAGUARD_LOCAL_EXPLAIN_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function readExplainSecret(): string | null {
  const raw = process.env.AVAGUARD_EXPLAIN_SECRET?.trim() ?? "";
  return raw.length >= MIN_EXPLAIN_SECRET_LENGTH ? raw : null;
}

function readConfiguredExplainProvider(): {
  provider: ExplainProvider | null;
  promptVersion?: string;
  requestTimeoutMs?: number;
  deadlineMs?: number;
} {
  if (process.env.AVAGUARD_AI_ENABLED !== "1") {
    return { provider: null };
  }

  const rawPromptVersion = process.env.AVAGUARD_AI_PROMPT_VERSION?.trim();
  if (
    rawPromptVersion &&
    rawPromptVersion !== EXPLAIN_PROMPT_VERSION &&
    rawPromptVersion !== EXPLAIN_PROMPT_VERSION_V3
  ) {
    return { provider: null };
  }

  const aiProvider = process.env.AVAGUARD_AI_PROVIDER?.trim() ?? "";
  if (aiProvider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    if (!apiKey) {
      return { provider: null };
    }
    const rawModel = process.env.AVAGUARD_GEMINI_MODEL?.trim();
    if (rawModel && !GEMINI_MODEL_PATTERN.test(rawModel)) {
      return { provider: null };
    }
    return {
      provider: createGeminiExplainProvider({
        apiKey,
        model: rawModel || DEFAULT_GEMINI_EXPLAIN_MODEL,
      }),
      promptVersion: rawPromptVersion || EXPLAIN_PROMPT_VERSION_V3,
      requestTimeoutMs: GEMINI_REQUEST_TIMEOUT_MS,
      deadlineMs: GEMINI_DEADLINE_MS,
    };
  }

  if (aiProvider !== "") {
    return { provider: null };
  }

  const localEndpoint = readLocalEndpoint();
  if (!localEndpoint) {
    return { provider: null };
  }

  return {
    provider: createLoopbackHttpExplainProvider({
      endpoint: localEndpoint,
      model: process.env.AVAGUARD_LOCAL_EXPLAIN_MODEL || undefined,
    }),
    promptVersion: rawPromptVersion || EXPLAIN_PROMPT_VERSION,
  };
}

export function createLoopbackHttpExplainProvider(options: {
  endpoint: URL;
  model?: string;
  fetchImpl?: typeof fetch;
}): ExplainProvider {
  if (
    options.endpoint.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(options.endpoint.hostname)
  ) {
    throw new Error("Local explain provider requires a loopback http URL.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? "local-loopback-explainer";

  return {
    model,
    async explain(input, { promptVersion, signal }) {
      let response: Response;
      try {
        response = await fetchImpl(options.endpoint.href, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ promptVersion, model, input }),
          signal,
          cache: "no-store",
          redirect: "error",
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new ExplainProviderError("timeout", "Explain request aborted.");
        }
        throw new ExplainProviderError("outage", "Explain endpoint unreachable.");
      }

      if (response.status === 429) {
        throw new ExplainProviderError("rate-limit", "Explain rate limited.");
      }
      if (!response.ok) {
        throw new ExplainProviderError(
          "outage",
          `Explain endpoint returned HTTP ${response.status}.`,
        );
      }

      try {
        return await readBoundedJson(response, MAX_EXPLAIN_OUTPUT_BYTES);
      } catch (err) {
        if (err instanceof BoundedReadError) {
          if (err.kind === "oversized") {
            throw new ExplainProviderError(
              "oversized",
              "Explain response exceeded byte limit.",
            );
          }
          if (err.kind === "aborted") {
            throw new ExplainProviderError("timeout", "Explain request aborted.");
          }
          if (err.kind === "unreadable") {
            throw new ExplainProviderError(
              "outage",
              "Explain response stream failed.",
            );
          }
          throw new ExplainProviderError(
            "invalid-json",
            "Explain response was not valid JSON.",
          );
        }
        throw new ExplainProviderError(
          "invalid-json",
          "Explain response was not valid JSON.",
        );
      }
    },
  };
}

export function createExplainRuntime(config: ExplainRuntimeConfig) {
  const projections = new Map<string, StoredProjection>();
  const now = config.now ?? Date.now;
  const ttlMs = config.projectionTtlMs ?? PROJECTION_TTL_MS;
  const maxProjections = Math.max(1, config.maxProjections ?? MAX_PROJECTIONS);
  const rawSecret = config.tokenSecret?.trim() ?? "";
  const tokenSecret =
    rawSecret.length >= MIN_EXPLAIN_SECRET_LENGTH ? rawSecret : null;
  const activePromptVersion = config.promptVersion ?? EXPLAIN_PROMPT_VERSION;

  const service = createExplainService({
    enabled: config.enabled,
    provider: config.provider,
    promptVersion: activePromptVersion,
    requestTimeoutMs: config.requestTimeoutMs,
    deadlineMs: config.deadlineMs,
    maxAttempts: config.maxAttempts,
  });

  function pruneExpired(currentTime: number) {
    for (const [key, entry] of projections.entries()) {
      if (currentTime - entry.createdAt > ttlMs) {
        projections.delete(key);
      }
    }
  }

  function registerBody(body: ReportBody) {
    const { input } = buildExplainInput(body);
    const template = buildTemplateExplanationFromInput(input);
    const currentTime = now();
    pruneExpired(currentTime);

    if (projections.has(input.reportHash)) {
      projections.delete(input.reportHash);
    }
    while (projections.size >= maxProjections) {
      const oldest = projections.keys().next().value;
      if (oldest === undefined) break;
      projections.delete(oldest);
    }
    projections.set(input.reportHash, {
      input,
      template,
      createdAt: currentTime,
    });
    const explainToken = tokenSecret
      ? signExplainToken(input, {
          secret: tokenSecret,
          exp: currentTime + ttlMs,
        })
      : null;
    return { reportHash: input.reportHash, template, explainToken };
  }

  function tryRegisterBody(body: ReportBody):
    | {
        ok: true;
        reportHash: string;
        template: ReportExplanation;
        explainToken: string | null;
      }
    | {
        ok: false;
        code: "oversized-input" | "invalid-report" | "unknown";
        error: string;
      } {
    try {
      const { reportHash, template, explainToken } = registerBody(body);
      return { ok: true, reportHash, template, explainToken };
    } catch (err) {
      if (err instanceof ExplainInputError) {
        return { ok: false, code: err.code, error: err.message };
      }
      return {
        ok: false,
        code: "unknown",
        error: "Unable to prepare AI explanation projection.",
      };
    }
  }

  async function explainByHash(
    rawHash: string,
    language?: ExplainLanguage,
  ): Promise<
    | { ok: true; status: 200; explanation: ReportExplanation }
    | { ok: false; status: 400 | 404; error: string }
  > {
    const parsedHash = hashSchema.safeParse(rawHash.toLowerCase());
    if (!parsedHash.success) {
      return { ok: false, status: 400, error: "Invalid report hash." };
    }
    const key = parsedHash.data;
    const entry = projections.get(key);
    const currentTime = now();
    if (!entry || currentTime - entry.createdAt > ttlMs) {
      projections.delete(key);
      return {
        ok: false,
        status: 404,
        error: "Explanation projection unavailable or expired.",
      };
    }

    if (!config.enabled) {
      return { ok: true, status: 200, explanation: entry.template };
    }

    const { explanation } = await service.explainFromInput(
      entry.input,
      activePromptVersion === EXPLAIN_PROMPT_VERSION_V3 && language
        ? { language }
        : undefined,
    );
    return { ok: true, status: 200, explanation };
  }

  async function explainByToken(
    rawHash: string,
    rawToken: string,
    language?: ExplainLanguage,
  ): Promise<
    | { ok: true; status: 200; explanation: ReportExplanation }
    | { ok: false; status: 400 | 404; error: string }
  > {
    const parsedHash = hashSchema.safeParse(rawHash.toLowerCase());
    if (!parsedHash.success) {
      return { ok: false, status: 400, error: "Invalid report hash." };
    }
    if (!tokenSecret) {
      return {
        ok: false,
        status: 400,
        error: "Explain token mode is not enabled.",
      };
    }

    const verified = verifyExplainToken(rawToken, {
      secret: tokenSecret,
      expectedHash: parsedHash.data,
      nowMs: now(),
      maxTtlMs: ttlMs,
    });
    if (!verified.ok) {
      return verified;
    }

    if (!config.enabled) {
      return {
        ok: true,
        status: 200,
        explanation: buildTemplateExplanationFromInput(verified.input),
      };
    }

    const { explanation } = await service.explainFromInput(
      verified.input,
      activePromptVersion === EXPLAIN_PROMPT_VERSION_V3 && language
        ? { language }
        : undefined,
    );
    return { ok: true, status: 200, explanation };
  }

  return {
    isAiEnabled: () => config.enabled && config.provider !== null,
    hasTokenSecret: () => tokenSecret !== null,
    promptVersion: () => activePromptVersion,
    registerBody,
    tryRegisterBody,
    explainByHash,
    explainByToken,
    projectionCount: () => projections.size,
  };
}

const RUNTIME_KEY = Symbol.for("avaguard.m6.explainRuntime");

type GlobalWithRuntime = typeof globalThis & {
  [RUNTIME_KEY]?: ReturnType<typeof createExplainRuntime>;
};

export function getExplainRuntime() {
  const g = globalThis as GlobalWithRuntime;
  if (!g[RUNTIME_KEY]) {
    // Ambient GEMINI_API_KEY alone does not authorize live external provider calls;
    // AVAGUARD_AI_ENABLED=1 and AVAGUARD_AI_PROVIDER=gemini must be set explicitly.
    const { provider, promptVersion, requestTimeoutMs, deadlineMs } =
      readConfiguredExplainProvider();
    g[RUNTIME_KEY] = createExplainRuntime({
      enabled: provider !== null,
      provider,
      tokenSecret: readExplainSecret(),
      promptVersion,
      requestTimeoutMs,
      deadlineMs,
    });
  }
  return g[RUNTIME_KEY];
}
