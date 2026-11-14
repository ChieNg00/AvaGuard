# AvaGuard M7 Delivery & Fuji Deployment Runbook

This runbook documents the configuration, Foundry deployment, source-verification, hosting, and submission readiness steps prepared in M7. At handoff time, no live Fuji transactions, explorer verifications, or public hosting deployments have been executed; all unexecuted on-chain/external items are explicitly marked `not deployed`, `not verified`, or `not recorded`.

## 1. Environment Modes (`local` vs `fuji`)

`apps/web` reads server configuration from `AVAGUARD_ENV`, `FUJI_RPC_URL`, `REGISTRY_ADDRESS`, and optional `AVAGUARD_APP_ORIGIN` (`apps/web/lib/server-config.ts`):

| Mode | Required Env Vars | Publication / Lookup Behavior | Browser Origin Rule |
| --- | --- | --- | --- |
| `local` | `AVAGUARD_ENV=local`, loopback `FUJI_RPC_URL=http://127.0.0.1:<port>`, `REGISTRY_ADDRESS=0x...` | Enables wallet publication & lookup against local Anvil (`chainId = 43113`, requires `web3_clientVersion` matching `/anvil/i` and `registryRuntimeHash`). Preserves `scripts/local-demo.sh`. | Loopback hostnames only (`127.0.0.1`, `localhost`, `[::1]`). |
| `fuji` | `AVAGUARD_ENV=fuji`, non-loopback `FUJI_RPC_URL=https://...`, `REGISTRY_ADDRESS=0x...`, optional `AVAGUARD_APP_ORIGIN=https://...` | Enables wallet publication & lookup against Avalanche Fuji (`chainId = 43113` and pinned `registryRuntimeHash`; skips local `web3_clientVersion` Anvil check). | Exact `AVAGUARD_APP_ORIGIN` match when configured, otherwise `https:` (or loopback for local dev). |
| Unset / invalid | Omitted or invalid `AVAGUARD_ENV` or missing `REGISTRY_ADDRESS` | Fails closed: wallet publication (and lookup if registry is unset/invalid) is disabled. Read-only scanning on `/` and `/lookup` replay stay available whenever `FUJI_RPC_URL` is a valid HTTP(S) URL without embedded credentials. | Publication disabled. |

Keep `.env.local` untracked and never embed RPC basic-auth credentials (`https://user:pass@...`) in `FUJI_RPC_URL`.

## 2. Wallet Roles & Foundry Keystore Setup (User-Run)

Separate the deployer/registry owner key from the injected browser attester key so `OWNER_ADDRESS` is not mixed with routine report attestation:

1. Create or import a dedicated deployer keystore locally in WSL/Linux (interactive prompt; never pass raw keys on the CLI or store them in `.env*`):
   ```bash
   cast wallet new ~/.foundry/keystores --unsafe-password
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
- `DecoyConstantToken()` (reused negative control exposing constant selectors without privilege logic)

### Step A: Verify Registry Artifact Identity & Run Dry-Run Simulation

Dry-run is the default and does **not** broadcast transactions or unlock any keystore:

```bash
./scripts/fuji-deploy.sh \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --owner 0xYOUR_OWNER_ADDRESS \
  --attester 0xYOUR_ATTESTER_ADDRESS
```

This runs `forge build --build-info`, `node scripts/verify-registry-identity.mjs`, checks `cast chain-id == 43113`, and simulates `DeployDemoScript` without `--broadcast`.

### Step B: Broadcast to Avalanche Fuji (`43113`)

Only when ready to deploy on live Fuji, pass `--broadcast` and `--keystore` (Foundry prompts interactively for the keystore password):

```bash
./scripts/fuji-deploy.sh \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --owner 0xYOUR_OWNER_ADDRESS \
  --attester 0xYOUR_ATTESTER_ADDRESS \
  --keystore fuji-deployer \
  --broadcast
```

### Step C: Read-Back On-Chain Verification

After broadcast finishes, verify on-chain runtime bytecode identity, registry ownership, attester authorization, and demo contract state:

```bash
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc \
ATTESTER_ADDRESS=0xYOUR_ATTESTER_ADDRESS \
BASELINE_TOKEN_ADDRESS=0xDEPLOYED_BASELINE \
MINT_PAUSE_TOKEN_ADDRESS=0xDEPLOYED_MINT_PAUSE \
UPGRADEABLE_PROXY_ADDRESS=0xDEPLOYED_PROXY \
DECOY_TOKEN_ADDRESS=0xDEPLOYED_DECOY \
./scripts/fuji-deploy.sh --readback --skip-build --registry 0xDEPLOYED_REGISTRY
```

Expected read-back invariants:
- `scripts/verify-registry-identity.mjs` confirms `chainId=43113` and `onChainHash == 0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`.
- `RiskRegistry.owner()` equals `OWNER_ADDRESS` and `RiskRegistry.attesters(ATTESTER_ADDRESS)` returns `true`.
- `DemoTokenProxy` ERC-1967 implementation slot (`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) points to the deployed `DemoUpgradeableToken` address.

