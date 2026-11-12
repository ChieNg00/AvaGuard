import { keccak256, type Hex } from "viem";
import { z } from "zod";

export const addressSchema = z.string().regex(/^0x[0-9a-f]{40}$/);
export const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
export const decimalSchema = z.string().max(78).regex(/^(0|[1-9][0-9]*)$/);
export const snapshotSchema = z.strictObject({ blockNumber: decimalSchema, blockHash: hashSchema });
export const hexSchema = z.string().max(131074).regex(/^0x(?:[0-9a-f]{2})*$/);
export const errorKindSchema = z.enum(["transport", "rate-limit", "execution-revert", "malformed-return",
  "historical-state-unavailable", "snapshot-mismatch", "wrong-network", "invalid-response", "deadline"]);
export const collectionErrorSchema = z.strictObject({ kind: errorKindSchema, rpcCode: z.number().int().nullable() });
const entry = z.strictObject({ id: z.string().min(1).max(100), reason: z.string().min(1).max(1000) });
export const coverageSchema = z.strictObject({
  checked: z.array(entry).max(100), notChecked: z.array(entry).max(100),
  unavailable: z.array(entry).max(100), notApplicable: z.array(entry).max(100),
}).refine(c => {
  const ids = Object.values(c).flat().map(e => e.id);
  return new Set(ids).size === ids.length;
}, "Coverage IDs must be unique across categories");
export const confidenceSchema = z.enum(["dispatcher-match", "slot-read", "call-result", "bytecode-pattern"]);
export const evidenceSchema = z.strictObject({
  id: z.string().min(1).max(100), chainId: z.literal("43113"), snapshot: snapshotSchema,
  request: z.strictObject({
    method: z.enum(["eth_getCode", "eth_getStorageAt", "eth_call"]), address: addressSchema,
    slot: hashSchema.nullable(), data: hexSchema.nullable(), caller: addressSchema.nullable(),
    gas: decimalSchema.nullable(), value: decimalSchema.nullable(),
  }),
  confidence: confidenceSchema.nullable(), outcome: z.enum(["observed", "execution-revert", "malformed-return", "unavailable"]),
  derivation: z.literal("erc1167-runtime").nullable(), sourceEvidenceId: z.string().min(1).max(100).nullable(),
  codehash: hashSchema.nullable(), raw: hexSchema.nullable(), decoded: z.string().max(256).nullable(), error: collectionErrorSchema.nullable(),
}).superRefine((e, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (e.outcome === "observed" ? e.error !== null || e.raw === null : e.error === null) fail("Outcome/error mismatch");
  if (e.outcome !== "observed" && e.decoded !== null) fail("Failed reads cannot have decoded observations");
  if (e.outcome === "execution-revert" && e.error?.kind !== "execution-revert") fail("Revert kind mismatch");
  if (e.outcome === "malformed-return" && e.error?.kind !== "malformed-return") fail("Malformed kind mismatch");
  if (e.request.method === "eth_getCode" && e.outcome === "observed" ? e.codehash === null : e.codehash !== null) fail("Invalid code hash context");
  if (e.request.method === "eth_getCode" && e.outcome === "observed" && e.raw !== null && /^0x(?:[0-9a-f]{2})*$/.test(e.raw) && e.codehash !== keccak256(e.raw as Hex)) fail("Code hash does not match bytes");
  if (e.request.method === "eth_getStorageAt" && e.outcome === "observed" && e.raw?.length !== 66) fail("Invalid storage word");
  if (e.request.method === "eth_call") {
    if (e.request.data === null || e.request.caller === null || e.request.gas !== "3000000" || e.request.value !== "0" ||
        e.request.slot !== null || e.confidence !== "call-result") fail("Invalid fixed call context");
    if (e.request.caller !== "0x0000000000000000000000000000000000000000") fail("Caller must be fixed");
  } else if (e.request.caller !== null || e.request.data !== null || e.request.gas !== null || e.request.value !== null) fail("Unexpected call context");
  if (e.request.method === "eth_getStorageAt" && (e.request.slot === null || e.confidence !== "slot-read")) fail("Missing slot context");
  if (e.derivation === null ? e.sourceEvidenceId !== null : e.sourceEvidenceId === null) fail("Missing derivation source");
  if (e.derivation !== null && (e.request.method !== "eth_getCode" || e.confidence !== "bytecode-pattern" ||
      e.outcome !== "observed" || !/^0x363d3d373d3d3d363d73[0-9a-f]{40}5af43d82803e903d91602b57fd5bf3$/.test(e.raw ?? ""))) fail("Invalid exact-clone derivation");
  if (e.request.method === "eth_getCode" && (e.request.slot !== null || (e.derivation === null && e.confidence !== null))) fail("Plain code read has no capability confidence");
});
export const proxySchema = z.strictObject({
  kind: z.enum(["unresolved", "erc1967", "beacon", "erc1167"]),
  status: z.enum(["unresolved", "resolved", "unsupported"]),
  reason: z.string().max(1000),
  implementation: addressSchema.nullable(), implementationCodeHash: hashSchema.nullable(),
  beacon: addressSchema.nullable(), beaconCodeHash: hashSchema.nullable(),
  evidenceIds: z.array(z.string()).max(30),
});
export const collectionSchema = z.strictObject({
  stage: z.literal("evidence-collection"), schemaVersion: z.literal(1), rulesetVersion: z.literal(1),
  configurationVersion: z.literal(1), publishable: z.literal(false),
  status: z.enum(["collected", "inconclusive", "not-analyzable"]),
  address: addressSchema, chainId: decimalSchema.nullable(), snapshot: snapshotSchema.nullable(),
  codehash: hashSchema.nullable(), signalScore: z.null(), band: z.null(),
  error: collectionErrorSchema.nullable(), evidence: z.array(evidenceSchema).max(64),
  proxy: proxySchema, coverage: coverageSchema,
}).superRefine((r, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const ids = r.evidence.map(e => e.id);
  if (new Set(ids).size !== ids.length) fail("Duplicate evidence IDs");
  for (const e of r.evidence) {
    if (r.chainId !== e.chainId || !r.snapshot || e.snapshot.blockNumber !== r.snapshot.blockNumber ||
        e.snapshot.blockHash !== r.snapshot.blockHash) fail("Mixed snapshots/chains");
  }
  for (const e of r.evidence.filter(e => e.derivation !== null)) {
    const source = r.evidence.find(s => s.id === e.sourceEvidenceId);
    if (!source || source.derivation !== null || source.outcome !== "observed" || source.request.method !== "eth_getCode" ||
        source.request.address !== e.request.address || source.raw !== e.raw || source.codehash !== e.codehash) fail("Invalid derived evidence source");
  }
  if (r.proxy.evidenceIds.some(id => !ids.includes(id))) fail("Dangling proxy evidence");
  if (r.status !== "inconclusive" && (!r.snapshot || r.chainId !== "43113" || r.error !== null)) fail("Missing established snapshot");
  if (r.status === "collected" && (r.codehash === null || r.evidence.some(e => e.outcome === "unavailable"))) fail("Collection cannot complete after unavailable read");
  if (!r.snapshot && (r.codehash !== null || r.evidence.length !== 0)) fail("Pre-snapshot failure cannot contain state observations");
  if (r.status === "collected" && !r.evidence.some(e => e.id === "target-code" && e.request.address === r.address && e.request.method === "eth_getCode" && e.outcome === "observed" && e.raw !== "0x" && e.codehash === r.codehash)) fail("Target code commitment missing");
  if (r.status === "inconclusive" && r.error === null) fail("Inconclusive needs a reason");
  if (r.status === "not-analyzable" && (r.codehash !== null || !r.evidence.some(e =>
      e.request.method === "eth_getCode" && e.request.address === r.address && e.outcome === "observed" && e.raw === "0x"))) fail("No-code evidence required");
  if (r.proxy.status === "resolved" && (!r.proxy.implementation || !r.proxy.implementationCodeHash)) fail("Incomplete proxy dependency");
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CollectionResult = z.infer<typeof collectionSchema>;
export type ErrorKind = z.infer<typeof errorKindSchema>;
