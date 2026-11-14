# Bounded implementation prompts

Use after INIT_PROMPT.md discovery/foundation. Run only the phase explicitly requested. Read AGENTS.md, PRODUCT_SPEC.md, SCANNER_SPEC.md, ACCEPTANCE.md and current decisions/progress first. Preserve the existing apps/web and packages layout. No prompt below grants deployment or public publishing permission.

## Phase 1 Contracts

Implement packages/contracts with Foundry/OpenZeppelin: Ownable2Step RiskRegistry, browser-attester publication API, snapshot fields and historical events, owned fixtures and keystore-compatible deployment scripts. Include direct and beacon proxy fixtures; ERC-1167 initially has parser-only unit coverage. Match approved schema/score expectations. Run forge build and forge test -vvv from the contract workspace. Exercise authorization, score/codehash/no-code/future-block checks, history, events and ownership transfer. Do not deploy or import keys. Stop and report changed files, commands actually run, results and unresolved questions.

## Phase 2 Scanner

Implement packages/analyzer per SCANNER_SPEC.md, integrated into apps/web. Establish canonical JSON test vectors before registry integration. Use one-block reads, typed error classification, bounded same-block retries, supported dispatcher/proxy rules, confidence, coverage and locked golden scores. Test against local Anvil with the owned contract artifacts, plus mock transport failures and negative controls. Test historical replay unavailable and changed-block hash behavior. Run the defined pnpm analyzer tests/type checks; do not invent passing output or silently change score expectations. Stop and report.

## Phase 3 Explain

For M6 after the merged M5 local flow, run the [full Antigravity implementation prompt](M6_ANTIGRAVITY_PROMPT.md).

For the three review findings on the M6 branch, use the [PR #7 fix prompt for Antigravity](M6_PR7_REVIEW_FIX_PROMPT.md).

Implement deterministic templates and an optional Gemini server adapter only after credential setup is separately authorized. The no-key path works first. Use bounded validated findings/evidence/coverage/score, no arbitrary chain strings, exact-input cache with prompt/model versions, evidence-ID validation and unexecuted suggested checks. Mock provider calls for valid JSON, invalid JSON, invented IDs, timeout, 429 and missing key. Actual provider calls are not required for these tests. Run relevant pnpm tests and stop/report.

## Phase 4 Frontend and browser publication

Build English Scan/Lookup, wagmi injected-only wallet connection, Fuji switch, live attester check and browser-signed publish. Show signal score/coverage/confidence together. Include inconclusive, unsupported, body-unavailable and historical-state-unavailable states. Add canonical JSON export/import. Verify report replays original B; Scan current state uses a new B and semantic diff. No wallet key or signing endpoint on server. Run available UI checks/lint/build and provide a manual Fuji checklist. Stop/report; no public deployment.

## Phase 5 Delivery preparation

After the merged M6 implementation, use [M7 delivery preparation](M7_PREPARATION_PROMPT.md) for the current gaps, implementation scope and acceptance checks. Preparation does not complete the public-delivery milestone.

For Antigravity, execute the [full M7 preparation prompt](M7_ANTIGRAVITY_PROMPT.md), which includes the code paths, local/Fuji behavior, deployable examples, runbook deliverables, regression matrix and final handoff.

Prepare user-run Foundry keystore/faucet/deployment/attester/fixture/source-verification commands using current primary docs. Do not run wallet import or deployment. Complete judges' README, threat model, report export/retrieval instructions, real-address table only when known, and a 2-3 minute demo script. Include semantic negative controls and template fallback. Run available local checks and stop/report. Execute deployments or publish links only under a subsequent explicit instruction with appropriate wallet/user interaction.

The phase prompts group the detailed M2-M7 milestones in PLAN.md; they do not rename or duplicate source directories. PROGRESS.md must record which concrete outcome was achieved. Scripts/commands must exist before claiming their checks ran.
