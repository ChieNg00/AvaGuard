import {
  buildExplainInput,
  buildTemplateExplanationFromInput,
  createExplainService,
  EXPLAIN_PROMPT_VERSION,
  ExplainProviderError,
  hashSchema,
  MAX_EXPLAIN_OUTPUT_BYTES,
  type ExplainInput,
  type ExplainProvider,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";

const PROJECTION_TTL_MS = 10 * 60 * 1000;
const MAX_PROJECTIONS = 64;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

type StoredProjection = {
  input: ExplainInput;
  template: ReportExplanation;
  createdAt: number;
};

export type ExplainRuntimeConfig = {
  enabled: boolean;
  provider: ExplainProvider | null;
  promptVersion?: string;
  requestTimeoutMs?: number;
  deadlineMs?: number;
  maxAttempts?: number;
  projectionTtlMs?: number;
  maxProjections?: number;
  now?: () => number;
};

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

      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_EXPLAIN_OUTPUT_BYTES) {
        throw new ExplainProviderError(
          "oversized",
          "Explain response exceeded byte limit.",
        );
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
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

  const service = createExplainService({
    enabled: config.enabled,
    provider: config.provider,
    promptVersion: config.promptVersion ?? EXPLAIN_PROMPT_VERSION,
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
    return { reportHash: input.reportHash, template };
  }

  async function explainByHash(rawHash: string): Promise<
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

    const { explanation } = await service.explainFromInput(entry.input);
    return { ok: true, status: 200, explanation };
  }

  return {
    isAiEnabled: () => config.enabled && config.provider !== null,
    registerBody,
    explainByHash,
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
    const localEndpoint = readLocalEndpoint();
    // Ambient GEMINI_API_KEY does not authorize live external provider calls in M6.
    const provider = localEndpoint
      ? createLoopbackHttpExplainProvider({
          endpoint: localEndpoint,
          model: process.env.AVAGUARD_LOCAL_EXPLAIN_MODEL || undefined,
        })
      : null;
    g[RUNTIME_KEY] = createExplainRuntime({
      enabled: provider !== null,
      provider,
    });
  }
  return g[RUNTIME_KEY];
}
