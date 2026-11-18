# M7 Fuji delivery evidence — G2, G3 and G5 complete

Updated 2026-11-18, Vietnam time. G2 Fuji deployment, G3 Builder Hub source verification and G5 real wallet acceptance on localhost are complete. All four showcases have verified receipts, preserved canonical reports, matching browser import and replay, and a current-state comparison. Optional hosting is deferred. The evidence bundle is ready for local review before GitHub publication and competition submission. See [the G5 acceptance record](g5-acceptance-2026-11-18.json).

## Gate status

| Gate | Observed status | Remaining requirement |
| --- | --- | --- |
| G0 technical preparation | Execution source `c7bd311`. G2 evidence was committed at `bbbe441` and CI `43774373740` passed. | Review the local G3/G5 evidence and recheck PR #9 before an authorized merge. |
| G1 | Complete for the observed snapshot: funded balances, user-confirmed signer address and refreshed signer-free simulation passed | Recheck state if source, public inputs, nonce or fees change before deployment |
| G2 deployment | Complete: 7/7 successful receipts; strict full readback passed at block `61141800` | Preserve this deployment; do not rerun the broadcast command |
| G3 source verification | Complete: all 6 deployed contracts verified `Exact match` (`Pass - Verified`) on Builder Hub (`43113`) and readable while signed out | Separate third-party Routescan/Snowtrace verification not requested or claimed |
| G4 hosting | Optional / deferred (`not started`) | Deferred by default per November 17 organizer recap; all hosting-only checks stay `pending`/`deferred` unless G4 executes |
| G5 live acceptance | Complete on localhost against Fuji. All four receipts, exports, imports, replays and current-state comparisons are recorded. | Review the evidence bundle for GitHub publication. Optional hosting checks stay deferred. |
| G6 submission | Pending | Finalize README, max-3m Vietnamese video and Vietnamese slides (`GitHub → video → slides`), then verify signed-out links and submit. |

See [the focused G3/G4 session plan](../../M7_G3_G4_SESSION_PLAN.md), [the full execution plan](../../M7_EXECUTION_PLAN.md), [delivery commands](../../M7_DELIVERY.md) and [the completed G2 handoff](G2_HANDOFF.md). Existing wallets do not need to be recreated or unlocked for G3/G4.

## Source and preservation evidence

