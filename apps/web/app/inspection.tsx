"use client";
import { useEffect, useRef, useState } from "react";
import {
  buildTemplateExplanation,
  verifyCommitment,
  type ReportBody,
} from "@avaguard/analyzer";
import { agrees, differences } from "../lib/publication";
import { lookup, replay, scan } from "./actions";
import { Coverage, ExplanationPanel } from "./report";

type Item = NonNullable<
  Extract<Awaited<ReturnType<typeof lookup>>, { ok: true }>["data"]
>;

export function Inspection({ item }: { item: Item }) {
  const { report } = item;
  const [trackedHash, setTrackedHash] = useState(report.reportHash);
  const [body, setBody] = useState<ReportBody>();
  const [status, setStatus] = useState("Report body unavailable.");
  const [detail, setDetail] = useState("");
  const [importing, setImporting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const versions = useRef({ importId: 0, compareId: 0 });

  if (trackedHash !== report.reportHash) {
    setTrackedHash(report.reportHash);
    setBody(undefined);
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
    };
  }, [report.reportHash]);

  async function load(file?: File) {
    const id = ++versions.current.importId;
    versions.current.compareId++;
    setComparing(false);
    setBody(undefined);
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
      setBody(result.body);
      setStatus("Commitment matches. Hash and registry summary fields agree.");
    } catch (e) {
      if (versions.current.importId === id)
        setStatus(
          e instanceof SyntaxError
            ? "Malformed JSON. Choose another file."
            : "Invalid report schema. Choose another file.",
        );
    } finally {
      if (versions.current.importId === id) setImporting(false);
    }
  }

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
      {body && <ExplanationPanel explanation={buildTemplateExplanation(body)} />}
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
      <button
        type="button"
        disabled={!body || importing || comparing}
        onClick={() => void compare(true)}
      >
        Replay original block
      </button>{" "}
      <button
        type="button"
        disabled={importing || comparing}
        onClick={() => void compare(false)}
      >
        Scan current state
      </button>
      <pre role="status">{detail}</pre>
    </>
  );
}
