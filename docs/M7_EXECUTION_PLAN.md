# M7 public delivery execution plan

Prepared 2026-11-15 and updated 2026-11-18, Vietnam time. G2 Fuji deployment, G3 Builder Hub verification and G5 real-wallet acceptance on localhost are complete. G6 covers evidence publication, README, a Vietnamese demo video of at most three minutes and Vietnamese slides. The organizer recap gives the order as **GitHub → video → slides**, with G4 public hosting optional. See [the release evidence](releases/m7-fuji/README.md) and [the session plan](M7_G3_G4_SESSION_PLAN.md).

## 1. Starting point and outcome

Observed through GitHub and the workspace on November 15–17:

- [PR #8](https://github.com/ChieNg00/AvaGuard/pull/8) is merged. Final PR head: `b994134ba49cf34a179028c23cff3b9ae73117c7`; merge commit: `c7bd311cfb8d0253dedec9719c2d50a542963792`.
- [Post-merge CI run 43709090662](https://github.com/ChieNg00/AvaGuard/actions/runs/43709090662) passed both jobs, including deployment/readback regressions, contracts, integration and browser acceptance. This is automated evidence, not a real-wallet or public-host result.
- G0 continuation refreshed `origin/main` and created `codex/m7-public-delivery` at `c7bd311`, preserving the existing documentation. The [G2 source record](releases/m7-fuji/g2-source-2026-11-16.json) freezes that execution source/artifact identity. The November 16 planning session later observed G2 evidence committed at `bbbe4418c98225bda569ed6e892ec2bd6449536d`, matching its upstream, with a clean starting checkout and no runtime source/config diff from `c7bd311`. The new planning edits are a separate local diff.
- [PR #9](https://github.com/ChieNg00/AvaGuard/pull/9) is open; [CI 43774373740](https://github.com/ChieNg00/AvaGuard/actions/runs/43774373740) passed both jobs for `bbbe441`. November 17 read-only checks identified an unmet requirement in [ruleset main-2](https://github.com/ChieNg00/AvaGuard/rules/27142816): one approving review is required, but none has been submitted. There are no review threads or merge conflicts and both required checks pass. Obtain the required review and recheck state before an authorized merge; source verification can proceed independently of that merge.
- R1–R5 are resolved by the reviewed fixes. Their original findings remain in [the review record](M7_REVIEW_AND_NEXT_PLAN.md). The repository is already public according to GitHub metadata; recheck judge access before submission.
- November 16 continuation completed G1 and the explicitly authorized G2: six contracts, one attester authorization, seven successful receipts and strict full initial-state readback at block `61141800`. November 17 G3 verified all six deployed contracts (`Exact match`, `Pass - Verified`) on Avalanche Builder Hub (`43113`) while keeping the frozen G2 artifacts unchanged. See [the live deployment and verification evidence](releases/m7-fuji/README.md) and [the G3 verification manifest](releases/m7-fuji/g3-verification-2026-11-17.json). Owner nonce is `7`; do not rerun the deployment or re-verify these sources.
- November 18 G5 completed with four verified Fuji receipts, matching canonical JSONs, fresh browser imports and recorded original-block replays. GitHub publication, final README, video and slides remain G6 work. G4 and its hosting checks stay deferred. See [the G5 acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).

**Required outcome:** a reproducible public repository with verified Fuji contracts (`G2`/`G3`), end-to-end real-wallet Fuji proof (`scan → export → publish → /lookup → import → replay`) recorded with canonical JSON bundles (`G5` on localhost, or optional HTTPS host if G4 runs), plus README, max-3m demo video and Vietnamese slides (`G6`, `GitHub → video → slides`). Hosting-only verifications stay explicitly `pending`/`deferred` unless G4 executes.

Use [M7_DELIVERY.md](M7_DELIVERY.md) for deployment and constructor-argument commands, [ACCEPTANCE.md](ACCEPTANCE.md) for product acceptance, and [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the recording outline. This plan defines order, decisions and evidence.

Keep Fuji `43113`, existing rules/schema, one lockfile, injected-wallet signing and no database. Live AI is not implemented: the public baseline uses the labeled template explanation. Do not advertise a live Gemini integration. No extra plugin, agent framework or application dependency is a prerequisite for this delivery plan.

## 2. Inputs to settle before affected actions

Only public addresses and non-secret choices belong in the handoff. Passwords, recovery phrases, private keys and provider credentials stay in the user's local wallet or provider settings.

| Input | Confirmed input / proposed choice | Required by |
| --- | --- | --- |
| Release source | Merged `c7bd311`, followed only by reviewed delivery fixes/docs; record exact final SHA and CI | G0 |
| `OWNER_ADDRESS` | User supplied `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1`; funded refresh observed `0.1 AVAX`, nonce `0`. User confirmed the local keystore address matches | G1 dry-run, G2 broadcast |
| `ATTESTER_ADDRESS` | User supplied `0xc6f32290379CA39273306e3758aB0a2b813ce3eB`; distinct from owner; funded refresh observed `0.39999999999664 AVAX`, nonce `1` | G1, G2, G5 |
| `INITIAL_HOLDER` | `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` (owner default used in simulation and prepared command) | G1–G3 |
| Wallet | MetaMask in Chrome recommended for a first-time operator; the app currently reads `window.ethereum`. Real-wallet behavior remains a G5 check | G5 |
| Hosting | Optional / deferred (`not started`); Vercel Hobby + `*.vercel.app` (or Node 24 fallback) prepared if time/team wants a live trial link | Optional G4 only |
| Host account/plan | Personal Hobby project operated by one designated owner, subject to plan eligibility; account not yet selected/created. Proposed hosting/domain budget: USD 0 within included usage | Only if optional G4 runs |
| App origin | `http://localhost:3000` for prioritized G5 localhost Fuji testing; stable `*.vercel.app` HTTPS domain only if optional G4 runs | G5 localhost / optional G4 |
| RPC | Public Fuji URL from the existing runbook first; measure availability from the executed environment | G1, G5, optional G4 |
| Source verifier | Completed on Avalanche Builder Hub (`https://build.avax.network/api/verify/43113/api`, public placeholder `builder-hub`); all 6 contracts `Exact match` | G3 (complete) |
| Team allocation | Confirm who operates owner wallet, attester wallet, optional hosting and submission; capacity per person is still unconfirmed | Schedule commitment |
| Event requirements | User-reported Nov 17 organizer recap: **GitHub → video → slides**, max **3-minute** video, **Vietnamese** presentation, **hosting optional**; revalidate portal fields/deadline before final submission | Before final submission |

The organizer site [team1vn.xyz](https://team1vn.xyz/) was not accessible through the research tool on November 15; the November 17 organizer-recap requirements above (**GitHub → video → slides**, max **3-minute** video, **Vietnamese** presentation, **hosting optional**) were reported directly by the user. The recorded deadline remains **2026-11-21 23:59 Asia/Ho_Chi_Minh** and Demo Day is recorded as November 30; revalidate final form fields and deadline before submission. Live AI remains outside the implemented baseline; template explanation stays active.

## 3. Work sequence and completion gates

Adjusted dependency order after G3 and the November 17 organizer recap: **G0 → G1 → G2 → G3 → Commit/PR #9 review → G5 (localhost against live Fuji) → G6 (README, ≤3m video, Vietnamese slides, submission)**, with **G4 (public HTTPS hosting) deferred as optional** if time permits or the team wants a public trial URL. Source verification and deployment are already complete; do not spawn coding agents.

### G0 — Freeze and prepare the execution checkout

Estimated active effort: 0.5–1 hour.

Technical preparation and the exact G2 execution source/artifact hashes are recorded in [the evidence bundle](releases/m7-fuji/README.md). Routine `git fetch`, non-destructive local branch preparation, artifact checks and read-only public RPC requests are within preparation scope; they do not require a new permission question. Preserve existing diffs and respect actual tool approval boundaries. G2 evidence is now committed at `bbbe441`; inspect current status before changing branches. The following preparation steps are historical/reusable checks, not a request to repeat completed G0–G2 work.

1. Review and preserve this documentation diff. Before changing branches, inspect `git status`; do not reset, discard or overwrite pending work.
2. Refresh Git refs, use a clean checkout containing merged PR #8, and record the exact source commit. If a follow-up branch is necessary, use `codex/m7-public-delivery`; keep one working checkout unless isolation is needed.
3. Confirm CI success for the actual code selected for deployment. Do not repeat the already completed PR merge.
4. Verify Node 24, pnpm 12.4.2 and Foundry 1.9.0; preserve Solidity 0.8.30, Cancun, optimizer enabled/200 and IPFS metadata settings.
5. Preserve matching build-info and the registry identity check output. Expected runtime hash: `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`.
6. Prepare a public evidence record using section 6, with unknown fields marked `pending`, and a list of files intended for later publication. Foundry broadcast output is not covered by an explicit `broadcast/` rule in the current `.gitignore`; review files individually rather than staging the whole contract workspace.

**Exit:** release SHA and CI URL recorded; local toolchain/artifact identity confirmed; no unresolved implementation blocker; public input list ready. Documentation-only changes need link/whitespace checks, not another full application suite.

### G1 — Finalize public inputs and simulate deployment

Estimated active effort: 1–2 hours, excluding faucet/account delays.

G1 is complete for the November 16 funded snapshot. The user confirmed the local signer address and funded the owner. The refreshed signer-free simulation passed with six creations, one attester authorization and an estimated `4,858,094` gas, covered by the observed `0.1 AVAX` owner balance. Owner nonce remained `0`, attester nonce remained `1`, and all predicted contract addresses had empty code in the funded postflight check; see [the evidence record](releases/m7-fuji/README.md) and [G2 handoff](releases/m7-fuji/G2_HANDOFF.md). Existing wallets do not need to be recreated or rechecked merely to continue. Hosting accounts, verifier choice and deadline reconfirmation remain separate later inputs.

1. Record owner, attester and holder; validate address shape, nonzero values, and owner/attester separation. The user confirms control of the owner keystore and the selected browser account locally.
2. Read Fuji chain ID and public account balances. Obtain testnet gas through the runbook's faucet flow if needed; the user handles any login or interactive challenge. Do not invent a required AVAX amount: use the actual dry-run estimate plus a user-approved margin, and fund the attester for report publications too.
3. Run the wrapper's default dry-run with those public inputs. Supply no `--broadcast`, `--account` or `--keystore` during simulation. Clear inherited signer-selection environment variables in that subprocess if present, without printing their values.
4. Inspect the planned sequence: six contract creations plus registry `setAttester(attester, true)`. Confirm initial holder and constructor/initializer values from the simulation.
5. Prepare the exact broadcast command and source-verification settings for review. Keep the account name/path local and the password interactive.

Example from the repository root in WSL/Linux, after public variables are set:

```bash
env -u FOUNDRY_ACCOUNT -u FOUNDRY_KEYSTORE bash scripts/fuji-deploy.sh \
  --rpc-url "$FUJI_RPC_URL" \
  --owner "$OWNER_ADDRESS" \
  --attester "$ATTESTER_ADDRESS" \
  --initial-holder "$INITIAL_HOLDER"
```

**Exit:** successful simulation, consistent compiler/runtime identity, reviewed transaction sequence and gas estimate, sufficient testnet balances, and a concrete command awaiting public-deployment authorization. A simulation address is not a deployed address.

### G2 — Execute the authorized Fuji deployment

Estimated active effort: 1–2 hours including receipt review.

**Completed November 16.** The user explicitly authorized G2 and entered the keystore password privately in WSL. Seven on-chain receipts and full initial-state readback passed; [the execution record](releases/m7-fuji/G2_HANDOFF.md) contains the actual commands and evidence. The steps below describe the completed gate and are not an instruction to deploy again. Do not collect credentials in chat or execute unattended signing.

1. Recheck chain `43113`, public roles, current owner nonce and the approved source revision. Keep the owner account idle for unrelated transactions during the deployment.
2. Execute the reviewed wrapper command with `--account fuji-deployer --broadcast`, or one explicit `--keystore` path instead. Use the same holder as the dry-run.
3. Preserve the broadcast transaction list and inspect every receipt. Record actual created addresses from confirmed transactions, including the attester-authorization transaction. A console summary alone does not prove all transactions succeeded.
4. Export all six real addresses and run `bash scripts/fuji-deploy.sh --readback --skip-build` from the repository root with the same public role variables. Run this before token transfers, minting, pausing or upgrades.
5. Record the readback block number/hash and exit status. It must validate registry runtime, owner, authorized attester, nonempty suite code, initial supply/holder balances, token owners, unpaused mint/pause token and exact proxy implementation at one pinned snapshot.

**Exit:** all expected deployment/authorization receipts confirmed, six distinct nonzero contract addresses, full initial-state readback exit 0. Registry-only readback does not satisfy this gate. Partial deployment follows section 7; never rerun the entire script blindly.

### G3 — Verify source and publish a reproducible deployment record

**Completed November 17.** Estimated active effort was 1–2 hours. All six deployed contracts passed Builder Hub verification (`https://build.avax.network/api/verify/43113/api`) with `v0.8.30+commit.73712a01`, `evm=cancun`, `200` runs, and IPFS metadata, matching canonical ABIs, Standard JSON sources, and creation constructor inputs, and confirmed publicly readable while signed out (`Exact match`); see [the G3 verification manifest](releases/m7-fuji/g3-verification-2026-11-17.json). Keep this historical reference below without rerunning verification.

1. Proposed primary verifier: Builder Hub at `https://build.avax.network/api/verify/43113/api`. Its read-only registry lookup returned HTTP 200 and an unverified-source response on November 16; source submission remains untested. The [focused handoff](M7_G3_G4_SESSION_PLAN.md) records the observation, public placeholder key and registry-first command. The [Builder Hub guide](https://build.avax.network/docs/tooling/contract-verification) and [API reference](https://build.avax.network/docs/tooling/contract-verification/api-reference) describe this provider's API, not Routescan.
2. Routescan's previously recorded Fuji endpoint remains an alternative requiring fresh confirmation. Do not assume a verification submitted to one provider appears on all other explorers. No API key creation is implied by this plan.
3. Use the exact build-info from deployment and the holder-aware commands in the runbook. Set `VERIFIER_URL` explicitly; do not substitute a different compiler/EVM target to make verification pass.
4. Verify `RiskRegistry`, baseline, mint/pause, UUPS implementation, proxy and decoy. For the proxy, match both implementation address and initializer bytes. A proxy source page does not verify the implementation by itself.
5. Record the actual result/match level and a judge-accessible source URL for each contract. Review the source/build metadata before its authorized upload.
6. After authorization to publish the prepared record, expose addresses, transaction links, compiler profile and source URLs in the delivery ledger/README.

**Exit:** six inspected source pages, with registry source mandatory for submission; any incomplete suite verification remains an explicit delivery gap. Source verification of these owned deployments does not change the analyzer's `R-SOURCE-UNKNOWN` or its source-coverage limitation.

### G4 — Optional HTTPS web app deployment (`deferred / optional`)

Estimated active effort: 2–3 hours (run only after prioritized G5 localhost proof / core G6 materials if time allows, or if the team explicitly wants a public trial link). Provider settings below are prepared proposals and remain **unexecuted (`pending` / `deferred`)** until authorized and deployed.

**Recommended hosting: Vercel Hobby with the assigned `*.vercel.app` project domain.** The user confirmed no existing hosting/domain and asked for a suitable demo option. Vercel documents [Node 24 support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and [Corepack version pinning](https://vercel.com/docs/builds/configure-a-build). Use the repository's `pnpm@12.4.2` pin and confirm it in actual build logs; lockfile autodetection alone does not establish that version. Hosted compatibility remains an inference requiring a build and smoke check.

The [Hobby plan](https://vercel.com/docs/plans/hobby) is free within included usage, and Vercel assigns a [project domain](https://vercel.com/docs/domains/working-with-domains) without requiring a custom-domain purchase. Proposed hosting/domain spend for this demo is **USD 0**. [Hobby terms](https://vercel.com/legal/terms) restrict use to personal or non-commercial purposes; use this recommendation for that demo scope, and revisit the plan if the project becomes commercial. Do not start a paid trial, add-on or domain purchase as part of setup.

Designate one hosting operator; the second teammate can contribute and review in GitHub without sharing the hosting login. Keep the report JSON bundle in the public repository/release as already planned, with no hosting database. Watch the Hobby usage dashboard: included limits can pause service when exhausted, so check remaining usage before recording and submission. This is a demo recommendation, not a production availability guarantee.

| Setting | Proposed value / check |
| --- | --- |
| Repository/revision | `ChieNg00/AvaGuard`; reviewed `main` after an authorized PR #9 merge, or an explicitly selected delivery branch. Record the actual deployed SHA and its CI; see the focused session plan |
| Plan / operator | Hobby, one designated account owner; no paid collaboration feature required for the planned demo workflow |
| Framework | Next.js |
| Root Directory | `apps/web`; include files outside root so `packages/analyzer` and root lockfile are available |
| Node | Explicit `24.x`; record actual build/runtime versions because provider patch versions can differ from local 24.19.0 |
| Package manager | Existing root `packageManager: pnpm@12.4.2`; enable `ENABLE_EXPERIMENTAL_COREPACK=1` and verify the selected version in build logs |
| Install | `pnpm install --frozen-lockfile` using the workspace lockfile; no second lockfile |
| Build | `pnpm build` from `apps/web` (its script runs `next build`) |
| Output/start | Next.js preset defaults; do not configure a static export or a `next start` process on Vercel |
| Execution budget | Proposed 60-second function limit, with Fluid compute enabled. Current [Hobby Fluid limits](https://vercel.com/docs/functions/limitations) allow up to 300 seconds; inspect actual Server Action/function settings and keep the analyzer's own 30-second deadline unchanged |
| Production origin | Stable project domain under `*.vercel.app`; set its exact HTTPS scheme/host without a path in `AVAGUARD_APP_ORIGIN`. Name availability is not yet checked |
| Preview configuration | Publication disabled by leaving `AVAGUARD_ENV`/registry unset; read-only scanning can use a valid RPC. Do not give arbitrary preview domains production publication settings |

The [build configuration documentation](https://vercel.com/docs/builds/configure-a-build) describes external workspace files and Corepack; [monorepo guidance](https://vercel.com/docs/monorepos) covers root selection. Confirm the applied [function duration](https://vercel.com/docs/functions/configuring-functions/duration) for Server Actions as well as API routes. If a small route/config change is necessary, review and run affected checks before deploying it. Do not shorten analyzer deadlines or weaken guards to accommodate hosting.

Set these server variables for the production deployment:

```dotenv
AVAGUARD_ENV=fuji
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
REGISTRY_ADDRESS=0x003D1f3C26FfAC734297979B1FC82914217C5392
AVAGUARD_APP_ORIGIN=<exact production HTTPS origin>
```

Use the actual assigned origin in provider settings; its angle-bracket entry above is a placeholder. Leave `AVAGUARD_AI_ENABLED` and `AVAGUARD_LOCAL_EXPLAIN_URL` unset. A Gemini key alone cannot enable the absent live adapter. No wallet secrets belong in hosting configuration. If using a provider RPC credential, keep it server-only and out of recorded logs.

Provisioning/deployment starts only after the user selects the account/plan and authorizes publication. Record domain, source SHA, build URL, non-secret settings and rollback target. Rebuild/redeploy after changing environment values when required by the provider.

For the authorized hosting session: select/create the user's Hobby account, import this repository with access limited to AvaGuard, apply the settings above, set the production variables using the real Fuji registry and assigned project domain, then deploy the reviewed revision. Inspect build logs for Node/pnpm versions and workspace resolution. Complete the anonymous scan, real-wallet, import and replay checks before publishing the URL in the submission. If the account/provider selection is incompatible with Hobby or the hosted build fails, diagnose that specific blocker before proposing a paid plan or a different host.

**Node server fallback:** retain the existing provider-neutral deployment if Vercel is unsuitable or an existing host is preferred. [Next.js supports this server mode](https://nextjs.org/docs/app/getting-started/deploying). Use Node 24 and pnpm 12.4.2, install/build at repository root, then run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @avaguard/web start -H 0.0.0.0 -p "${PORT:-3000}"
```

The host supplies the production environment, HTTPS termination and restart policy. No database, Docker migration or new infrastructure layer is required by default.

**Exit:** `/` and `/lookup` load publicly over HTTPS; anonymous scan works; production Server Actions reach Fuji; origin/chain/runtime checks pass; template provenance is honest; logs contain no credentials. Open in a signed-out browser to detect hosting access protection before calling the URL judge-ready.

### G5 — Real wallet acceptance and report bundle

Completed on November 18 with Baseline and Mint/pause on port `3000`, then Proxy and Decoy on port `3001`. The checklist below documents the executed scope. See [the G5 acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).

Estimated active effort: 2–3 hours.

Because public hosting is optional per the organizer recap, **start G5 on `http://localhost:3000` configured directly against Avalanche Fuji (`43113`)** (`AVAGUARD_ENV=fuji`, `FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc`, `REGISTRY_ADDRESS=0x003D1f3C26FfAC734297979B1FC82914217C5392`, and `AVAGUARD_APP_ORIGIN=http://localhost:3000` or unset) using the real injected browser wallet (`ATTESTER_ADDRESS = 0xc6f32290379CA39273306e3758aB0a2b813ce3eB`), not only the CI wallet mock. Save actual outcomes in the evidence record and **explicitly distinguish localhost Fuji checks from optional hosting-only checks** (signed-out public HTTPS access, Vercel Node 24 / `pnpm@12.4.2` build logs, `60s` Server Action budget, `AVAGUARD_APP_ORIGIN` HTTPS enforcement, Preview disabled, and hosted cold/warm latency remain `pending` / `deferred` unless G4 executes).

| Case | Required observation |
| --- | --- |
| No wallet connected | Scan and evidence inspection work; publication requires a wallet |
| Four demo targets | Record Fuji score, findings, coverage, confidence and snapshot for baseline, mint/pause, proxy and decoy |
| Known local references | Local Anvil scores were `0 / 45 / 60 / 0`; investigate a Fuji difference before making claims, never force expected numbers |
| Wrong wallet network | **Check wallet** blocks publishing; explicit **Switch wallet to 43113** works with the selected wallet |
| Unauthorized account | Publishing stays disabled; no deliberately reverting public transaction is needed |
| Authorized attester | Fresh scan, canonical JSON export, explicit **Publish**, user confirmation, successful receipt and matching registry entry |
| User rejects a signature | UI recovers without inventing a transaction hash or success |
| Account/chain/report changes | Previous publish readiness is invalidated; recheck before signing |
| Missing JSON | Lookup shows commitment/body-unavailable state; it does not invent evidence |
| Correct JSON import | Report hash and commitment fields agree; verify from a fresh browser session |
| Modified JSON | Import is rejected as inconsistent; alter a copy and retain the original export |
| Replay original B | Record `replay-matches` or explicit historical-state unavailability; never use latest as a substitute |
| Scan current state | Treat it as a new snapshot/hash, separate from historical replay |
| Inconclusive/empty code | No numeric score; publication remains unavailable |

Publish and export all four showcase reports so each distributed JSON has a corresponding on-chain commitment. Target at least one successful Fuji original-block replay for the main video; if the RPC cannot provide it, investigate another approved public/archive endpoint and record the limitation. Do not mark replay success using the earlier sampled RPC probe.

Registry freshness is limited: unchanged target codehash does not prove unchanged owner, proxy implementation or configuration. Do not describe it as full state monitoring. Use replay and a fresh scan for their separate purposes.

Measure scan latency on the executed environment (`localhost` -> Fuji RPC when deferred hosting is not run; optional Vercel host separately if G4 runs): one first request plus three subsequent scans per demo target, with success/failure counts, range and median. Record timestamp, target, snapshot, environment (`localhost` vs hosted) and whether the request was cold/warm. These are small-sample observations, not an SLA. Preserve the existing 30-second analyzer deadline and visible unavailable behavior.

The release bundle records G0–G3 evidence and four preserved G5 canonical analyzer exports (`avaguard-<address>-<blockNumber>.json`). The report table links each JSON to its Fuji receipt and replay evidence. The acceptance record links the source revision, chain, registry, report hashes and transaction references. GitHub publication and signed-out access checks belong to G6. See [the report table](releases/m7-fuji/README.md#report-and-submission-ledger) and [the acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).

**Exit:** real wallet publication and independent JSON import verified on Fuji; four reports downloadable; replay outcomes and localhost/Fuji latency measurements recorded; any unexecuted hosting-only checks explicitly retained as `pending`/`deferred`. Synthetic timeout/replacement tests remain CI evidence unless the corresponding condition actually occurred live.

### G6 — Freeze, record and submit

Estimated active effort: 3–4 hours plus submission contingency.

1. Freeze the working app/contracts and capture final source SHA, registry address, report hashes (and host deployment ID only if optional G4 runs). Later fixes require relevant checks; avoid editing frozen report bytes.
2. Adapt [DEMO_SCRIPT.md](DEMO_SCRIPT.md) to observed Fuji G5 values. Record one end-to-end scan → evidence/template → export → wallet publish → lookup/import → replay sequence. Show the decoy or unauthorized-account control.
3. Keep the video within the confirmed organizer limit: **maximum 3m 00s** (target **2m 30s**), presented in **Vietnamese** (`GitHub → video → slides`). Edit waiting time transparently, without implying a delayed transaction was instant.
4. Prepare five **Vietnamese** slides: problem; architecture; observed Fuji showcase cases; trust/coverage limits; verification and links. Distinguish templates/mocks from a live AI provider and bytecode capability indicators from proven privileges.
5. Update README and the delivery ledger with verified links, exact startup commands and a short judge path. Open repo, verified Builder Hub sources, raw G5 reports, video and slides while signed out (and optional HTTPS URL only if G4 ran).
6. Reconfirm the official form/requirements (`GitHub → video → slides`). Prepare its exact entries for user review, submit only when authorized, and save the actual confirmation/receipt and submission time.

**Exit:** accessible submission package, observed G5 acceptance evidence, explicit `pending`/`deferred` status for any unrun optional G4 hosting checks, and actual submission confirmation. If no submission was made, report “package ready, submission pending,” not “M7 complete.”

## 4. Verification policy during execution

Existing post-merge CI is the starting evidence. Run `node scripts/verify-registry-identity.mjs` against the selected build before deployment, plus the dry-run and live readback gates. A host build is a new environment check even when CI already passed.

For code/contract/config changes after this baseline, run affected checks and finish with the CI-required suite on the final release revision:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
forge fmt --check                 (packages/contracts, WSL/Linux)
forge build --build-info          (packages/contracts, WSL/Linux)
forge test -vv                    (packages/contracts, WSL/Linux)
bash -n scripts/fuji-deploy.sh
bash -n scripts/test-fuji-deploy.sh
node scripts/verify-registry-identity.mjs
bash scripts/test-fuji-deploy.sh   (WSL/Linux)
pnpm test:integration
pnpm test:browser
git diff --check
```

The lines above identify commands and working directories; parenthetical annotations are not shell syntax. Do not interpret a filtered browser test count as the complete integration count. Documentation-only changes use link/whitespace validation; no need to rerun the full suite solely for prose.

## 5. Calendar, ownership and scope control

These are estimates, not confirmed availability. Budget roughly **11–18 active person-hours**, plus 3–5 hours contingency for infrastructure, verification and recording. Faucet, wallet and provider delays add elapsed time.

| Vietnam date | Target | Suggested responsibility, pending team agreement |
| --- | --- | --- |
| Nov 15 | G0; decide public addresses, host, operator and event constraints (complete) | Both review; user selects accounts/wallet roles |
| Nov 16 | G1 and G2; keep full readback evidence (complete) | Deployment operator with local owner wallet; teammate reviews public inputs |
| Nov 17 | G3 Builder Hub source verification (complete); commit/push G3 docs, PR #9 review, prepare G5 localhost | Contract operator verified sources; team aligns on recap priority |
| Nov 18 | G5 real-wallet Fuji acceptance on localhost (`scan → export → publish → lookup/import → replay`), 4 canonical JSONs; feature freeze | Attester operates wallet on localhost; teammate verifies JSON/replay from fresh session |
| Nov 19–20 | Record max-3m Vietnamese video, finish Vietnamese slides & README; run optional G4 Vercel Hobby hosting only if time/team wants it | Presenter and reviewer |
| Nov 21 | Final signed-out link checks & contingency before the recorded 23:59 deadline | Submission owner, with second-person review |

If capacity is three hours total per day, preserve the critical path and cut optional polish first. Do not add a live AI adapter, custom domain, database, additional chains, autonomous agents, new scoring rules or a visual redesign to this execution scope. An event requirement that conflicts with this scope needs an explicit decision and a revised estimate.

## 6. Evidence record to fill during execution

Use the following fields in the versioned release README/manifest. Start with `pending`, never sample addresses that could be mistaken for real deployments.

| Evidence group | Fields required |
| --- | --- |
| Release | Exact source SHA, CI URL/conclusion, operator, execution date/time/timezone |
| Toolchain | Actual Node/pnpm/Forge versions; solc/EVM/optimizer/metadata; registry runtime hash |
| Public roles | Owner, attester, effective initial holder, chain ID |
| Deployment | Six contract names/addresses; creation hashes, authorization hash, receipt status/block; full readback block/hash and result |
| Source | Provider, URL and observed match/status for each of six contracts; deployment build-info reference |
| Host | Provider/project, exact HTTPS origin, deployment ID/source SHA, build result, effective Node/pnpm, non-secret configuration, signed-out check |
| Each report | Target, canonical filename, reportHash, block number/hash, ruleset, score/findings/coverage, publisher, publication transaction/history reference, import outcome, replay outcome/time |
| Manual checks | Browser/wallet versions, expected/actual result for G5, screenshot/log reference where useful, limitation if not exercised |
| Performance | Actual timings, sample size, failures, first/subsequent request distinction; no fabricated values |
| Submission | App/repo/source/report/video/slide links, latest access-check time, actual form confirmation/time |

Store screenshots/logs only after reviewing for wallet UI secrets, RPC credentials, local paths or account information that is not needed publicly. Report hash is the application's canonical Keccak commitment; a file checksum or explorer source status is not a substitute.

## 7. Failure handling and stop conditions

| Condition | Next action |
| --- | --- |
| Local/CI regression or runtime identity mismatch | Stop release; fix/review the specific issue, preserve rules/golden scores, then run affected checks |
| Dry-run failure or insufficient testnet balance | Resolve before signing; do not switch to mainnet or bypass chain checks |
| Interrupted/partially mined deployment | Save broadcast artifacts; inspect receipts/nonces and existing addresses first. The wrapper has no `--resume` option. Prepare any direct Foundry resume/recovery against installed CLI help and the exact saved sequence; continue only within explicit deployment authorization |
| Wrong role, implementation or initial readback mismatch | Do not host against that registry or use `--allow-post-deploy-state` to excuse an initial mismatch; diagnose and obtain approval for any corrective transaction/redeployment |
| Explorer outage or mismatch | Keep successful chain receipts; check build settings, constructor bytes and provider support. Try an approved verifier/upload path; leave source status pending until observed |
| Hosting timeout/build/version mismatch | Inspect applied runtime, workspace root, lockfile and execution budget. Use the Node server fallback if appropriate; do not weaken analyzer rules |
| Wrong origin/registry after hosting | Correct reviewed configuration and redeploy, then repeat hosted wallet/lookup checks; retain the old deployment reference for rollback |
| Wallet rejection/pending/replaced transaction | Retain the actual submitted hash; use receipt recovery and inspect chain state before another publication. Do not sign a duplicate merely because the UI timed out |
| RPC history unavailable | Preserve commitment/import evidence, show the explicit unavailable result, and try an approved endpoint at the same original block; no latest-state substitution |
| Missing/corrupt JSON | Restore the exact exported report and validate against its commitment. A fresh scan has a different snapshot/hash and cannot replace the original body silently |
| Hosted regression after release | Roll back to a known working app build with the matching registry/origin configuration. Contract deployments are not rolled back by redeploying the web app |

No token mint, pause, ownership transfer, proxy upgrade or attester revocation is necessary for the basic demo. Such actions require their own stated purpose and authorization; local tests already cover these behaviors.

## 8. Immediate next session

G2, G3 and G5 are complete. Review the local G3/G5 evidence diff and confirm current PR #9 requirements before authorized GitHub publication. Finalize the README, Vietnamese video of at most three minutes and Vietnamese slides for G6, then verify signed-out links. G4 public HTTPS hosting stays optional and deferred. Use [the release evidence](releases/m7-fuji/README.md) and [the G5 acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).