## 4. Source Verification on Fuji Explorers (User-Run)

Pinned compiler profile in `packages/contracts/foundry.toml`:

- Solc: `0.8.30` (`0.8.30+commit.73712a01`)
- EVM version: `cancun`
- Optimizer: `enabled = true`, `runs = 200`
- Bytecode hash: `ipfs`
- Exact `RiskRegistry` runtime hash: `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`

Rebuild with `--build-info` before verifying so Foundry retains matching metadata, then run `forge verify-contract` against Avalanche's Routescan Etherscan-compatible endpoint (`https://api.routescan.io/v2/network/testnet/evm/43113/etherscan`):

```bash
cd packages/contracts
~/.foundry/bin/forge build --build-info

# 1. RiskRegistry
OWNER_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(address)' "$OWNER_ADDRESS")"
~/.foundry/bin/forge verify-contract "$REGISTRY_ADDRESS" src/RiskRegistry.sol:RiskRegistry \
  --chain 43113 \
  --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan \
  --constructor-args "$OWNER_ARGS" \
  --watch

# 2. DemoBaselineToken
BASE_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(string,string,address,uint256)' 'AvaGuard Demo Baseline' 'AGBASE' "$OWNER_ADDRESS" 1000000000000000000000000)"
~/.foundry/bin/forge verify-contract "$BASELINE_ADDRESS" src/DemoTokens.sol:DemoBaselineToken \
  --chain 43113 --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan \
  --constructor-args "$BASE_ARGS" --watch

# 3. DemoMintPauseToken
MP_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(string,string,address,address,uint256)' 'AvaGuard Demo MintPause' 'AGMP' "$OWNER_ADDRESS" "$OWNER_ADDRESS" 1000000000000000000000000)"
~/.foundry/bin/forge verify-contract "$MINT_PAUSE_ADDRESS" src/DemoTokens.sol:DemoMintPauseToken \
  --chain 43113 --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan \
  --constructor-args "$MP_ARGS" --watch

# 4. DemoUpgradeableToken (implementation)
~/.foundry/bin/forge verify-contract "$UPGRADEABLE_IMPL_ADDRESS" src/DemoTokens.sol:DemoUpgradeableToken \
  --chain 43113 --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan --watch

# 5. DemoTokenProxy (ERC-1967 proxy)
INIT_BYTES="$(~/.foundry/bin/cast calldata 'initialize(string,string,address,address,uint256)' 'AvaGuard Demo Upgradeable' 'AGUP' "$OWNER_ADDRESS" "$OWNER_ADDRESS" 1000000000000000000000000)"
PROXY_ARGS="$(~/.foundry/bin/cast abi-encode 'constructor(address,bytes)' "$UPGRADEABLE_IMPL_ADDRESS" "$INIT_BYTES")"
~/.foundry/bin/forge verify-contract "$UPGRADEABLE_PROXY_ADDRESS" src/DemoTokens.sol:DemoTokenProxy \
  --chain 43113 --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan \
  --constructor-args "$PROXY_ARGS" --watch

# 6. DecoyConstantToken (negative control)
~/.foundry/bin/forge verify-contract "$DECOY_ADDRESS" src/GoldenFixtures.sol:DecoyConstantToken \
  --chain 43113 --verifier etherscan \
  --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan --watch
```

Check verification status manually if needed with `forge verify-check <GUID> --chain 43113 --verifier etherscan --verifier-url https://api.routescan.io/v2/network/testnet/evm/43113/etherscan`. Remember Snowscan (`https://testnet.snowscan.xyz`) and Snowtrace (`https://testnet.snowtrace.io`) can both be used by judges; if Snowscan requires a separate API key in your workflow, verify via Snowscan's API/UI separately.

## 5. Hosted Web App & No-DB Canonical Report Retrieval Plan

### Hosting Target Decision

