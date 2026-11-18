# G2 Fuji deployment handoff — completed execution record

Completed 2026-11-16, Vietnam time, from source `c7bd311cfb8d0253dedec9719c2d50a542963792` on local branch `codex/m7-public-delivery`. The user explicitly authorized G2 and entered the keystore password locally in WSL. All seven transactions succeeded and strict full initial-state readback passed. [The deployment manifest](g2-deployment-2026-11-16.json) contains all six actual addresses and seven hashes; [the readback record](g2-initial-readback-2026-11-16.json) records block `61141800` and its hash. **Do not rerun the broadcast command for this suite.** Commands below are the execution reference, not a request to deploy again.

## 1. Completed G1 prerequisites and G2 result

The [G1 evidence record](README.md#funded-refresh--current-g1-readiness) preserves the pre-deployment snapshot: successful signer-free simulation, owner nonce `0`, attester nonce `1`, and no contract code then. G2 subsequently deployed the exact reviewed suite in blocks `61141670`–`61141671`; owner nonce is now `7` at the recorded post-receipt snapshot. Strict readback passed at block `61141800`. The balances below are historical G1 inputs, not the post-deployment owner balance.

| Public role | Address | Observed Fuji balance |
| --- | --- | --- |
| Owner / deployer | `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` | `0.1 AVAX` |
| Browser attester | `0xc6f32290379CA39273306e3758aB0a2b813ce3eB` | `0.39999999999664 AVAX` |
| Initial holder | Owner address above | Same account as owner |

Balances were rechecked at `2026-11-15T22:05:55.080Z` (05:05 on November 16 in Vietnam), not guaranteed for a later session. Initial holder uses the previously proposed owner default. The user confirmed the local signer-address check and performed the funding; the assistant independently checked public balances and ran only the simulation.

Prerequisites satisfied before the completed broadcast:

1. **Owner funding: complete.** The user transferred testnet funds; the public RPC confirms `0.1 AVAX` in the owner. No funding receipt hash was supplied, and no transfer was performed by the assistant. The attester retains approximately `0.4 AVAX` for later publications.
2. **Local signer address: user-confirmed.** The user reported that `cast wallet address --account fuji-deployer` matched the supplied owner. The assistant did not unlock the keystore. Section 2 remains a reference; do not repeat the address check unless the selected keystore changes.
3. **Funded state/simulation refresh: complete.** The estimate remains `4,858,094` gas; the owner balance exceeds the observed fee estimate. Recheck chain/nonce/balance/fees at execution time if delayed or state changes. No additional dry-run is needed merely because documentation changed.
4. **Execution source recorded.** [G2 source record](g2-source-2026-11-16.json) binds the selected `c7bd311` source and prior passing CI to all six local artifact hashes and both build-info files. Runtime source/config matches that revision; documentation is still uncommitted and preserved. Use an explicit file list for any later documentation commit; do not stage the whole contract workspace or ignored cache.
5. **G2 explicitly authorized.** The current user instruction permits the seven planned transactions and strict full readback. No repeated G2 approval is needed. Hosting, source upload, report publication, commit/push and submission remain outside this authorization.

## 2. User-operated terminal setup and signer check

Open Ubuntu from PowerShell:

```powershell
wsl -d Ubuntu
```

Run the remaining blocks inside Ubuntu. These settings apply only to this terminal session and contain public values. Clearing inherited signer/password variables ensures the intended local password prompt is used.

```bash
cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard
export PATH="$HOME/.foundry/bin:$PATH"
unset FOUNDRY_ACCOUNT FOUNDRY_KEYSTORE ETH_KEYSTORE ETH_KEYSTORE_ACCOUNT
unset ETH_PASSWORD CAST_PASSWORD ETH_PRIVATE_KEY PRIVATE_KEY MNEMONIC
export FUJI_RPC_URL='https://api.avax-test.network/ext/bc/C/rpc'
export OWNER_ADDRESS='0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1'
export ATTESTER_ADDRESS='0xc6f32290379CA39273306e3758aB0a2b813ce3eB'
export INITIAL_HOLDER="$OWNER_ADDRESS"
```

The following reference command decrypts the selected keystore locally to derive its public address; it does not send a transaction. During G2 recovery, the user entered the password privately in a dedicated WSL session, and the assistant observed only exit `0` and the matching public address. Repeat only if the selected keystore changes or a new unlock failure needs diagnosis.

```bash
cast wallet address --account fuji-deployer
```

Expected result: `0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1` (case-insensitive address equality). If it differs, stop and resolve which existing keystore owns the supplied address. Do not overwrite the account or use `--force`. Only the resulting public address/confirmation belongs in the handoff. Separately confirm the browser's selected Fuji account is the attester address above.

## 3. Historical pre-broadcast checks

The funded refresh passed before G2. The following reference commands are read-only; current owner nonce is now `7`, so the historical nonce-zero deployment precondition no longer applies. No new deployment is needed.

```bash
cast chain-id --rpc-url "$FUJI_RPC_URL"
cast balance "$OWNER_ADDRESS" --ether --rpc-url "$FUJI_RPC_URL"
cast balance "$ATTESTER_ADDRESS" --ether --rpc-url "$FUJI_RPC_URL"
cast nonce "$OWNER_ADDRESS" --rpc-url "$FUJI_RPC_URL"
cast gas-price --rpc-url "$FUJI_RPC_URL"
```

Expected chain ID is `43113`. The funded owner nonce was `0`; if it changes, inspect the intervening activity and review newly predicted addresses with the simulation below. Receiving funds does not itself spend the owner's nonce. Both existing G1 summaries reference preserved timestamped raw files; retain this practice before any repeat run updates Foundry's `run-latest.json`.

Fee arithmetic uses the current estimate, not a permanent spending limit. With `4,858,094` gas and `0.1 AVAX`, the arithmetic break-even fee is approximately `20.5842 gwei/gas`; `20.5 gwei/gas` would already consume `0.099590927 AVAX` under that estimate. Do not use that near-balance threshold as a target. If fees have materially changed, rerun the signer-free simulation and review the updated maximum-fee estimate and required amount before broadcasting. A current `cast gas-price` quote alone does not guarantee a later transaction's fee.

```bash
env -u FOUNDRY_ACCOUNT -u FOUNDRY_KEYSTORE \
  -u ETH_KEYSTORE -u ETH_KEYSTORE_ACCOUNT -u ETH_PASSWORD -u CAST_PASSWORD \
  -u ETH_PRIVATE_KEY -u PRIVATE_KEY -u MNEMONIC \
  bash scripts/fuji-deploy.sh \
  --rpc-url "$FUJI_RPC_URL" \
  --owner "$OWNER_ADDRESS" \
  --attester "$ATTESTER_ADDRESS" \
  --initial-holder "$INITIAL_HOLDER"
```

Require exit `0`, chain `43113`, the pinned registry runtime hash `0x4fae2a424c444bfdc1c89924898d33a63b25b30a5ece9ed3bb4c1fbe96397b38`, and this reviewed sequence:

| Order | Operation | Expected roles/arguments |
| --- | --- | --- |
| 1 | Create RiskRegistry | Owner = supplied owner |
| 2 | Call `setAttester(address,bool)` | Supplied attester, `true` |
| 3 | Create DemoBaselineToken | `AvaGuard Demo Baseline`, `AGBASE`, holder = owner, supply `1000000000000000000000000` |
| 4 | Create DemoMintPauseToken | `AvaGuard Demo MintPause`, `AGMP`, owner and holder = owner, same supply |
| 5 | Create DemoUpgradeableToken implementation | No constructor arguments |
| 6 | Create DemoTokenProxy | New implementation; initializer uses `AvaGuard Demo Upgradeable`, `AGUP`, owner and holder = owner, same supply |
| 7 | Create DecoyConstantToken | No constructor arguments |

All seven transactions originate from the owner and transfer `0` native AVAX as transaction value; the owner still pays gas. Simulation addresses are predictions only. Do not configure the app or fill the deployed-address ledger with them.

## 4. Executed broadcast command — do not repeat for this suite

This is the command used in the successful user-operated WSL session. The wrapper rebuilt with the pinned profile and checked chain/registry identity before broadcasting. It is retained for reproducibility; do not execute it again for this deployment.

```bash
env -u FOUNDRY_ACCOUNT -u FOUNDRY_KEYSTORE \
  -u ETH_KEYSTORE -u ETH_KEYSTORE_ACCOUNT -u ETH_PASSWORD -u CAST_PASSWORD \
  -u ETH_PRIVATE_KEY -u PRIVATE_KEY -u MNEMONIC \
  bash scripts/fuji-deploy.sh \
  --rpc-url "$FUJI_RPC_URL" \
  --owner "$OWNER_ADDRESS" \
  --attester "$ATTESTER_ADDRESS" \
  --initial-holder "$INITIAL_HOLDER" \
  --account fuji-deployer \
  --broadcast
```

Keep the owner idle for other transactions during this sequence. If any receipt is missing, the process is interrupted, or the RPC times out, inspect receipts and the current nonce before attempting recovery. Do not blindly rerun this deployment: it can create another suite. The wrapper does not expose a resume option; prepare any recovery separately from the original command.

## 5. Receipt capture and full initial-state readback

After successful broadcast, capture all seven real transaction hashes, receipt statuses and block numbers. Derive the six contract addresses from successful creation receipts and record them in [the deployment ledger](README.md#public-inputs-and-deployment-ledger). Preserve the exact source SHA, compiler settings, build-info and reviewed public transaction evidence. Ignore the separate Foundry cache containing sensitive values.

Set `REGISTRY_ADDRESS`, `BASELINE_TOKEN_ADDRESS`, `MINT_PAUSE_TOKEN_ADDRESS`, `UPGRADEABLE_IMPL_ADDRESS`, `UPGRADEABLE_PROXY_ADDRESS` and `DECOY_TOKEN_ADDRESS` to those six **actual receipt addresses** in the same terminal. They cannot be filled truthfully before broadcast. This read-only command requires all six variables and runs the full suite checks:

```bash
(
  set -e
  : "${REGISTRY_ADDRESS:?Set from successful RiskRegistry creation receipt}"
  : "${BASELINE_TOKEN_ADDRESS:?Set from successful DemoBaselineToken creation receipt}"
  : "${MINT_PAUSE_TOKEN_ADDRESS:?Set from successful DemoMintPauseToken creation receipt}"
  : "${UPGRADEABLE_IMPL_ADDRESS:?Set from successful DemoUpgradeableToken creation receipt}"
  : "${UPGRADEABLE_PROXY_ADDRESS:?Set from successful DemoTokenProxy creation receipt}"
  : "${DECOY_TOKEN_ADDRESS:?Set from successful DecoyConstantToken creation receipt}"
  bash scripts/fuji-deploy.sh \
    --rpc-url "$FUJI_RPC_URL" \
    --owner "$OWNER_ADDRESS" \
    --attester "$ATTESTER_ADDRESS" \
    --initial-holder "$INITIAL_HOLDER" \
    --registry "$REGISTRY_ADDRESS" \
    --baseline "$BASELINE_TOKEN_ADDRESS" \
    --mint-pause "$MINT_PAUSE_TOKEN_ADDRESS" \
    --upgradeable-impl "$UPGRADEABLE_IMPL_ADDRESS" \
    --upgradeable-proxy "$UPGRADEABLE_PROXY_ADDRESS" \
    --decoy "$DECOY_TOKEN_ADDRESS" \
    --readback
)
```

Require exit `0` and the exact success message `Full initial-deployment read-back PASSED at block <BLOCK> (<HASH>).` with the actual recorded block/hash. This checks registry runtime and roles, all demo bytecode, proxy implementation/owner, initial supplies/holder balances and unpaused state. Run it before any token transfers, mint, pause or upgrade. The shorter `Full read-back PASSED` prefix belongs to the relaxed `--allow-post-deploy-state` branch; it does not prove initial-state equality. Neither that mode nor `--readback-registry` satisfies this initial full-suite gate.

G2 is complete: seven successful receipts, six actual addresses and passing strict full readback are recorded in the linked evidence. Continue with G3 source verification and G4 hosting in [the execution plan](../../M7_EXECUTION_PLAN.md) when those actions are authorized. No canonical report, browser attester publication, Vercel deployment or explorer source-verification success is implied by G2 completion.
