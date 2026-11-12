# Local M5 demo

Use Node 24, pnpm 12.4.2 and Foundry 1.9.0. Run shell examples from the repository root. On Windows run Foundry commands in Ubuntu WSL and pnpm in PowerShell. Use Python 3 for setup.

1. Install dependencies with `pnpm install --frozen-lockfile`. In terminal A run the persistent demo node (integration tests use a separate ephemeral node on 18545).

   ```sh
   export PATH="$HOME/.foundry/bin:$PATH"
   anvil --host 127.0.0.1 --port 8545 --chain-id 43113 --hardfork cancun --accounts 0 --silent
   ```

2. Use a disposable browser account and a different encrypted local Foundry deployer keystore. To create a deployer locally use `cast wallet new ~/.foundry/keystores avaguard-local` and enter the password at the terminal. Record the public deployer address. In terminal B run the following with the two public addresses. The script funds both on the demo node, deploys the registry and fixture, initializes the fixture owner and authorizes the browser account. Foundry prompts for the keystore password.

   ```sh
   export PATH="$HOME/.foundry/bin:$PATH"
   bash scripts/local-demo.sh <browser-public-address> <deployer-public-address> ~/.foundry/keystores/avaguard-local
   ```

3. Copy `.env.example` to `apps/web/.env.local`. Set `REGISTRY_ADDRESS` to the value printed by setup. Keep the RPC on loopback. Start the server and open http://127.0.0.1:3000.

   ```sh
   pnpm --filter @avaguard/web dev --hostname 127.0.0.1
   ```

4. Scan the printed fixture address with the wallet disconnected. Expect **35 / 100 · Some signals**, mint dispatch evidence and a nonzero owner without code. Export canonical JSON.
5. In Core select the disposable account and a custom network with RPC `http://127.0.0.1:8545`, chain ID `43113`, currency `AVAX`. Check the endpoint in the wallet. If the wallet routes this ID to Fuji, the local snapshot check must fail. Select **Check wallet**, then **Publish**, approve the transaction and wait for its confirmed hash.
6. In a clean browser profile open Lookup. Paste the fixture address, select **Find latest**, then import the exported file. Check commitment agreement, replay the original block and scan current state. History index 0 is the first publication. Stop the node and web server using Ctrl+C. A new demo node requires new setup and configuration.

## Automated reproduction

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
(cd packages/contracts && forge fmt --check && forge build --build-info && forge test -vv)
pnpm test:integration
pnpm build
# On Windows omit --with-deps
pnpm --filter @avaguard/web exec playwright-core install --with-deps chromium
pnpm test:browser
```

The browser check starts the built web app on loopback port 31845 and uses the integration runner's account-free Anvil. A test-only injected EIP-1193 provider sends from an impersonated disposable test account. A test RPC wrapper can simulate unavailable historical state. Real Core extension approval and network selection require the manual steps above. Read-only pages also work with a server-configured Fuji RPC. Local publication requires the server and wallet to agree on the snapshot and registry.
