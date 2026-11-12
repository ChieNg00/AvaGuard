import type { Hex } from "viem";
import { collectionSchema, type CollectionResult, type Evidence } from "./evidence-schema";
import { BEACON_SLOT, IMPLEMENTATION_SLOT, ZERO, decodeProbe, minimalImplementation, probeData, type Probe } from "./probes";
import { dispatcherRules, inspectRuntime } from "./dispatcher";
import { byId, parseReportBody, reportHash, wireEvidence, type DerivedEvidence, type Finding } from "./report-body";

const probes: Record<string, Probe> = { "total-supply": "totalSupply", "balance-zero": "balanceOf", owner: "owner",
  "metadata-name": "name", "metadata-symbol": "symbol", "metadata-decimals": "decimals" };
const zeroWord = "0x" + "0".repeat(64);
function requiredEvidence(r: CollectionResult, reads: Map<string, Evidence>) {
  const at = (id: string, address: string | null, method: string) => {
    const e = reads.get(id);
    return e?.request.address === address && e.request.method === method ? e : undefined;
  };
  const slot = (id: string, address: string | null, key: string) => {
    const e = at(id, address, "eth_getStorageAt");
    return e?.request.slot === key && e.outcome === "observed" ? e.raw : null;
  };
  const call = (id: string, address: string | null, name: Probe) => {
    const e = at(id, address, "eth_call");
    if (e?.request.data !== probeData(name)) return undefined;
    if (e.outcome !== "observed") return e;
    try { return decodeProbe(name, e.raw as Hex) === e.decoded ? e : undefined; }
    catch { return undefined; }
  };
  if (!Object.entries(probes).every(([id, name]) => call(id, r.address, name))) return false;
  const owner = reads.get("owner")!.decoded;
  if (owner && owner !== ZERO && at("owner-code", owner, "eth_getCode")?.outcome !== "observed") return false;
  const impl = slot("proxy-implementation-slot", r.address, IMPLEMENTATION_SLOT);
  if (!impl) return false;
  const beacon = impl === zeroWord ? slot("proxy-beacon-slot", r.address, BEACON_SLOT) : null;
  if (impl === zeroWord && !beacon) return false;
  const p = r.proxy;
  if (p.status === "unsupported") return true;
  if (p.status === "unresolved") return p.kind === "unresolved" && beacon === zeroWord &&
    !minimalImplementation(reads.get("target-code")!.raw as Hex);
  const path = ["target-code", "proxy-implementation-slot", "implementation-code", "implementation-nested-slot", "implementation-nested-beacon"];
  if (p.kind !== "erc1967") path.push("proxy-beacon-slot");
  if (p.kind === "beacon") path.push("beacon-code", "beacon-implementation");
  if (p.kind === "erc1167") path.push("proxy-minimal-pattern");
  if (!path.every(id => p.evidenceIds.includes(id))) return false;
  if (!p.implementation || p.implementation === r.address || p.implementation === p.beacon || p.beacon === r.address) return false;
  const code = at("implementation-code", p.implementation, "eth_getCode");
  if (!code?.raw || code.raw === "0x" || code.codehash !== p.implementationCodeHash || minimalImplementation(code.raw as Hex) ||
      slot("implementation-nested-slot", p.implementation, IMPLEMENTATION_SLOT) !== zeroWord ||
      slot("implementation-nested-beacon", p.implementation, BEACON_SLOT) !== zeroWord) return false;
  const padded = (address: string) => "0x" + address.slice(2).padStart(64, "0");
  if (p.kind === "erc1967") return !p.beacon && impl === padded(p.implementation);
  if (p.kind === "erc1167") return beacon === zeroWord && reads.get("proxy-minimal-pattern")?.derivation === "erc1167-runtime" &&
    minimalImplementation(reads.get("target-code")!.raw as Hex) === p.implementation;
  const beaconCode = at("beacon-code", p.beacon, "eth_getCode");
  return p.kind === "beacon" && p.beacon && beacon === padded(p.beacon) && beaconCode?.raw && beaconCode.raw !== "0x" &&
    beaconCode.codehash === p.beaconCodeHash && call("beacon-implementation", p.beacon, "implementation")?.decoded === p.implementation;
}

