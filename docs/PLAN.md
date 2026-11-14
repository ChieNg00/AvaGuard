# Implementation plan

As reviewed on 2026-11-14, M0 through M6 have recorded local verification. M6 PR #7 is merged into main at `76857b1`; its final PR head `193391f` passed both CI jobs. Fresh merged-checkout checks and limitations are recorded in PROGRESS.md. M6 covers templates and mocked AI behavior, not a live provider. M7 delivery is not complete. A separate sampled historical RPC probe succeeded; see RPC_HISTORY_CHECK.md. Keep capacity realistic for two people; extra hours are contingency, not guaranteed scope.

| Milestone | Outcome | Completion evidence |
| --- | --- | --- |
| M0 Discovery | Inspect tools, check current primary docs, resolve blocking toolchain choices | Observed versions/availability, decision list, exact proposed scaffold commands |
| M1 Foundation | Minimal web/analyzer/contracts workspace, one lockfile, local-only configuration | Actual build/type checks and one meaningful workspace smoke check; no network deployment |
| M2 Evidence | Versioned report schema and bounded Fuji/local read adapters | Deterministic fixtures, unavailable paths, non-contract and misleading-selector cases |
| M3 Rules | Approved v2 signal rules, confidence, coverage and formula | Locked scores AND negative controls; stable canonical report hash |
| M4 Registry | Browser-attester publication API and report history with local tests | Authorization, snapshot fields, JSON body availability and explicit publisher trust |
| M5 Vertical slice | Scan, report, publication UI and lookup | Local end-to-end flow and truthful incomplete/stale/error states |
| M6 AI | Optional explanation with deterministic fallback | Same evidence/score with AI on/off; outage and injection tests |
| M7 Delivery | Authorized Fuji deployment, hosted demo and submission package | Real addresses, verified source, accessible app/report links, video and slides |

## Next bounded task — proposed M7 preparation

Use [M7_PREPARATION_PROMPT.md](M7_PREPARATION_PROMPT.md) for the next implementation request. This review prepared the task; it did not implement or authorize public delivery.

1. Add an explicit Fuji publication configuration while preserving the local mode, registry/snapshot checks, live attester checks and receipt recovery. Both server and browser currently enforce loopback-only publication.
2. Add deployable demo contracts and local tests without changing the locked golden fixtures. Existing scoring fixtures rely on Anvil storage initialization and contain selector stubs.
3. Prepare a keystore-based deployment/source-verification runbook, hosting configuration, report retrieval instructions and a 2–3 minute demo script. Verify commands against current official documentation at implementation time.
4. Pass local checks and leave the changes for review. Real Core wallet testing, Fuji transactions, source publication and hosting follow separate explicit instructions. A live AI adapter is an optional separate task; the template flow remains usable.

## Tentative calendar

- Nov 6-7: M0/M1 and freeze report schema. Historical public-RPC samples already succeeded; retain per-request unavailable handling.
- Nov 8-10: aim to complete local registry plus core scanner fixtures and negative controls.
- Nov 11-14: end-to-end UI, wallet publication and optional explanation/fallback.
- Nov 15-17: authorized Fuji deployment/source verification when ready, replay checks and failure handling; cut unfinished optional checks.
- Nov 18: feature freeze; aim for a complete deployable demo.
- Nov 19-20: fix issues, verify links, record video and finish pitch.
- Nov 21: contingency and submission before 23:59 Vietnam time.

## Proposed division of responsibility

The user previously described product requirements, initialization prompt, architecture review and frontend integration as their focus. Proposed second-member ownership is analyzer adapters/rules and registry tests. Confirm this split with the teammate; both review the security claims and can explain the full flow.

Do not let two assistants independently change the shared schema or root dependency manifest. Record agreed interface changes before splitting implementation work. This is a team workflow recommendation, not authorization to spawn coding agents.

## Scope cuts

If evidence quality is weak, reduce supported checks rather than invent findings. If AI is unavailable, ship the labeled template explanation. If a proxy pattern is unsupported, state that limit. Do not add mainnet, trading, browser extensions or transaction simulation to rescue the pitch.

The revised calendar is a target, not a claim that work occurred. PHASE_PROMPTS.md groups these milestones into five requests with mandatory stop-and-report checkpoints. Run only commands that exist; report actual forge build/test and pnpm test/lint/build output from the relevant workspace. No dependency installations or application scaffolding are authorized by the documentation merge itself.