- Selected source commit: `c7bd311cfb8d0253dedec9719c2d50a542963792` ([merged PR #8](https://github.com/ChieNg00/AvaGuard/pull/8)).
- Current delivery branch: `codex/m7-public-delivery` at `bbbe4418c98225bda569ed6e892ec2bd6449536d`, tracking the matching `origin/codex/m7-public-delivery` ref. The November 16 planning session started clean; its new planning edits are a separate local diff. Deployment itself used the `c7bd311` source above.
- [PR #9](https://github.com/ChieNg00/AvaGuard/pull/9) is open; [CI 43774373740](https://github.com/ChieNg00/AvaGuard/actions/runs/43774373740) passed both jobs. On November 17, active [ruleset main-2](https://github.com/ChieNg00/AvaGuard/rules/27142816) required one approving review, while the PR had no review submissions or review threads; both exact-head checks passed with the required app ID. GitHub reported no merge conflict but `mergeable_state=blocked`. This unmet approval requirement must be addressed before a normal authorized merge. Runtime source/config remains unchanged from deployed `c7bd311`.
- `git fetch --no-tags origin main` succeeded and advanced `origin/main` from `76857b1` to `c7bd311`.
- Before switching, `b994134` and `c7bd311` had the identical Git tree `ca5d90295fdebbd602ea3e1bc5d2d66390a6fa87`; `git diff --name-only HEAD origin/main` was empty.
- All 11 pre-existing modified/untracked documentation files were compared by SHA-256 immediately before/after the branch switch: byte-identical. Subsequent documentation edits in this session are intentional additions to that preserved work.
- During G0 no reset, stash, commit, push or public release was performed. The later authorized G2 deployment is recorded below. No Git commit or push has been made during G2. The local `main` label was not moved; use the execution branch, not the stale local label.
- [CI run 43709090662](https://github.com/ChieNg00/AvaGuard/actions/runs/43709090662): push event, exact source commit above, `completed / success`. Both `workspace-checks` and `contracts-and-integration` passed; deployment/readback, Anvil integration and browser steps were inspected.

## Toolchain and local artifact

Freshly observed commands: `node -v`, `pnpm -v`, WSL `forge --version`, WSL `cast --version`, and `node scripts/verify-registry-identity.mjs`.

| Item | Observed value |
| --- | --- |
| Node | `v24.19.0` |
| pnpm | `12.4.2` |
| Forge / Cast | `1.9.0`, commit `6056c5845d34205a83cf7108042adb137325c9df` |
| Solc metadata | `0.8.30+commit.73712a01` |
| EVM / optimizer | `cancun`; enabled, 200 runs |
| Metadata bytecode hash | `ipfs` |
| Registry ABI | 27 entries, matches web ABI |
| Registry runtime Keccak | `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38` |
| Identity command result | Exit 0 |

Existing ignored build files were retained locally. Both build-info outputs contain the same registry runtime as the artifact and the same registry source as the workspace. These file SHA-256 values identify local preparation files, not report commitments or on-chain verification:

| Local file under `packages/contracts/out/` | SHA-256 |
| --- | --- |
| `RiskRegistry.sol/RiskRegistry.json` | `79c180aa60df6ee1f686b634aac70901c630cdf0110c4828f13a06585aed07cf` |
| `build-info/993bdf819ecc026e.json` | `8fa296201d223d5ec2946edf5917eb2babda0788741de683040bbb8828b97bc2` |
| `build-info/a99dc5e0f1a231da.json` | `ef891d393ee6d27c387145a2341aff921ea83b5987dbe1a6ea5cac9c119587bf` |

Freeze the exact build-info used by the eventual deployment at execution time. No application code changed and no full application suite was rerun for this documentation work.

## Read-only Fuji availability sample

| Field | Actual observation |
| --- | --- |
| Time | `2026-11-15T14:08:40.502Z` |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Methods | `eth_chainId`, `eth_getBlockByNumber(latest, false)` |
| Chain ID | `43113` |
| Block number | `61120462` |
| Block hash | `0x29b7abeec81e66287867da0923eab4e7cec35e6d4755cf5c57ec65860fe4693f` |

This is a connectivity/header sample from the current machine. It is not a contract scan, balance check, dry-run, historical-state probe, deployment snapshot or Vercel connectivity test.

## Public inputs and deployment ledger

On November 16 the user reported both testnet wallets set up and supplied the addresses below. Both passed strict checksum validation and are nonzero and distinct. The trailing backslash in the pasted owner line was removed. The user subsequently confirmed that a local `cast wallet address --account fuji-deployer` returned the owner address. This is user-reported signer confirmation; the assistant did not decrypt or unlock the keystore. The user also reported transferring funds from the Fuji browser attester to the owner. Current balances were independently checked below. AvaGuard's browser-wallet publication flow remains untested.

| Input | Value / status |
| --- | --- |
| `OWNER_ADDRESS` | `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` |
| `ATTESTER_ADDRESS` | `0xc6f32290379CA39273306e3758aB0a2b813ce3eB` |
| `INITIAL_HOLDER` | `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1`; owner default used in simulation and prepared command |
| Signing operator | User operates the local keystore/browser wallet; user confirmed the local signer-to-owner match on November 16 |
| Hosting | Optional / deferred (`not started`); Vercel Hobby + `*.vercel.app` prepared if time/team wants a public trial URL |
| Production origin | `pending` (`deferred` unless optional G4 runs) |
| Verifier | Avalanche Builder Hub (`https://build.avax.network/api/verify/43113/api`, public placeholder `builder-hub`) |
| Deadline/form requirements | Recorded deadline November 21, 23:59 Vietnam time; user-reported Nov 17 organizer recap specifies **GitHub → video → slides**, max **3m** video, **Vietnamese** presentation, and **hosting optional** (revalidate before submitting) |

| Contract | Address | Creation transaction / block | Source URL / result |
| --- | --- | --- | --- |
| RiskRegistry | `0x003D1f3C26FfAC734297979B1FC82914217C5392` | `0x4e2f8e3ebd4c674f2fd93ee9d839db59649bbf2b3daadeae74e68ed4f53a8238` / `61141670` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x003D1f3C26FfAC734297979B1FC82914217C5392) (`Exact match`) |
| DemoBaselineToken | `0x58d42E6710764c1753Cad885fA80916a1F516Fec` | `0x7719b9d8dcb02cef4f45aa25ba4fbe1e70cc94b817bfdafef34ea138ce04a3bd` / `61141670` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x58d42E6710764c1753Cad885fA80916a1F516Fec) (`Exact match`) |
| DemoMintPauseToken | `0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6` | `0x3071db1b83fa71257409e8c408f6d8d1bf31d64a9062661dd0f14d7460dcc677` / `61141670` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6) (`Exact match`) |
| DemoUpgradeableToken implementation | `0x3E56446cACf6Aa3D77157de83c449c837d45064d` | `0x6cb5945828c0d73e62465674145656344c9143b14138a58fa255fd2cb49a73aa` / `61141671` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x3E56446cACf6Aa3D77157de83c449c837d45064d) (`Exact match`) |
| DemoTokenProxy | `0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c` | `0x5fe3d2868e5346a5e85432cfa83944e49187b8b1c2b262760ba383e224947636` / `61141671` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c) (`Exact match`, shows proxy + impl) |
| DecoyConstantToken | `0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4` | `0xb351e3a88f04e7d6d9f190c91612a38a8eccc7b82af1aa8ef117c074092af6d5` / `61141671` | [Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4) (`Exact match`) |

