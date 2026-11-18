# AvaGuard M7 Delivery & Fuji Deployment Runbook

G2 completed on November 16 with six Fuji contracts, seven successful receipts and strict initial-state readback. G3 completed on November 17 with six signed-out Builder Hub source pages marked `Exact match`. G5 completed on November 18 with four localhost Fuji wallet publications and matching exports, imports and replays. GitHub publication and submission are pending. Optional hosting stays deferred. See [the release evidence](releases/m7-fuji/README.md) and [the G5 acceptance record](releases/m7-fuji/g5-acceptance-2026-11-18.json).

PR #8 is merged at `c7bd311` with passing post-merge CI. Follow [M7_EXECUTION_PLAN.md](M7_EXECUTION_PLAN.md) for the current sequence, public inputs, hosting proposal, evidence requirements and failure recovery. The commands here are execution references, not authorization to publish or sign.

## 1. Environment Modes (`local` vs `fuji`)

`apps/web` reads server configuration from `AVAGUARD_ENV`, `FUJI_RPC_URL`, `REGISTRY_ADDRESS`, and optional `AVAGUARD_APP_ORIGIN` (`apps/web/lib/server-config.ts`):

| Mode | Required Env Vars | Publication / Lookup Behavior | Browser Origin Rule |
| --- | --- | --- | --- |
| `local` | `AVAGUARD_ENV=local`, loopback `FUJI_RPC_URL=http://127.0.0.1:<port>`, `REGISTRY_ADDRESS=0x...` | Enables wallet publication & lookup against local Anvil (`chainId = 43113`, requires `web3_clientVersion` matching `/anvil/i` and `registryRuntimeHash`). Preserves `scripts/local-demo.sh`. | Loopback hostnames only (`127.0.0.1`, `localhost`, `[::1]`). |
| `fuji` | `AVAGUARD_ENV=fuji`, non-loopback `FUJI_RPC_URL=https://...`, `REGISTRY_ADDRESS=0x...`, optional `AVAGUARD_APP_ORIGIN=https://...` | Enables wallet publication & lookup against Avalanche Fuji (`chainId = 43113` and pinned `registryRuntimeHash`; skips local `web3_clientVersion` Anvil check). | Exact `AVAGUARD_APP_ORIGIN` match when configured, otherwise `https:` (or loopback for local dev). |
| Unset / invalid | Omitted or invalid `AVAGUARD_ENV` or missing `REGISTRY_ADDRESS` | Fails closed: wallet publication (and lookup if registry is unset/invalid) is disabled. Read-only scanning on `/` and `/lookup` replay stay available whenever `FUJI_RPC_URL` is a valid HTTP(S) URL without embedded credentials. | Publication disabled. |

Keep `.env.local` untracked and never embed RPC basic-auth credentials (`https://user:pass@...`) in `FUJI_RPC_URL`.

## 2. Wallet Roles & Foundry Keystore Setup (User-Run)

On November 16 the user set up both wallets, funded the owner and completed G2 with local keystore signing. [The G2 execution record](releases/m7-fuji/G2_HANDOFF.md) preserves the successful commands and evidence; do not repeat the deployment. [M7_WALLET_SETUP.md](M7_WALLET_SETUP.md) and the creation/import commands below are reference instructions for an operator without an existing wallet; do not recreate or overwrite `fuji-deployer`. The existing Fuji attester published all four G5 reports.

Separate the deployer/registry owner key from the injected browser attester key so `OWNER_ADDRESS` is not mixed with routine report attestation:

1. Create or import a dedicated deployer keystore locally in WSL/Linux (prompts invisibly for the keystore password; never pass raw keys or cleartext password flags on the CLI, and never store secrets in `.env*`):
   ```bash
   # Prompts invisibly for a password and writes ~/.foundry/keystores/fuji-deployer
   cast wallet new fuji-deployer
   # Or specify the keystore directory + account name explicitly:
   # cast wallet new ~/.foundry/keystores fuji-deployer
   # Or import an existing testnet-only deployer key interactively:
   cast wallet import fuji-deployer --interactive
   ```
