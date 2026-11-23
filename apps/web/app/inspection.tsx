"use client";
import { useEffect, useRef, useState } from "react";
import {
  buildTemplateExplanation,
  EXPLAIN_PROMPT_VERSION,
  EXPLAIN_PROMPT_VERSION_V3,
  verifyCommitment,
  type ExplainLanguage,
  type ReportBody,
  type ReportExplanation,
} from "@avaguard/analyzer";
import { formatReportMarkdown } from "../lib/export-markdown";
import { agrees, differences } from "../lib/publication";
import {
  lookup,
  prepareImportedExplanation,
  replay,
  scan,
} from "./actions";
import { Coverage, ExplanationPanel } from "./report";

type Item = NonNullable<
  Extract<Awaited<ReturnType<typeof lookup>>, { ok: true }>["data"]
>;

export function Inspection({ item }: { item: Item }) {
  const { report } = item;
  const [trackedHash, setTrackedHash] = useState(report.reportHash);
  const [body, setBody] = useState<ReportBody>();
  const [templateExplanation, setTemplateExplanation] =
    useState<ReportExplanation>();
  const [explanation, setExplanation] = useState<ReportExplanation>();
  const [templateLimitation, setTemplateLimitation] = useState<string>();
  const [aiActivated, setAiActivated] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<ExplainLanguage>("en");
  const [preparedAi, setPreparedAi] = useState<{
    reportHash: string;
    explainToken: string | null;
    aiPromptVersion: string;
  } | null>(null);
  const [status, setStatus] = useState("Report body unavailable.");
  const [detail, setDetail] = useState("");
  const [importing, setImporting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const versions = useRef({ importId: 0, compareId: 0 });
  const aiAbortRef = useRef<AbortController | null>(null);

  if (trackedHash !== report.reportHash) {
    setTrackedHash(report.reportHash);
    setBody(undefined);
    setTemplateExplanation(undefined);
    setExplanation(undefined);
    setTemplateLimitation(undefined);
    setAiActivated(false);
    setAiPending(false);
    setAiLanguage("en");
    setPreparedAi(null);
    setStatus("Report body unavailable.");
    setDetail("");
    setImporting(false);
    setComparing(false);
  }

  useEffect(() => {
    const current = versions.current;
    return () => {
      current.importId++;
      current.compareId++;
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
    };
  }, [report.reportHash]);

  async function load(file?: File) {
    const id = ++versions.current.importId;
    versions.current.compareId++;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setComparing(false);
    setBody(undefined);
    setTemplateExplanation(undefined);
    setExplanation(undefined);
    setTemplateLimitation(undefined);
    setAiActivated(false);
    setAiPending(false);
    setAiLanguage("en");
    setPreparedAi(null);
    setDetail("");
    if (!file) {
      setImporting(false);
      setStatus("Report body unavailable.");
      return;
    }
    if (file.size > 900000) {
      setImporting(false);
      setStatus("File exceeds the import limit.");
      return;
    }
    setImporting(true);
    setStatus("Importing report body…");
    let text: string;
    try {
      text = await file.text();
    } catch {
      if (versions.current.importId === id) {
        setStatus("File could not be read. Choose another file.");
        setImporting(false);
      }
      return;
    }
    if (versions.current.importId !== id) return;
    let verifiedBody: ReportBody;
    try {
      const result = verifyCommitment(text, report.reportHash);
      if (result.status !== "commitment-matches") {
        setStatus("Hash mismatch.");
        return;
      }
      if (!agrees(result.body, report)) {
        setStatus("Hash matches, but registry summary fields disagree.");
        return;
      }
      verifiedBody = result.body;
    } catch (e) {
      if (versions.current.importId === id)
        setStatus(
          e instanceof SyntaxError
            ? "Malformed JSON. Choose another file."
            : "Invalid report schema. Choose another file.",
        );
      return;
    } finally {
      if (versions.current.importId === id) setImporting(false);
    }

    let nextExplanation: ReportExplanation | undefined;
    let nextLimitation: string | undefined;
    try {
      nextExplanation = buildTemplateExplanation(verifiedBody);
    } catch {
      nextLimitation =
        "Optional template explanation unavailable: this report contains a finding rule this viewer cannot interpret. Inspection, canonical fields, replay, and current-state comparison remain usable.";
    }
    setBody(verifiedBody);
    setTemplateExplanation(nextExplanation);
    setExplanation(nextExplanation);
    setTemplateLimitation(nextLimitation);
    setStatus("Commitment matches. Hash and registry summary fields agree.");
  }

  async function requestAiExplanation(nextLanguage: ExplainLanguage) {
    if (!body || !templateExplanation || importing || aiPending) return;
    const expectedImportId = versions.current.importId;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setAiActivated(true);
    setAiLanguage(nextLanguage);
    setAiPending(true);

    try {
      let resolved = preparedAi;
      if (!resolved) {
        const prep = await prepareImportedExplanation(body, report.reportHash);
        if (
          controller.signal.aborted ||
          versions.current.importId !== expectedImportId
        ) {
          return;
        }
        if (!prep.ok) {
          setExplanation({
            ...templateExplanation,
            fallbackReason: prep.error,
          });
          return;
        }
        if (!prep.data.aiEnabled) {
          setAiActivated(false);
          setExplanation(prep.data.explanation);
          return;
        }
        resolved = {
          reportHash: prep.data.reportHash,
          explainToken: prep.data.explainToken,
          aiPromptVersion: prep.data.aiPromptVersion,
        };
        setPreparedAi(resolved);
      }

      const payload = {
        reportHash: resolved.reportHash,
        ...(resolved.explainToken
          ? { explainToken: resolved.explainToken }
          : {}),
        ...(resolved.aiPromptVersion === EXPLAIN_PROMPT_VERSION_V3
          ? { language: nextLanguage }
          : {}),
      };

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
      if (
        controller.signal.aborted ||
        versions.current.importId !== expectedImportId
      ) {
        return;
      }
      if (
        response.ok &&
        data.ok &&
        data.explanation &&
        data.explanation.reportHash === resolved.reportHash
      ) {
        setExplanation(data.explanation);
      } else {
        if (!response.ok) {
          setPreparedAi(null);
        }
        setExplanation({
          ...templateExplanation,
          fallbackReason:
            data.error ?? "AI explanation unavailable; showing template.",
        });
      }
    } catch {
      if (
        controller.signal.aborted ||
        versions.current.importId !== expectedImportId
      ) {
        return;
      }
      setExplanation({
        ...templateExplanation,
        fallbackReason: "AI explanation unavailable; showing template.",
      });
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }
      if (
        !controller.signal.aborted &&
        versions.current.importId === expectedImportId
      ) {
        setAiPending(false);
      }
    }
  }

  function downloadMarkdown() {
    if (!body || !explanation) return;
    const markdown = formatReportMarkdown(body, explanation, {
      attester: item.attester,
      publishedAt: item.publishedAt,
      stale: item.stale,
    });
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `avaguard-${body.address}-${body.blockNumber}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const activePromptVersion =
    preparedAi?.aiPromptVersion ??
    item.aiPromptVersion ??
    EXPLAIN_PROMPT_VERSION;
  const supportsLanguageSwitch =
    aiActivated &&
    item.aiEnabled &&
    activePromptVersion === EXPLAIN_PROMPT_VERSION_V3;

  async function compare(original: boolean) {
    if (importing || comparing || (original && !body)) return;
    const id = ++versions.current.compareId;
    const expectedImportId = versions.current.importId;
    setComparing(true);
    setDetail("Reading…");
    try {
      let message: string;
      if (original && body) {
        const r = await replay(body, report.reportHash);
        message = r.ok
          ? "Original-block replay: " +
            r.data.status +
            ("reason" in r.data ? " · " + r.data.reason : "")
          : r.error;
      } else {
        const r = await scan(report.target);
        if (!r.ok) message = r.error;
        else if (r.data.status !== "complete")
          message = r.data.status + " · " + r.data.reason;
        else if (!body)
          message =
            "Full diff unavailable without original body. Current score " +
            r.data.body.signalScore +
            ", target runtime " +
            (r.data.body.codehash === report.codehash
              ? "unchanged"
              : "changed") +
            ".";
        else {
          const diff = differences(body, r.data.body);
          message =
            "Current block " +
            r.data.body.blockNumber +
            " · " +
            (diff.length
              ? JSON.stringify(diff, null, 2)
              : "No semantic changes.");
        }
      }
      if (
        versions.current.compareId === id &&
        versions.current.importId === expectedImportId
      )
        setDetail(message);
    } catch {
      if (
        versions.current.compareId === id &&
        versions.current.importId === expectedImportId
      )
        setDetail("Read unavailable. Try again.");
    } finally {
      if (
        versions.current.compareId === id &&
        versions.current.importId === expectedImportId
      )
        setComparing(false);
    }
  }

  return (
    <>
      <p>
        Attester {item.attester}
        <br />
        Snapshot {report.blockNumber} · Attested score {report.score}
        <br />
        {body
          ? "Confidence by observation: " +
            (body.findings.flatMap((f) => (f.confidence ? [f.confidence] : []))
              .join(", ") || "Scope only")
          : "A commitment alone has insufficient evidence for an explanation; coverage and confidence are unavailable until a matching body is imported."}{" "}
        Interpretation belongs to the attester.
      </p>
      {body && <Coverage coverage={body.coverage} />}
      {body && explanation && (
        <ExplanationPanel
          explanation={explanation}
          pending={aiPending}
          language={supportsLanguageSwitch ? aiLanguage : undefined}
          onRequestAi={
            item.aiEnabled && !aiActivated
              ? () => void requestAiExplanation("en")
              : undefined
          }
          onLanguageChange={
            supportsLanguageSwitch
              ? (next) => {
                  if (next !== aiLanguage) {
                    void requestAiExplanation(next);
                  }
                }
              : undefined
          }
          onRetry={
            aiActivated
              ? () => void requestAiExplanation(aiLanguage)
              : undefined
          }
        />
      )}
      {body && !explanation && templateLimitation && (
        <article className="explain-panel" aria-label="Report explanation">
          <div className="explain-header">
            <h3>Explanation</h3>
            <span className="provenance-badge">Explanation unavailable</span>
          </div>
          <p role="status">{templateLimitation}</p>
        </article>
      )}
      <details>
        <summary>Commitment fields</summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
      <p>Target runtime-code check: {item.stale ? "changed" : "unchanged"}.</p>
      <label htmlFor="body">Import canonical JSON</label>
      <input
        id="body"
        type="file"
        accept=".json,application/json"
        onChange={(e) => void load(e.target.files?.[0])}
      />
      <p role="status">{status}</p>
      <p className="action-row">
        <button
          type="button"
          disabled={!body || importing || comparing}
          onClick={() => void compare(true)}
        >
          Replay original block
        </button>
        <button
          type="button"
          disabled={importing || comparing}
          onClick={() => void compare(false)}
        >
          Scan current state
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!body || !explanation || importing}
          onClick={downloadMarkdown}
        >
          Export Markdown
        </button>
      </p>
      <pre role="status">{detail}</pre>
    </>
  );
}