Attester authorization: `0x575d98c7d17e06ea7bcbc827c45940856632240eaccf9d3d9e0ed7b41021bca7`, successful at block `61141670`. All six addresses above were derived from successful on-chain creation receipts, not populated from predictions alone. Full receipt fields are in [the deployment manifest](g2-deployment-2026-11-16.json).

## G3 source verification — completed November 17

- Under explicit G3 authorization, verified `RiskRegistry` first and then all five demo/decoy contracts sequentially against Avalanche Builder Hub (`https://build.avax.network/api/verify/43113/api`) with `v0.8.30+commit.73712a01`, `evm=cancun`, optimizer enabled (`200` runs), IPFS metadata, and archived `INITIAL_HOLDER` constructor/initializer bytes. See [the G3 verification manifest](g3-verification-2026-11-17.json).
- All six frozen G2 artifacts and both build-info hashes in [the G2 source snapshot](g2-source-2026-11-16.json) remained unchanged (`forge clean` was not run).
- All six submission GUIDs returned `Pass - Verified` via `checkverifystatus`, Builder Hub Sourcify metadata returned `verified: true` and `match: "exact_match"` for all six contracts, and `getsourcecode` returned canonical ABI entries, Standard JSON source files, settings (`OptimizationUsed=1`, `Runs=200`, `EVMVersion=cancun`), and creation-matched `ConstructorArguments`.
- Signed-out headless Chromium inspection confirmed all six public explorer pages at `https://build.avax.network/explorer/fuji/c-chain/address/<address>` render `Verified contract`, `Exact match`, compiler `0.8.30+commit.73712a01`, `Enabled · 200 runs`, and source code without signing in (note: the raw `/api/verify/43113/address/<address>` URL printed by Forge CLI returns HTTP `404`; the `/explorer/fuji/c-chain/address/<address>` links above are the live public UI pages).
- Separate third-party verification on Routescan (`api.routescan.io`) was not performed: read-only checks showed `RiskRegistry`, `DemoUpgradeableToken`, and `DecoyConstantToken` unverified there and third-party bytecode names (`WhaleLoop`, `Token`, `ERC1967Proxy`) on generic OZ bytecodes. External source verification certifies neither contract safety nor removes `R-SOURCE-UNKNOWN` from the deterministic analyzer.

## G2 deployment and strict readback — completed November 16

- The user explicitly authorized G2 and entered the keystore password privately in WSL. The final wrapper exited `0`; no password was collected in chat or recorded by the assistant. An initial CRLF source-guard stop and two incorrect-password stops were resolved before any transaction was submitted; PROGRESS records the recovery evidence.
- [Source/artifact record](g2-source-2026-11-16.json): source `c7bd311`, previously verified passing CI, six artifact hashes and two build-info hashes. These hashes matched after deployment and again during next-session preparation. Its `documentationUncommitted` field describes the historical G2 preflight; the evidence is now committed at `bbbe441`. Application, contract, script, CI and dependency code remain unchanged.
- [Pre-broadcast state](g2-preflight-2026-11-16.json): chain `43113`, owner latest/pending nonce `0`, owner balance `0.1 AVAX`, and no code at the six predicted addresses before execution.
- [Deployment manifest](g2-deployment-2026-11-16.json): seven successful receipts independently read through RPC; each sender, nonce `0`–`6`, value `0` and on-chain input matched the reviewed G1 transaction plan. Creation addresses and canonical receipt block hashes matched. No pending transaction remained.
- Actual total gas used: `3,734,009`. Actual total fee: `597,441,440 wei` (`0.00000000059744144 AVAX`). At post-receipt block `61141750`, owner latest/pending nonce was `7` and balance was `0.09999999940255856 AVAX`, exactly the preflight balance minus verified fees. These are observed Fuji testnet values, not future fee guarantees.
- [Strict full initial-state readback](g2-initial-readback-2026-11-16.json): exit `0`, block `61141800`, hash `0x1c911f8ad0aeeddab59123851a34a38ec79946ee43c6968b4de53148316ac059`. Exact output: `Full initial-deployment read-back PASSED at block 61141800 (0x1c911f8ad0aeeddab59123851a34a38ec79946ee43c6968b4de53148316ac059).`
- Readback confirmed registry runtime identity/owner, `attesters(attester) == true`, nonempty code for every demo contract, the exact proxy implementation/owner, each initial token supply and owner-held balance of `1000000000000000000000000`, and `paused == false`. All required state reads used the recorded snapshot with header-hash recheck. No `--allow-post-deploy-state` or registry-only shortcut was used.