2. Record the public addresses:
   - `OWNER_ADDRESS`: the `fuji-deployer` address (owns `RiskRegistry`, authorizes `ATTESTER_ADDRESS`, owns `DemoMintPauseToken` and `DemoTokenProxy`, and broadcasts `DeployDemoScript`).
   - `ATTESTER_ADDRESS`: a separate Avalanche Fuji address in your browser wallet (Core, MetaMask, or Rabby) used strictly to sign `RiskRegistry.publish(...)` transactions in the web UI.
3. Fund `OWNER_ADDRESS` (and a small amount for `ATTESTER_ADDRESS`) from an official Fuji faucet:
   - [Avalanche Builder Faucet](https://faucet.avax.network/)
   - [Core Testnet Faucet](https://core.app/tools/testnet-faucet/)

## 3. Reproducible Contract Deployment (`scripts/fuji-deploy.sh`)

`packages/contracts/script/DeployDemo.s.sol` deploys the complete demo suite on chain ID `43113` and grants attestation rights to `ATTESTER_ADDRESS`:

- `RiskRegistry(owner)` + `setAttester(attester, true)`
- `DemoBaselineToken("AvaGuard Demo Baseline", "AGBASE", initialHolder, 1_000_000 ether)`
- `DemoMintPauseToken("AvaGuard Demo MintPause", "AGMP", owner, initialHolder, 1_000_000 ether)`
- `DemoUpgradeableToken()` (logic contract with constructor `_disableInitializers()`)
- `DemoTokenProxy(implementation, initialize("AvaGuard Demo Upgradeable", "AGUP", owner, initialHolder, 1_000_000 ether))`
- `DecoyConstantToken()` (negative control with selector constant bytes without supported dispatcher evidence; absence of dispatcher signals is not proof matching functions are harmless)

Note: `scripts/fuji-deploy.sh` is tracked with Git executable mode `100755`, and all commands below use `bash scripts/fuji-deploy.sh` so they run consistently across Linux/WSL environments even if file permissions are not preserved by an archive/checkout tool.

### Step A: Verify Registry Artifact Identity & Run Dry-Run Simulation

Dry-run is the default and does **not** broadcast transactions or unlock any signer:

```bash
bash scripts/fuji-deploy.sh \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --owner 0xYOUR_OWNER_ADDRESS \
  --attester 0xYOUR_ATTESTER_ADDRESS
# Optional when initial supply recipient differs from OWNER_ADDRESS:
# --initial-holder 0xYOUR_INITIAL_HOLDER
```

This runs `forge build --build-info`, `node scripts/verify-registry-identity.mjs`, checks `cast chain-id == 43113`, and simulates `DeployDemoScript` without `--broadcast` or any `--account`/`--keystore` argument.

### Step B: Broadcast to Avalanche Fuji (`43113`)

Only when ready to deploy on live Fuji, pass `--broadcast` with `--account <name>` for a named keystore in `~/.foundry/keystores` (Foundry prompts invisibly for the password), or pass `--keystore <path>` for a keystore file/directory path (resolved relative to the caller's working directory before `cd packages/contracts`):

```bash
bash scripts/fuji-deploy.sh \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --owner 0xYOUR_OWNER_ADDRESS \
  --attester 0xYOUR_ATTESTER_ADDRESS \
  --account fuji-deployer \
  --broadcast
# Optional: --initial-holder 0xYOUR_INITIAL_HOLDER
# Alternative for an explicit file/directory keystore:
# --keystore ~/.foundry/keystores/fuji-deployer --broadcast
```

### Step C: Read-Back On-Chain Verification

Record all 6 deployed contract addresses and effective `INITIAL_HOLDER` from the `DeployDemoScript` output using unified names:

```bash
export FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
export OWNER_ADDRESS=0xYOUR_OWNER_ADDRESS
export ATTESTER_ADDRESS=0xYOUR_ATTESTER_ADDRESS
export INITIAL_HOLDER="${INITIAL_HOLDER:-$OWNER_ADDRESS}"
export REGISTRY_ADDRESS=0xDEPLOYED_REGISTRY
export BASELINE_TOKEN_ADDRESS=0xDEPLOYED_BASELINE
export MINT_PAUSE_TOKEN_ADDRESS=0xDEPLOYED_MINT_PAUSE
export UPGRADEABLE_IMPL_ADDRESS=0xDEPLOYED_UPGRADEABLE_IMPL
export UPGRADEABLE_PROXY_ADDRESS=0xDEPLOYED_PROXY
export DECOY_TOKEN_ADDRESS=0xDEPLOYED_DECOY
```

Then run full read-back verification against one pinned snapshot block (`--readback`):

```bash
bash scripts/fuji-deploy.sh --readback --skip-build
```

Expected pinned-snapshot invariants (`--readback` locks one block number/hash before reads and re-verifies the same block hash after all reads):
- `scripts/verify-registry-identity.mjs` confirms `chainId=43113` and `onChainHash == 0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38` at the pinned block.
- `RiskRegistry.owner()` equals `OWNER_ADDRESS` and `RiskRegistry.attesters(ATTESTER_ADDRESS)` returns `true`.
- All 5 deployed token/proxy/implementation/decoy contracts have nonempty bytecode at the pinned block.
- `DemoBaselineToken`, `DemoMintPauseToken`, and `DemoTokenProxy` match expected `totalSupply() == 1000000000000000000000000`, `balanceOf(INITIAL_HOLDER) == 1000000000000000000000000`, expected `owner()`, and `DemoMintPauseToken.paused() == false`.
- `DemoTokenProxy` ERC-1967 implementation slot (`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) resolves to exact `UPGRADEABLE_IMPL_ADDRESS`.

If verifying an already-exercised deployment after later transfers, mints, or pauses, pass `--readback --allow-post-deploy-state` (keeps all identity, role, nonempty code, and proxy implementation assertions strict while exempting initial supply/balance/unpaused equality). To inspect only `RiskRegistry` without verifying demo tokens, use `--readback-registry --owner ... --attester ... --registry ...` (explicitly warns it is **not** a full-suite verification pass).

## 4. Source Verification on Fuji Explorers (User-Run)

For the next session, use [M7_G3_G4_SESSION_PLAN.md](M7_G3_G4_SESSION_PLAN.md) for the actual six addresses, proposed Builder Hub endpoint/public placeholder key, registry-first command and precise completion criteria. G2 is complete; this step requires no wallet unlock or new deployment. Preserve and compare frozen build-info/artifact hashes before any rebuild.

Pinned compiler profile in `packages/contracts/foundry.toml`:

- Solc: `0.8.30` (`0.8.30+commit.73712a01`)
- EVM version: `cancun`
- Optimizer: `enabled = true`, `runs = 200`
- Bytecode hash: `ipfs`
- Exact `RiskRegistry` runtime hash: `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`

Preserve the matching G2 artifacts/build-info and compare their hashes before verification. If an artifact is missing, investigate and rebuild with `forge build --build-info` under the unchanged profile; do not run `forge clean` or replace preserved deployment evidence. Export the same `OWNER_ADDRESS`, effective `INITIAL_HOLDER` and all six receipt-derived addresses from the session plan before using the commands below.

- Select the verifier before running these commands. The current [Builder Hub guide](https://build.avax.network/docs/tooling/contract-verification) documents Builder Hub's own API; it does not establish Routescan endpoint availability. Its [API reference](https://build.avax.network/docs/tooling/contract-verification/api-reference) uses `/api/verify/{chainId}/api` for catalog chains with public RPCs. Confirm Fuji support before selecting `https://build.avax.network/api/verify/43113/api`. The API accepts a non-empty placeholder API-key field; it is not an account credential.
- The previously recorded Routescan endpoint, `https://api.routescan.io/v2/network/testnet/evm/43113/etherscan`, is a separate candidate requiring fresh provider/API confirmation. Record the selected provider and set `VERIFIER_URL` locally to its confirmed Fuji endpoint. A successful submission is not evidence of source visibility on another explorer.
- The examples below use an Etherscan-compatible custom endpoint. For the proposed Builder Hub endpoint, use the public placeholder `VERIFIER_API_KEY=builder-hub` from the session plan; do not use it as a credential for another provider. Installed Forge help confirms the flags below. If using a Standard JSON upload instead, export with `forge verify-contract --show-standard-json-input` for the actual address/contract and keep the same compiler profile. The November 16 read-only Builder Hub lookup responded with the registry unverified; source submission remains untested.

After explicit G3 authorization, run the setup and registry command first. Wait for its final status and inspect its source page before continuing. Run the remaining contract blocks one at a time; stop on a failed or ambiguous result and retain its request ID. All six commands include the same explicit compiler/API placeholder/retry settings.

```bash
: "${VERIFIER_URL:?Select and confirm a Fuji Etherscan-compatible verifier endpoint first}"
: "${VERIFIER_API_KEY:?Set the selected verifier API field; Builder Hub uses the public placeholder builder-hub}"
: "${OWNER_ADDRESS:?Set the G2 owner address}"
: "${INITIAL_HOLDER:?Set the effective G2 initial holder}"
: "${REGISTRY_ADDRESS:?Set the receipt-derived registry address}"
: "${BASELINE_TOKEN_ADDRESS:?Set the receipt-derived baseline address}"
: "${MINT_PAUSE_TOKEN_ADDRESS:?Set the receipt-derived mint-pause address}"
: "${UPGRADEABLE_IMPL_ADDRESS:?Set the receipt-derived implementation address}"
: "${UPGRADEABLE_PROXY_ADDRESS:?Set the receipt-derived proxy address}"
: "${DECOY_TOKEN_ADDRESS:?Set the receipt-derived decoy address}"
cd packages/contracts

# 1. RiskRegistry
OWNER_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(address)' "$OWNER_ADDRESS")"
~/.foundry/bin/forge verify-contract "$REGISTRY_ADDRESS" src/RiskRegistry.sol:RiskRegistry \
  --chain 43113 \
  --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --constructor-args "$OWNER_ARGS" \
  --watch

```

```bash
# 2. DemoBaselineToken (constructor initialHolder = $INITIAL_HOLDER)
BASE_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(string,string,address,uint256)' 'AvaGuard Demo Baseline' 'AGBASE' "$INITIAL_HOLDER" 1000000000000000000000000)"
~/.foundry/bin/forge verify-contract "$BASELINE_TOKEN_ADDRESS" src/DemoTokens.sol:DemoBaselineToken \
  --chain 43113 --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --constructor-args "$BASE_ARGS" --watch

```

```bash
# 3. DemoMintPauseToken (initialOwner = $OWNER_ADDRESS, initialHolder = $INITIAL_HOLDER)
MP_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(string,string,address,address,uint256)' 'AvaGuard Demo MintPause' 'AGMP' "$OWNER_ADDRESS" "$INITIAL_HOLDER" 1000000000000000000000000)"
~/.foundry/bin/forge verify-contract "$MINT_PAUSE_TOKEN_ADDRESS" src/DemoTokens.sol:DemoMintPauseToken \
  --chain 43113 --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --constructor-args "$MP_ARGS" --watch

```

```bash
# 4. DemoUpgradeableToken (implementation)
~/.foundry/bin/forge verify-contract "$UPGRADEABLE_IMPL_ADDRESS" src/DemoTokens.sol:DemoUpgradeableToken \
  --chain 43113 --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --watch

```

```bash
# 5. DemoTokenProxy (ERC-1967 proxy; initialize initialOwner = $OWNER_ADDRESS, initialHolder = $INITIAL_HOLDER)
INIT_BYTES="$(~/.foundry/bin/cast calldata 'initialize(string,string,address,address,uint256)' 'AvaGuard Demo Upgradeable' 'AGUP' "$OWNER_ADDRESS" "$INITIAL_HOLDER" 1000000000000000000000000)"
PROXY_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(address,bytes)' "$UPGRADEABLE_IMPL_ADDRESS" "$INIT_BYTES")"
~/.foundry/bin/forge verify-contract "$UPGRADEABLE_PROXY_ADDRESS" src/DemoTokens.sol:DemoTokenProxy \
  --chain 43113 --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --constructor-args "$PROXY_ARGS" --watch

```

```bash
# 6. DecoyConstantToken (negative control)
~/.foundry/bin/forge verify-contract "$DECOY_TOKEN_ADDRESS" src/GoldenFixtures.sol:DecoyConstantToken \
  --chain 43113 --verifier custom \
  --verifier-url "$VERIFIER_URL" \
  --verifier-api-key "$VERIFIER_API_KEY" \
  --compiler-version v0.8.30+commit.73712a01 \
  --num-of-optimizations 200 --evm-version cancun \
  --retries 3 --delay 5 \
  --watch
```

Check the selected provider's status with `forge verify-check <GUID> --chain 43113 --verifier custom --verifier-url "$VERIFIER_URL" --verifier-api-key "$VERIFIER_API_KEY" --retries 3 --delay 5` when supported. For a different verifier protocol, use that provider's documented Foundry options after confirming Fuji support; do not reuse a key or endpoint from another provider. Record the actual match/status and open each final source link while signed out. Return to the repository root (`cd ../..`) before using root-level scripts.

## 5. Localhost Fuji Execution (G5 Priority), Optional Hosting & No-DB Report Retrieval

### Localhost Fuji Mode (`http://localhost:3000` — G5 Priority)

Because public hosting is optional per the November 17 organizer recap, run G5 real-wallet Fuji acceptance on localhost first. When `AVAGUARD_APP_ORIGIN=http://localhost:3000` is set, browser publication requires **exact** `http://localhost:3000` (`http://127.0.0.1:3000` is intentionally blocked on publication even though the server binds `127.0.0.1:3000`):

```powershell
# PowerShell from repository root (explicit overrides prevent stale .env.local values)
pnpm build
$env:AVAGUARD_ENV = "fuji"
$env:FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
$env:REGISTRY_ADDRESS = "0x003D1f3C26FfAC734297979B1FC82914217C5392"
$env:AVAGUARD_APP_ORIGIN = "http://localhost:3000"
pnpm --filter @avaguard/web start -H 127.0.0.1 -p 3000
```

Then open **`http://localhost:3000`** uniformly in Chrome/MetaMask. Passing G5 on localhost verifies real MetaMask signing, on-chain `RiskRegistry` commitments, canonical exports, `/lookup` import, and original-block replay against live Fuji (`43113`). It does **not** verify optional HTTPS hosting checks (`signed-out Vercel HTTPS access`, `AVAGUARD_APP_ORIGIN` production lock, Vercel build/runtime logs, or `60s` Server Action budget), which must remain marked `pending` or `deferred` unless G4 runs.

### Optional Hosting Target (Deferred Unless Executed After G5/G6)

- **Optional recommendation**: Vercel Hobby and its assigned `*.vercel.app` project domain (`$0` within personal/non-commercial included usage), or provider-neutral Node.js `next start`. [M7_EXECUTION_PLAN.md](M7_EXECUTION_PLAN.md) records the proposed Vercel settings and smoke checks; account setup and deployment remain `deferred / not deployed`.
- **Startup commands (Node server fallback)**:
  ```bash
  pnpm install --frozen-lockfile
  pnpm build
  AVAGUARD_ENV=fuji \
  FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc \
  REGISTRY_ADDRESS=0x003D1f3C26FfAC734297979B1FC82914217C5392 \
  AVAGUARD_APP_ORIGIN=https://your-avaguard-host.example.com \
  pnpm --filter @avaguard/web start -H 0.0.0.0 -p 3000
  ```
- **Local Anvil demo fallback**: `scripts/local-demo.sh` remains intact for local offline/Anvil demonstrations using `AVAGUARD_ENV=local` and `FUJI_RPC_URL=http://127.0.0.1:8545`.

### Canonical Report Storage & Retrieval (No Server Database)

`RiskRegistry` intentionally stores only a compact commitment (`target`, `score`, `codehash`, `implementation`, `reportHash`, `rulesetVersion`, `blockNumber`, `blockHash`, `attester`, `publishedAt`). No database or public user-upload endpoint is used:

1. During scan/publication on `/`, the attester exports the canonical report JSON (`avaguard-<address>-<blockNumber>.json`).
2. Published canonical JSON artifacts for the deployed demo tokens are distributed alongside the release/submission bundle (for example, committed under a versioned bundle directory or GitHub Release asset).
3. On `/lookup`, anyone queries `RiskRegistry` by token address (`Find latest` or `Read history entry`) and imports the canonical JSON file:
   - The browser recomputes `keccak256` of the canonical UTF-8 JSON bytes and confirms it equals `reportHash` on-chain as well as matching summary fields.
   - `Replay original block` re-executes reads at `body.blockNumber` / `body.blockHash` read-only and reports `replay-matches` or `historical-state-unavailable` (without substituting `latest`).

## 6. Observed Local Demo Contract Reports & Pending Fuji Deployment Ledger

All four demo contracts below were compiled with Forge (`0.8.30`, `cancun`, optimizer `200`), deployed via real transactions on local Anvil (`chainId = 43113`), tested functionally, and scanned in `packages/analyzer/test/anvil.integration.test.ts`:

| Contract | Intended Showcase Role | Observed Anvil Score & Band | Observed Finding IDs |
| --- | --- | --- | --- |
| `DemoBaselineToken` (`AGBASE`) | Ordinary ERC-20 baseline (no admin/mint/pause/proxy) | `0 / 100` (`Few signals`) | `R-SOURCE-UNKNOWN` |
| `DemoMintPauseToken` (`AGMP`) | Owned ERC-20 with real minting + `ERC20Pausable` | `45 / 100` (`Some signals`) | `R-MINT`, `R-OWNER-EOA`, `R-PAUSE`, `R-SOURCE-UNKNOWN` |
| `DemoTokenProxy` + `DemoUpgradeableToken` (`AGUP`) | Real ERC-1967 UUPS upgradeable proxy + initialized storage | `60 / 100` (`Many signals`) | `R-MINT`, `R-OWNER-EOA`, `R-PROXY`, `R-SOURCE-UNKNOWN` |
| `DecoyConstantToken` | Negative control (selector constant bytes without supported dispatcher evidence) | `0 / 100` (`Few signals`) | `R-SOURCE-UNKNOWN` |

### Pending Real Fuji Addresses & Submission Links

| Item | Address / URL | Explorer Verification Status | Notes |
| --- | --- | --- | --- |
| `RiskRegistry` | `0x003D1f3C26FfAC734297979B1FC82914217C5392` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x003D1f3C26FfAC734297979B1FC82914217C5392)) | On-chain runtime matched pinned hash `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`; GUID `54459f39-0f77-4705-acbd-dfd080c771c6` |
| `DemoBaselineToken` (`AGBASE`) | `0x58d42E6710764c1753Cad885fA80916a1F516Fec` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x58d42E6710764c1753Cad885fA80916a1F516Fec)) | Ordinary ERC-20 baseline; GUID `b52ba024-f71b-4e87-b036-3602dc040c7a` |
| `DemoMintPauseToken` (`AGMP`) | `0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6)) | Controlled mint + real pause; GUID `d8a9e8bd-f9e1-42a4-aff2-b7795960b253` |
| `DemoUpgradeableToken` (impl) | `0x3E56446cACf6Aa3D77157de83c449c837d45064d` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x3E56446cACf6Aa3D77157de83c449c837d45064d)) | UUPS logic contract (`_disableInitializers`); GUID `07a82ca1-7547-40f4-b58d-171d3d62eb5f` |
| `DemoTokenProxy` (`AGUP`) | `0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xFfAd3eb4FbB259B1e76f84A66d6C0D005864d61c)) | ERC-1967 proxy pointing to `DemoUpgradeableToken`; GUID `1bde5db1-c960-43af-9378-3988f75fc5de` |
| `DecoyConstantToken` | `0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4` | `Exact match` ([Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0xFa73c98Ece0639CB86dA211E98E742289dE5FCd4)) | Selector-constant negative control (absence of dispatcher evidence is not a safety proof); GUID `d008d971-3a8e-4d30-a3b6-1fba478d2f92` |
| Publication transaction hashes | [Four verified receipts](releases/m7-fuji/g5-acceptance-2026-11-18.json) | Fuji `43113` | All four commitments verified at block `61260827` |
| Canonical report files for Fuji suite | [Four preserved exports](releases/m7-fuji/README.md#report-and-submission-ledger) | — | Matching import and replay recorded for every report |
| Hosted AvaGuard HTTPS URL | `deferred / not deployed` | — | Optional per organizer recap; deploy `apps/web` (`AVAGUARD_ENV=fuji`) only if team elects G4 |
| Public repository | [ChieNg00/AvaGuard](https://github.com/ChieNg00/AvaGuard) | — | GitHub metadata reports public; recheck signed-out judge access before submission |
| Demo video / Vietnamese slides | `not recorded` | — | Max 3m video & Vietnamese slides (`GitHub → video → slides`) after G5 real-wallet evidence |

## 7. Manual Wallet (G5 Localhost / Optional Host) & Submission Checklists

### Browser wallet acceptance observed on localhost Fuji

- [x] Verified the `Avalanche Fuji · 43113` header and wallet flow on the configured `localhost` origins. The earlier `3000` check verified exact-origin rejection, and the later `3001` production instance completed Proxy and Decoy.
- [x] Run anonymous scans (`4` showcase targets + `1+3` timing samples per target), empty/malformed/no-code EOA (`not-analyzable`/`inconclusive`), exact-origin rejection (`127.0.0.1:3000` vs `localhost:3000`), and pre-G5 `/lookup` check (`No published reports for this target.`).
- [x] Wrong network blocked publishing and **Switch wallet to 43113** restored the Fuji wallet check.
- [x] Unauthorized account stayed blocked. Changing the account, chain or report cleared publish readiness.
- [x] Cancel in MetaMask restored **Check wallet** and kept **Publish** disabled. The app displayed the cancellation result without a submitted hash.
- [x] The authorized attester published all four exports. Fresh lookup verified the missing body and correct import for each. Baseline tamper rejection and recovery, all four original-block replays, and all four current-state comparisons were recorded.

### Public Release Readiness Checklist

- [x] Fuji deployment broadcast complete and all 6 source pages verified (`Exact match` on Builder Hub) and accessible while signed out.
- [x] G5 real-wallet Fuji acceptance passed on localhost and all four canonical JSONs are in the local evidence bundle.
- [ ] Review and publish the G3/G5 evidence bundle on GitHub after authorization.
- [ ] Optional G4 HTTPS hosting reachable signed out with `AVAGUARD_ENV=fuji` and `AVAGUARD_APP_ORIGIN` enforced (`deferred / optional`).
- [ ] Public repository, verified sources, max-3m video, and Vietnamese slides (`GitHub → video → slides`) reviewed for accidental credential inclusion and accessible while signed out.
