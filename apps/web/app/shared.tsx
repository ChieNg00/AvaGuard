"use client";
import { useRef, useState } from "react";
import { scan, lookup } from "./actions";
import { Report, Coverage } from "./report";
import { Inspection } from "./inspection";

export function AddressForm({ action }: { action: "scan" | "lookup" }) {
  const [target, setTarget] = useState(""),
    [message, setMessage] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof scan>>>();
  const [record, setRecord] = useState<Awaited<ReturnType<typeof lookup>>>();
  const [index, setIndex] = useState("");
  const revision = useRef(0);
  function reset() {
    revision.current++;
    setResult(undefined);
    setRecord(undefined);
    setMessage("");
  }
  async function submit(history?: string) {
    reset();
    const id = revision.current;
    setMessage("Reading snapshot…");
    try {
      if (action === "scan") {
        const r = await scan(target.trim());
        if (id !== revision.current) return;
        setResult(r);
        setMessage(r.ok ? "" : r.error);
      } else {
        const r = await lookup(target.trim(), history);
        if (id !== revision.current) return;
        setRecord(r);
        setMessage(
          !r.ok
            ? r.error
            : r.data
              ? ""
              : "No published reports for this target.",
        );
      }
    } catch {
      if (id === revision.current)
        setMessage("Request unavailable. Try again.");
    }
  }
  return (
    <>
      <section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="address">Target contract address</label>
          <div className="inputrow">
            <input
              id="address"
              required
              value={target}
              onChange={(e) => {
                reset();
                setTarget(e.target.value);
                setIndex("");
              }}
              placeholder="0x…"
              spellCheck={false}
            />
            <button>
              {action === "scan" ? "Scan contract" : "Find latest"}
            </button>
          </div>
        </form>
        <p role="status">{message}</p>
      </section>
      {result?.ok &&
        (result.data.status === "complete" ? (
          <Report body={result.data.body} band={result.data.band} />
        ) : (
          <section>
            <h2>{result.data.status}</h2>
            <p>{result.data.reason} · No score available</p>
            <Coverage coverage={result.data.coverage} />
          </section>
        ))}
      {record?.ok && record.data && (
        <section>
          <h2>Published commitment</h2>
          <p>
            {record.data.count} publication(s). Latest uses greatest snapshot
            block, then last publication on ties.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(index);
            }}
          >
            <label htmlFor="index">History index (0 = first published)</label>
            <input
              id="index"
              required
              pattern="[0-9]+"
              value={index}
              onChange={(e) => setIndex(e.target.value)}
            />{" "}
            <button>Read history entry</button>
          </form>
          <Inspection key={record.data.report.reportHash} item={record.data} />
        </section>
      )}
    </>
  );
}
