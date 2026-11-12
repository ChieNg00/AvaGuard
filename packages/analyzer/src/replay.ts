import { collectEvidence } from "./collector";
import { hashSchema } from "./evidence-schema";
import { parseReportBody, reportHash } from "./report-body";
import { buildReport } from "./rules";
import type { ReadTransport } from "./transport";

export async function replayReport(transport: ReadTransport, input: unknown, expectedHash: string) {
  if (input == null) return { status: "unavailable", reason: "missing-body" } as const;
  if (typeof input === "object" && "rulesetVersion" in input && input.rulesetVersion !== 1)
    return { status: "unavailable", reason: "unsupported-ruleset" } as const;
  const body = parseReportBody(input);
  const hash = hashSchema.parse(expectedHash.toLowerCase());
  if (reportHash(body) !== hash) return { status: "commitment-mismatch" } as const;
  const result = buildReport(await collectEvidence(transport, { address: body.address,
    historical: { blockNumber: body.blockNumber, blockHash: body.blockHash } }));
  if (result.status !== "complete") return { status: "inconclusive", reason: result.reason } as const;
  return { status: result.reportHash === hash ? "replay-matches" : "replay-mismatch", reportHash: result.reportHash } as const;
}
