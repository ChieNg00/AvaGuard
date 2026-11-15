# Implementation plan

Updated 2026-11-16: M0–M6 have recorded local verification. M7 preparation and all R1–R5 fixes are merged through [PR #8](https://github.com/ChieNg00/AvaGuard/pull/8) at `c7bd311`, with [post-merge CI](https://github.com/ChieNg00/AvaGuard/actions/runs/43709090662) passing both jobs. G2 Fuji deployment is complete: six contracts, seven successful receipts and strict full initial-state readback; [evidence](releases/m7-fuji/README.md). G3–G6 public delivery remains pending. M6 covers templates and mocked AI behavior, not a live provider. The [detailed execution plan](M7_EXECUTION_PLAN.md) is the current continuation; the earlier review/fix documents retain historical evidence. Keep capacity realistic for two people; extra hours are contingency, not guaranteed scope.

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

## Next bounded gate — prepare and execute M7 public delivery

[M7_EXECUTION_PLAN.md](M7_EXECUTION_PLAN.md) defines dependencies, estimates, public inputs, host configuration, acceptance evidence and recovery. Use [M7_PUBLIC_DELIVERY_PROMPT.md](M7_PUBLIC_DELIVERY_PROMPT.md) for Codex/Antigravity. The planning request authorizes preparation; it does not authorize public broadcast, source upload, hosting or submission.

1. G0–G1: preserve planning changes, synchronize the execution checkout to merged code, record CI/artifact identity, confirm public owner/attester/holder and hosting choices, then simulate without a signer.
2. G2 completed November 16: six-contract Fuji suite, all seven receipts successful, strict full initial-state readback passed at block `61141800`. Preserve this suite; do not redeploy as part of G3/G4.
3. G3–G4: verify source with the selected provider and deploy the HTTPS app; record actual URLs and effective host configuration.
4. G5: complete real-wallet checks, four report commitments/JSON exports, independent import, replay outcomes and measured latency.
5. G6: freeze the demo, create video/slides, check judge access and submit under explicit authorization. Live AI remains separate optional work unless newly confirmed event requirements demand a scope decision.

## Tentative calendar

- Nov 15: prepare the merged release and agree on the public deployment inputs.
- Nov 16-17: authorized Fuji deployment/source verification, HTTPS hosting, real-wallet checks and recorded replay outcomes; cut unfinished optional checks.
- Nov 18: feature freeze; aim for a complete deployable demo.
- Nov 19-20: verify links, record video, finish pitch and aim to submit early.
- Nov 21: contingency and submission before 23:59 Vietnam time.

The submission deadline above is the repository's recorded target. The organizer page could not be accessed during the November 15 review; revalidate the deadline and submission requirements before delivery. No dates imply completed external work or confirmed team capacity.

## Proposed division of responsibility

The user previously described product requirements, initialization prompt, architecture review and frontend integration as their focus. Proposed second-member ownership is analyzer adapters/rules and registry tests. Confirm this split with the teammate; both review the security claims and can explain the full flow.

Do not let two assistants independently change the shared schema or root dependency manifest. Record agreed interface changes before splitting implementation work. This is a team workflow recommendation, not authorization to spawn coding agents.

## Scope cuts

If evidence quality is weak, reduce supported checks rather than invent findings. If AI is unavailable, ship the labeled template explanation. If a proxy pattern is unsupported, state that limit. Do not add mainnet, trading, browser extensions or transaction simulation to rescue the pitch.

The revised calendar is a target, not a claim that work occurred. PHASE_PROMPTS.md groups these milestones into five requests with mandatory stop-and-report checkpoints. Run only commands that exist; report actual forge build/test and pnpm test/lint/build output from the relevant workspace. No dependency installations or application scaffolding are authorized by the documentation merge itself.
