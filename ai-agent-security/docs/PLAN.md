# Implementation plan

Updated 2026-11-06. No application phase below has been executed. A separate sampled historical RPC probe succeeded; see RPC_HISTORY_CHECK.md. Keep capacity realistic for two people; extra hours are contingency, not guaranteed scope.

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
