import { expect, it } from "vitest";
import { zeroAddress } from "viem";
import { parseReportBody } from "@avaguard/analyzer";
import vector from "../../../fixtures/canonical-report-v1.json";
import { agrees, differences, publication } from "../lib/publication";

it("checks every retrieved field even when the canonical body hash matches", () => {
  const body = parseReportBody(vector);
  const tuple = publication(body);
  const summary = { ...tuple, blockNumber: tuple.blockNumber.toString() };
  expect(tuple.implementation).toBe(zeroAddress);
  expect(agrees(body, summary)).toBe(true);
  expect(agrees(body, { ...summary, score: summary.score + 1 })).toBe(false);
  expect(agrees(body, { ...summary, blockNumber: "9007199254740993" })).toBe(false);
});

it("compares proxy, coverage, findings and observations across snapshots", () => {
  const body = parseReportBody(vector);
  const current = structuredClone(body);
  current.blockNumber = "9007199254740993";
  for (const e of current.evidence) e.snapshot.blockNumber = current.blockNumber;
  expect(differences(body, current)).toEqual([]);
  current.proxy.implementation = body.address;
  current.coverage.checked.pop();
  current.findings[0].explanation += " changed";
  current.evidence.pop();
  const fields = differences(body, current).map(change => change.field);
  for (const prefix of ["Proxy", "Coverage ", "Finding ", "Evidence "])
    expect(fields.some(field => field.startsWith(prefix))).toBe(true);
});
