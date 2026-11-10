import { z } from "zod";

// Foundation schema only: not a canonical publication payload or a scanner.
export const addressSchema = z.string().regex(/^0x[0-9a-f]{40}$/);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const decimal = z.string().regex(/^(0|[1-9][0-9]*)$/);
const entry = z.strictObject({ id: z.string().min(1).max(100), reason: z.string().min(1).max(1000) });
export const coverageSchema = z.strictObject({
  checked: z.array(entry).max(100), notChecked: z.array(entry).max(100),
  unavailable: z.array(entry).max(100), notApplicable: z.array(entry).max(100),
}).refine(c => {
  const ids = Object.values(c).flat().map(e => e.id);
  return new Set(ids).size === ids.length;
}, "Coverage IDs must be unique across categories");
const snapshot = z.strictObject({ blockNumber: decimal, blockHash: hash });
const common = {
  schemaVersion: z.literal(1), rulesetVersion: z.literal(1), chainId: z.literal("43113"),
  address: addressSchema, snapshot, codehash: hash.nullable(), coverage: coverageSchema,
};
export const reportSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...common, status: z.literal("complete"), codehash: hash,
    signalScore: z.number().int().min(0).max(100),
    band: z.enum(["Few signals", "Some signals", "Many signals"]),
    confidence: z.array(z.enum(["dispatcher-match", "slot-read", "call-result", "bytecode-pattern"])).min(1),
  }).refine(r => r.band === (r.signalScore < 25 ? "Few signals" : r.signalScore < 60 ? "Some signals" : "Many signals"), "Score and band disagree"),
  z.strictObject({ ...common, status: z.literal("inconclusive"),
    signalScore: z.null(), band: z.null(),
    reason: z.enum(["transport", "rate-limit", "historical-state-unavailable", "snapshot-mismatch", "wrong-network", "invalid-response"]),
  }),
  z.strictObject({ ...common, status: z.literal("not-analyzable"), codehash: z.null(),
    signalScore: z.null(), band: z.null(), reason: z.literal("no-bytecode"),
  }),
]);
export type ReportSkeleton = z.infer<typeof reportSchema>;
export function resultLabel(report: ReportSkeleton): string {
  if (report.status === "complete") return report.band;
  return report.status === "not-analyzable" ? "Not analyzable" : "Inconclusive";
}