- **Selected runtime**: Provider-neutral **Node.js `next start`** server (`apps/web`, running behind HTTPS/TLS termination on any Node 22/24 host such as Railway, Render, Fly.io, Cloud Run, or a VPS). Vercel is not required and does not need monorepo workspace build overrides unless desired later.
- **Startup commands**:
  ```bash
  pnpm install --frozen-lockfile
  pnpm build
  AVAGUARD_ENV=fuji \
  FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc \
  REGISTRY_ADDRESS=0xDEPLOYED_REGISTRY \
  AVAGUARD_APP_ORIGIN=https://your-avaguard-host.example.com \
  pnpm --filter @avaguard/web start -H 0.0.0.0 -p 3000
  ```
- **Local Anvil demo fallback**: `scripts/local-demo.sh` remains intact for local offline/Anvil demonstrations using `AVAGUARD_ENV=local` and `FUJI_RPC_URL=http://127.0.0.1:8545`.

### Canonical Report Storage & Retrieval (No Server Database)

`RiskRegistry` intentionally stores only a compact commitment (`target`, `score`, `codehash`, `implementation`, `reportHash`, `rulesetVersion`, `blockNumber`, `blockHash`, `attester`, `publishedAt`). No database or public user-upload endpoint is used:

1. During scan/publication on `/`, the attester exports the canonical report JSON (`avaguard-report-<reportHash>.json`).
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
| `DecoyConstantToken` | Negative control (constant `mint`/`blacklist`/`setFee` selectors) | `0 / 100` (`Few signals`) | `R-SOURCE-UNKNOWN` |

### Pending Real Fuji Addresses & Submission Links

| Item | Address / URL | Explorer Verification Status | Notes |
| --- | --- | --- | --- |
| `RiskRegistry` | `not deployed` | `not verified` | Runtime hash pinned to `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38` |
| `DemoBaselineToken` (`AGBASE`) | `not deployed` | `not verified` | Ordinary ERC-20 baseline |
| `DemoMintPauseToken` (`AGMP`) | `not deployed` | `not verified` | Controlled mint + real pause |
| `DemoUpgradeableToken` (impl) | `not deployed` | `not verified` | UUPS logic contract (`_disableInitializers`) |
| `DemoTokenProxy` (`AGUP`) | `not deployed` | `not verified` | ERC-1967 proxy pointing to `DemoUpgradeableToken` |
| `DecoyConstantToken` | `not deployed` | `not verified` | Selector-decoy negative control |
| Publication transaction hashes | `not recorded` | — | Record after Fuji attester publishes canonical reports |
| Canonical report files for Fuji suite | `not recorded` | — | Export from `/` right after scanning Fuji deployments |
| Hosted AvaGuard HTTPS URL | `not deployed` | — | Deploy Node server (`apps/web`) with `AVAGUARD_ENV=fuji` |
| Public repository / demo video / slides | `not recorded` | — | Fill cleanly before final UniHack submission |

## 7. Manual Core / Real-Wallet & Submission Checklists

### Core Extension / Real Fuji Wallet Smoke Checklist (Simulated in CI; Verify Manually on Live Fuji)

- [ ] Open the hosted `AVAGUARD_APP_ORIGIN` (`https://...`) in a browser with Core or MetaMask connected.
- [ ] Confirm header pill reads `Avalanche Fuji · 43113`.
- [ ] Switch wallet temporarily to Ethereum mainnet (`0x1`) -> click **Check wallet** -> verify AvaGuard fails closed and reveals **Switch wallet to 43113**.
- [ ] Click **Switch wallet to 43113** -> confirm Core/MetaMask switches (or prompts `wallet_addEthereumChain` for Fuji `https://api.avax-test.network/ext/bc/C/rpc` on `4902`) -> re-check wallet.
- [ ] Switch to an unauthorized account -> click **Check wallet** -> confirm AvaGuard reports unauthorized attester and keeps **Publish** disabled.
- [ ] Switch to authorized `ATTESTER_ADDRESS` -> **Check wallet** -> **Publish** a fresh scan -> verify tx hash on Snowscan/Snowtrace and inspect `/lookup` + canonical JSON import + **Replay original block**.

### Public Release Readiness Checklist

- [ ] Fuji deployment broadcast complete and all 6 contracts verified on Snowtrace/Snowscan.
- [ ] Canonical JSON bundles exported for all 4 demo contracts, committed/attached, and verified on `/lookup`.
- [ ] Live hosted Node server reachable over HTTPS with `AVAGUARD_ENV=fuji` and `AVAGUARD_APP_ORIGIN` set.
- [ ] GitHub repository made public with clean history (no `.env.local`, no keystores, no private keys) and demo video/slides linked.
