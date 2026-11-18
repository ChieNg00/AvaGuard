# M7 session record and delivery plan

Prepared 2026-11-16 and updated 2026-11-18 after G5 completion. Read with [the execution plan](M7_EXECUTION_PLAN.md), [the delivery runbook](M7_DELIVERY.md) and [the release evidence](releases/m7-fuji/README.md).

## 1. Outcome and starting evidence

**G2 deployment, G3 source verification and G5 localhost Fuji acceptance are complete.** The organizer recap gives the review order as **GitHub → video → slides**, a maximum three-minute video and Vietnamese presentation. See [the G5 acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).

1. Review the local G3/G5 documentation and evidence diff. Recheck PR #9 before authorized GitHub publication or merge.
2. Finalize the README, Vietnamese demo video and Vietnamese slides for G6. Verify signed-out access to the submission links.
3. G4 Vercel Hobby hosting and its HTTPS, build, function budget and latency checks remain deferred. The team may elect a live trial link after the core G6 materials are ready.

Observed during preparation on November 16 and the November 17 read-only follow-up:

- The checkout started clean on `codex/m7-public-delivery` at `bbbe4418c98225bda569ed6e892ec2bd6449536d`, matching its local remote-tracking ref. G2 documentation and public broadcast archives are already committed there. This new planning update is a separate local diff.
- [PR #9](https://github.com/ChieNg00/AvaGuard/pull/9) remains open against `main`, with that head SHA. [CI run 43774373740](https://github.com/ChieNg00/AvaGuard/actions/runs/43774373740) passed both `workspace-checks` and `contracts-and-integration`, including production build, deployment checks and browser acceptance. On November 17, GitHub returned `mergeable=true`, `mergeable_state=blocked`, no submitted reviews and no review threads. Active [ruleset main-2](https://github.com/ChieNg00/AvaGuard/rules/27142816) requires one approving review; that requirement is unmet. Both required checks succeeded on this exact head with the required GitHub Actions app ID `15368`. Obtain the required review and recheck mergeability before any authorized merge; do not bypass protection as part of this plan.
- Application, analyzer, contract source/deployment script, CI and dependency files have no diff from deployed source `c7bd311cfb8d0253dedec9719c2d50a542963792`. All six artifact hashes and both build-info hashes still match [the G2 source snapshot](releases/m7-fuji/g2-source-2026-11-16.json). `node scripts/verify-registry-identity.mjs` passed again.
- G2 has seven successful receipts and strict initial-state readback at block `61141800`, hash `0x1c911f8ad0aeeddab59123851a34a38ec79946ee43c6968b4de53148316ac059`. Preserve that historical snapshot. The owner nonce was already `7` after deployment; do not rerun the nonce-zero deployment.
- On November 17 under explicit G3 authorization, all six deployed Fuji contracts passed Avalanche Builder Hub source verification sequentially (`RiskRegistry` first, then the five demo/decoy contracts) using the frozen G2 compiler settings (`v0.8.30+commit.73712a01`, `evm=cancun`, `200` runs, IPFS metadata) and archived constructor/initializer bytes without altering any G2 artifact or build-info hash. All six `checkverifystatus` queries returned `Pass - Verified`, Builder Hub Sourcify metadata returned `verified: true` and `match: "exact_match"`, `getsourcecode` returned canonical ABIs and Standard JSON sources, and signed-out headless Chromium checks confirmed public source pages at `https://build.avax.network/explorer/fuji/c-chain/address/<address>` (while Forge CLI's `/api/verify/43113/address/<address>` URL returned HTTP `404`). See [the G3 verification manifest](releases/m7-fuji/g3-verification-2026-11-17.json).

No hosting account/project was created, no hosted deployment was published, no wallet was unlocked, no transaction was submitted, and no commit/push was performed during G3. G4 (hosting), G5 (real-wallet publication/canonical JSON/replay) and G6 (submission) need their own explicit execution scope.

## 2. Updated priority agenda and operator preparation

Estimated active effort for the remaining core deliverables (excluding optional G4 hosting): **about 4–7 hours** (`Commit/PR #9 review` + `G5 localhost` + `README / ≤3m video / Vietnamese slides`). Add **~2–3 hours** only if opting into optional G4 Vercel Hobby hosting afterwards.

| Order | Work | Status / Priority | Completion evidence |
| --- | --- | --- | --- |
| 1 | G3/G5 GitHub evidence and PR #9 review | Pending | Reviewed evidence diff and signed-out access |
| 2 | **G5 on localhost (`AVAGUARD_ENV=fuji`)** | **Complete** | Four real wallet publications, canonical JSONs, imports and recorded replays |
| 3 | **G6 README, max-3m video & Vietnamese slides** | Pending | Updated README, Vietnamese walkthrough video and slides, signed-out link checks and submission confirmation |
| 4 | **G4 optional Vercel Hobby HTTPS hosting** | **Optional / deferred (`pending`)** | Only if time permits: actual `*.vercel.app` HTTPS origin, Node 24/pnpm 12.4.2 logs, `60s` Server Actions, signed-out hosted smoke & hosted G5 re-check |

The user only needs the following for the upcoming steps:

- **Step 1 (Commit/Push & PR #9):** explicit authorization to commit/push the explicit G3/planning file list to `codex/m7-public-delivery` and arrange 1 approving review on [PR #9](https://github.com/ChieNg00/AvaGuard/pull/9) (`ruleset main-2`).
- **Step 2 (G5 Localhost):** Chrome/Chromium with MetaMask/Core switched to the authorized browser attester (`0xc6f32290379CA39273306e3758aB0a2b813ce3eB`, ~`0.4 AVAX` on Fuji) plus a secondary unauthorized account & temporary wrong network (`0x1`) for fail-closed tests. **No keystore unlock or contract redeployment is needed.**
- **Step 4 (Optional G4 only):** designated Vercel Hobby operator login (`USD 0`, `*.vercel.app`). Keep account login and hosting deployment out of scope unless explicitly requested later.

## 3. G3 execution handoff

### Fixed inputs

Use receipt-derived addresses, not fresh CREATE predictions. This block only sets public shell variables, from the repository root in Ubuntu WSL:

```bash
export FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
export OWNER_ADDRESS=0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1
export ATTESTER_ADDRESS=0xc6f32290379CA39273306e3758aB0a2b813ce3eB
export INITIAL_HOLDER="$OWNER_ADDRESS"
export REGISTRY_ADDRESS=0x003D1f3C26FfAC734297979B1FC82914217C5392
export BASELINE_TOKEN_ADDRESS=0x58d42E6710764c1753Cad885fA80916a1F516Fec
export MINT_PAUSE_TOKEN_ADDRESS=0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6
export UPGRADEABLE_IMPL_ADDRESS=0x3E56446cACf6Aa3D77157de83c449c837d45064d
export UPGRADEABLE_PROXY_ADDRESS=0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c
export DECOY_TOKEN_ADDRESS=0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4
export VERIFIER_URL=https://build.avax.network/api/verify/43113/api
export VERIFIER_API_KEY=builder-hub
```

`builder-hub` is a public placeholder accepted by this provider, not a credential to create or request. Installed Forge 1.9.0 help confirms `--verifier custom`, `--verifier-api-key` / `VERIFIER_API_KEY`, `--show-standard-json-input`, `--watch` and bounded retry options. The [Builder Hub guide](https://build.avax.network/docs/tooling/contract-verification) and [API reference](https://build.avax.network/docs/tooling/contract-verification/api-reference) describe the submission protocol; the successful GET above is the local availability observation. Routescan is a separate fallback requiring its own endpoint and status confirmation.

Retain `solc=0.8.30+commit.73712a01`, `evm=cancun`, optimizer enabled with `200` runs, and IPFS bytecode metadata. Preserve the existing build-info; do not run `forge clean`, change compiler/profile or modify source to force verification.

| Contract identifier | Constructor / initializer input |
| --- | --- |
| `src/RiskRegistry.sol:RiskRegistry` | `OWNER_ADDRESS` |
| `src/DemoTokens.sol:DemoBaselineToken` | `"AvaGuard Demo Baseline"`, `"AGBASE"`, `INITIAL_HOLDER`, `1000000000000000000000000` |
| `src/DemoTokens.sol:DemoMintPauseToken` | `"AvaGuard Demo MintPause"`, `"AGMP"`, `OWNER_ADDRESS`, `INITIAL_HOLDER`, same supply |
| `src/DemoTokens.sol:DemoUpgradeableToken` | No constructor arguments |
| `src/DemoTokens.sol:DemoTokenProxy` | Actual implementation address and ABI-encoded `initialize("AvaGuard Demo Upgradeable", "AGUP", OWNER_ADDRESS, INITIAL_HOLDER, supply)` |
| `src/GoldenFixtures.sol:DecoyConstantToken` | No constructor arguments |

### Execution sequence after G3 authorization

1. Recheck local changes, exact source SHA and artifact hashes. Inspect each Standard JSON input locally before upload: include imported sources, correct fully qualified contract name, exact compiler/settings and no unrelated local configuration. `forge verify-contract --show-standard-json-input` is the export path; do not flatten source. Preserve original build-info even if a separate verification input is generated.
2. Use `cast abi-encode` / `cast calldata` commands in [M7_DELIVERY section 4](M7_DELIVERY.md#4-source-verification-on-fuji-explorers-user-run). Compare their constructor/initializer bytes with the archived creation inputs already independently checked in [G2 deployment evidence](releases/m7-fuji/g2-deployment-2026-11-16.json).
3. Submit **RiskRegistry only** first. From the repository root, after the public variables above are set:

```bash
cd packages/contracts
OWNER_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(address)' "$OWNER_ADDRESS")"
~/.foundry/bin/forge verify-contract "$REGISTRY_ADDRESS" src/RiskRegistry.sol:RiskRegistry \
  --chain 43113 --verifier custom --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --constructor-args "$OWNER_ARGS" --retries 3 --delay 5 --watch
```

4. Record the submission ID and terminal status. If a request times out, look up that ID or the address before resubmitting. API envelope `status=1` alone is not proof of source verification: inspect returned source, ABI, compiler/settings and final verification status. Open the actual provider's source page while signed out.
5. Once registry verification succeeds, run the remaining five blocks from runbook section 4 one at a time using the exported addresses/provider placeholder. All six commands now include the same explicit compiler/API placeholder/retry flags; no manual flag assembly is needed. Verify implementation and proxy separately; a verified implementation does not make the proxy verified.
6. Save public evidence under `docs/releases/m7-fuji/`: selected provider, request IDs, six addresses, creation hashes, compiler/settings, verification input hashes, constructor inputs, final status/match level, actual source URLs and observation timestamps. Update the release ledger and PROGRESS. Do not fabricate provider URLs or classify a queued job as complete.

Builder Hub documents that constructor arguments are stored/displayed but are **not independently checked** by its runtime match. Preserve AvaGuard's separate creation-calldata evidence. Record the provider's actual match level, including any metadata distinction; investigate an unexpected non-exact match against the frozen artifacts. Verification does not certify contract safety, and external verification does not automatically remove `R-SOURCE-UNKNOWN` from the current analyzer.

**G3 status (`completed November 17`):** all six Builder Hub source pages are publicly readable while signed out (`Exact match`), statuses and compiler/source identities are verified, and [the G3 verification manifest](releases/m7-fuji/g3-verification-2026-11-17.json) is complete. Keep G3 as completed evidence; do not re-submit unless a specific provider change is later requested.

## 4. G5 localhost Fuji configuration and acceptance checklist

### Localhost runtime configuration (`AVAGUARD_ENV=fuji`)

Verified against `apps/web/lib/server-config.ts` and `apps/web/lib/publication-config.ts`: when `AVAGUARD_APP_ORIGIN=http://localhost:3000` is configured, browser publication enforces an **exact** origin match (`location.origin === "http://localhost:3000"`). Opening `http://127.0.0.1:3000` in the browser will intentionally block publication even on loopback, so **use `http://localhost:3000` uniformly** across server config and browser navigation. To guarantee stale keys in untracked `apps/web/.env.local` do not override Fuji settings during G5, build once and start `apps/web` in PowerShell with explicit process variables:

```powershell
pnpm build
$env:AVAGUARD_ENV = "fuji"
$env:FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
$env:REGISTRY_ADDRESS = "0x003D1f3C26FfAC734297979B1FC82914217C5392"
$env:AVAGUARD_APP_ORIGIN = "http://localhost:3000"
pnpm --filter @avaguard/web start -H 127.0.0.1 -p 3000
```

When port 3000 already serves Local Anvil, start the Fuji instance with `-p 3001` and set `AVAGUARD_APP_ORIGIN=http://localhost:3001`. Use that same origin on the scan and lookup pages in the checklist. Check that the header reads `Avalanche Fuji · 43113` before scanning. The November 18 recovery used this setup. See [the browser and server observations](releases/m7-fuji/g5-localhost-transport-recovery-2026-11-18.json).

Leave AI variables unset (`AVAGUARD_AI_ENABLED`, `AVAGUARD_LOCAL_EXPLAIN_URL`) so `Template explanation` stays truthful. Remember: localhost tests do **not** validate optional HTTPS hosting (`AVAGUARD_APP_ORIGIN` production HTTPS lock, Preview disabled, signed-out Vercel access, or Vercel `60s` Server Actions).

### Real-wallet Fuji acceptance checklist (Checklist B — full G5 parity)

This checklist covers the scope exercised for G5. The acceptance record above links the observed results. See [the execution plan](M7_EXECUTION_PLAN.md#g5--real-wallet-acceptance-and-report-bundle).

1. **Read-only / non-wallet checks & latency (`http://localhost:3000`, wallet disconnected)**:
   - Confirm header reads `Avalanche Fuji · 43113`.
   - Confirm exact-origin guard: `/` allows publication readiness UI on `http://localhost:3000`, whereas opening `http://127.0.0.1:3000` rejects publication with the configured-origin error.
   - Confirm empty/malformed address validation and no-code / EOA target (e.g. `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` or `0x0000...dEaD`): returns `not-analyzable` / `inconclusive` with no numeric score and publication unavailable.
   - Scan all four showcase targets anonymously (compare against local Anvil references `0 / 45 / 60 / 0`, keeping `Template explanation` provenance and coverage explicit; never force scores) plus **1 cold + 3 warm runs per target** (`16` total Fuji scans) recording timestamp, snapshot, success/failure, range, and median (`localhost -> Fuji RPC`):
     - `DemoBaselineToken`: `0x58d42E6710764c1753Cad885fA80916a1F516Fec`
     - `DemoMintPauseToken`: `0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6`
     - `DemoTokenProxy` (`AGUP`, proxy address): `0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c`
     - `DecoyConstantToken`: `0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4`
   - Confirm pre-G5 `/lookup` against the target addresses returns `"No published reports for this target."` cleanly.
2. **Wallet guard, invalidation & rejection checks (human-operated MetaMask on `http://localhost:3000`, zero reverting txs needed)**:
   - **Wrong network (`0x1`)**: switch MetaMask to Ethereum Mainnet (`0x1`) -> click **Check wallet** -> confirm AvaGuard blocks publish and reveals **Switch wallet to 43113** -> click **Switch wallet to 43113** -> verify switch back to Fuji (`43113`) -> re-check **Check wallet**.
   - **Unauthorized account**: switch MetaMask to a non-attester account -> click **Check wallet** -> confirm AvaGuard reports unauthorized attester and keeps **Publish** disabled.
   - **Readiness invalidation (mandatory)**: switch MetaMask to authorized attester `0xc6f32290379CA39273306e3758aB0a2b813ce3eB`, click **Check wallet** so **Publish** activates, then change MetaMask account OR switch network OR trigger a new scan/report -> confirm **Publish** disables immediately and requires rechecking before signing.
   - **User rejects signature (mandatory)**: after a clean **Check wallet** on a scanned target, click **Publish** and click **Reject** in MetaMask -> confirm UI recovers cleanly without inventing a tx hash or success state.
3. **Authorized publication & canonical JSON export (`4/4` contracts)**:
   - Using authorized attester `0xc6f32290379CA39273306e3758aB0a2b813ce3eB`, for each of the 4 showcase contracts on `/`: click **Export canonical JSON** (saves `avaguard-<address>-<blockNumber>.json`), click **Check wallet**, then click **Publish** and approve in MetaMask. Record every `reportHash`, `blockNumber`, `blockHash`, and `publication` tx hash.
   - If MetaMask times out or drops confirmation, keep the shown tx hash and click **Check receipt** rather than double-publishing.
4. **Independent `/lookup`, JSON import, negative tamper test, replay & current-state comparison (`http://localhost:3000/lookup`, fresh browser session)**:
   - Open `/lookup`, query each address via **Find latest**, verify missing JSON state (`"Report body unavailable."` with **Replay original block** disabled).
   - Import the unmodified `avaguard-<address>-<blockNumber>.json` via **Import canonical JSON**, confirm `"Commitment matches. Hash and registry summary fields agree."`.
   - Create an altered copy of one JSON file and test importing that copy -> confirm `"Hash mismatch."` (discard copy afterward and retain all 4 unmodified original exports).
   - Click **Replay original block** (record `replay-matches` or explicit `historical-state-unavailable`; do **not** substitute `latest`) and click **Scan current state** (distinct snapshot/diff comparison).
5. **Save G5 bundle**: store the four unmodified canonical report JSONs + G5 acceptance manifest/receipts/timings under `docs/releases/m7-fuji/`, keeping any unexecuted G5 items `pending` and G4 hosting checks `pending` / `deferred`.

## 5. G4 optional hosting handoff (`deferred / optional`)

### Source selection before import

Prefer `main` after PR #9 is reviewed, its merge requirements are satisfied and the merge is authorized; record the resulting SHA and its CI. If the PR remains open, an explicitly selected `codex/m7-public-delivery` production branch is a viable demo path after review. In either case, inspect the exact deployed commit. Do not let Vercel's default branch selection silently replace the intended revision. The current checked delivery head is `bbbe441`; any later config/code commit needs its own validation.

Do not merge, enable auto-merge or bypass branch protection as part of preparation. Review the committed public broadcast archives individually; preserve them and keep ignored Foundry cache outside release evidence. Future staging must use specific paths.

### Proposed project configuration

| Setting | Value / verification |
| --- | --- |
| Provider / plan | Vercel Hobby; eligible demo within included usage; one hosting operator |
| Framework / repository | Next.js / `ChieNg00/AvaGuard` |
| Root Directory | `apps/web`; keep **Include files outside the root directory in the Build Step** enabled for the analyzer workspace and root lockfile |
| Node | Explicit `24.x`; provider defaults can change. Record actual build/runtime version where exposed |
| Package manager | Root `pnpm@12.4.2`; `ENABLE_EXPERIMENTAL_COREPACK=1` in the environments that build the app; confirm `12.4.2` in logs |
| Install / build | `pnpm install --frozen-lockfile` / `pnpm build` from `apps/web`; Next.js preset output defaults |
| Function budget | Fluid compute; set project Default Max Duration to `60` seconds and verify the deployed scan/replay functions inherit it; retain analyzer's `30`-second deadline |
| Origin | Actual assigned project HTTPS domain under `*.vercel.app`; no purchased domain |
| Preview | Keep publication configuration unset. A valid RPC may support read-only scanning; never copy production publication settings to arbitrary preview origins |

Vercel's [build settings](https://vercel.com/docs/builds/configure-a-build) document Corepack and monorepo file access; its [Node support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) includes 24.x. The [Hobby plan](https://vercel.com/docs/plans/hobby) currently allows a 300-second function ceiling, and [duration settings](https://vercel.com/docs/functions/configuring-functions/duration) describe the dashboard default and deployment inspection. These are provider capabilities, not proof this app has passed hosted acceptance. Do not infer pnpm 12.4.2 from lockfile autodetection alone.

Set these **Production-only app variables** in provider settings:

| Variable | Value |
| --- | --- |
| `AVAGUARD_ENV` | `fuji` |
| `FUJI_RPC_URL` | `https://api.avax-test.network/ext/bc/C/rpc` |
| `REGISTRY_ADDRESS` | `0x003D1f3C26FfAC734297979B1FC82914217C5392` |
| `AVAGUARD_APP_ORIGIN` | The actual assigned HTTPS origin, scheme and host only; no path, query or trailing slash |

Leave optional AI variables unset: the shipped baseline uses the labeled template explanation. Keep server configuration server-only; no wallet secret belongs in Vercel or browser bundles. Do not bulk-import local `.env` files.

### Import, deploy and validate

1. The operator logs in and selects the eligible Hobby account. Review the chosen source, settings and account access before the authorized project import/deployment.
2. If the final project domain is only known after import, the first deployment can keep publication disabled. Capture the actual domain, apply the production variables above and redeploy that same reviewed source. Never put a made-up origin into production settings.
3. Inspect install/build logs for Node 24, pnpm 12.4.2, workspace resolution and successful Next production build. Record actual source SHA, deployment/build URLs and non-secret applied settings. Verify a 60-second budget applies to Server Actions used by both `/` and `/lookup`, not just unrelated API routes. Use the dashboard first; introduce a small route/config change only if required, with relevant checks before deployment.
4. Open the stable production domain in a signed-out browser. Adjust deployment access settings only as authorized for the public demo; Preview can remain protected. `/` and `/lookup` must be accessible to a judge without a Vercel login.
5. Run the hosted checks below. Save actual results, block identities and measured timings. A successful static page or build is insufficient evidence of working Server Actions/RPC.

| Check | Required observation |
| --- | --- |
| Anonymous scan | All four showcase targets work without connecting a wallet: baseline, mint/pause, **proxy address**, and decoy |
| Report identity | Fuji `43113`, actual target, block number/hash, evidence, coverage and confidence shown; registry identity guard succeeds where invoked |
| Reference comparison | Compare observed reports with local reference scores `0 / 45 / 60 / 0` and expected findings in the runbook. Investigate differences; never relabel local scores as observed Fuji output |
| Empty / invalid input | Clear validation or unavailable/not-analyzable outcome; no fabricated risk score or safety claim |
| Lookup before G5 | Existing registry is readable; no published commitment is reported honestly if none exists. Do not create a dummy report to make lookup appear populated |
| Configuration / origin | Production exact origin accepted; Preview publication stays disabled; server never signs transactions |
| Explanation | Template provenance remains visible; no claim of a live AI adapter |
| Access / runtime | Signed-out HTTPS works; actual scan completes within the app/host budgets; no RPC or Server Action error hidden by a static success page |

Do not sign or publish report commitments during a G4-only smoke check. Real wallet rejection/wrong-network/success cases, canonical exports, import/hash checks and original-block replay are G5. A nonempty lookup and verified replay cannot be claimed before the relevant report exists.

**Optional G4 completion (only if executed):** public HTTPS routes and anonymous Fuji scans pass on the recorded revision; exact origin/registry/function settings and observed results are retained. Until G4 runs, all hosting-only checks (`HTTPS origin`, `signed-out Vercel access`, `Node 24 / pnpm 12.4.2 build logs`, `60s Server Action budget`, `Preview disabled`, `hosted latency`) remain **`pending` or `deferred`**. A Node 24 `next start` host remains the technical fallback in the runbook; moving to another provider or paid plan needs a reviewed proposal and authorization.

## 6. Evidence, testing and stop conditions

- Preserve all G2 and G3 JSON snapshots as historical facts. Store G5 canonical exports (`avaguard-<address>-<blockNumber>.json`) and localhost G5 observations with timestamps; label localhost timings as local->Fuji RPC rather than hosted latency, and leave unexecuted G4 fields `pending` / `deferred`.
- Update `docs/PROGRESS.md`, the release README and runbook links. Documentation-only changes require link/fence/whitespace checks. For a real application/config change, run affected checks and get CI on the selected commit; do not invent a new test suite for prose or rerun all tests without a relevant change.
- Handle a bytecode/source mismatch only if observed; never modify frozen G2/G3 manifests or scoring rules.
- Stop at the authorized gate. PR merge/push, hosting publication, account creation, paid services, browser report transactions and final competition submission are separate actions unless the user explicitly includes them.

After G5 on localhost, finalize **G6**: update `README.md`, record the **≤ 3-minute** walkthrough video in **Vietnamese** and prepare the **Vietnamese** pitch slides (`GitHub → video → slides` per the organizer recap), run signed-out link checks, then decide whether to add optional **G4** Vercel Hobby hosting before submission.

## 7. Continuation prompt

The [full continuation prompt](M7_PUBLIC_DELIVERY_PROMPT.md) remains available. For a focused next session, paste this block and separately state the external actions you authorize:

```text
Continue AvaGuard after completed G2 and G3. Read AGENTS.md, docs/DECISIONS.md,
docs/SCANNER_SPEC.md, docs/M7_G3_G4_SESSION_PLAN.md, docs/M7_DELIVERY.md,
docs/releases/m7-fuji/README.md, docs/releases/m7-fuji/g3-verification-2026-11-17.json
and the latest docs/PROGRESS.md entries.
Discuss in Vietnamese; write project docs in English; do not spawn agents.

Start by checking current branch/changes, PR #9 and CI. As checked November 17,
ruleset main-2 requires one approving review and PR #9 has no reviews; both
required checks pass. Do not bypass this requirement or send review requests
without authorization. Deployed contract source is c7bd311, G2 evidence is at
bbbe4418c98225bda569ed6e892ec2bd6449536d, and G3 verification evidence is saved
locally in docs/releases/m7-fuji/g3-verification-2026-11-17.json.
G2, G3 and G5 are complete. The four published reports and acceptance checks are
recorded in docs/releases/m7-fuji/g5-acceptance-2026-11-18.json.
Reuse the six verified receipt-derived addresses and frozen
artifacts; do not repeat deployment, source verification, wallet setup or keystore unlock.

Per the November 17 organizer recap (GitHub -> video -> slides, max 3-minute
video, Vietnamese presentation, hosting optional), prioritize:
1. Review the G3/G5 evidence diff and address PR #9 within my explicit scope.
2. G6 deliverables: README, <=3m Vietnamese walkthrough video, Vietnamese slides.
Keep optional G4 Vercel Hobby hosting (and hosting-only checks) marked pending or
deferred unless I explicitly request G4 afterwards.

Continue independent local/read-only work if an external input is missing.
Do not request credentials in chat or assume a green PR is mergeable.
Do not change scoring, add live AI, use paid services, push/merge or submit
reports unless separately authorized. Record actual checks and stop at the
authorized gate with a concise handoff.
```
