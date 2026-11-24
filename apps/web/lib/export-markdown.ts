import {
  EXPLAIN_PROMPT_VERSION,
  reportHash,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";

export type MarkdownCommitmentContext = {
  attester?: string;
  publishedAt?: string;
  stale?: boolean;
};

function escapeTableCell(value: string): string {
  return value.replace(/\r?\n+/g, " ").replace(/\|/g, "\\|");
}

function formatScoreBand(score: number): string {
  if (score < 25) return "Few signals";
  if (score < 60) return "Some signals";
  return "Many signals";
}

function formatPublishedAt(publishedAt: string): string {
  if (/^\d+$/.test(publishedAt)) {
    const seconds = Number(publishedAt);
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return `${publishedAt} (${new Date(seconds * 1000).toISOString()})`;
    }
  }
  return publishedAt;
}

/**
 * Formats an analyzed or verified-commitment AvaGuard report into a portable,
 * evidence-bound Markdown summary without altering canonical JSON or hashes.
 */
export function formatReportMarkdown(
  body: ReportBody,
  explanation: ReportExplanation,
  commitment?: MarkdownCommitmentContext,
): string {
  const hash = reportHash(body);
  const band = formatScoreBand(body.signalScore);

  const summaryRows: Array<[string, string]> = [
    ["Signal Score", `${body.signalScore} / 100 (${band})`],
    ["Target", `\`${body.address}\``],
    ["Chain ID", `\`${body.chainId}\``],
    ["Block Number", `\`${body.blockNumber}\``],
    ["Block Hash", `\`${body.blockHash}\``],
    ["Codehash", `\`${body.codehash}\``],
    ["Ruleset Version", `\`${body.rulesetVersion}\``],
    ["Report Hash", `\`${hash}\``],
  ];

  if (body.proxy.implementation) {
    summaryRows.push([
      "Proxy Implementation",
      `\`${body.proxy.implementation}\``,
    ]);
  }

  if (commitment) {
    if (commitment.attester) {
      summaryRows.push(["On-Chain Attester", `\`${commitment.attester}\``]);
    }
    if (commitment.publishedAt !== undefined) {
      summaryRows.push([
        "Published At",
        formatPublishedAt(commitment.publishedAt),
      ]);
    }
    if (commitment.stale !== undefined) {
      summaryRows.push([
        "Target Runtime Code",
        commitment.stale ? "changed" : "unchanged",
      ]);
    }
  }

  const lines: string[] = [
    "# AvaGuard Risk-Signal Report",
    "",
    "> Signal scores describe observed risk signals, never safety certification or an audit. Coverage and confidence are required for interpretation.",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...summaryRows.map(
      ([label, value]) =>
        `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`,
    ),
  ];

  if (explanation.provenance === "ai-assisted" && explanation.aiSummary) {
    const metaParts: string[] = [];
    if (explanation.model) {
      metaParts.push(`Model: \`${explanation.model}\``);
    }
    metaParts.push(
      `Prompt v${explanation.promptVersion ?? EXPLAIN_PROMPT_VERSION}`,
    );
    if (explanation.language) {
      metaParts.push(
        explanation.language === "vi" ? "Tiếng Việt" : "English",
      );
    }
    if (explanation.cached) {
      metaParts.push("cached");
    }

    lines.push(
      "",
      "## AI Summary",
      "",
      metaParts.join(" · "),
      "",
      "*AI-generated narrative — verify against deterministic evidence below.*",
      "",
      explanation.aiSummary,
    );
  }

  lines.push(
    "",
    "## Deterministic Overview & Coverage",
    "",
    explanation.overview,
    "",
    explanation.coverageSummary,
    "",
    "## Findings & Evidence",
  );

  if (explanation.findings.length === 0) {
    lines.push("", "_No findings recorded for this snapshot._");
  } else {
    for (const finding of explanation.findings) {
      lines.push(
        "",
        `### ${finding.findingId} (${finding.severity}, +${finding.weight})`,
        "",
      );
      if (finding.aiNote) {
        lines.push(`- **AI note:** ${finding.aiNote}`);
      }
      lines.push(`- **Summary:** ${finding.summary}`);
      lines.push(`- **Confidence:** ${finding.confidenceNote}`);
      const cited = finding.evidenceIds.map((id) => `\`${id}\``).join(", ");
      lines.push(`- **Cited evidence:** ${cited}`);
      if (finding.suggestedChecks.length > 0) {
        lines.push("- **Suggested read-only checks (unexecuted):**");
        for (const check of finding.suggestedChecks) {
          lines.push(`  - ${check}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}
