import { canonicalReportJson, type ReportBody } from "@avaguard/analyzer";
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
export function Report({ body, band }: { body: ReportBody; band: string }) {
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
      <p>
        <button onClick={download}>Export canonical JSON</button>
      </p>
      <Publish key={body.blockHash + body.address} body={body} />
    </section>
  );
}
