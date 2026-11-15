# M7 Fuji delivery evidence — G2 complete

Updated 2026-11-16, Vietnam time. The authorized G2 Fuji deployment is complete: six contracts, one attester-authorization transaction, seven independently verified successful receipts and passing strict full initial-state readback. Source verification, hosted app, browser-signed report publication and submission remain pending.

## Gate status

| Gate | Observed status | Remaining requirement |
| --- | --- | --- |
| G0 technical preparation | Execution source `c7bd311`, prior passing CI and local artifact/build-info hashes recorded | Documentation remains uncommitted; the working tree is not claimed clean |
| G1 | Complete for the observed snapshot: funded balances, user-confirmed signer address and refreshed signer-free simulation passed | Recheck state if source, public inputs, nonce or fees change before deployment |
| G2 deployment | Complete: 7/7 successful receipts; strict full readback passed at block `61141800` | Preserve this deployment; do not rerun the broadcast command |
| G3 source verification | Not started | Selected/confirmed verifier and authorization to submit source |
| G4 hosting | Not started | Account/operator and authorized Vercel deployment |
| G5 live acceptance | Not started | Hosted app, browser attester, real commitments and JSON exports |
| G6 submission | Not started | Verified public links, video/slides and submission confirmation |

See [the execution plan](../../M7_EXECUTION_PLAN.md), [delivery commands](../../M7_DELIVERY.md) and [the concrete G2 handoff](G2_HANDOFF.md). Existing wallets do not need to be recreated.

## Source and preservation evidence