Preserve this deployment. G3 verified the six addresses above, and the G5 publications below use the same registry. GitHub publication, optional hosting and competition submission each require their own scope.

## G1 simulation and funding evidence — November 16

All times in the JSON evidence are UTC (November 15 UTC is November 16 in Vietnam for this session). These files are operational evidence, not canonical analyzer reports.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Public account preflight | Chain `43113`; block `61136744`; owner `0 AVAX`, attester `0.5 AVAX`; both nonce `0`, code `0x`; header hash rechecked | [Preflight JSON](g1-preflight-2026-11-16.json) |
| Default wrapper dry-run | Exit `0`, no signer or broadcast; six creations and one `setAttester(attester, true)` call | [Simulation summary](g1-simulation-2026-11-16.json) |
| Transaction inspection | All seven sender/nonce/value/chain fields, constructor/initializer bytes and CREATE predictions matched the compiled artifacts and public inputs; no hashes or receipts | [Simulation summary](g1-simulation-2026-11-16.json) |
| Gas estimate | `4,858,094` gas; sum of the seven planned gas limits agrees | [Simulation summary](g1-simulation-2026-11-16.json) |
| Post-simulation RPC check | At `2026-11-15T21:08:49.213Z`, block `61136968`, balances unchanged, both nonces still `0`, all six predicted addresses code `0x`; header hash rechecked | [Postflight JSON](g1-postflight-2026-11-16.json) |

The wrapper ran `forge build --build-info` (compilation skipped because files were unchanged) and passed the local registry identity check. Existing fixture/lint warnings remain; no application source was modified. The observed max-fee estimate was `0.00000017 gwei` and the corresponding native-cost estimate `0.00000000082587598 AVAX`; Forge labels the generic native unit `ETH`. These unusually low values are the actual snapshot estimates, not a funding target or a future fee guarantee. The postflight RPC independently returned base fee `10 wei`, priority fee `150 wei` and gas price `160 wei`.

The initial snapshot above had an unfunded owner. It is retained as historical evidence and is superseded for funding readiness by the funded refresh below.

The raw simulations are under `packages/contracts/broadcast/DeployDemo.s.sol/43113/dry-run/`; each summary records its timestamped raw-file path and SHA-256. The original summary points to its byte-identical timestamped archive so later `run-latest.json` changes do not invalidate that hash. Public broadcast/simulation files are now tracked in `bbbe441`; preserve them and review any future additions individually. The separate ignored Foundry `cache/` output may contain sensitive values and is not part of the public bundle. Future staging should use specific reviewed paths, not the entire contract workspace.

### Funded refresh — current G1 readiness

