"use client";
import { useEffect, useState } from "react";
import {
  canonicalReportJson,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import { Publish } from "./publish";

export function Coverage({ coverage }: Pick<ReportBody, "coverage">) {
  return (
    <details>
      <summary>
        Coverage · {coverage.checked.length} checked ·{" "}
        {coverage.unavailable.length} unavailable · {coverage.notChecked.length}{" "}
        outside scope
      </summary>
      {Object.entries(coverage).map(([group, items]) => (
        <div key={group}>
          <h4>{group}</h4>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.id} — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

export function ExplanationPanel({
  explanation,
  pending = false,
}: {
  explanation: ReportExplanation;
  pending?: boolean;
}) {
  const provenanceLabel =
    explanation.provenance === "ai-assisted"
      ? "AI-assisted explanation"
      : "Template explanation";

  return (
    <article className="explain-panel" aria-label="Report explanation">
      <div className="explain-header">
        <h3>Explanation</h3>
        <span className="provenance-badge">{provenanceLabel}</span>
      </div>
      {explanation.provenance === "ai-assisted" && explanation.model && (
        <p className="explain-meta">
          Model: <code>{explanation.model}</code> · Prompt v
          {explanation.promptVersion ?? "1"}
          {explanation.cached ? " · cached" : ""}
        </p>
      )}
      {pending && (
        <p role="status">
          Requesting AI-assisted explanation… Showing template explanation
          meanwhile.
        </p>
      )}
      {explanation.fallbackReason && (
        <p role="status">{explanation.fallbackReason}</p>
      )}
      <p>{explanation.overview}</p>
      <p>{explanation.coverageSummary}</p>
      {explanation.findings.length > 0 && (
        <div className="explain-findings">
          {explanation.findings.map((f) => (
            <div key={f.findingId} className="explain-finding">
              <h4>
                {f.findingId} · {f.severity} · +{f.weight}
              </h4>
              <p>{f.summary}</p>
              <p>{f.confidenceNote}</p>
              <p>
                Cited evidence:{" "}
                {f.evidenceIds.map((id, idx) => (
                  <span key={id}>
                    {idx > 0 ? ", " : ""}
                    <code>{id}</code>
                  </span>
                ))}
              </p>
              {f.suggestedChecks.length > 0 && (
                <>
                  <p>Suggested read-only checks (unexecuted):</p>
                  <ul>
                    {f.suggestedChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function Report({
  body,
  band,
  reportHash,
  initialExplanation,
  aiEnabled,
}: {
  body: ReportBody;
  band: string;
  reportHash: string;
  initialExplanation: ReportExplanation;
  aiEnabled: boolean;
}) {
  const [explanation, setExplanation] =
    useState<ReportExplanation>(initialExplanation);
  const [aiPending, setAiPending] = useState(aiEnabled);

  useEffect(() => {
    if (!aiEnabled) return;

    let cancelled = false;
    const controller = new AbortController();
    const expectedHash = reportHash;

    void (async () => {
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reportHash: expectedHash }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          ok?: boolean;
          explanation?: ReportExplanation;
          error?: string;
        };
        if (cancelled || controller.signal.aborted) {
          return;
        }
        if (
          response.ok &&
          data.ok &&
          data.explanation &&
          data.explanation.reportHash === expectedHash
        ) {
          setExplanation(data.explanation);
        } else {
          setExplanation({
            ...initialExplanation,
            fallbackReason:
              data.error ?? "AI explanation unavailable; showing template.",
          });
        }
      } catch {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setExplanation({
          ...initialExplanation,
          fallbackReason: "AI explanation unavailable; showing template.",
        });
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setAiPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [aiEnabled, initialExplanation, reportHash]);

  function download() {
    const url = URL.createObjectURL(
      new Blob([canonicalReportJson(body)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "avaguard-" + body.address + "-" + body.blockNumber + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section>
      <h2>
        {body.signalScore} / 100 · {band}
      </h2>
      <p>
        Confidence by observation:{" "}
        {[
          ...new Set(body.findings.map((f) => f.confidence).filter(Boolean)),
        ].join(", ") || "Scope declarations only"}
        .
      </p>
      <Coverage coverage={body.coverage} />
      <p>
        Chain {body.chainId} · Block {body.blockNumber}
        <br />
        <code>{body.blockHash}</code>
        <br />
        Target {body.address}
      </p>
      <h3>Findings and evidence</h3>
      {body.findings.map((f) => (
        <details key={f.id}>
          <summary>
            {f.id} · {f.severity} · +{f.weight}
          </summary>
          <p>
            {f.explanation} Confidence: {f.confidence ?? "scope declaration"}.
          </p>
          {f.evidenceIds.map((id) => (
            <pre key={id}>
              {JSON.stringify(
                body.evidence.find((e) => e.id === id),
                null,
                2,
              )}
            </pre>
          ))}
        </details>
      ))}
      <ExplanationPanel explanation={explanation} pending={aiPending} />
      <p>
        <button onClick={download}>Export canonical JSON</button>
      </p>
      <Publish key={body.blockHash + body.address} body={body} />
    </section>
  );
}
