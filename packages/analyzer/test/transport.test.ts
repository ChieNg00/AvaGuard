import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyRpcError, createHttpTransport } from "../src/index";
afterEach(() => vi.unstubAllGlobals());
describe("bounded HTTP protocol adapter", () => {
  it.each([
    [-32000, "missing trie node", "historical-state-unavailable"],
    [-32001, "historical state unavailable", "historical-state-unavailable"],
    [-32005, "limit", "rate-limit"], [429, "Too many requests", "rate-limit"],
    [3, "execution reverted", "execution-revert"],
    [-32000, "execution reverted: denied", "execution-revert"],
    [-32603, "internal error", "invalid-response"], [-32000, "unknown", "invalid-response"],
    [3, "some arbitrary revert word", "invalid-response"],
  ] as const)("classifies %s / %s conservatively", (code, message, kind) => {
    expect(classifyRpcError(code, message, "eth_call").kind).toBe(kind);
  });
  it("does not call a code/storage RPC error a contract revert", () => {
    expect(classifyRpcError(3, "execution reverted", "eth_getCode").kind).toBe("invalid-response");
  });
  it("sends a read-only method, validates response id and never exposes URL/errors", async () => {
    const fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({ jsonrpc: "2.0", method: "eth_chainId", params: [] });
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0xa869" }));
    });
    vi.stubGlobal("fetch", fetch);
    expect(await createHttpTransport("http://localhost:8545").request("eth_chainId", [])).toBe("0xa869");
  });
  it.each([
    { jsonrpc: "2.0", id: 99, result: "0x0" },
    { jsonrpc: "2.0", id: 1, result: "0x0", error: { code: 3, message: "execution reverted" } },
    { jsonrpc: "2.0", id: 1 },
    { jsonrpc: "1.0", id: 1, result: "0x0" },
    { jsonrpc: "2.0", id: 1, error: { code: "3", message: "execution reverted" } },
  ])("rejects invalid response envelope %j", async body => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body)));
    await expect(createHttpTransport("http://localhost:8545").request("eth_chainId", [])).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it.each([[429,"rate-limit"],[503,"transport"]] as const)("classifies HTTP %s", async (status, kind) => {
    vi.stubGlobal("fetch", async () => new Response("", { status }));
    await expect(createHttpTransport("http://localhost:8545").request("eth_chainId", [])).rejects.toMatchObject({ kind });
  });
  it("rejects oversized streaming responses before JSON decode", async () => {
    vi.stubGlobal("fetch", async () => new Response("x".repeat(262145)));
    await expect(createHttpTransport("http://localhost:8545").request("eth_chainId", [])).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it("rejects invalid JSON and does not retain exception secrets", async () => {
    vi.stubGlobal("fetch", async () => new Response("not-json"));
    await expect(createHttpTransport("http://localhost:8545").request("eth_chainId", [])).rejects.toMatchObject({ message: "invalid-response" });
    vi.stubGlobal("fetch", async () => { throw new Error("private-provider-token"); });
    await expect(createHttpTransport("http://localhost:8545").request("eth_chainId", [])).rejects.toMatchObject({ message: "transport" });
  });
});