The user supplied screenshots showing the completed funding and confirmed the local keystore address matched the owner. No funding transaction hash was supplied; this record does not claim a particular transfer receipt. Public balances and nonce were checked independently.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Funded preflight | At `2026-11-15T22:03:02.418Z`, chain `43113`, block `61139244`; owner `0.1 AVAX` / nonce `0`; attester `0.39999999999664 AVAX` / nonce `1`; both code `0x`; header rechecked | [Funded preflight JSON](g1-funded-preflight-2026-11-16.json) |
| Refreshed no-signer simulation | Wrapper exit `0`; all seven complete planned transaction objects identical to the previously reviewed simulation; no hashes, receipts or pending transactions | [Funded simulation summary](g1-funded-simulation-2026-11-16.json) |
| Gas and balance check | `4,858,094` gas; observed maximum fee `170 wei/gas`; estimated cost `825,875,980 wei` (`0.00000000082587598 AVAX`); owner balance exceeds the observed estimate | [Funded simulation summary](g1-funded-simulation-2026-11-16.json) |
| Funded postflight | At `2026-11-15T22:05:55.080Z`, block `61139363`, hash `0x0ccbffa6292a8f8802ccdfd9f52ebe0a99267ad160bc046003dd85404957ab09`; balances and nonces unchanged since funded preflight; all six predicted contract addresses still code `0x`; header rechecked | [Funded postflight JSON](g1-funded-postflight-2026-11-16.json) |

The funded G1 snapshot was sufficient to enter G2 and is retained as history. The completed deployment above consumed owner nonces `0`–`6`.

## G3/G4 preparation — November 16

- Local registry identity passed; all six artifact and both build-info SHA-256 values still matched the frozen G2 record. Installed Forge verification options were inspected; no verification submission command was run.
- At `2026-11-16T02:54:14.785Z`, a GET to the proposed Builder Hub Fuji endpoint with `module=contract`, `action=getsourcecode`, the actual registry address and public placeholder `apikey=builder-hub` returned HTTP `200`, API status `1`, empty source and `ABI="Contract source code not verified"`. This is a read-endpoint/status observation, not successful source verification or proof that uploads work.
- [M7_G3_G4_SESSION_PLAN.md](../../M7_G3_G4_SESSION_PLAN.md) contains actual inputs, the registry-first handoff, a PR/source-selection decision, Vercel settings, acceptance checks and failure recovery. G3 source URLs, G4 origin and hosted acceptance results remain pending; no account, credential, project or deployment was created in this planning pass.

## G5 localhost read-only & non-wallet checks — November 17

- Built `@avaguard/web` (`Next.js 16.4.6`) and started `http://localhost:3000` (`AVAGUARD_ENV=fuji`, `FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc`, `REGISTRY_ADDRESS=0x003D1f3C26FfAC734297979B1FC82914217C5392`, `AVAGUARD_APP_ORIGIN=http://localhost:3000`, AI disabled).
- Verified header pill (`Avalanche Fuji · 43113`), malformed input (`0x1234` rejected), EOA empty-code check (`0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` -> `not-analyzable`, `no-bytecode · No score available`, `Publish` absent), pre-G5 `/lookup` (`"No published reports for this target."` for all 4 targets), and exact-origin lock (`http://localhost:3000` enabled `Check wallet`, `http://127.0.0.1:3000` disabled publication with `"Fuji publication is restricted to the configured origin (http://localhost:3000)."`).
- Executed `16/16` live Fuji scans (`1` first + `3` subsequent per target, `0` failures, `Template explanation`):
  - `DemoBaselineToken`: `0 / 100 · Few signals` (`["R-SOURCE-UNKNOWN"]`), first `3945 ms`, subsequent `3429–3928 ms` (median `3436 ms`).
  - `DemoMintPauseToken`: `45 / 100 · Some signals` (`["R-MINT", "R-OWNER-EOA", "R-PAUSE", "R-SOURCE-UNKNOWN"]`), first `4456 ms`, subsequent `3927–4443 ms` (median `3968 ms`).
  - `DemoTokenProxy`: `60 / 100 · Many signals` (`["R-MINT", "R-OWNER-EOA", "R-PROXY", "R-SOURCE-UNKNOWN"]`, ERC-1967 -> `0x3e56446cacf6aa3d77157de83c449c837d45064d`), first `4952 ms`, subsequent `3931–4446 ms` (median `4445 ms`).
  - `DecoyConstantToken`: `0 / 100 · Few signals` (`["R-SOURCE-UNKNOWN"]`), first `3926 ms`, subsequent `3403–3913 ms` (median `3894 ms`).
- The later wallet and report records below extend this read-only checkpoint. See [the G5 localhost scan and timing record](g5-localhost-readonly-2026-11-17.json).

## First G5 browser publication — November 17

