# Threat model

## Assets and trust

Protect the integrity of evidence, report commitments, publisher authorization and credentials. The scanner is read-only with respect to scanned contracts. Only separately authorized publication writes to the team's registry.

The analyzer is a trusted computation source and browser-wallet attesters are trusted publishers. The server never holds wallet keys or signs/sends transactions. The chain does not recompute analysis; live codehash equality does not prove the snapshot hash, proxy implementation/state, findings or score. Compromised attesters can publish misleading commitments; revocation limits future writes, not already-published history.

## Threats and required behavior

| Threat | Required control and visible limitation |
| --- | --- |
| Deceptive selectors/ABI/token metadata | Treat as untrusted indicators; show evidence and confidence; do not claim confirmed owner privilege from names alone. |
| Changed proxy or mutable configuration | Snapshot all supported reads; include implementation hash and checked state; show historical scope and freshness limits. |
| RPC/explorer outage or dishonest results | Timeouts, bounded calls and explicit unavailable status. MVP trusts configured providers; it is not a trustless chain-data proof. |
| Malicious token strings or source comments | Bound input length, escape rendering, no raw HTML, no shell execution from metadata; never use external content as instructions. |
| LLM prompt injection or hallucination | Structured evidence input; schema/evidence-reference validation; model cannot alter findings or publish; labeled template fallback. |
| False safe conclusion from incomplete scan | Show coverage and unknowns; never convert unsupported checks into passes or safety certification. |
| Unauthorized/fake publication | Contract-level attester checks, independently tested; public scan requests never gain signing authority. |
| Publisher key misuse | Attester browser wallet signs each publication; user-run Foundry keystore deployment; no raw keys in chat/env/server and no public signing API. |
| Report substitution/unavailable storage | Canonical export/import and hash verification; approved demo fixtures. Missing body is explicit; hash alone is not retrieval or replay. |
| Scan endpoint abuse | Bounded input, response size, RPC calls and deadlines; server-controlled chain/RPC configuration, no user-supplied URLs to fetch. |
| RPC errors confused with contract behavior | Typed errors and bounded same-block retries. Exhausted required transport reads mean inconclusive without score, never R-NONSTANDARD. |
| Historical state unavailable | Probe is observational. Verify each requested block; show replay unavailable rather than silently scanning latest or calling the report false. |
| Misleading dispatcher pattern | PUSH4/EQ is only a heuristic; constants/dead code/custom dispatch can fool incomplete analysis. Negative controls and explicit coverage, no privilege claims. |
| Snapshot mixing or dishonest provider | Fixed B for every required read plus header/hash checks. No reorg recovery subsystem; provider trust and consistency checks remain. |
| Misleading low score | Few signals is not safety, severity is not exploit probability, and access control is unexamined. Coverage is adjacent to score. |
| Misconfigured mode or hosted origin mismatch | Server `AVAGUARD_ENV` explicitly separates `local` (loopback RPC + Anvil) from `fuji` (non-loopback HTTPS RPC + chain 43113 + pinned `registryRuntimeHash`), disables wallet publication/lookup on missing or invalid config while keeping read-only scans usable, and restricts browser publication to loopback (`local`) or configured `AVAGUARD_APP_ORIGIN` / HTTPS (`fuji`). |

## Claims we do not make

No proof that a token is safe or malicious, no exhaustive vulnerability detection, no full audit, no prevention of a user signing elsewhere, no decentralized consensus over report correctness, and no autonomous agent in the initial MVP.

Use owned fixtures and local/testnet examples for evaluation. Do not perform exploit transactions against third-party contracts.
