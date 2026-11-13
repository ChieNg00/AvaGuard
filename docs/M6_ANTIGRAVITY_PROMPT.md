# Antigravity execution prompt for AvaGuard M6

Open the AvaGuard repository and execute **M6 · Explain**. Deliver the local implementation, tests, usage notes and verification results. Start with a short plan and carry it through. Use English for code, UI and project documentation. Report to the maintainer in Vietnamese.

A user who scans an ERC-20 contract should be able to understand what was observed, which evidence supports it and what remains unknown. The explanation must work on the Scan page with no wallet, account or AI key. The analyzer owns the findings, score, coverage and confidence. The attester signs the existing publication payload in their browser wallet.

## 1. Establish the starting point

- Read `AGENTS.md` explicitly. Read `docs/DECISIONS.md`, `docs/SCANNER_SPEC.md` (especially “AI and caches”), `docs/PRODUCT_SPEC.md`, `docs/ACCEPTANCE.md`, `docs/THREAT_MODEL.md` and the latest entries in `docs/PROGRESS.md`. M6 in `docs/PLAN.md` corresponds to Phase 3 Explain in `docs/PHASE_PROMPTS.md`. The workshop recap is context only.
- As of November 14, 2026, M5 PR #6 had merged into `main` at `a727bd5`. Both CI jobs passed for PR head `a284e18`. A fresh local `pnpm test` passed 123 tests across five files during handoff preparation. A real Core extension smoke test still has no recorded result in the repo. Carry that forward separately from M6 verification. [Merged PR](https://github.com/ChieNg00/AvaGuard/pull/6) · [Final PR CI](https://github.com/ChieNg00/AvaGuard/actions/runs/43362174955)
- Run `git status --short --branch` and `git log -1 --oneline --decorate`. Base M6 on the current `main` that contains M5 and confirm with `git merge-base --is-ancestor a727bd5 HEAD` on the selected base (exit 0). At handoff the local checkout was still on the M5 branch with an existing edit to `apps/web/next-env.d.ts`. Use a local M6 branch or a clean checkout if needed. Preserve the original working tree, including uncommitted handoff files and generated-file edits.
- Trace `scan` in `apps/web/app/actions.ts` through `apps/web/app/shared.tsx` to `apps/web/app/report.tsx`. Inspect `buildReport` in `packages/analyzer/src/rules.ts`, `parseReportBody`, `canonicalReportJson` and `reportHash` in `packages/analyzer/src/report-body.ts`, and `publication(body)` in `apps/web/lib/publication.ts`. Use the existing canonical vector in `fixtures/canonical-report-v1.json`.

## 2. Ship the no-key explanation first

1. Start from a complete, server-produced, validated report. Build a deterministic English explanation from the existing rule interpretations. Link each explained finding to its own evidence IDs and describe its confidence method and relevant coverage limits. Render a useful explanation even for a score of zero. Use the existing reason and coverage for `inconclusive` and `not-analyzable`. These outcomes have no numeric score and make zero provider calls.
2. For the existing MintableToken acceptance case, the reader should see why the fixture scored **35**. `R-MINT` contributes 25 because `dispatch-mint(address,uint256)` records a possible dispatcher entry point. `R-OWNER-EOA` contributes 10 because `owner` and `owner-code` show a nonzero owner address with no deployed code at that block. Who can mint remains unverified. Derive the displayed score and weights from the report. For DecoyConstantToken, a score of zero must never acquire a mint finding or a safety verdict in the explanation.
3. Put the explanation next to the existing Scan report with visible provenance, e.g. **Template explanation** or **AI-assisted explanation**. Show the deterministic report first. Keep export, publication, lookup and replay usable during an explanation request or outage. Bind delayed responses to the report they describe and discard stale responses after a new scan, including a rescan of the same address. A lookup commitment alone has insufficient evidence for an explanation.

## 3. Bound the provider input and validate the response

- Construct one typed explain input on the server. Include ruleset version, signal score, finding IDs with their existing severity, weight, confidence and evidence links, a bounded projection of the linked observations, and all four coverage groups. Bind it to the specific snapshot. Including the server-computed report hash in the projected input is a simple way to retain that binding. Render explanations and provenance separately from `ReportBody`, canonical JSON and the registry tuple.
- Build the projection field by field. Use known rule/evidence IDs, trusted labels, typed outcomes and relevant facts such as owner observation or implementation hash. Report parsing permits strings in decoded metadata, coverage reasons and finding explanations. Passing the schema alone does not make those strings safe prompt content. Omit raw name/symbol, source, ABI, bytecode, arbitrary prose and RPC errors. For metadata failures, send only the probe ID and typed outcome. Treat imported JSON as untrusted. A client-provided body plus its own hash does not establish that AvaGuard scanned it. Any separate explain action must bind to trusted server-produced data and bound input size before provider work.
- A small implementation can retain the server-built projection under its report hash for a bounded time and let the browser request an explanation by hash. If the projection expires, the current template remains usable. Avoid reparsing a client-supplied body as proof of origin or scanning the latest block to explain an older snapshot.
- Define a small strict response schema. Each item identifies a supplied finding and cites evidence linked to **that finding**. Reject unknown fields, invented or duplicate findings, empty/dangling/duplicate citations, cross-finding citations, oversized output and attempts to supply scores, severity, coverage or publication data. Even a valid ID cannot justify a new claim about access control or safety. One simple design lets the model choose or order server-defined interpretations and optional read-only checks valid for the cited finding. Render suggestions as inert text. Use ordinary escaped React text throughout.
- Build the cache key from the Keccak-256 digest of UTF-8 canonical JSON of the **exact full explain input**, together with `promptVersion` and model name. Use a deterministic key representation and a bounded in-memory cache. Include every state-dependent input needed to distinguish owner, implementation and coverage changes at the same target codehash. Cache validated successes. A timeout must allow a later successful retry. Disabling AI must show the template even if a model result is cached.