- The user supplied screenshots showing the wrong-network guard, invalidated readiness after a network change, restored authorized Fuji attester status, and a confirmed baseline publication. MetaMask's token-network filter is separate from the network selected for the connected `localhost:3000` dapp. The earlier generic `Wallet rejected or failed to submit the transaction` screenshot does not by itself establish an intentional Reject test.
- Independent read-only Fuji verification at `2026-11-17T16:56:20.846Z` confirmed transaction `0xcc9d9f41e3189a87ce98fc121f5e88392c94a3bc5b0783a670a82ea65f2902be`: receipt status `1` at block `61245622`, the expected attester and registry, zero native value, and the frozen registry runtime. Calldata, the `ReportPublished` event and `getReport` at the receipt block agree. Attester permission was checked at that same block, and both receipt/original-snapshot header hashes and chain ID were rechecked.
- The commitment is for `DemoBaselineToken`, score `0`, ruleset `1`, original block `61245287`, report hash `0x44aa619ede0e1f741861c6203673a212c2f4299e97f76e7d54f028b08228f936`. See [the publication evidence](g5-baseline-publication-2026-11-17.json). This operational manifest is not the canonical report body.
- At the November 17 receipt-verification checkpoint, the original JSON, browser import and original-block replay were pending; checking a historical block header did not prove state replay availability. The November 18 continuation below records the supplied original export and browser results. No additional transaction was signed or sent during independent verification.

## Baseline canonical JSON, import and replay — November 18

- The user supplied [the original canonical report](avaguard-0x58d42e6710764c1753cad885fa80916a1f516fec-61245287.json). It was copied byte-for-byte into this release bundle, with the original unchanged: `11804` bytes, SHA-256 `aff7c3c19aa6f1f6d13e45fe0221fe1d3e2739403c6324d0a66e22e47c6c4e14`. Do not reformat this file or add a final newline.
- Independent local checks at `2026-11-17T17:05:44.434Z` (November 18 in Vietnam) passed the existing strict report schema, exact canonical-byte comparison, raw/canonical Keccak agreement, all eight publication fields against the independently verified commitment, and target runtime-bytecode hash. ReportHash remains `0x44aa619ede0e1f741861c6203673a212c2f4299e97f76e7d54f028b08228f936`; snapshot remains `61245287` / `0x20eec9f0dfc128c7f7cdbbdf5da07ce565aac0b063d90f9e4f5539969afbfdbc`.
- User screenshots from `/lookup` show `Commitment matches. Hash and registry summary fields agree.` and `Original-block replay: replay-matches`. These are observed browser results; no separate RPC replay was rerun during local file validation. See [the validation and observation record](g5-baseline-validation-2026-11-18.json).
- A subsequent user screenshot shows `Current block 61246139 · No semantic changes.` after **Scan current state**. This is a new snapshot comparison, distinct from the original-block replay; its block hash is not visible in the screenshot and is not invented. The result describes only the fields compared by the app.
- Prepared an ignored local negative-control file at `cache/g5/baseline-tampered-DO-NOT-PUBLISH.json`, changing only the `R-SOURCE-UNKNOWN` finding explanation. The strict schema still passes, but the existing commitment validator returns `commitment-mismatch`; the original still returns `commitment-matches`. Both original copies retain their recorded SHA-256. The test copy is not part of the canonical release bundle.
- Subsequent user screenshots confirm browser rejection of that test copy (`Hash mismatch.`, **Replay original block** disabled) and recovery after re-importing the original (`Commitment matches. Hash and registry summary fields agree.`, replay enabled). The baseline publish/export/import/replay/current-state and tamper rejection/recovery paths are evidenced. The remaining showcase work is tracked below; this does not mark all G5 acceptance complete.

## Wallet guards, report changes and Cancel recovery — November 18

- While scanning `DemoMintPauseToken` (displayed score `45`, block `61246505`), the user switched the account connected to `localhost:3000` from Account 1 to Account 2 on Fuji. The app displayed `Wallet changed. Check the account and network again.` and disabled Publish. The user explicitly confirmed that Publish had been enabled by **Check wallet** before the switch; that preceding enabled state is text-confirmed, while the disabled state is visible in the screenshot.
- **Check wallet** for Account 2 then displayed `Account lacks live attester permission.` with Publish disabled. Only the truncated address `0x64Bb8...57E93` is visible, so no full secondary-account address is invented. See [the wallet guard record](g5-wallet-guards-2026-11-18.json).
- Account-change readiness invalidation and unauthorized-account rejection are recorded as passed. Subsequent screenshots supplied for the guided rescan check show Account 1 authorized with Publish enabled, then the initial wallet-check prompt with Publish disabled while the account and Fuji network remain unchanged. Report-change readiness invalidation is recorded as observed; the new snapshot block/hash are not visible and are not inferred from the earlier scan.
- The user explicitly confirmed Cancel during Publish. The resulting screenshot displays `Wallet rejected or failed to submit the transaction.`, leaves **Check wallet** enabled, disables Publish and shows no transaction hash or success state. This passes intentional rejection recovery to a fresh wallet check. A subsequent successful Mint/pause publication is independently verified below; the cancellation screenshots themselves do not establish that publication.

