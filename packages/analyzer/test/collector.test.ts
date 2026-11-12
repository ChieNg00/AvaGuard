import { describe, expect, it, vi } from "vitest";
import { keccak256, toHex, type Hex } from "viem";
import { collectEvidence, collectionSchema, evidenceSchema, classifyRpcError, ReadError,
  IMPLEMENTATION_SLOT, BEACON_SLOT, ZERO, probeData, minimalImplementation,
  type CollectionResult } from "../src/index";

import { mock, TARGET, IMPL, BEACON, HASH, ZERO_WORD } from "./mock";
function observed(result: CollectionResult, id: string) { return result.evidence.find(e => e.id === id)!; }

describe("fixed snapshot evidence collection", () => {
  it("collects unscored evidence without findings or aggregate confidence", async () => {
    const m = mock();
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.status).toBe("collected");
    expect(r.publishable).toBe(false);
    expect(r.signalScore).toBeNull();
    expect(r).not.toHaveProperty("findings");
    expect(r).not.toHaveProperty("confidence");
    expect(r.codehash).toBe(keccak256("0x6000"));
    expect(observed(r, "owner-code").raw).toBe("0x");
    expect(r.proxy.status).toBe("unresolved");
    expect(r.proxy.reason).toContain("do not prove");
    for (const { method, params } of m.calls.filter(c => ["eth_call", "eth_getStorageAt", "eth_getCode"].includes(c.method))) {
      expect(params.at(-1)).toBe("0x20");
      if (method === "eth_call") expect(params[0]).toMatchObject({ to: TARGET, from: ZERO, gas: "0x2dc6c0", value: "0x0" });
    }
    expect(m.calls.filter(c => c.method === "eth_getBlockByNumber").map(c => c.params[0])).toEqual(["latest", "0x20"]);
    expect(r.evidence.every(e => e.snapshot.blockHash === HASH)).toBe(true);
  });
  it("has no fabricated chain/snapshot on initial transport failure", async () => {
    const m = mock(() => { throw new ReadError("transport"); });
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r).toMatchObject({ status: "inconclusive", chainId: null, snapshot: null, evidence: [], error: { kind: "transport" } });
    expect(m.calls).toHaveLength(3);
  });
  it("records wrong chain without fetching a snapshot", async () => {
    const m = mock(method => method === "eth_chainId" ? "0xa86a" : undefined);
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r).toMatchObject({ chainId: "43114", snapshot: null, error: { kind: "wrong-network" } });
    expect(m.calls).toHaveLength(1);
  });
  it("rejects invalid address before IO", async () => {
    const m = mock();
    await expect(collectEvidence(m.transport, { address: "0x123" })).rejects.toThrow();
    expect(m.calls).toEqual([]);
  });
  it.each(["transport", "rate-limit", "invalid-response", "historical-state-unavailable"] as const)("never converts %s into a finding, retries only transient failures at B", async kind => {
    const m = mock((method, p) => {
      if (method === "eth_call" && (p[0] as { data: Hex }).data === probeData("totalSupply")) throw new ReadError(kind);
    });
    const r = await collectEvidence(m.transport, { address: TARGET, historical: { blockNumber: "32", blockHash: HASH } });
    expect(r.status).toBe("inconclusive"); expect(r.error?.kind).toBe(kind); expect(r.signalScore).toBeNull();
    expect(observed(r, "total-supply").outcome).toBe("unavailable");
    const calls = m.calls.filter(c => c.method === "eth_call");
    expect(calls).toHaveLength(["transport", "rate-limit"].includes(kind) ? 3 : 1);
    expect(calls.every(c => c.params[1] === "0x20")).toBe(true);
    expect(m.calls.some(c => c.params.includes("latest"))).toBe(false);
    expect(r).not.toHaveProperty("findings");
  });
  it("can recover from a transient transport failure at the same B", async () => {
    let count = 0;
    const m = mock((method) => { if (method === "eth_getCode" && count++ === 0) throw new ReadError("transport"); });
    expect((await collectEvidence(m.transport, { address: TARGET })).status).toBe("collected");
    expect(m.calls.filter(c => c.method === "eth_getCode").slice(0, 2).map(c => c.params[1])).toEqual(["0x20", "0x20"]);
  });
  it.each(["totalSupply", "name", "owner"] as const)("retains a confirmed %s execution revert without retry or verdict", async probe => {
    const m = mock((method, p) => {
      if (method === "eth_call" && (p[0] as { data: Hex }).data === probeData(probe)) throw classifyRpcError(3, "execution reverted", method);
    });
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.status).toBe("collected");
    expect(r.evidence.filter(e => e.outcome === "execution-revert")).toHaveLength(1);
    expect(m.calls.filter(c => c.method === "eth_call" && (c.params[0] as { data: Hex }).data === probeData(probe))).toHaveLength(1);
  });
  it.each(["0x", "0x01", "0x" + "0".repeat(128)])("classifies malformed ABI return %s separately", async raw => {
    const m = mock((method, p) => method === "eth_call" && (p[0] as { data: Hex }).data === probeData("totalSupply") ? raw : undefined);
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.status).toBe("collected");
    expect(observed(r, "total-supply")).toMatchObject({ outcome: "malformed-return", decoded: null });
  });
  it("optional metadata transport failure still invalidates workflow", async () => {
    const m = mock((method, p) => { if (method === "eth_call" && (p[0] as { data: Hex }).data === probeData("name")) throw new ReadError("transport"); });
    expect((await collectEvidence(m.transport, { address: TARGET })).status).toBe("inconclusive");
  });
  it("detects final header hash mismatch", async () => {
    let count = 0;
    const m = mock(method => method === "eth_getBlockByNumber" && count++ > 0 ? { number: "0x20", hash: toHex(1n, { size: 32 }) } : undefined);
    expect((await collectEvidence(m.transport, { address: TARGET })).error?.kind).toBe("snapshot-mismatch");
  });
  it("rejects historical header mismatch before using state, no latest fallback", async () => {
    const m = mock();
    const r = await collectEvidence(m.transport, { address: TARGET, historical: { blockNumber: "32", blockHash: toHex(2n, { size: 32 }) } });
    expect(r.snapshot).toBeNull(); expect(r.error?.kind).toBe("snapshot-mismatch");
    expect(m.calls.some(c => c.method === "eth_getCode")).toBe(false);
    expect(m.calls.some(c => c.params.includes("latest"))).toBe(false);
  });
  it("handles missing historical header without fabricating B/hash", async () => {
    const m = mock(method => method === "eth_getBlockByNumber" ? null : undefined);
    const r = await collectEvidence(m.transport, { address: TARGET, historical: { blockNumber: "32", blockHash: HASH } });
    expect(r).toMatchObject({ snapshot: null, error: { kind: "historical-state-unavailable" } });
  });
  it("no-bytecode remains not analyzable and rechecks header", async () => {
    const m = mock(method => method === "eth_getCode" ? "0x" : undefined);
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.status).toBe("not-analyzable"); expect(r.codehash).toBeNull(); expect(r.signalScore).toBeNull();
    expect(m.calls.filter(c => c.method === "eth_getBlockByNumber")).toHaveLength(2);
    expect(m.calls.some(c => c.method === "eth_call")).toBe(false);
  });
  it("rejects a self-beacon before calling implementation()", async () => {
    // The default mock would return IMPL from implementation() and nonempty code for IMPL.
    const m = mock((method, p) => {
      if (method === "eth_getStorageAt" && p[0] === TARGET && p[1] === BEACON_SLOT)
        return toHex(BigInt(TARGET), { size: 32 });
    });
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.proxy.status).toBe("unsupported");
    expect(r.proxy.reason).toMatch(/self-beacon/i);
    expect(r.proxy.evidenceIds).toContain("proxy-beacon-slot");
    expect(observed(r, "proxy-beacon-slot").raw).toBe(toHex(BigInt(TARGET), { size: 32 }));
    const calls = m.calls.filter(c => c.method === "eth_call").map(c => c.params[0] as { to: Hex; data: Hex });
    expect(calls.map(c => c.data)).not.toContain(probeData("implementation"));
    for (const probe of ["totalSupply", "balanceOf", "owner", "name", "symbol", "decimals"] as const)
      expect(calls).toContainEqual(expect.objectContaining({ to: TARGET, data: probeData(probe) }));
    expect(r).toMatchObject({ status: "collected", signalScore: null, band: null });
  });
  it.each(["direct", "beacon"] as const)("collects %s dependency and owner code at B; calls TARGET state", async kind => {
    const m = mock((method, p) => {
      if (method === "eth_getStorageAt" && p[0] === TARGET)
        return p[1] === (kind === "direct" ? IMPLEMENTATION_SLOT : BEACON_SLOT) ? toHex(BigInt(kind === "direct" ? IMPL : BEACON), { size: 32 }) : ZERO_WORD;
    });
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.proxy).toMatchObject({ status: "resolved", kind: kind === "direct" ? "erc1967" : "beacon", implementation: IMPL });
    expect(r.proxy.implementationCodeHash).toBe(keccak256("0x6000"));
    const reads = m.calls.filter(c => ["eth_call", "eth_getCode", "eth_getStorageAt"].includes(c.method));
    expect(reads.every(c => c.params.at(-1) === "0x20")).toBe(true);
    expect(m.calls.filter(c => c.method === "eth_call" && (c.params[0] as { to: Hex }).to !== TARGET)
      .every(c => (c.params[0] as { to: Hex; data: Hex }).to === BEACON && (c.params[0] as { data: Hex }).data === probeData("implementation"))).toBe(true);
  });
  it.each(["loop", "empty", "nested", "malformed"] as const)("marks %s proxy dependency unsupported, no false resolution", async gap => {
    const m = mock((method, p) => {
      if (method === "eth_getStorageAt" && p[0] === TARGET && p[1] === IMPLEMENTATION_SLOT)
        return gap === "malformed" ? "0x" + "f".repeat(64) : toHex(BigInt(gap === "loop" ? TARGET : IMPL), { size: 32 });
      if (gap === "empty" && method === "eth_getCode" && p[0] === IMPL) return "0x";
      if (gap === "nested" && method === "eth_getStorageAt" && p[0] === IMPL && p[1] === IMPLEMENTATION_SLOT) return toHex(BigInt(TARGET), { size: 32 });
    });
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.proxy.status).toBe("unsupported");
    expect(r.coverage.notChecked.some(e => e.id === "proxy-runtime-gap")).toBe(true);
  });
  it("rejects mixed-snapshot evidence, fabricated score, dangling IDs and outcome mismatch", async () => {
    const r = await collectEvidence(mock().transport, { address: TARGET });
    expect(collectionSchema.safeParse({ ...r, signalScore: 0 }).success).toBe(false);
    expect(collectionSchema.safeParse({ ...r, publishable: true }).success).toBe(false);
    expect(collectionSchema.safeParse({ ...r, evidence: [...r.evidence, r.evidence[0]] }).success).toBe(false);
    expect(collectionSchema.safeParse({ ...r, proxy: { ...r.proxy, evidenceIds: ["missing"] } }).success).toBe(false);
    expect(collectionSchema.safeParse({ ...r, evidence: [{ ...r.evidence[0], snapshot: { blockNumber: "99", blockHash: HASH } }] }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...r.evidence[0], outcome: "unavailable" }).success).toBe(false);
  });
  it("computes canonical ERC-1967 slots", () => {
    expect(IMPLEMENTATION_SLOT).toBe("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
    expect(BEACON_SLOT).toBe("0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50");
  });
  it("parses only exact ERC-1167 runtime, not variants/truncated/payload constants", () => {
    const clone = ("0x363d3d373d3d3d363d73" + IMPL.slice(2) + "5af43d82803e903d91602b57fd5bf3") as Hex;
    expect(minimalImplementation(clone)).toBe(IMPL);
    for (const bad of [clone.slice(0, -2), clone + "00", "0x00" + clone.slice(2), "0x63" + IMPL.slice(2)])
      expect(minimalImplementation(bad as Hex)).toBeNull();
  });
});

