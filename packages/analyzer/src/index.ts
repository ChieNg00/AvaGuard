import { z } from "zod";
import { addressSchema, hashSchema, decimalSchema, snapshotSchema, coverageSchema, evidenceSchema, confidenceSchema } from "./evidence-schema";
export * from "./evidence-schema";
export * from "./collector";
export * from "./transport";
export * from "./probes";

// Legacy M1 scored envelope; not a canonical publication schema. M2 collectors never return this type.
export const findingSchema = z.strictObject({
  id: z.string().min(1).max(100), severity: z.enum(["info", "medium", "high"]),
  weight: z.number().int().min(0).max(100), confidence: confidenceSchema,
  evidenceIds: z.array(z.string().min(1)).min(1).max(64),
  explanation: z.string().min(1).max(2000),
});
const common = {
  schemaVersion: z.literal(1), rulesetVersion: z.literal(1), chainId: z.literal("43113"),
  address: addressSchema, snapshot: snapshotSchema, codehash: hashSchema.nullable(), coverage: coverageSchema,
  evidence: z.array(evidenceSchema).max(64).default([]), findings: z.array(findingSchema).max(64).default([]),
};
export const reportSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...common, status: z.literal("complete"), codehash: hashSchema,
    signalScore: z.number().int().min(0).max(100),
    band: z.enum(["Few signals", "Some signals", "Many signals"]),
  }).refine(r => r.band === (r.signalScore < 25 ? "Few signals" : r.signalScore < 60 ? "Some signals" : "Many signals"), "Score and band disagree"),
  z.strictObject({ ...common, status: z.literal("inconclusive"),
    signalScore: z.null(), band: z.null(),
    reason: z.enum(["transport", "rate-limit", "historical-state-unavailable", "snapshot-mismatch", "wrong-network", "invalid-response"]),
  }),
  z.strictObject({ ...common, status: z.literal("not-analyzable"), codehash: z.null(),
    signalScore: z.null(), band: z.null(), reason: z.literal("no-bytecode"),
  }),
]).superRefine((r, ctx) => {
  const ids = r.evidence.map(e => e.id);
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(ids).size !== ids.length || new Set(r.findings.map(f => f.id)).size !== r.findings.length) fail("Duplicate IDs");
  for (const f of r.findings) {
    if (new Set(f.evidenceIds).size !== f.evidenceIds.length || f.evidenceIds.some(id => !ids.includes(id))) fail("Invalid finding evidence references");
  }
  for (const e of r.evidence) if (e.chainId !== r.chainId || e.snapshot.blockNumber !== r.snapshot.blockNumber ||
    e.snapshot.blockHash !== r.snapshot.blockHash) fail("Mixed snapshots");
});
export type ReportSkeleton = z.infer<typeof reportSchema>;
export function resultLabel(report: ReportSkeleton): string {
  if (report.status === "complete") return report.band;
  return report.status === "not-analyzable" ? "Not analyzable" : "Inconclusive";
}
export { decimalSchema };
