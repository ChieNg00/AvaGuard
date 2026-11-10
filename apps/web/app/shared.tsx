"use client";
import { useState } from "react";
import { addressSchema } from "@avaguard/analyzer";
export function AddressForm({ action }: { action: "scan" | "lookup" }) {
  const [message, setMessage] = useState("");
  return <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const valid = addressSchema.safeParse(String(data.get("address")).trim().toLowerCase()); setMessage(valid.success ? (action === "scan" ? "Address format accepted. Scanner unavailable in M1; no chain reads or report generated." : "Address format accepted. Registry lookup unavailable in M1; no publication status checked.") : "Enter a 0x-prefixed address with exactly 40 hexadecimal characters."); }}>
    <label htmlFor="address">Fuji contract address</label><div className="inputrow"><input id="address" name="address" placeholder="0x…" required autoComplete="off" spellCheck={false}/><button type="submit">Validate address →</button></div><p role="status" aria-live="polite">{message || "Chain 43113 · Local input validation only"}</p>
  </form>;
}
