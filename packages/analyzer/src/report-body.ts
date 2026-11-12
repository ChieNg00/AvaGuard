import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import { addressSchema, confidenceSchema, coverageSchema, decimalSchema, evidenceSchema, hashSchema, proxySchema,
  snapshotSchema, type Evidence } from "./evidence-schema";

const id = z.string().min(1).max(100);
const refs = z.array(id).min(1).max(64).refine(a => new Set(a).size === a.length, "Duplicate references");
export const reportFinding = z.strictObject({
  id, severity: z.enum(["info", "medium", "high"]), weight: z.number().int().min(0).max(100),
  confidence: confidenceSchema.nullable(), evidenceIds: refs, explanation: z.string().min(1).max(2000),
}).refine(f => (f.confidence === null) === (f.id === "R-SOURCE-UNKNOWN"),
  "Only the source scope declaration has no observation method");
const derived = z.strictObject({
  id, sourceEvidenceId: id, snapshot: snapshotSchema,
  observation: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("dispatcher-match"), signature: z.string().max(100),
      selector: z.string().regex(/^0x[0-9a-f]{8}$/), offset: decimalSchema, eqOffset: decimalSchema }),
    z.strictObject({ kind: z.literal("delegatecall"), offset: decimalSchema }),
    z.strictObject({ kind: z.literal("scope"), coverageId: z.literal("source-verification") }),
  ]),
});
export type DerivedEvidence = z.infer<typeof derived>;
export type Finding = z.infer<typeof reportFinding>;

// The on-wire JSON uses decimal strings for RPC error codes too.
export function wireEvidence(e: Evidence) {
  return { ...e, error: e.error && { ...e.error, rpcCode: e.error.rpcCode?.toString() ?? null } };
}
const wireRead = z.preprocess(input => {
  if (!input || typeof input !== "object" || !("error" in input) || !input.error ||
    typeof input.error !== "object" || !("rpcCode" in input.error) || input.error.rpcCode === null) return input;
  const code = input.error.rpcCode;
  if (typeof code !== "string" || !/^(0|-?[1-9][0-9]*)$/.test(code)) return null;
  return { ...input, error: { ...input.error, rpcCode: Number(code) } };
}, evidenceSchema).transform(wireEvidence);

const bodySchema = z.strictObject({
  schemaVersion: z.literal(1), rulesetVersion: z.literal(1), chainId: z.literal("43113"),
  blockNumber: decimalSchema, blockHash: hashSchema, address: addressSchema, codehash: hashSchema,
  proxy: proxySchema, evidence: z.array(z.union([wireRead, derived])).max(96),
  findings: z.array(reportFinding).max(64), coverage: coverageSchema, signalScore: z.number().int().min(0).max(100),
}).superRefine((b, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const ids = new Set(b.evidence.map(e => e.id));
  if (ids.size !== b.evidence.length || new Set(b.findings.map(f => f.id)).size !== b.findings.length) issue("Duplicate IDs");
  const links = [...b.proxy.evidenceIds, ...b.findings.flatMap(f => f.evidenceIds)];
  if (new Set(b.proxy.evidenceIds).size !== b.proxy.evidenceIds.length) issue("Duplicate proxy references");
  for (const e of b.evidence) {
    if (e.sourceEvidenceId !== null) links.push(e.sourceEvidenceId);
    if (e.snapshot.blockHash !== b.blockHash || e.snapshot.blockNumber !== b.blockNumber) issue("Mixed snapshots");
  }
  if (links.some(ref => !ids.has(ref))) issue("Dangling evidence reference");
  if (!b.evidence.some(e => "request" in e && e.id === "target-code" && e.request.method === "eth_getCode" &&
    e.request.address === b.address && e.codehash === b.codehash && e.raw !== "0x")) issue("Missing target code commitment");
  if (Math.min(100, b.findings.reduce((n, f) => n + f.weight, 0)) !== b.signalScore) issue("Invalid score");
});
export type ReportBody = z.infer<typeof bodySchema>;

export function byId(a: { id: string }, b: { id: string }) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return Object.fromEntries(entries.map(([key, child]) => [key, sortedKeys(child)]));
  }
  return value;
}

// Normalize only typed hex fields. Metadata strings and explanation text are opaque.
function normalizeHex(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const obj = { ...input } as Record<string, unknown>;
  for (const key of ["blockHash", "address", "codehash", "raw", "implementation", "beacon", "implementationCodeHash",
    "beaconCodeHash", "slot", "caller", "data", "selector"]) {
    if (typeof obj[key] === "string") obj[key] = obj[key].toLowerCase();
  }
  for (const key of ["proxy", "request", "snapshot", "observation"]) if (obj[key]) obj[key] = normalizeHex(obj[key]);
  if ((obj.id === "owner" || obj.id === "beacon-implementation") && typeof obj.decoded === "string") obj.decoded = obj.decoded.toLowerCase();
  if (Array.isArray(obj.evidence)) obj.evidence = obj.evidence.map(normalizeHex);
  return obj;
}
export function parseReportBody(input: unknown): ReportBody {
  const body = bodySchema.parse(normalizeHex(input));
  body.evidence.sort(byId);
  body.findings.sort(byId);
  body.proxy.evidenceIds.sort();
  for (const f of body.findings) f.evidenceIds.sort();
  for (const entries of Object.values(body.coverage)) entries.sort(byId);
  return body;
}
export function canonicalReportJson(body: ReportBody) {
  const { schemaVersion, rulesetVersion, chainId, blockNumber, blockHash, address, codehash,
    proxy, evidence, findings, coverage, signalScore } = body;
  return JSON.stringify(sortedKeys(parseReportBody({ schemaVersion, rulesetVersion, chainId,
    blockNumber, blockHash, address, codehash, proxy, evidence, findings, coverage, signalScore })));
}
export function reportHash(body: ReportBody) {
  return keccak256(stringToHex(canonicalReportJson(body)));
}
type VerifiedBody = { status: "commitment-matches" | "commitment-mismatch"; body: ReportBody };
type MissingBody = { status: "report-body-unavailable"; body: null };

export function verifyCommitment(json: string, expectedHash: string): VerifiedBody;
export function verifyCommitment(json: string | null | undefined, expectedHash: string): VerifiedBody | MissingBody;
export function verifyCommitment(json: string | null | undefined, expectedHash: string) {
  if (json == null) return { status: "report-body-unavailable", body: null } as const;
  const body = parseReportBody(JSON.parse(json));
  return { status: reportHash(body) === hashSchema.parse(expectedHash.toLowerCase()) ? "commitment-matches" : "commitment-mismatch", body } as const;
}
