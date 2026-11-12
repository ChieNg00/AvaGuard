import { useRef, useState } from "react";
import { verifyCommitment, type ReportBody } from "@avaguard/analyzer";
import { agrees, differences } from "../lib/publication";
import { lookup, replay, scan } from "./actions";
import { Coverage } from "./report";
type Item = NonNullable<
  Extract<Awaited<ReturnType<typeof lookup>>, { ok: true }>["data"]
>;
export function Inspection({ item }: { item: Item }) {
  const { report } = item;
  const [body, setBody] = useState<ReportBody>(),
    [status, setStatus] = useState("Report body unavailable.");
  const [detail, setDetail] = useState("");
  const version = useRef(0);
  async function load(file?: File) {
    const id = ++version.current;
    setBody(undefined);
    setDetail("");
    setStatus("Report body unavailable.");
    if (!file) return;
    if (file.size > 900000) {
      setStatus("File exceeds the import limit.");
      return;
    }
    try {
      const result = verifyCommitment(await file.text(), report.reportHash);
      if (version.current !== id) return;
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
      if (version.current === id)
        setStatus(
          e instanceof SyntaxError
            ? "Malformed JSON. Choose another file."
            : "Invalid report schema. Choose another file.",
        );
    }
  }
  async function compare(original: boolean) {
    const id = ++version.current;
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
      if (version.current === id) setDetail(message);
    } catch {
      if (version.current === id) setDetail("Read unavailable. Try again.");
    }
  }
  return (
    <>
      <p>
        Attester {item.attester}
        <br />
        Snapshot {report.blockNumber} · Attested score {report.score}
        <br />
        {body ? "Confidence by observation: " + (body.findings.flatMap(f => f.confidence ? [f.confidence] : []).join(", ") || "Scope only") :
          "Coverage and confidence unavailable until a matching body is imported."} Interpretation belongs to the attester.
      </p>
      {body && <Coverage coverage={body.coverage}/>}
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
      <button disabled={!body} onClick={() => compare(true)}>
        Replay original block
      </button>{" "}
      <button onClick={() => compare(false)}>Scan current state</button>
      <pre role="status">{detail}</pre>
    </>
  );
}
