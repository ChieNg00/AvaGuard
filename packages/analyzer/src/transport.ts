import type { ErrorKind } from "./evidence-schema";

export type ReadMethod = "eth_chainId" | "eth_getBlockByNumber" | "eth_getCode" | "eth_getStorageAt" | "eth_call";
export interface ReadTransport {
  request(method: ReadMethod, params: readonly unknown[]): Promise<unknown>;
}
export class ReadError extends Error {
  constructor(public readonly kind: ErrorKind, public readonly rpcCode: number | null = null) {
    super(kind);
  }
}
// RPC message text is untrusted, used only for classification and never retained/logged.
export function classifyRpcError(code: number, message: string, method: ReadMethod): ReadError {
  const text = message.toLowerCase().slice(0, 2048);
  if (/missing trie node|historical state|state.*(?:unavailable|pruned)|no state available|old state|header not found/.test(text))
    return new ReadError("historical-state-unavailable", code);
  if (code === 429 || code === -32005 || /rate limit|too many requests/.test(text))
    return new ReadError("rate-limit", code);
  if (method === "eth_call" && (code === 3 || code === -32000) && /(?:execution reverted|vm execution error.*revert)/.test(text))
    return new ReadError("execution-revert", code);
  // -32000 alone, "revert" in arbitrary data, and -32603 are ambiguous, never contract findings.
  return new ReadError("invalid-response", code);
}
const RESPONSE_LIMIT = 262144;
export function createHttpTransport(url: string): ReadTransport {
  const endpoint = new URL(url);
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password)
    throw new Error("Invalid configured RPC URL");
  let id = 0;
  return {
    async request(method, params) {
      if (!["eth_chainId", "eth_getBlockByNumber", "eth_getCode", "eth_getStorageAt", "eth_call"].includes(method)) throw new ReadError("invalid-response");
      const requestId = ++id;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(endpoint, { method: "POST", signal: controller.signal,
          redirect: "error", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }) });
        if (response.status === 429) throw new ReadError("rate-limit");
        if (!response.ok) throw new ReadError("transport");
        const reader = response.body?.getReader();
        if (!reader) throw new ReadError("invalid-response");
        let length = 0;
        const chunks: Uint8Array[] = [];
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > RESPONSE_LIMIT) throw new ReadError("invalid-response");
            chunks.push(value);
          }
        } finally { await reader.cancel().catch(() => {}); }
        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        let json: unknown;
        try { json = JSON.parse(new TextDecoder().decode(body)); } catch { throw new ReadError("invalid-response"); }
        if (!json || typeof json !== "object" || Array.isArray(json)) throw new ReadError("invalid-response");
        const r = json as Record<string, unknown>;
        if (r.jsonrpc !== "2.0" || r.id !== requestId || (("result" in r) === ("error" in r))) throw new ReadError("invalid-response");
        if ("error" in r) {
          const e = r.error as { code?: unknown; message?: unknown } | null;
          if (!e || typeof e.code !== "number" || !Number.isInteger(e.code) || typeof e.message !== "string") throw new ReadError("invalid-response");
          throw classifyRpcError(e.code, e.message, method);
        }
        return r.result;
      } catch (error) {
        if (error instanceof ReadError) throw error;
        throw new ReadError("transport");
      } finally { clearTimeout(timer); }
    },
  };
}