## Mint/pause publication, canonical JSON, import and replay — November 18

- Independently verified the user-signed transaction `0xe1ba2e32585c0fcedab582c3e71618b81b3261c870744e6e56bfc6f593eb03f2`: successful receipt at block `61247120`, authorized attester, intended registry and zero native value. All eight publication fields agree across calldata, `ReportPublished`, stored commitment and canonical export. Registry runtime identity, target code at snapshot/receipt blocks, both block hashes and chain ID were checked. See [the publication record](g5-mintpause-publication-2026-11-18.json).
- Found [the original canonical export](avaguard-0xe2f96ca00564cee3505ac3b22d4cf0f66b730ec6-61246821.json) under the exact expected filename in the user's previously shared Avalanche folder and preserved its bytes: `15525` bytes, SHA-256 `8e1adca83854ccbc72c7178b6cc50e7637aed9da465c1e4c6c481f76bdfae324`. Strict schema, canonical-byte, raw/canonical Keccak and commitment checks passed. Snapshot is `61246821` / `0x1a027631c7fb2ef6b86fd77e1c6bf9cf04f7b5bec36ecc94978ea567bd530a12`, score `45` (`Some signals`), with 12 checked, 7 outside scope and 0 unavailable coverage entries.
- User screenshots show a confirmed publication, one lookup entry with attested score `45`, and `Commitment matches. Hash and registry summary fields agree.` after import. A subsequent screenshot displays `Original-block replay: replay-matches` for the imported report at snapshot `61246821`. Another displays `Current block 61249225 · No semantic changes.`; the current block hash is not visible and remains unrecorded. These are user-observed browser results, separate from independent publication/export verification; the assistant did not rerun the analyzer. See [the validation and browser observations](g5-mintpause-validation-2026-11-18.json).

## Proxy scan transport failure and Fuji recovery — November 18

- The user saw `inconclusive` with `transport · No score available` while scanning `DemoTokenProxy` on port 3000. An independent browser check identified the running app there as `Local Anvil · 43113` and reproduced the same outcome. The result had 0 checked, 2 unavailable and 14 outside-scope coverage entries. Publish and canonical export were absent. The earlier Fuji read-only record covers the empty-code case.
- A separate production instance using the existing build served Fuji at `http://localhost:3001`, bound to `127.0.0.1:3001`. At the recovery check, a browser scan returned `60 / 100 · Many signals` with `R-PROXY` at snapshot `61259992`. The browser could export and check wallet readiness. The registry lookup found the existing Baseline commitment and returned `No published reports for this target.` for the proxy before the publication below. See [the transport and recovery record](g5-localhost-transport-recovery-2026-11-18.json).

## Proxy publication, canonical JSON and replay — November 18

- Independently verified transaction `0x78e44d1cfc5afdd31cbe4bbaef673de8f2dd14d9217b1b06a0483fe11db7e053` at receipt block `61260534`. All eight publication fields agree across calldata, the event, the stored commitment and the original canonical export. The registry runtime and attester permission matched the Fuji deployment. See [the publication record](g5-proxy-publication-2026-11-18.json).
- Found and preserved the user's [original canonical export](avaguard-0xffad3eb4fbb259b1e76f84a66d6c0d005864d61c-61260485.json). Its score is 60 with 14 checked, 6 outside scope and 0 unavailable coverage entries at snapshot `61260485`. The ERC-1967 slot resolved to `0x3E56446cACf6Aa3D77157de83c449c837d45064d`. Target and implementation runtime bytes match the snapshot and file evidence. The export is 21683 bytes with SHA-256 `1a24cd3ae07db327138e0d524eb8bcd54b1c238896aefa8cb2a82d26e4d3b3b6`.
- User browser screenshots from `http://localhost:3001` show an authorized attester, a submitted transaction, one lookup entry, matching JSON import and `Original-block replay: replay-matches`. In the submission screenshot, MetaMask showed `Transaction confirmed` while the app displayed `Pending receipt`. The independent receipt check confirms success. The later current-state comparison at block `61260576` reported `No semantic changes` in the fields compared by the app. See [the browser and export validation record](g5-proxy-validation-2026-11-18.json).

