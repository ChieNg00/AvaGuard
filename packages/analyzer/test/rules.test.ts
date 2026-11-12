import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { toFunctionSelector, toHex, type Hex } from "viem";
import { BEACON_SLOT, IMPLEMENTATION_SLOT, ReadError, buildReport, canonicalReportJson, collectEvidence,
  disassemble, dispatcherRules, inspectRuntime, parseReportBody, probeData, replayReport, reportHash, verifyCommitment } from "../src";
import { HASH, IMPL, TARGET, mock } from "./mock";

const push = (sig: string) => "63" + toFunctionSelector(sig).slice(2);
const mint = push("mint(uint256)");
const collect = (override?: Parameters<typeof mock>[0]) => collectEvidence(mock(override).transport, { address: TARGET });
async function complete(override?: Parameters<typeof mock>[0]) {
  const report = buildReport(await collect(override));
  if (report.status !== "complete") throw new Error(report.reason);
  return report;
}

it.each(["64" + mint + "14", mint, mint + "808014", ...["00", "56", "57", "5b", "fd", "ff", "0c"].map(op => mint + op + "14")])(
  "ignores payloads, isolated constants and comparisons across the window/block: %s", bytes => {
    expect(inspectRuntime(("0x" + bytes) as Hex).matches.size).toBe(0);
  });
it("records instruction offsets, skips PUSH payloads and reports incomplete operands", () => {
  expect(disassemble("0x61f41463abcd")).toEqual([
    { offset: 0, opcode: 0x61, payload: "f414", truncated: false },
    { offset: 3, opcode: 0x63, payload: "abcd", truncated: true },
  ]);
  expect(inspectRuntime("0x61f414").delegatecall).toBeUndefined();
  expect(inspectRuntime(("0x80" + mint + "8014") as Hex).matches.get("mint(uint256)")).toMatchObject({ offset: "1", eqOffset: "7" });
});
it("documents the linear heuristic: even an unreachable comparison can match", () => {
  expect(inspectRuntime(("0x00" + mint + "14") as Hex).matches.has("mint(uint256)")).toBe(true);
});
it("links every configured signature once per rule and caps the total at 100", async () => {
  const runtime = "0x" + dispatcherRules.flatMap(rule => rule.signatures.map(sig => push(sig) + "14")).join("");
  const r = await complete((m, p) => {
    if (m === "eth_getStorageAt" && p[0] === TARGET && p[1] === IMPLEMENTATION_SLOT) return toHex(BigInt(IMPL), { size: 32 });
    if (m === "eth_getCode" && p[0] === IMPL) return runtime;
  });
  expect(r.signalScore).toBe(100);
  for (const rule of dispatcherRules) {
    expect(r.findings.find(f => f.id === rule.id)).toMatchObject({ severity: rule.severity, weight: rule.weight,
      confidence: "dispatcher-match", evidenceIds: rule.signatures.map(s => "dispatch-" + s).sort() });
  }
});
it("retains independently supported findings on self-beacon and documents an unresolved DELEGATECALL", async () => {
  const r = await complete((m, p) => {
    if (m === "eth_getStorageAt" && p[1] === BEACON_SLOT) return toHex(BigInt(TARGET), { size: 32 });
    if (m === "eth_getCode" && p[0] === TARGET) return "0x" + mint + "14f4";
  });
  expect(r.findings.map(f => f.id)).toEqual(["R-MINT", "R-OWNER-EOA", "R-PROXY-UNRESOLVED", "R-SOURCE-UNKNOWN"]);
  expect(r.signalScore).toBe(35);
  expect(r.proxy.status).toBe("unsupported");
});
it("recognizes the exact clone with no ERC-1967 weight; analyzes the implementation", async () => {
  const r = await complete((m, p) => {
    if (m === "eth_getCode" && p[0] === TARGET) return "0x363d3d373d3d3d363d73" + IMPL.slice(2) + "5af43d82803e903d91602b57fd5bf3";
    if (m === "eth_getCode" && p[0] === IMPL) return "0x" + mint + "14";
  });
  expect(r.proxy.kind).toBe("erc1167");
  expect(r.findings.map(f => f.id)).toEqual(["R-MINT", "R-OWNER-EOA", "R-SOURCE-UNKNOWN"]);
});
it("counts two failed required reads once and keeps failure causes", async () => {
  const r = await complete((m, p) => {
    if (m !== "eth_call") return;
    const { data } = p[0] as { data: Hex };
    if (data === probeData("totalSupply")) return "0x1234";
    if (data === probeData("balanceOf")) throw new ReadError("execution-revert", 3);
  });
  expect(r.findings.find(f => f.id === "R-NONSTANDARD")).toMatchObject({ weight: 10, evidenceIds: ["balance-zero", "total-supply"] });
  expect(r.signalScore).toBe(20);
  expect(canonicalReportJson(r.body)).toContain('"rpcCode":"3"');
});
it.each(["transport", "rate-limit", "historical-state-unavailable", "invalid-response"] as const)(
  "keeps partial evidence diagnostic after %s", async kind => {
    const r = buildReport(await collect((m, p) => {
      if (m === "eth_call" && (p[0] as { data: Hex }).data === probeData("name")) throw new ReadError(kind);
    }));
    expect(r).toMatchObject({ status: "inconclusive", findings: [], signalScore: null, band: null, reportHash: null });
  });
