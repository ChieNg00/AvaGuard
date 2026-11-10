import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/schema-inconclusive.json";
import { reportSchema, resultLabel } from "../src/index";
describe("report foundation boundary", () => {
  it("accepts labeled synthetic unavailable input without a score", () => {
    const r = reportSchema.parse(fixture);
    expect(resultLabel(r)).toBe("Inconclusive");
    expect(r.signalScore).toBeNull();
  });
  it.each([
    { signalScore: 0 }, { band: "Few signals" }, { schemaVersion: 2 },
    { rulesetVersion: 2 }, { chainId: "43114" }, { chainId: 43113 },
    { address: "0x123" }, { address: "0x" + "A".repeat(40) },
    { snapshot: { ...fixture.snapshot, blockNumber: "01" } },
    { snapshot: { ...fixture.snapshot, blockHash: "0x12" } },
    { reason: "execution-revert" }, { invented: true },
  ])("rejects malformed or misleading report override %j", patch => {
    expect(reportSchema.safeParse({ ...fixture, ...patch }).success).toBe(false);
  });
  it("rejects duplicate coverage IDs across categories", () => {
    expect(reportSchema.safeParse({ ...fixture, coverage: {
      ...fixture.coverage, checked: fixture.coverage.unavailable,
    }}).success).toBe(false);
  });
  it("keeps no-code separate from unavailable", () => {
    const r = reportSchema.parse({ ...fixture, status: "not-analyzable", reason: "no-bytecode" });
    expect(resultLabel(r)).toBe("Not analyzable");
    expect(reportSchema.safeParse({ ...r, signalScore: 0 }).success).toBe(false);
  });
  it.each([[0,"Few signals"],[24,"Few signals"],[25,"Some signals"],[59,"Some signals"],[60,"Many signals"],[100,"Many signals"]])("accepts score boundary %s with adjacent coverage/confidence", (signalScore, band) => {
    const { reason: _reason, ...base } = fixture;
    void _reason;
    expect(reportSchema.safeParse({ ...base, status: "complete", codehash: fixture.snapshot.blockHash,
      signalScore, band, confidence: ["call-result"] }).success).toBe(true);
  });
  it("rejects score/band mismatch and missing confidence", () => {
    const { reason: _reason, ...base } = fixture;
    void _reason;
    const complete = { ...base, status: "complete", codehash: fixture.snapshot.blockHash, signalScore: 25, band: "Few signals", confidence: ["call-result"] };
    expect(reportSchema.safeParse(complete).success).toBe(false);
    expect(reportSchema.safeParse({ ...complete, band: "Some signals", confidence: [] }).success).toBe(false);
    expect(reportSchema.safeParse({ ...complete, signalScore: 101 }).success).toBe(false);
  });
});