- Selected source commit: `c7bd311cfb8d0253dedec9719c2d50a542963792` ([merged PR #8](https://github.com/ChieNg00/AvaGuard/pull/8)).
- Current local execution branch: `codex/m7-public-delivery`, created from refreshed `origin/main` with no upstream configured.
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
| Hosting | Vercel Hobby with assigned `*.vercel.app` domain recommended; no account/project selected or created |
| Production origin | `pending` |
| Verifier | `pending`; required for G3, not for G1 simulation |
| Deadline/form requirements | Repository target November 21, 23:59 Vietnam time; current organizer confirmation pending |

| Contract | Address | Creation transaction / block | Source URL / result |
| --- | --- | --- | --- |
| RiskRegistry | `0x003D1f3C26FfAC734297979B1FC82914217C5392` | `0x4e2f8e3ebd4c674f2fd93ee9d839db59649bbf2b3daadeae74e68ed4f53a8238` / `61141670` | Source not verified; G3 pending |
| DemoBaselineToken | `0x58d42E6710764c1753Cad885fA80916a1F516Fec` | `0x7719b9d8dcb02cef4f45aa25ba4fbe1e70cc94b817bfdafef34ea138ce04a3bd` / `61141670` | Source not verified; G3 pending |
| DemoMintPauseToken | `0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6` | `0x3071db1b83fa71257409e8c408f6d8d1bf31d64a9062661dd0f14d7460dcc677` / `61141670` | Source not verified; G3 pending |
| DemoUpgradeableToken implementation | `0x3E56446cACf6Aa3D77157de83c449c837d45064d` | `0x6cb5945828c0d73e62465674145656344c9143b14138a58fa255fd2cb49a73aa` / `61141671` | Source not verified; G3 pending |
| DemoTokenProxy | `0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c` | `0x5fe3d2868e5346a5e85432cfa83944e49187b8b1c2b262760ba383e224947636` / `61141671` | Source not verified; G3 pending |
| DecoyConstantToken | `0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4` | `0xb351e3a88f04e7d6d9f190c91612a38a8eccc7b82af1aa8ef117c074092af6d5` / `61141671` | Source not verified; G3 pending |

Attester authorization: `0x575d98c7d17e06ea7bcbc827c45940856632240eaccf9d3d9e0ed7b41021bca7`, successful at block `61141670`. All six addresses above were derived from successful on-chain creation receipts, not populated from predictions alone. Full receipt fields are in [the deployment manifest](g2-deployment-2026-11-16.json).

## G2 deployment and strict readback — completed November 16

- The user explicitly authorized G2 and entered the keystore password privately in WSL. The final wrapper exited `0`; no password was collected in chat or recorded by the assistant. An initial CRLF source-guard stop and two incorrect-password stops were resolved before any transaction was submitted; PROGRESS records the recovery evidence.
- [Source/artifact record](g2-source-2026-11-16.json): source `c7bd311`, previously verified passing CI, six artifact hashes and two build-info hashes. These hashes still matched after deployment. Documentation remains uncommitted; application, contract, script, CI and dependency code were unchanged.
- [Pre-broadcast state](g2-preflight-2026-11-16.json): chain `43113`, owner latest/pending nonce `0`, owner balance `0.1 AVAX`, and no code at the six predicted addresses before execution.
- [Deployment manifest](g2-deployment-2026-11-16.json): seven successful receipts independently read through RPC; each sender, nonce `0`–`6`, value `0` and on-chain input matched the reviewed G1 transaction plan. Creation addresses and canonical receipt block hashes matched. No pending transaction remained.
- Actual total gas used: `3,734,009`. Actual total fee: `597,441,440 wei` (`0.00000000059744144 AVAX`). At post-receipt block `61141750`, owner latest/pending nonce was `7` and balance was `0.09999999940255856 AVAX`, exactly the preflight balance minus verified fees. These are observed Fuji testnet values, not future fee guarantees.
- [Strict full initial-state readback](g2-initial-readback-2026-11-16.json): exit `0`, block `61141800`, hash `0x1c911f8ad0aeeddab59123851a34a38ec79946ee43c6968b4de53148316ac059`. Exact output: `Full initial-deployment read-back PASSED at block 61141800 (0x1c911f8ad0aeeddab59123851a34a38ec79946ee43c6968b4de53148316ac059).`
- Readback confirmed registry runtime identity/owner, `attesters(attester) == true`, nonempty code for every demo contract, the exact proxy implementation/owner, each initial token supply and owner-held balance of `1000000000000000000000000`, and `paused == false`. All required state reads used the recorded snapshot with header-hash recheck. No `--allow-post-deploy-state` or registry-only shortcut was used.

Do not run the deployment command again for this suite. G3 verifies source for these exact six addresses; G4 configures hosting with the actual registry above. Those public actions, browser report publication, commit/push and submission have not been performed or authorized by the G2 instruction.

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

The raw local simulations are under `packages/contracts/broadcast/DeployDemo.s.sol/43113/dry-run/`; each summary records its timestamped raw-file path and SHA-256. The original summary now points to its byte-identical timestamped archive so rerunning Forge does not invalidate that hash when `run-latest.json` changes. This directory is untracked and is not covered by an explicit broadcast ignore rule. Keep it for local evidence; do not stage it wholesale. The separate ignored Foundry `cache/` output may contain sensitive values and is not part of the public bundle. Only the six reviewed G1 JSON evidence files are intended for a later documentation commit.

### Funded refresh — current G1 readiness

The user supplied screenshots showing the completed funding and confirmed the local keystore address matched the owner. No funding transaction hash was supplied; this record does not claim a particular transfer receipt. Public balances and nonce were checked independently.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Funded preflight | At `2026-11-15T22:03:02.418Z`, chain `43113`, block `61139244`; owner `0.1 AVAX` / nonce `0`; attester `0.39999999999664 AVAX` / nonce `1`; both code `0x`; header rechecked | [Funded preflight JSON](g1-funded-preflight-2026-11-16.json) |
| Refreshed no-signer simulation | Wrapper exit `0`; all seven complete planned transaction objects identical to the previously reviewed simulation; no hashes, receipts or pending transactions | [Funded simulation summary](g1-funded-simulation-2026-11-16.json) |
| Gas and balance check | `4,858,094` gas; observed maximum fee `170 wei/gas`; estimated cost `825,875,980 wei` (`0.00000000082587598 AVAX`); owner balance exceeds the observed estimate | [Funded simulation summary](g1-funded-simulation-2026-11-16.json) |
| Funded postflight | At `2026-11-15T22:05:55.080Z`, block `61139363`, hash `0x0ccbffa6292a8f8802ccdfd9f52ebe0a99267ad160bc046003dd85404957ab09`; balances and nonces unchanged since funded preflight; all six predicted contract addresses still code `0x`; header rechecked | [Funded postflight JSON](g1-funded-postflight-2026-11-16.json) |

The funded G1 snapshot was sufficient to enter G2 and is retained as history. The later completed deployment above consumed owner nonces `0`–`6`; do not reuse the old nonce-zero preflight to start another deployment. Documentation is still uncommitted; G3–G6 remain pending.

## Report and submission ledger

| Target | Canonical file / reportHash | Publication receipt | Import / original-block replay |
| --- | --- | --- | --- |
| Baseline | `pending` | `pending` | `pending` |
| Mint/pause | `pending` | `pending` | `pending` |
| Upgradeable proxy | `pending` | `pending` | `pending` |
| Decoy | `pending` | `pending` | `pending` |

Hosted build/source SHA, real-wallet checks, performance samples, video, slides, signed-out link checks and submission receipt: all `pending`. There are no canonical analyzer report JSON files in this draft bundle yet; the G1 operational JSON files above do not satisfy that requirement. Populate these fields only from actual execution.