it.each(["total-supply", "balance-zero", "metadata-symbol", "owner", "owner-code"])("withholds a score without %s evidence", async id => {
  const collection = await collect();
  collection.evidence = collection.evidence.filter(e => e.id !== id);
  expect(buildReport(collection)).toMatchObject({ status: "inconclusive", signalScore: null, band: null,
    coverage: { unavailable: expect.arrayContaining([expect.objectContaining({ id })]) } });
});
it("locks the canonical UTF-8 JSON body and expected keccak256 digest", async () => {
  const r = await complete();
  const vector = await readFile(new URL("../../../fixtures/canonical-report-v1.json", import.meta.url), "utf8");
  expect(canonicalReportJson(r.body)).toBe(vector);
  expect(r.reportHash).toBe("0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd");
});
it("normalizes case and ordering, excludes presentation fields and commits to deterministic changes", async () => {
  const c = await collect((m, p) => {
    if (m === "eth_getStorageAt" && p[0] === TARGET && p[1] === IMPLEMENTATION_SLOT) return toHex(BigInt(IMPL), { size: 32 });
  });
  const r = buildReport(c);
  if (r.status !== "complete") throw new Error(r.reason);
  c.evidence.reverse();
  expect(buildReport(c).reportHash).toBe(r.reportHash);
  const b = structuredClone(r.body);
  b.blockHash = b.blockHash.toUpperCase();
  b.evidence.reverse();
  b.findings.reverse();
  b.proxy.evidenceIds.reverse();
  for (const f of b.findings) f.evidenceIds.reverse();
  for (const entries of Object.values(b.coverage)) entries.reverse();
  expect(reportHash(b)).toBe(r.reportHash);
  const decorated = { ...r, aiText: "different", publishedAt: "tomorrow" };
  expect(reportHash(decorated)).toBe(r.reportHash);
  const changed = structuredClone(r.body);
  changed.blockHash = toHex(55, { size: 32 });
  for (const e of changed.evidence) e.snapshot.blockHash = changed.blockHash;
  expect(reportHash(changed)).not.toBe(r.reportHash);
  const later = structuredClone(r.body);
  later.blockNumber = "33";
  for (const e of later.evidence) e.snapshot.blockNumber = later.blockNumber;
  expect(reportHash(later)).not.toBe(r.reportHash);
  expect(reportHash({ ...b, proxy: { ...b.proxy, implementationCodeHash: HASH } })).not.toBe(r.reportHash);
  const f = b.findings.find(f => f.id === "R-PROXY")!;
  f.confidence = "call-result";
  expect(reportHash(b)).not.toBe(r.reportHash);
  f.confidence = "slot-read";
  b.coverage.checked[0].reason += " Revised.";
  expect(reportHash(b)).not.toBe(r.reportHash);
});
it("rejects unsupported versions, duplicate IDs, invalid values and missing evidence links", async () => {
  const { body } = await complete();
  for (const change of [
    { schemaVersion: 2 }, { signalScore: Infinity }, { blockNumber: 32 },
    { evidence: [...body.evidence, body.evidence[0]] }, { findings: [...body.findings, body.findings[0]] },
    { findings: [{ ...body.findings[0], evidenceIds: ["missing"] }] },
    { coverage: { ...body.coverage, unavailable: [body.coverage.checked[0]] } },
    { proxy: { ...body.proxy, evidenceIds: ["missing"] } },
  ]) expect(() => parseReportBody({ ...body, ...change })).toThrow();
});
it("checks an imported commitment offline and independently requests historical evidence for replay", async () => {
  const r = await complete();
  const json = canonicalReportJson(r.body);
  expect(verifyCommitment(json, r.reportHash).status).toBe("commitment-matches");
  expect(verifyCommitment(json, HASH).status).toBe("commitment-mismatch");
  const untouched = mock();
  expect((await replayReport(untouched.transport, null, r.reportHash)).status).toBe("unavailable");
  expect((await replayReport(untouched.transport, { ...r.body, rulesetVersion: 2 }, r.reportHash)).status).toBe("unavailable");
  expect((await replayReport(untouched.transport, r.body, HASH)).status).toBe("commitment-mismatch");
  expect(untouched.calls).toEqual([]);
  const m = mock(method => { if (method === "eth_getCode") throw new ReadError("historical-state-unavailable"); });
  expect(await replayReport(m.transport, r.body, r.reportHash)).toEqual({ status: "inconclusive", reason: "historical-state-unavailable" });
  expect(m.calls.filter(c => c.method === "eth_getBlockByNumber").map(c => c.params[0])).toEqual(["0x20"]);
  const different = mock((method, p) => method === "eth_getCode" && p[0] === TARGET ? "0x6001" : undefined);
  expect((await replayReport(different.transport, r.body, r.reportHash)).status).toBe("replay-mismatch");
});