describe("additional collection failure boundaries", () => {
  it("detects missing final header and final network change", async () => {
    let headers = 0;
    const missing = mock(m => m === "eth_getBlockByNumber" && headers++ > 0 ? null : undefined);
    expect((await collectEvidence(missing.transport, { address: TARGET })).error?.kind).toBe("snapshot-mismatch");
    let chains = 0;
    const switched = mock(m => m === "eth_chainId" && chains++ > 0 ? "0xa86a" : undefined);
    expect((await collectEvidence(switched.transport, { address: TARGET })).error?.kind).toBe("wrong-network");
  });
  it("does not invent a snapshot from a malformed initial header", async () => {
    const m = mock(method => method === "eth_getBlockByNumber" ? { number: "0x20", hash: "0x123" } : undefined);
    const r = await collectEvidence(m.transport, { address: TARGET });
    expect(r.snapshot).toBeNull(); expect(r.error?.kind).toBe("invalid-response");
    expect(r.evidence).toEqual([]);
  });
  it("marks beacon execution failure unsupported, but transport failure inconclusive", async () => {
    for (const failure of ["execution-revert", "transport"] as const) {
      const m = mock((method, params) => {
        if (method === "eth_getStorageAt" && params[0] === TARGET && params[1] === BEACON_SLOT)
          return toHex(BigInt(BEACON), { size: 32 });
        if (method === "eth_call" && (params[0] as { to: Hex }).to === BEACON) throw new ReadError(failure);
      });
      const r = await collectEvidence(m.transport, { address: TARGET });
      expect(r.status).toBe(failure === "transport" ? "inconclusive" : "collected");
      if (failure === "execution-revert") expect(r.proxy.status).toBe("unsupported");
      expect(m.calls.filter(c => ["eth_call", "eth_getCode", "eth_getStorageAt"].includes(c.method))
        .every(c => c.params.at(-1) === "0x20")).toBe(true);
    }
  });
  it("bounded timeouts on a hanging transport never return a fabricated snapshot", async () => {
    vi.useFakeTimers();
    try {
      const result = collectEvidence({ request: () => new Promise(() => {}) }, { address: TARGET });
      await vi.advanceTimersByTimeAsync(16000);
      expect(await result).toMatchObject({ status: "inconclusive", snapshot: null, error: { kind: "transport" } });
    } finally { vi.useRealTimers(); }
  });
});

it("links exact-clone parser evidence to raw code with bytecode-pattern confidence", async () => {
  const runtime = ("0x363d3d373d3d3d363d73" + IMPL.slice(2) + "5af43d82803e903d91602b57fd5bf3") as Hex;
  const m = mock((method, params) => method === "eth_getCode" && params[0] === TARGET ? runtime : undefined);
  const r = await collectEvidence(m.transport, { address: TARGET });
  expect(r.proxy).toMatchObject({ kind: "erc1167", status: "resolved", implementation: IMPL });
  const pattern = r.evidence.find(e => e.id === "proxy-minimal-pattern")!;
  expect(pattern).toMatchObject({ confidence: "bytecode-pattern", derivation: "erc1167-runtime", sourceEvidenceId: "target-code" });
  expect(r.proxy.evidenceIds).toContain(pattern.id);
  expect(collectionSchema.safeParse({ ...r, evidence: r.evidence.map(e => e.id === pattern.id ? { ...e, sourceEvidenceId: "missing" } : e) }).success).toBe(false);
});
