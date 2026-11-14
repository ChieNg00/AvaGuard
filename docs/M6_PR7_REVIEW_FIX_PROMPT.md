# Antigravity prompt for the M6 review fixes on PR #7

Implement the three review fixes below on AvaGuard's existing `m6/AI-explanation-integration` branch. Deliver a local diff, regression tests and observed results. Write code, UI and project notes in English. Give the maintainer the final report in Vietnamese.

## Starting point

The review covered commit `9f0fd21`. At that commit, 133 unit tests passed and hosted CI passed, including Anvil and Chromium. These are the pre-fix results. [PR #7](https://github.com/ChieNg00/AvaGuard/pull/7) · [Baseline CI](https://github.com/ChieNg00/AvaGuard/actions/runs/43526842921)

Run `git status --short --branch` and `git log -1 --oneline --decorate`. Preserve existing edits and build on any subsequent fixes already present on the PR branch. Read `AGENTS.md`, the M6 entries in `docs/PROGRESS.md`, the AI and report sections of `docs/SCANNER_SPEC.md`, and `docs/ACCEPTANCE.md`. The original `docs/M6_ANTIGRAVITY_PROMPT.md` describes the feature already implemented.

Start a short review-fix entry in `docs/PROGRESS.md`. For each finding, run a focused regression against the current behavior, inspect the result, then implement and verify the fix. Use the existing Vitest, local Anvil and Chromium harnesses.

## 1. P1 · Bind every displayed AI conclusion to the report

In `packages/analyzer/src/explain.ts`, `validateAiResponse` checks finding and evidence IDs, then copies the provider's `overview`, item `summary` and optional `coverageNote` into the UI. A valid citation can accompany an incorrect statement about the score, mint authority or source verification.

- Give the provider a strict, bounded selection format. A small change is to let it order the supplied findings or select existing read-only check IDs. One valid item for the MintableToken fixture could be the following. A full response must account for every input finding exactly once.

  ```json
  {"findingId":"R-MINT","citedEvidenceIds":["dispatch-mint(address,uint256)"],"suggestedCheckIds":["mint-events"]}
  ```

- Render the overview, finding summaries, coverage and confidence from the validated input and the existing deterministic templates. Resolve suggested checks to trusted text using the finding's allowlist. Every claim must display all evidence it needs. For example, an owner without deployed code needs both `owner` and `owner-code`. Keep any model choice meaningful and visible, such as which suggested check is shown.
- Reject the entire response on unknown fields, free-form conclusions, missing or duplicate findings, empty or cross-finding citations, or unknown check IDs. Invalid output gets **Template explanation** and a short reason. Only a validated selection can be labeled **AI-assisted explanation** and enter the success cache. Bump `EXPLAIN_PROMPT_VERSION` for the new response contract and use that version in provenance and cache keys. Keep the report schema and ruleset at their existing versions.
- Update the valid response builders in `packages/analyzer/test/explain.test.ts`, `apps/web/test/explain.test.ts` and the loopback mock in `apps/web/test/browser.mjs`. Derive each negative case from a valid control and change one property. Use a fresh cache so the candidate reaches the validator. Include valid citations paired separately with a wrong score in the overview, unsupported mint authority in a summary, and a false coverage note. Assert fallback, absence of the rejected text and successful recovery on the next valid response.
- The stale-response browser test currently expects provider-written `FRESH_BLOCK_` and `STALE_BLOCK_` text. Have the two responses select different allowed checks for `R-MINT`, for example `mint-authority` and `mint-events`. Hold the first response, export the report, rescan the same address at a new block, then release the first response after the second has appeared. Assert that the new block and its selected check remain visible after both requests settle.

## 2. P2 · Keep Scan and Lookup usable if explanation preparation fails

`scan` in `apps/web/app/actions.ts` calls `registerBody` in `apps/web/lib/explain-server.ts` before returning a complete report, even with AI disabled. Its outer catch can turn a projection error into an RPC error. Lookup calls `buildTemplateExplanation(body)` during render in `apps/web/app/inspection.tsx`. That builder uses the same strict, size-limited AI projection.

- Take the body, band and hash from the successful `buildReport` result. Make deterministic template rendering independent of the **16,384-byte** provider-input limit. Apply the limit before registering or sending an AI projection. If projection fails, return the complete scan with a template and a concise explanation status. Enable the background AI request only when its projection is available for that hash. Preserve existing handling of genuine RPC failures, `inconclusive` and `not-analyzable` scans.
- In Lookup, retain the file-size, canonical schema, commitment hash and registry-summary checks (`verifyCommitment` and `agrees`). Once they pass, keep the body available for inspection, original-block replay and current-state comparison even when an optional template cannot interpret a finding. Show that limitation using application-defined text. Handle it outside the import-validation error path and avoid throwing during React render. Imported content stays local. A matching commitment alone does not establish that replay will match.
- Exercise both normal entry points. For Scan, use a valid completed test report whose **projected** content exceeds 16,384 bytes. Large discarded metadata does not exercise this case. Verify the actual scan action still returns success, preserves the score, canonical export, hash and publication tuple, and makes zero provider calls with AI off or when the enabled provider cannot receive the projection. Keep the production limit in the test.
- For Lookup, use an otherwise valid canonical body with a finding ID the template cannot interpret. Set the test commitment and summary to match **that body**. Verify import succeeds, the limitation is visible, and replay/comparison remain usable and report their actual outcomes. Then select a record with a supported body, import its matching file and verify the normal template returns. Retain rejection of mismatched, malformed or unsupported-schema files and the existing stale-import protections.

## 3. P2 · Enforce both HTTP limits while reading bytes

The POST handler in `apps/web/app/api/explain/route.ts` currently awaits `request.text()` before enforcing **512 bytes**. `createLoopbackHttpExplainProvider` in `apps/web/lib/explain-server.ts` awaits `response.text()` before enforcing **8,192 bytes**. The current status checks can pass even when the whole body was buffered.

- Use a small shared bounded reader for these two web paths. See the byte-counting loop in `packages/analyzer/src/transport.ts` for a local precedent. Count incoming `Uint8Array.byteLength` before retaining each chunk. Allow exactly the cap. On overflow, stop reading, cancel the remaining stream and release the reader. Decode UTF-8 across chunk boundaries and parse JSON only after a successful bounded read. A declared `Content-Length` can enable early rejection. Enforce the actual byte count even with an absent or understated header.
- Return 413 for oversized input before projection lookup, 400 for unreadable or invalid requests, 404 for missing/expired projections and 200 for a valid registered hash. Preserve the provider's oversized fallback, timeout/abort, 429 and outage handling, and retry/deadline bounds. An oversized response must not enter the cache or consume further retry attempts. Retain the loopback-only endpoint and redirect restriction.
- Use finite in-memory streams in `apps/web/test/explain.test.ts` through the real `POST` handler and the adapter's injected `fetchImpl`. Cover 512/513 and 8,192/8,193 bytes, multiple chunks without `Content-Length`, an understated header and UTF-8 split across chunks. For the exact-limit positive controls, use valid JSON padded with whitespace. On overflow, assert cancellation and that the reader stops before consuming the remaining test data. Check zero lookup/provider work for a rejected request and a valid response after an oversized provider result.

## Verify and hand off

Compare `canonicalReportJson(body)`, `reportHash(body)` and the entire `publication(body)` tuple for the same snapshot with AI off, valid mock output and fallback. Keep the locked `fixtures/canonical-report-v1.json` test, MintableToken at 35 and DecoyConstantToken at 0. The no-key path must still show a template immediately, with export and the existing browser-wallet publication flow available.

Run the focused tests during development. After the final edit, run the workspace checks from the repo root.

```powershell
pnpm exec vitest run packages/analyzer/test/explain.test.ts apps/web/test/explain.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

From `packages/contracts` in Ubuntu WSL, run the Foundry checks and generate the artifacts used by Anvil.

```sh
forge fmt --check
forge build --build-info
forge test -vv
```

Back at the root, run the existing local integration and browser checks with the production build. See `docs/M5_DEMO.md` for the pinned tools and Chromium setup.

```powershell
pnpm test:integration
pnpm test:browser
git diff --check
git status --short --branch
```

Record in `docs/PROGRESS.md` the base SHA, files changed, commands actually run, observed failures and passes, test counts including filtered cases, and any check still pending. In the Vietnamese handoff, give each finding's fix and the test that proves it. Use local mocks and the existing test wallet harness. Leave the diff for review and stop at M6. Pushing, merging, live provider access, real-wallet transactions and M7 are outside this task.