export function buildReport(input: CollectionResult) {
  const r = collectionSchema.parse(input);
  const { coverage, proxy } = r;
  coverage.notChecked = coverage.notChecked.filter(c => c.id !== "rules");
  const reads = new Map(r.evidence.map(e => [e.id, e]));
  for (const entry of coverage.checked) {
    const outcome = reads.get(entry.id)?.outcome;
    if (outcome && outcome !== "observed") entry.reason = outcome + " at the selected snapshot.";
  }
  if (r.status !== "collected" || !requiredEvidence(r, reads)) {
    const status = r.status === "not-analyzable" ? "not-analyzable" : "inconclusive";
    const reason = r.error?.kind ?? (status === "not-analyzable" ? "no-bytecode" : "missing-required-evidence");
    for (const entry of coverage.checked.filter(e => !reads.has(e.id))) {
      coverage.unavailable.push({ id: entry.id, reason: "Collection lacks the corresponding read evidence." });
    }
    coverage.checked = coverage.checked.filter(e => reads.has(e.id));
    coverage[status === "not-analyzable" ? "notApplicable" : "unavailable"].push({ id: "rules", reason });
    for (const group of Object.values(coverage)) group.sort(byId);
    return { status, reason, coverage, address: r.address, chainId: r.chainId, snapshot: r.snapshot,
      schemaVersion: r.schemaVersion, rulesetVersion: r.rulesetVersion, codehash: r.codehash,
      evidence: r.evidence, proxy, findings: [], signalScore: null, band: null, reportHash: null } as const;
  }
  const snapshot = r.snapshot!;
  const source = reads.get(proxy.status === "resolved" ? "implementation-code" : "target-code")!;
  const runtime = inspectRuntime(source.raw as Hex);
  const findings: Finding[] = [];
  const derived: DerivedEvidence[] = [];
  function observation(id: string, sourceEvidenceId: string, observation: DerivedEvidence["observation"]) {
    derived.push({ id, sourceEvidenceId, snapshot, observation });
    return id;
  }
  function add(id: string, weight: number, severity: Finding["severity"], confidence: Finding["confidence"],
    evidenceIds: string[], explanation: string) {
    findings.push({ id, weight, severity, confidence, evidenceIds, explanation });
  }
  for (const rule of dispatcherRules) {
    const ids = [];
    for (const signature of rule.signatures) {
      const match = runtime.matches.get(signature);
      if (match) ids.push(observation("dispatch-" + signature, source.id, { kind: "dispatcher-match", signature, ...match }));
    }
    if (ids.length) add(rule.id, rule.weight, rule.severity, "dispatcher-match", ids,
      "The dispatcher pattern indicates a possible entry point. Reachability, authority and limits are unknown.");
  }
  coverage.checked.push({ id: "dispatcher", reason: "Inspected " + source.id + " for ruleset 1 selector comparisons within linear basic blocks." },
    { id: "rules", reason: "Evaluated ruleset 1 using the collected snapshot." });
  if (runtime.truncated) coverage.notChecked.push({ id: "truncated-push",
    reason: "Incomplete PUSH operand at byte offset " + runtime.truncated.offset + " in " + source.id + "." });
  if (proxy.status === "resolved" && (proxy.kind === "erc1967" || proxy.kind === "beacon")) {
    add("R-PROXY", 25, "high", proxy.kind === "beacon" ? "call-result" : "slot-read", [...proxy.evidenceIds],
      "Supported one-hop ERC-1967 resolution identified the configured implementation at this snapshot.");
  } else if (proxy.status !== "resolved" && runtime.delegatecall) {
    const id = observation("target-delegatecall", source.id, { kind: "delegatecall", offset: String(runtime.delegatecall.offset) });
    add("R-PROXY-UNRESOLVED", 0, "info", "bytecode-pattern", [id, ...proxy.evidenceIds],
      "Target runtime contains DELEGATECALL and supported implementation resolution was unavailable.");
  }
  const owner = reads.get("owner")!;
  if (owner.decoded === ZERO) add("R-OWNER-RENOUNCED", 0, "info", "call-result", ["owner"],
    "owner() returned the zero address. Other control mechanisms are unknown.");
  else if (owner.decoded) {
    if (reads.get("owner-code")!.raw === "0x") add("R-OWNER-EOA", 10, "medium", "call-result", ["owner", "owner-code"],
      "owner() returned a nonzero address with no deployed code at this block. Its identity and control are unknown.");
    else add("R-OWNER-CONTRACT", 0, "info", "call-result", ["owner", "owner-code"],
      "The address returned by owner() has deployed code. Multisig status is unknown.");
  }
  const failed = (ids: string[]) => ids.filter(id => reads.get(id)!.outcome !== "observed");
  const required = failed(["total-supply", "balance-zero"]);
  if (required.length) add("R-NONSTANDARD", 10, "medium", "call-result", required,
    "Required read probe failed: " + required.map(id => id + " (" + reads.get(id)!.outcome + ")").join(", ") + ".");
  const optional = failed(["metadata-name", "metadata-symbol", "metadata-decimals"]);
  if (optional.length) add("R-METADATA-ABSENT", 0, "info", "call-result", optional,
    "Optional metadata unavailable: " + optional.map(id => probes[id] + " (" + reads.get(id)!.outcome + ")").join(", ") + ".");
  const scope = observation("source-scope", "target-code", { kind: "scope", coverageId: "source-verification" });
  add("R-SOURCE-UNKNOWN", 0, "info", null, [scope], "Source verification was not attempted.");
  const signalScore = Math.min(100, findings.reduce((total, f) => total + f.weight, 0));
  const body = parseReportBody({ schemaVersion: 1, rulesetVersion: 1, chainId: r.chainId, ...snapshot, address: r.address,
    codehash: r.codehash, proxy, coverage, evidence: [...r.evidence.map(wireEvidence), ...derived], findings, signalScore });
  return { ...body, status: "complete", band: signalScore < 25 ? "Few signals" : signalScore < 60 ? "Some signals" : "Many signals",
    reportHash: reportHash(body), body } as const;
}
