# Implementation plan

Updated 2026-11-18. M0–M6 have recorded local verification. M7 preparation and R1–R5 fixes are merged at `c7bd311` with passing post-merge CI. G2 deployed six contracts on Fuji, G3 verified all six source pages on Builder Hub, and G5 completed real wallet acceptance with four matching reports and replays. G6 covers GitHub evidence, the README, a Vietnamese demo video of at most three minutes and Vietnamese slides. G4 HTTPS hosting is optional and deferred. See [the release evidence](releases/m7-fuji/README.md), [the execution plan](M7_EXECUTION_PLAN.md) and [the session plan](M7_G3_G4_SESSION_PLAN.md).

| Milestone | Outcome | Completion evidence |
| --- | --- | --- |
| M0 Discovery | Inspect tools, check current primary docs, resolve blocking toolchain choices | Observed versions/availability, decision list, exact proposed scaffold commands |
| M1 Foundation | Minimal web/analyzer/contracts workspace, one lockfile, local-only configuration | Actual build/type checks and one meaningful workspace smoke check; no network deployment |
| M2 Evidence | Versioned report schema and bounded Fuji/local read adapters | Deterministic fixtures, unavailable paths, non-contract and misleading-selector cases |
| M3 Rules | Approved v2 signal rules, confidence, coverage and formula | Locked scores AND negative controls; stable canonical report hash |
| M4 Registry | Browser-attester publication API and report history with local tests | Authorization, snapshot fields, JSON body availability and explicit publisher trust |
| M5 Vertical slice | Scan, report, publication UI and lookup | Local end-to-end flow and truthful incomplete/stale/error states |
| M6 AI | Optional explanation with deterministic fallback | Same evidence/score with AI on/off; outage and injection tests |
| M7 Delivery | Authorized Fuji deployment, verified source, real-wallet G5 acceptance, optional hosting, and submission package | Real addresses, Builder Hub `Exact match` pages, G5 localhost/hosted commitments & JSONs, max-3m video and Vietnamese slides |

## Next bounded gate — prepare and execute M7 public delivery

[M7_EXECUTION_PLAN.md](M7_EXECUTION_PLAN.md) defines dependencies, estimates, public inputs, localhost/optional-host configuration, acceptance evidence and recovery. Use [M7_PUBLIC_DELIVERY_PROMPT.md](M7_PUBLIC_DELIVERY_PROMPT.md) or [M7_G3_G4_SESSION_PLAN.md](M7_G3_G4_SESSION_PLAN.md) for Codex/Antigravity. The planning request authorizes preparation; it does not authorize public broadcast, source upload, hosting or submission.

1. G0–G1: preserve planning changes, synchronize the execution checkout to merged code, record CI/artifact identity, confirm public owner/attester/holder and hosting choices, then simulate without a signer. (Complete Nov 15–16.)
2. G2 completed November 16: six-contract Fuji suite, all seven receipts successful, strict full initial-state readback passed at block `61141800`. Preserve this suite; do not redeploy.
3. G3 completed November 17: all six deployed contracts verified `Exact match` on Avalanche Builder Hub and confirmed readable while signed out. Preserve frozen build-info/artifacts; do not re-verify.
4. G5 completed November 18 on localhost against Fuji (`43113`). Four real wallet commitments, exports, independent imports and recorded replays are in [the acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).
5. G6: freeze the demo, create the max-3-minute Vietnamese video and Vietnamese slides (`GitHub -> video -> slides`), update README, check signed-out repo/source/report/media links, and submit under explicit authorization. Live AI remains separate optional work.
6. G4 (optional): deploy public HTTPS hosting (Vercel Hobby + `*.vercel.app`) if time allows and team wants a live trial link; hosting-specific checks stay `pending`/`deferred` until actually executed.

## Tentative calendar

- Nov 15–16: G0, G1, G2 Fuji deployment & strict readback complete.
- Nov 17: G3 Builder Hub source verification complete; BTC recap confirmed hosting optional, video <= 3m, Vietnamese presentation. Commit/push G3 docs + prepare G5 localhost run.
- Nov 18: G5 real wallet acceptance completed with four verified receipts and canonical exports. Review the evidence and freeze the demo for G6.
- Nov 19–20: record max-3m Vietnamese walkthrough, finish Vietnamese slides & README; optional G4 Vercel Hobby hosting if time permits.
- Nov 21: verify signed-out links and submit early before the recorded 23:59 deadline.

The submission deadline above is the repository's recorded target. The organizer page could not be accessed during the November 15 review; revalidate the deadline and submission requirements before delivery. No dates imply completed external work or confirmed team capacity.

## Proposed division of responsibility

The user previously described product requirements, initialization prompt, architecture review and frontend integration as their focus. Proposed second-member ownership is analyzer adapters/rules and registry tests. Confirm this split with the teammate; both review the security claims and can explain the full flow.

Do not let two assistants independently change the shared schema or root dependency manifest. Record agreed interface changes before splitting implementation work. This is a team workflow recommendation, not authorization to spawn coding agents.

## Scope cuts

If evidence quality is weak, reduce supported checks rather than invent findings. If AI is unavailable, ship the labeled template explanation. If a proxy pattern is unsupported, state that limit. Do not add mainnet, trading, browser extensions or transaction simulation to rescue the pitch.

The revised calendar is a target, not a claim that work occurred. PHASE_PROMPTS.md groups these milestones into five requests with mandatory stop-and-report checkpoints. Run only commands that exist; report actual forge build/test and pnpm test/lint/build output from the relevant workspace. No dependency installations or application scaffolding are authorized by the documentation merge itself.
