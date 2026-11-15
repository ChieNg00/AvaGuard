# Implementation plan

As reviewed and updated on 2026-11-15, M0 through M6 have recorded local verification and M6 is merged into main at `76857b1`. M7 local preparation is implemented on open PR #8 at `4937c72` (its two CI jobs and fresh local checks passed), and fixes for the five PR #8 delivery/runbook findings (`R1`–`R5` in [M7_REVIEW_AND_NEXT_PLAN.md](M7_REVIEW_AND_NEXT_PLAN.md)) are now implemented and tested locally in the working tree (uncommitted local diff pending review/CI/merge). M7 public delivery is not complete. M6 covers templates and mocked AI behavior, not a live provider. A separate sampled historical RPC probe succeeded; see RPC_HISTORY_CHECK.md. Keep capacity realistic for two people; extra hours are contingency, not guaranteed scope.

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

## Current local status & next bounded gate — M7 PR #8 delivery review fixes

[M7_PR8_REVIEW_FIX_PROMPT.md](M7_PR8_REVIEW_FIX_PROMPT.md) defines the `R1`–`R5` fixes implemented in the local working tree on top of `4937c72`. The original [M7_PREPARATION_PROMPT.md](M7_PREPARATION_PROMPT.md) is historical scope for M7 preparation. No public Fuji deployment, explorer verification, real-wallet broadcast, or hosting has been authorized or executed yet.

1. Make deployment read-back fail on incorrect owner/attester/proxy state or unavailable reads; add focused positive and negative regressions.
2. Repair named encrypted-keystore creation/selection, the Linux script invocation and initial-holder-aware source-verification arguments.
3. Re-run applicable checks, update the runbook and review the final PR head. Preserve the implemented local/Fuji configuration, demo contracts and report invariants.
4. After separate authorization, execute the real Fuji deployment/source verification, publish the HTTPS app and record injected-wallet publication, canonical JSON retrieval and original-block replay evidence. Public addresses and a hosting target still need selection; credentials stay local.
5. Prepare video/slides and verify submission links. A live AI adapter remains an optional separate task; the labeled template flow remains usable.

## Tentative calendar

- Nov 15: fix/review PR #8 delivery findings and agree on the public deployment inputs.
- Nov 16-17: authorized Fuji deployment/source verification, HTTPS hosting, real-wallet checks and recorded replay outcomes; cut unfinished optional checks.
- Nov 18: feature freeze; aim for a complete deployable demo.
- Nov 19-20: fix issues, verify links, record video and finish pitch.
- Nov 21: contingency and submission before 23:59 Vietnam time.

The submission deadline above is the repository's recorded target. The organizer page could not be accessed during the November 15 review; revalidate the deadline and submission requirements before delivery. No dates imply completed external work or confirmed team capacity.

## Proposed division of responsibility

The user previously described product requirements, initialization prompt, architecture review and frontend integration as their focus. Proposed second-member ownership is analyzer adapters/rules and registry tests. Confirm this split with the teammate; both review the security claims and can explain the full flow.

Do not let two assistants independently change the shared schema or root dependency manifest. Record agreed interface changes before splitting implementation work. This is a team workflow recommendation, not authorization to spawn coding agents.

## Scope cuts

If evidence quality is weak, reduce supported checks rather than invent findings. If AI is unavailable, ship the labeled template explanation. If a proxy pattern is unsupported, state that limit. Do not add mainnet, trading, browser extensions or transaction simulation to rescue the pitch.

The revised calendar is a target, not a claim that work occurred. PHASE_PROMPTS.md groups these milestones into five requests with mandatory stop-and-report checkpoints. Run only commands that exist; report actual forge build/test and pnpm test/lint/build output from the relevant workspace. No dependency installations or application scaffolding are authorized by the documentation merge itself.
