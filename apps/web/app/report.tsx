"use client";
import { useEffect, useState } from "react";
import {
  canonicalReportJson,
  EXPLAIN_PROMPT_VERSION,
  EXPLAIN_PROMPT_VERSION_V3,
  type ExplainLanguage,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import { formatReportMarkdown } from "../lib/export-markdown";
import type { PublicPublicationConfig } from "../lib/publication-config";
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
  language,
  onRequestAi,
  onLanguageChange,
  onRetry,
}: {
  explanation: ReportExplanation;
  pending?: boolean;
  language?: ExplainLanguage;
  onRequestAi?: () => void;
  onLanguageChange?: (language: ExplainLanguage) => void;
  onRetry?: () => void;
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
        {onLanguageChange ? (
          <div
            className="explain-lang"
            role="group"
            aria-label="AI explanation language"
          >
            <button
              type="button"
              className={language === "en" ? "active" : undefined}
              aria-pressed={language === "en"}
              disabled={pending}
              onClick={() => onLanguageChange("en")}
            >
              English
            </button>
            <button
              type="button"
              className={language === "vi" ? "active" : undefined}
              aria-pressed={language === "vi"}
              disabled={pending}
              onClick={() => onLanguageChange("vi")}
            >
              Tiếng Việt
            </button>
          </div>
        ) : (
          onRequestAi && (
            <button
              type="button"
              className="explain-trigger"
              disabled={pending}
              onClick={onRequestAi}
            >
              Explain with AI
            </button>
          )
        )}
      </div>
      {explanation.provenance === "ai-assisted" && explanation.model && (
        <p className="explain-meta">
          Model: <code>{explanation.model}</code> · Prompt v
          {explanation.promptVersion ?? EXPLAIN_PROMPT_VERSION}
          {explanation.language
            ? ` · ${explanation.language === "vi" ? "Tiếng Việt" : "English"}`
            : ""}
          {explanation.cached ? " · cached" : ""}
        </p>
      )}
      {pending && (
        <p role="status">
          {language
            ? `Requesting ${language === "vi" ? "Tiếng Việt" : "English"} AI explanation…`
            : "Requesting AI-assisted explanation… Showing template explanation meanwhile."}
        </p>
      )}
      {explanation.fallbackReason && (
        <div className="explain-fallback" role="status">
          <span>{explanation.fallbackReason}</span>
          {!pending && onRetry && (
            <button
              type="button"
              className="explain-retry"
              onClick={onRetry}
            >
              Retry AI
            </button>
          )}
        </div>
      )}
      {explanation.aiSummary && (
        <div className="explain-ai-summary">
          <p className="explain-ai-label">
            AI summary (verify against deterministic evidence below)
          </p>
          <p>{explanation.aiSummary}</p>
        </div>
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
              {f.aiNote && (
                <p className="explain-ai-note">
                  <strong>AI note:</strong> {f.aiNote}
                </p>
              )}
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
  aiPromptVersion = EXPLAIN_PROMPT_VERSION,
  explainToken = null,
  publicationConfig,
}: {
  body: ReportBody;
  band: string;
  reportHash: string;
  initialExplanation: ReportExplanation;
  aiEnabled: boolean;
  aiPromptVersion?: string;
  explainToken?: string | null;
  publicationConfig: PublicPublicationConfig;
}) {
  const [explanation, setExplanation] =
    useState<ReportExplanation>(initialExplanation);
  const [aiPending, setAiPending] = useState(aiEnabled);
  const [aiLanguage, setAiLanguage] = useState<ExplainLanguage>("en");
  const [retryNonce, setRetryNonce] = useState(0);
  const supportsLanguageSwitch =
    aiEnabled && aiPromptVersion === EXPLAIN_PROMPT_VERSION_V3;

  function handleLanguageChange(nextLanguage: ExplainLanguage) {
    if (nextLanguage === aiLanguage) return;
    setAiPending(true);
    setAiLanguage(nextLanguage);
  }

  function handleRetry() {
    setAiPending(true);
    setRetryNonce((n) => n + 1);
  }

  useEffect(() => {
    if (!aiEnabled) return;

    let cancelled = false;
    const controller = new AbortController();
    const expectedHash = reportHash;
    const payload = {
      reportHash: expectedHash,
      ...(explainToken ? { explainToken } : {}),
      ...(aiPromptVersion === EXPLAIN_PROMPT_VERSION_V3
        ? { language: aiLanguage }
        : {}),
    };

    void (async () => {
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
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
  }, [
    aiEnabled,
    aiLanguage,
    aiPromptVersion,
    explainToken,
    initialExplanation,
    reportHash,
    retryNonce,
  ]);

  function downloadFile(content: string, type: string, extension: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "avaguard-" + body.address + "-" + body.blockNumber + "." + extension;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function download() {
    downloadFile(canonicalReportJson(body), "application/json", "json");
  }
  function downloadMarkdown() {
    downloadFile(
      formatReportMarkdown(body, explanation),
      "text/markdown;charset=utf-8",
      "md",
    );
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
      <ExplanationPanel
        explanation={explanation}
        pending={aiPending}
        language={supportsLanguageSwitch ? aiLanguage : undefined}
        onLanguageChange={
          supportsLanguageSwitch ? handleLanguageChange : undefined
        }
        onRetry={aiEnabled ? handleRetry : undefined}
      />
      <p className="action-row">
        <button type="button" onClick={download}>
          Export canonical JSON
        </button>
        <button type="button" className="secondary" onClick={downloadMarkdown}>
          Export Markdown
        </button>
      </p>
      <Publish
        key={body.blockHash + body.address}
        body={body}
        publicationConfig={publicationConfig}
      />
    </section>
  );
}
