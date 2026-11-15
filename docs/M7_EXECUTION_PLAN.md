# M7 public delivery execution plan

Prepared 2026-11-15; preparation status updated 2026-11-16, Vietnam time. This is the continuation after PR #8, with a concrete preparation phase and separately authorized public execution. It does not declare a Fuji deployment or hosted demo complete.

## 1. Starting point and outcome

Observed through GitHub on November 15:

- [PR #8](https://github.com/ChieNg00/AvaGuard/pull/8) is merged. Final PR head: `b994134ba49cf34a179028c23cff3b9ae73117c7`; merge commit: `c7bd311cfb8d0253dedec9719c2d50a542963792`.
- [Post-merge CI run 43709090662](https://github.com/ChieNg00/AvaGuard/actions/runs/43709090662) passed both jobs, including deployment/readback regressions, contracts, integration and browser acceptance. This is automated evidence, not a real-wallet or public-host result.
- G0 continuation refreshed `origin/main` and created local `codex/m7-public-delivery` at `c7bd311`. All 11 existing documentation files were byte-identical across the switch. The [G2 source record](releases/m7-fuji/g2-source-2026-11-16.json) freezes the unchanged execution source/artifact hashes and prior passing CI. Documentation is still uncommitted; the working tree is not claimed clean.
- R1–R5 are resolved by the reviewed fixes. Their original findings remain in [the review record](M7_REVIEW_AND_NEXT_PLAN.md). The repository is already public according to GitHub metadata; recheck judge access before submission.
- November 16 continuation completed G1 and the explicitly authorized G2: six contracts, one attester authorization, seven successful receipts and strict full initial-state readback at block `61141800`. See [the live deployment evidence](releases/m7-fuji/README.md). Owner nonce is now `7`; do not rerun the nonce-zero deployment.
- Explorer source verification, browser report-publication receipts, hosted app, canonical Fuji report bundle, video and slides remain pending.

**Required outcome:** a judge can open the HTTPS app, scan owned Fuji examples without a wallet, inspect evidence/coverage, retrieve a published commitment, import its canonical JSON, and attempt original-block replay. The authorized attester demonstrates a real browser-signed publication. Verified source and public submission links accompany the demo.

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
| Hosting | User confirmed no existing hosting/domain and requested a recommendation. Recommend Vercel Hobby for the demo; Node 24 server remains the technical fallback | G4 |
| Host account/plan | Personal Hobby project operated by one designated owner, subject to plan eligibility; account not yet selected/created. Proposed hosting/domain budget: USD 0 within included usage | Before creating or deploying a service |
| App origin | Stable project domain under `*.vercel.app`; actual name assigned during setup. No custom-domain purchase is proposed | G4 production configuration |
| RPC | Public Fuji URL from the existing runbook first; measure availability from the chosen host | G1, G4, G5 |
| Source verifier | Select one Fuji-supported provider and confirm its endpoint before submitting source; see G3 | G3 |
| Team allocation | Confirm who operates owner wallet, attester wallet, hosting and submission; capacity per person is still unconfirmed | Schedule commitment |
| Event requirements | Reconfirm deadline, form, category/AI requirements, required links and media limits | Before final scope freeze/submission |

The organizer site [team1vn.xyz](https://team1vn.xyz/) was not accessible through the research tool on November 15. The recorded deadline is **2026-11-21 23:59 Asia/Ho_Chi_Minh** and Demo Day is recorded as November 30; neither date was freshly confirmed in this planning pass. If the selected category requires a live model, resolve that requirement before scope freeze instead of presenting mocked AI as live.

## 3. Work sequence and completion gates

Dependency order: **G0 → G1 → G2 → G3/G4 → G5 → G6**. Source verification and hosting preparation may overlap after addresses exist. This is a two-person work split, not an instruction to spawn coding agents.

### G0 — Freeze and prepare the execution checkout

Estimated active effort: 0.5–1 hour.

Technical preparation and the exact G2 execution source/artifact hashes are recorded in [the evidence bundle](releases/m7-fuji/README.md). Routine `git fetch`, non-destructive local branch preparation, artifact checks and read-only public RPC requests are within the requested preparation scope; they do not require a new permission question. Preserve existing diffs and respect any actual tool approval boundary. Documentation commit remains pending; do not call the current working tree clean. G2 used unchanged runtime source at the recorded reviewed SHA despite the preserved documentation diff.

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

Estimated active effort: 1–2 hours, excluding verifier delays.

1. Select the verifier using current provider documentation and confirm Fuji support. The current [Builder Hub guide](https://build.avax.network/docs/tooling/contract-verification) documents its own API, not the Routescan API. Its [API reference](https://build.avax.network/docs/tooling/contract-verification/api-reference) parameterizes the chain ID; confirm Fuji is supported before choosing `https://build.avax.network/api/verify/43113/api`.
2. Routescan's previously recorded Fuji endpoint remains an alternative requiring fresh confirmation. Do not assume a verification submitted to one provider appears on all other explorers. No API key creation is implied by this plan.
3. Use the exact build-info from deployment and the holder-aware commands in the runbook. Set `VERIFIER_URL` explicitly; do not substitute a different compiler/EVM target to make verification pass.
4. Verify `RiskRegistry`, baseline, mint/pause, UUPS implementation, proxy and decoy. For the proxy, match both implementation address and initializer bytes. A proxy source page does not verify the implementation by itself.
5. Record the actual result/match level and a judge-accessible source URL for each contract. Review the source/build metadata before its authorized upload.
6. After authorization to publish the prepared record, expose addresses, transaction links, compiler profile and source URLs in the delivery ledger/README.

**Exit:** six inspected source pages, with registry source mandatory for submission; any incomplete suite verification remains an explicit delivery gap. Source verification of these owned deployments does not change the analyzer's `R-SOURCE-UNKNOWN` or its source-coverage limitation.

### G4 — Deploy and verify the HTTPS web app

Estimated active effort: 2–3 hours. Provider settings below are proposed and not yet deployed or tested on that provider.

**Recommended hosting: Vercel Hobby with the assigned `*.vercel.app` project domain.** The user confirmed no existing hosting/domain and asked for a suitable demo option. This recommendation follows the existing Next.js app and workspace layout: Vercel currently supports [Node 24](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and [pnpm 12](https://vercel.com/docs/package-managers). Compatibility is an inference from the documented platform support and repository configuration; it still requires a hosted build and smoke check.

The [Hobby plan](https://vercel.com/docs/plans/hobby) is free within included usage, and Vercel assigns a [project domain](https://vercel.com/docs/domains/working-with-domains) without requiring a custom-domain purchase. Proposed hosting/domain spend for this demo is **USD 0**. [Hobby terms](https://vercel.com/legal/terms) restrict use to personal or non-commercial purposes; use this recommendation for that demo scope, and revisit the plan if the project becomes commercial. Do not start a paid trial, add-on or domain purchase as part of setup.

Designate one hosting operator; the second teammate can contribute and review in GitHub without sharing the hosting login. Keep the report JSON bundle in the public repository/release as already planned, with no hosting database. Watch the Hobby usage dashboard: included limits can pause service when exhausted, so check remaining usage before recording and submission. This is a demo recommendation, not a production availability guarantee.

| Setting | Proposed value / check |
| --- | --- |
| Repository/revision | `ChieNg00/AvaGuard`, reviewed `main` revision with passing CI |
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
REGISTRY_ADDRESS=<actual deployed RiskRegistry address>
AVAGUARD_APP_ORIGIN=<exact production HTTPS origin>
```

Use actual values in provider settings; the angle-bracket entries above are placeholders. Leave `AVAGUARD_AI_ENABLED` and `AVAGUARD_LOCAL_EXPLAIN_URL` unset. A Gemini key alone cannot enable the absent live adapter. No wallet secrets belong in hosting configuration. If using a provider RPC credential, keep it server-only and out of recorded logs.

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

### G5 — Complete real-wallet acceptance and the report bundle

Estimated active effort: 2–3 hours.

Run from the production origin with the real browser wallet, not only the CI wallet mock. Save actual outcomes in the evidence record.

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

Measure scan latency on the actual host: one first request plus three subsequent scans per demo target, with success/failure counts, range and median. Record timestamp, target, snapshot and whether the request was cold/warm. These are small-sample observations, not an SLA. Preserve the existing 30-second analyzer deadline and visible unavailable behavior.

The versioned bundle starts with [docs/releases/m7-fuji/README.md](releases/m7-fuji/README.md), now containing G0/G1 evidence plus the completed G2 deployment manifest and strict readback. Four canonical analyzer JSON exports remain pending; operational G1/G2 JSON files do not satisfy that report requirement. Keep source revision/chain/registry/report hashes/transaction references together. Review the exact files, then publish under the user's authorization. Judges must be able to download raw report JSON without signing in; no hosted report database is promised.

**Exit:** real wallet publication and independent JSON import verified; four reports downloadable; replay outcomes and performance measurements recorded; any failed criterion remains visible. Synthetic timeout/replacement tests remain CI evidence unless the corresponding condition actually occurred live.

### G6 — Freeze, record and submit

Estimated active effort: 3–4 hours plus submission contingency.

1. Freeze the working app/contracts and capture final source SHA, registry address, report hashes and host deployment ID. Later fixes require relevant checks; avoid editing frozen report bytes.
2. Adapt [DEMO_SCRIPT.md](DEMO_SCRIPT.md) to observed Fuji values. Record one end-to-end scan → evidence/template → export → wallet publish → lookup/import → replay sequence. Show the decoy or unauthorized-account control.
3. Keep the video within the confirmed event limit; the project target is 2–3 minutes. Edit waiting time transparently, without implying a delayed transaction was instant.
4. Prepare five slides: problem; architecture; observed showcase cases; trust/coverage limits; verification and links. Distinguish templates/mocks from a live AI provider and bytecode capability indicators from proven privileges.
5. Update README and the delivery ledger with real URLs, exact startup commands and a short judge path. Open app, repo, verified source, raw reports, video and slides while signed out.
6. Reconfirm the official form/requirements. Prepare its exact entries for user review, submit only when authorized, and save the actual confirmation/receipt and submission time.

**Exit:** accessible submission package, observed acceptance evidence and actual submission confirmation. If no submission was made, report “package ready, submission pending,” not “M7 complete.”

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
| Nov 15 | G0; decide public addresses, host, operator and event constraints | Both review; user selects accounts/wallet roles |
| Nov 16 | G1 and G2; keep full readback evidence | Deployment operator with local owner wallet; teammate reviews public inputs |
| Nov 17 | G3 and G4; source pages and HTTPS app working | Contract operator handles verifier; web operator handles host |
| Nov 18 | G5; complete real-wallet/report/replay checks; feature freeze | Attester operates wallet; teammate verifies from a fresh session |
| Nov 19 | Record video and prepare slides/README | Presenter and reviewer |
| Nov 20 | Final signed-out link checks; aim to submit early | Submission owner, with second-person review |
| Nov 21 | Contingency before the recorded 23:59 deadline | Fix delivery blockers only; preserve proof of submission |

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

G2 is complete. Use its [execution record](releases/m7-fuji/G2_HANDOFF.md) and [receipt/readback evidence](releases/m7-fuji/README.md) as inputs to G3 source verification and G4 hosting. [M7_PUBLIC_DELIVERY_PROMPT.md](M7_PUBLIC_DELIVERY_PROMPT.md) carries the current continuation. Preserve the deployed addresses, source/build-info and documentation diff; do not restart wallet setup, funding or deployment. Source upload, hosting, browser report publication, commit/push and submission require their respective authorization; the G2 instruction did not include them.
