# M7 wallet setup for a first-time operator

Prepared 2026-11-15 after the user confirmed no wallets existed then. These are user-operated setup instructions. Update on November 16: the user reported both wallets set up and supplied public addresses; the assistant checked public account state and ran a signer-free simulation. The existing local keystore was not decrypted or unlocked. Continue with [the G2 handoff](releases/m7-fuji/G2_HANDOFF.md); do not recreate or overwrite existing wallets. See [the evidence record](releases/m7-fuji/README.md) for observed results.

## Roles and recommended setup

| Role | Recommended location | Purpose |
| --- | --- | --- |
| Owner / deployer | Encrypted Foundry keystore `fuji-deployer` in Ubuntu WSL | Deploy suite; own registry and controlled demo tokens |
| Attester | Separate new MetaMask wallet in Chrome | Sign report publications from AvaGuard |
| Initial holder | Owner public address, unless another recipient is chosen | Receive demo token initial supply |

The owner and attester must be different addresses. The setup steps below apply when those wallets do not already exist. G1 needs their public `0x...` addresses; it does not need their secrets, a hosting account or a source-verifier decision. Actual deployment and publication remain separate later actions.

## 1. Create the browser attester

1. Follow the [official MetaMask installation guide](https://support.metamask.io/start/getting-started-with-metamask/) to install the browser extension in Chrome. Use the official site's store link.
2. Create a new wallet using the extension's own onboarding. If using a recovery phrase, record it privately offline and complete the extension's backup check. Set the local unlock password yourself. Do not share the phrase/password, paste it into this chat, or include it in screenshots.
3. Label the account `AvaGuard Fuji Attester` locally. Keep this as a separate wallet from the Foundry owner; no owner-key import is needed.
4. Copy its **EVM account address** beginning with `0x` and containing 40 hexadecimal characters. This is `ATTESTER_ADDRESS`; a Solana/Bitcoin address is not suitable.
5. Add/select Fuji using the parameters below. Keep one wallet provider active in the browser profile used for the demo.

MetaMask's [provider documentation](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/) explicitly documents `window.ethereum`, which is what `apps/web/app/publish.tsx` currently reads. This is the reason for the recommendation, not a claim of a completed live-wallet test. Core remains another possible wallet, but its current [official connection guide](https://docs.core.app/docs/connect-your-dapp/core-extension/) documents `window.avalanche`/EIP-6963; Core detection in the existing app must be checked before promising that path works. No wallet adapter change is part of this setup guide.

## 2. Configure Avalanche Fuji

The [official Avalanche network guide](https://support.avax.network/en/articles/6224787-how-to-connect-to-the-fuji-testnet) provides these C-Chain testnet parameters:

| Setting | Value |
| --- | --- |
| Network name | `Avalanche Fuji C-Chain` |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain ID | `43113` |
| Currency symbol | `AVAX` |

If an explorer field is optional, it can be left unset during initial wallet setup; use the actual Fuji explorer selected in G3 later. Network selection does not create an on-chain transaction. Wallet connection/signing through AvaGuard will be tested at G5.

## 3. Create the separate owner keystore locally

Run these commands yourself in a visible terminal so you control the hidden password prompt. Do not run them in an agent's unattended execution or share terminal screenshots containing recovery information.

From PowerShell, enter Ubuntu:

```powershell
wsl -d Ubuntu
```

Then, in the Ubuntu shell, create the named encrypted keystore. The guard preserves any existing file with this name:

```bash
if [ -e "$HOME/.foundry/keystores/fuji-deployer" ]; then
  printf '%s\n' 'fuji-deployer already exists. Stop and inspect locally; do not overwrite it.'
else
  mkdir -p "$HOME/.foundry/keystores"
  env -u CAST_PASSWORD "$HOME/.foundry/bin/cast" wallet new \
    "$HOME/.foundry/keystores" fuji-deployer
fi
```

Choose a strong password at the local hidden prompt and retain it privately. Keep a private backup of the encrypted keystore and the means to unlock it outside the repository. Do not add `--unsafe-password`, `--force`, or a raw private-key argument. Do not run bare `cast wallet new` without a path/name: installed Cast help says that form prints a private key.

After successfully creating your intended keystore, obtain its public address locally:

```bash
env -u ETH_PASSWORD "$HOME/.foundry/bin/cast" wallet address --account fuji-deployer
```

Enter the keystore password only in the local prompt if requested. The resulting `0x...` address is `OWNER_ADDRESS`. Confirm it differs from the browser attester. Neither command above broadcasts a transaction. Both are prepared instructions; neither was executed by the assistant.

Installed `cast 1.9.0` help was checked for `wallet new` and `wallet address`: explicit directory/name writes an encrypted keystore with a hidden password prompt; `--account` selects the file in the default keystore directory. If an existing file or unfamiliar prompt appears, stop and describe only the non-secret error text.

## 4. Testnet funds and G1 handoff

Public addresses can be supplied before funding. Use the [official Fuji faucet](https://build.avax.network/console/primary-network/faucet) for testnet AVAX on C-Chain. The older `faucet.avax.network` and Core faucet URLs redirected there during this documentation check.

Fund both owner (deployment gas) and attester (publication gas) using the faucet's current flow. Its login, eligibility and quota are not established by loading the page. If it cannot fund the owner directly, report that limitation before any separate wallet transfer. No purchase of real AVAX is required by this plan, and no faucet request was made by the assistant.

Send only this public input form after the two wallets exist:

```text
OWNER_ADDRESS=0x...
ATTESTER_ADDRESS=0x...
INITIAL_HOLDER=OWNER_ADDRESS
```

The final line means “use the same actual address as OWNER_ADDRESS.” Before running commands, resolve it to that actual `0x...` value; do not pass the literal text `OWNER_ADDRESS` as an address. These `0x...` examples are placeholders, not valid command inputs.

Next, the assistant can validate the public inputs, read balances and run the G1 deployment simulation without any signer. If the simulation is balance-gated, complete faucet funding first. Hosting/operator selection belongs to G4 and verifier selection to G3; neither should block this preparation. See [the execution plan](M7_EXECUTION_PLAN.md) and [current evidence record](releases/m7-fuji/README.md).