## Decoy publication, canonical JSON and replay — November 18

- Independent Fuji readback verified transaction `0xe1e1649cf826be7363aab7c4a36d44d8886d10d01984e08e024f17f199f64e7e` at receipt block `61260827`. The sender, registry runtime and all eight publication fields matched across the transaction input, event, stored commitment and canonical export. See [the Decoy publication record](g5-decoy-publication-2026-11-18.json).
- The [original Decoy export](avaguard-0xfa73c98ece0639cb86da211e98e742289de5fcd4-61260797.json) has score `0 / 100 · Few signals` and only the informational `R-SOURCE-UNKNOWN` finding at snapshot `61260797`. Coverage recorded 11 checked, 6 outside scope and 0 unavailable entries. The preserved file has 9107 bytes and SHA-256 `238a8da67582613c4333f7affd30e963c882c0b0e297774b217ae71b6f677753`.
- User screenshots from `http://localhost:3001` show commitment lookup, matching import and `Original-block replay: replay-matches`. The current-state comparison at block `61260847` reported `No semantic changes` in the fields compared by the app. See [the Decoy validation record](g5-decoy-validation-2026-11-18.json).

## Report and submission ledger

| Target | Canonical file / reportHash | Publication receipt | Import / original-block replay |
| --- | --- | --- | --- |
| Baseline | [Canonical JSON, validated and preserved](avaguard-0x58d42e6710764c1753cad885fa80916a1f516fec-61245287.json); reportHash `0x44aa619ede0e1f741861c6203673a212c2f4299e97f76e7d54f028b08228f936`, snapshot `61245287` | [Verified successful receipt](g5-baseline-publication-2026-11-17.json), transaction `0xcc9d9f41e3189a87ce98fc121f5e88392c94a3bc5b0783a670a82ea65f2902be` | [User screenshots: commitment-matches / replay-matches](g5-baseline-validation-2026-11-18.json) |
| Mint/pause | [Canonical JSON, validated and preserved](avaguard-0xe2f96ca00564cee3505ac3b22d4cf0f66b730ec6-61246821.json); reportHash `0xf8fb1ca6fae7e6ebb9e79694c30c1e1a89834c0aa6ad89997634d67d04cdc74c`, snapshot `61246821` | [Verified successful receipt](g5-mintpause-publication-2026-11-18.json), transaction `0xe1ba2e32585c0fcedab582c3e71618b81b3261c870744e6e56bfc6f593eb03f2` | [User screenshots: commitment-matches / replay-matches](g5-mintpause-validation-2026-11-18.json) |
| Upgradeable proxy | [Canonical JSON, validated and preserved](avaguard-0xffad3eb4fbb259b1e76f84a66d6c0d005864d61c-61260485.json), reportHash `0x724dd734f49619e424fb4fab049daabc2f03e0a6b8ec67e404c085aa821ad807`, snapshot `61260485` | [Verified successful receipt](g5-proxy-publication-2026-11-18.json), transaction `0x78e44d1cfc5afdd31cbe4bbaef673de8f2dd14d9217b1b06a0483fe11db7e053` | [User screenshots of matching import and replay](g5-proxy-validation-2026-11-18.json) |
| Decoy | [Canonical JSON, validated and preserved](avaguard-0xfa73c98ece0639cb86da211e98e742289de5fcd4-61260797.json), reportHash `0x24ba4aa85cfeaf45a9e386603126dc0be24afc42fa4878d7da26c7ba92e9da29`, snapshot `61260797` | [Verified successful receipt](g5-decoy-publication-2026-11-18.json), transaction `0xe1e1649cf826be7363aab7c4a36d44d8886d10d01984e08e024f17f199f64e7e` | [User screenshots of matching import and replay](g5-decoy-validation-2026-11-18.json) |

The four commitments matched their exports in independent registry readback at Fuji block `61260827`. A fresh Edge session without a wallet observed `Report body unavailable.` before each import, then verified all four JSONs and replayed Mint/pause at its original block. The user recorded matching replays for all four and current-state comparisons with no semantic changes in the compared fields. The acceptance record links these results to the earlier scan timings, wallet guards, tamper rejection and transport handling. See [the G5 acceptance record](g5-acceptance-2026-11-18.json).

GitHub publication of the evidence bundle, the final README, video, slides and submission remain pending. G4 hosting is optional and deferred.
