import { keccak256, toHex, type Hex } from "viem";
import { addressSchema, collectionSchema, hexSchema, snapshotSchema, type CollectionResult, type Evidence, type Snapshot } from "./evidence-schema";
import { BEACON_SLOT, IMPLEMENTATION_SLOT, PROBE_CONFIGURATION, ZERO, decodeProbe, minimalImplementation, probeData, slotAddress, type Probe } from "./probes";
import { ReadError, type ReadMethod, type ReadTransport } from "./transport";

const limits = [
  ["source-verification", "Source verification is not attempted."],
  ["privileged-access", "Privileged-function access control is not evaluated."],
  ["tokenomics", "Tokenomics, liquidity and holder concentration are not evaluated."],
  ["custom-dispatch", "Non-Solidity/custom dispatch is not evaluated."],
  ["unsupported-proxies", "Custom, diamond, legacy and nested proxy layouts are unsupported."],
  ["clone-integration", "ERC-1167 has parser-only coverage; integration behavior is not evaluated."],
  ["rules", "Rules, findings, scores and canonical publication reports are not implemented in M2."],
] as const;
export async function collectEvidence(transport: ReadTransport, input: { address: string; historical?: Snapshot }): Promise<CollectionResult> {
  const address = addressSchema.parse(input.address) as Hex;
  const historical = input.historical ? snapshotSchema.parse(input.historical) : undefined;
  const r: CollectionResult = {
    stage: "evidence-collection", schemaVersion: 1, rulesetVersion: 1, configurationVersion: 1,
    publishable: false, status: "inconclusive", address, chainId: null, snapshot: null, codehash: null,
    signalScore: null, band: null, error: null, evidence: [],
    proxy: { kind: "unresolved", status: "unresolved", reason: "Not collected.", implementation: null,
      implementationCodeHash: null, beacon: null, beaconCodeHash: null, evidenceIds: [] },
    coverage: { checked: [], notChecked: limits.map(([id, reason]) => ({ id, reason })), unavailable: [], notApplicable: [] },
  };
  const deadline = Date.now() + PROBE_CONFIGURATION.deadlineMs;
  async function request(method: ReadMethod, params: readonly unknown[]): Promise<unknown> {
    for (let attempt = 0; attempt < PROBE_CONFIGURATION.attempts; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ReadError("deadline");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([transport.request(method, params), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ReadError("transport")), Math.min(remaining, PROBE_CONFIGURATION.requestTimeoutMs));
        })]);
      } catch (e) {
        const error = e instanceof ReadError ? e : new ReadError("transport");
        if (!["transport", "rate-limit"].includes(error.kind) || attempt === PROBE_CONFIGURATION.attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      } finally { clearTimeout(timer); }
    }
    throw new ReadError("transport");
  }
  function header(value: unknown, expectedNumber?: string): Snapshot {
    if (!value || typeof value !== "object") throw new ReadError("snapshot-mismatch");
    const h = value as { number?: unknown; hash?: unknown };
    if (typeof h.number !== "string" || h.number.length > 66 || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(h.number) ||
        typeof h.hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(h.hash)) throw new ReadError("invalid-response");
    const snapshot = { blockNumber: BigInt(h.number).toString(), blockHash: h.hash.toLowerCase() };
    if (expectedNumber !== undefined && snapshot.blockNumber !== expectedNumber) throw new ReadError("snapshot-mismatch");
    return snapshot;
  }
  function chain(value: unknown): string {
    if (typeof value !== "string" || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value) || value.length > 66) throw new ReadError("invalid-response");
    return BigInt(value).toString();
  }
  let B: Hex;
  async function read(id: string, method: Evidence["request"]["method"], target: Hex, arg: Hex | null, probe?: Probe): Promise<Evidence> {
    const e: Evidence = { id, chainId: "43113", snapshot: r.snapshot!,
      request: { method, address: target, slot: method === "eth_getStorageAt" ? arg : null,
        data: method === "eth_call" ? arg : null, caller: method === "eth_call" ? ZERO : null,
        gas: method === "eth_call" ? "3000000" : null, value: method === "eth_call" ? "0" : null },
      confidence: method === "eth_call" ? "call-result" : method === "eth_getStorageAt" ? "slot-read" : null,
      outcome: "observed", derivation: null, sourceEvidenceId: null, codehash: null, raw: null, decoded: null, error: null };
    r.evidence.push(e);
    try {
      const params = method === "eth_call"
        ? [{ to: target, from: ZERO, data: arg, gas: toHex(3000000), value: "0x0" }, B]
        : method === "eth_getStorageAt" ? [target, arg, B] : [target, B];
      const raw = await request(method, params);
      if (typeof raw !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(raw) || raw.length > 131074) {
        if (probe && typeof raw === "string" && /^0x(?:[0-9a-f]{2})*$/i.test(raw) && raw.length <= 262144)
          throw new ReadError("malformed-return");
        throw new ReadError("invalid-response");
      }
      e.raw = hexSchema.parse(raw.toLowerCase()) as Hex;
      if (method === "eth_getStorageAt" && e.raw.length !== 66) throw new ReadError("invalid-response");
      if (method === "eth_getCode") e.codehash = keccak256(e.raw as Hex);
      if (probe) {
        try { e.decoded = decodeProbe(probe, e.raw as Hex); } catch { throw new ReadError("malformed-return"); }
      }
      r.coverage.checked.push({ id, reason: "Read completed at the selected snapshot; checked does not mean passed." });
    } catch (err) {
      const error = err instanceof ReadError ? err : new ReadError("invalid-response");
      e.error = { kind: error.kind, rpcCode: error.rpcCode };
      e.decoded = null;
      if (probe && ["execution-revert", "malformed-return"].includes(error.kind)) {
        e.outcome = error.kind as "execution-revert" | "malformed-return";
        r.coverage.checked.push({ id, reason: error.kind + " observed; interpretation deferred to M3." });
      } else {
        e.outcome = "unavailable";
        r.coverage.unavailable.push({ id, reason: error.kind });
        throw error;
      }
    }
    return e;
  }
  const code = (id: string, target: Hex) => read(id, "eth_getCode", target, null);
  const call = (id: string, target: Hex, name: Probe) => read(id, "eth_call", target, probeData(name), name);
  const slot = (id: string, target: Hex, key: Hex) => read(id, "eth_getStorageAt", target, key);
  const isUnsupported = () => r.proxy.status === "unsupported";
  function unsupported(reason: string) {
    r.proxy.status = "unsupported"; r.proxy.reason = reason;
    r.coverage.notChecked.push({ id: "proxy-runtime-gap", reason });
  }
  try {
    r.chainId = chain(await request("eth_chainId", []));
    if (r.chainId !== "43113") throw new ReadError("wrong-network");
    const selected = historical ? toHex(BigInt(historical.blockNumber)) : "latest";
    const initial = await request("eth_getBlockByNumber", [selected, false]);
    if (initial === null && historical) throw new ReadError("historical-state-unavailable");
    const snap = header(initial, historical?.blockNumber);
    if (historical && snap.blockHash !== historical.blockHash) throw new ReadError("snapshot-mismatch");
    r.snapshot = snap;
    B = toHex(BigInt(snap.blockNumber));
    const targetCode = await code("target-code", address);
    if (targetCode.raw === "0x") r.coverage.notApplicable.push({ id: "contract-reads", reason: "No bytecode at B; contract calls and proxy resolution were not attempted." });
    if (targetCode.raw !== "0x") {
      r.codehash = keccak256(targetCode.raw as Hex);
      r.proxy.evidenceIds.push(targetCode.id);
      const implSlot = await slot("proxy-implementation-slot", address, IMPLEMENTATION_SLOT);
      let implementation: Hex | null = null;
      try { implementation = slotAddress(implSlot.raw as Hex); } catch { unsupported("Implementation slot is not a padded address."); }
      r.proxy.evidenceIds.push(implSlot.id);
      if (!isUnsupported() && implementation) r.proxy.kind = "erc1967";
      if (!isUnsupported() && !implementation) {
        const beaconSlot = await slot("proxy-beacon-slot", address, BEACON_SLOT);
        r.proxy.evidenceIds.push(beaconSlot.id);
        let beacon: Hex | null = null;
        try { beacon = slotAddress(beaconSlot.raw as Hex); } catch { unsupported("Beacon slot is not a padded address."); }
        if (!isUnsupported() && beacon) {
          r.proxy.kind = "beacon"; r.proxy.beacon = beacon;
          const beaconCode = await code("beacon-code", beacon);
          r.proxy.evidenceIds.push(beaconCode.id);
          if (beaconCode.raw === "0x") unsupported("Beacon address has no code.");
          else {
            r.proxy.beaconCodeHash = keccak256(beaconCode.raw as Hex);
            const be = await call("beacon-implementation", beacon, "implementation");
            r.proxy.evidenceIds.push(be.id);
            if (be.outcome !== "observed" || be.decoded === ZERO) unsupported("Beacon implementation call did not yield a nonzero address.");
            else implementation = be.decoded as Hex;
          }
        } else if (!isUnsupported()) {
          implementation = minimalImplementation(targetCode.raw as Hex);
          if (implementation) {
            r.proxy.kind = "erc1167";
            const pattern: Evidence = { ...targetCode, id: "proxy-minimal-pattern", confidence: "bytecode-pattern",
              derivation: "erc1167-runtime", sourceEvidenceId: targetCode.id };
            r.evidence.push(pattern);
            r.proxy.evidenceIds.push(pattern.id);
          }
        }
      }
      if (implementation && !isUnsupported()) {
        r.proxy.implementation = implementation;
        if (implementation === address || implementation === r.proxy.beacon) unsupported("Proxy dependency loop.");
        else {
          const implCode = await code("implementation-code", implementation);
          r.proxy.evidenceIds.push(implCode.id);
          if (implCode.raw === "0x") unsupported("Implementation address has no code.");
          else {
            r.proxy.implementationCodeHash = keccak256(implCode.raw as Hex);
            // One-hop bound. Inspect supported nested layouts without following a second hop.
            const innerI = await slot("implementation-nested-slot", implementation, IMPLEMENTATION_SLOT);
            const innerB = await slot("implementation-nested-beacon", implementation, BEACON_SLOT);
            r.proxy.evidenceIds.push(innerI.id, innerB.id);
            if (innerI.raw !== "0x" + "0".repeat(64) || innerB.raw !== "0x" + "0".repeat(64) || minimalImplementation(implCode.raw as Hex))
              unsupported("Nested implementation layout is unsupported.");
            else { r.proxy.status = "resolved"; r.proxy.reason = "Supported one-hop dependency collected; custom layouts remain unexamined."; }
          }
        }
      }
      if (r.proxy.status === "unresolved") r.proxy.reason = "Empty standard slots and no exact ERC-1167 match do not prove absence of a proxy.";
      // All state probes run against TARGET, never the implementation.
      await call("total-supply", address, "totalSupply");
      await call("balance-zero", address, "balanceOf");
      const owner = await call("owner", address, "owner");
      if (owner.outcome === "observed" && owner.decoded !== ZERO) await code("owner-code", owner.decoded as Hex);
      for (const name of ["name", "symbol", "decimals"] as const) await call("metadata-" + name, address, name);
    }
    const final = header(await request("eth_getBlockByNumber", [B, false]), snap.blockNumber);
    if (final.blockHash !== snap.blockHash) throw new ReadError("snapshot-mismatch");
    if (chain(await request("eth_chainId", [])) !== r.chainId) throw new ReadError("wrong-network");
    r.status = targetCode.raw === "0x" ? "not-analyzable" : "collected";
  } catch (err) {
    const e = err instanceof ReadError ? err : new ReadError("invalid-response");
    r.status = "inconclusive"; r.error = { kind: e.kind, rpcCode: e.rpcCode };
    if (!r.coverage.unavailable.length) r.coverage.unavailable.push({ id: "snapshot-workflow", reason: e.kind });
  }
  const planned = ["target-code", "proxy-implementation-slot", "total-supply", "balance-zero", "owner", "metadata-name", "metadata-symbol", "metadata-decimals"];
  for (const id of planned.filter(id => !r.evidence.some(e => e.id === id))) {
    if (r.status === "not-analyzable") r.coverage.notApplicable.push({ id, reason: "No target bytecode at B; this contract read is not applicable." });
    else r.coverage.notChecked.push({ id, reason: "Collection halted before this read was attempted." });
  }
  for (const group of Object.values(r.coverage)) group.sort((a, b) => a.id.localeCompare(b.id));
  r.evidence.sort((a, b) => a.id.localeCompare(b.id));
  return collectionSchema.parse(r);
}