## 4. Exercise the optional AI path locally

- Implement a small injectable server-side provider interface and test it with a fake provider. With AI disabled or no key, go straight to the template. On timeout, 429/quota, outage, invalid JSON or failed evidence validation, keep the report visible and return the labeled template with a short reason. Bound input/output sizes, total deadline and retries. Keep the fake provider inside tests. Record provenance and the applicable prompt/model versions outside the canonical report.
- Phase 3 reserves the real Gemini adapter for separately authorized credential setup. In the current handoff, finish the UI, validation, cache and mocked success/failure paths offline. An ambient key does not authorize its use. If the maintainer separately authorizes Gemini setup, check the official docs for the chosen model and structured-output API, keep credentials server-only, and verify the adapter with mocked transport first. A live call requires explicit authorization. Record whether the adapter was mocked or exercised live. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [Key handling](https://ai.google.dev/gemini-api/docs/api-key) · [Provider errors](https://ai.google.dev/gemini-api/docs/troubleshooting)

## 5. Prove the behavior

Use the existing Vitest, Anvil and Chromium harnesses. Add focused cases that fail if M6 violates these boundaries.

| Case | Observable result |
| --- | --- |
| Same complete snapshot with AI off, missing key, valid mock response and provider failure | Compare byte-for-byte canonical export, `reportHash(body)` and the entire `publication(body)` tuple across modes. Findings, evidence, score, band, confidence and coverage agree. Retain the locked vector and golden scores. |
| Template and valid mock success | Both explain actual findings with valid citations. Provenance distinguishes the paths. No provider call occurs for disabled, missing-key or incomplete scans. |
| Malformed JSON/schema, invented or duplicate finding, nonexistent evidence ID, valid evidence attached to the wrong finding, unsupported safety claim | Reject the response and show the template. Assert the rejected content is absent from the displayed explanation. |
| Untrusted strings in metadata or imported free-text fields | Put a harmless, recognizable instruction-like marker in a fixture. Assert zero calls for rejected input. Where a trusted report is projected, inspect the actual mock request for exclusion of the raw marker. Assert the marker never appears as an instruction or conclusion. |
| Timeout, 429, outage and oversized response | Show the reason and template within the configured deadline and attempt limit. Recovery on a subsequent valid response works. No score, publication or wallet action depends on the result. |
| Cache hit and invalidation | Count mock calls. Equivalent canonical input hits. Change owner, proxy implementation or coverage at fixed target codehash, then change prompt version and model independently. Each change misses. |
| Browser flow and stale response | Scan the local MintableToken fixture without a wallet or key. See 35, coverage, confidence, the template label and citations. Export and verify the original body. In a controlled delayed-response test, start a new scan before the old explanation resolves and confirm only the new report's explanation is visible. |

From the repo root use the pinned pnpm version in `package.json`. Install with `pnpm install --frozen-lockfile` if dependencies are missing. Run the targeted tests you add, followed by the workspace checks.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Build the fixture artifacts before the Anvil checks. Run these commands from `packages/contracts` in Ubuntu WSL with the project's Foundry on PATH.

```sh
forge fmt --check
forge build --build-info
forge test -vv
```

Return to the repo root for integration, browser and diff checks.

```powershell
pnpm test:integration
pnpm test:browser
git diff --check
```

The browser check uses the production build and the matching Playwright Chromium. If that browser is missing on Windows, use `pnpm --filter @avaguard/web exec playwright-core install chromium`. See `docs/M5_DEMO.md` for local reproduction. Inspect exit codes, test counts and filtered/skipped cases. Repair M6 regressions and rerun the affected checks.

## 6. Handoff and stopping point

Add an M6 entry to `docs/PROGRESS.md` when implementation starts. Update it with changed paths, exact commands, observed results and remaining manual checks. Include short steps for reproducing the no-key flow. In the final report identify what the browser showed, which provider behavior was mocked, and any verification that remains pending.

Deliver the local diff for review and stop at M6. Work within the existing web app and analyzer, with the existing lockfile. Pushing or merging, external provider calls, credential creation, real-wallet transactions, Fuji deployment and M7 delivery require separate instructions.
