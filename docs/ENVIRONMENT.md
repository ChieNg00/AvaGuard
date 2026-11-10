# M0 environment discovery

Observed 2026-11-06 (Asia/Ho_Chi_Minh). Discovery only; no application dependencies were installed and no application checks were run.

## Local observations

| Item | Actual result | Interpretation |
| --- | --- | --- |
| Workspace | AvaGuard; planning documents, historical probe script and saved JSON | No application manifests or lockfile yet |
| Git | 2.51.1.windows.1; repository root is this directory; HEAD `425a624` (`Create init folder`) | Existing repository; initial `git status --short` was empty |
| Node | v24.19.0; win32 x64 | Available in Windows |
| npm | 11.17.0 | Available; not selected for workspace installs |
| pnpm | 12.4.2 | Available in Windows; recommended workspace package-manager pin |
| Corepack | 0.35.0 | Available; no activation/update performed |
| Python | 3.12.12 | Existing standard-library probe can run; not an application dependency |
| Windows Solidity tools | forge, cast, anvil, solc not found by Get-Command | Not available on checked Windows PATH |
| WSL | Default Ubuntu, version 2; initially stopped | Confirmed by permitted read-only retry outside sandbox |
| Ubuntu | Ubuntu 26.04 LTS; Linux 6.6.114.1-microsoft-standard-WSL2 | Distribution can start |
| WSL Solidity tools | command -v found none of forge/cast/anvil/solc; explicit ~/.foundry/bin binaries missing | Foundry setup is an M1 contract-tooling blocker |
| WSL JavaScript tools | node not on checked login PATH; pnpm resolves to a Windows-mounted npm shim | Do not treat this as a verified Linux Node/pnpm installation |

The first WSL status/list calls returned Wsl/E_ACCESSDENIED in the sandbox. The external read-only retry succeeded: this was an environment permission issue, not proof WSL was absent. A first Bash loop lost variable arguments through Windows shell quoting and produced blank tool names; discard that tool result. Direct commands subsequently established the WSL observations above. Individual missing-binary errors were inspected even though the combined command ended with a successful OS-release read.

## Current primary documentation

Read 2026-11-06. These are documentation observations, not successful integration tests.

- [Avalanche Primary Network](https://build.avax.network/docs/primary-network): Fuji chain ID 43113 (0xa869), native AVAX, RPC https://api.avax-test.network/ext/bc/C/rpc and explorer https://explorer-test.avax.network/c-chain.
- [Avalanche compiler guidance](https://build.avax.network/docs/avalanche-l1s/add-utility/deploy-smart-contract) and [Foundry quickstart](https://build.avax.network/academy/blockchain/solidity-foundry/03-smart-contracts/03-foundry-quickstart): explicitly use evm_version = "cancun"; do not inherit a newer compiler default. This conservative documented target is the proposal, not an independent opcode-support probe.
- [Contract verification](https://build.avax.network/docs/tooling/contract-verification): retain Standard JSON/build-info and identical compiler, optimizer and EVM settings. Foundry supports custom/Sourcify verification. The displayed CLI example is mainnet; Fuji endpoint acceptance was not tested. Verification is deferred to separately authorized delivery, not scanner source verification.
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation): minimum Node 20.9, Windows/WSL supported; retrieved documentation displays 16.4.5. Installed Node exceeds this minimum. Use manual workspace scaffolding to preserve project instructions; lint via ESLint, not next lint.
- [pnpm installation](https://pnpm.io/installation): pnpm 12 supports Windows x64 and Node 24. Observed pnpm 12.4.2 is compatible at the documented platform/runtime level.
- [Wagmi getting started](https://wagmi.sh/react/getting-started): current docs include v3 migration and require viem 2.x plus TanStack React Query. Use explicit injected-only configuration. No React/wagmi peer-dependency resolution has run.
- [Viem installation](https://viem.sh/docs/installation): pin exact package versions; use stable viem 2.x, not RC documentation. Some direct Markdown pages could not be fetched by the browser tool; no unsupported claims are inferred from those failures.
- [Vitest guide](https://vitest.dev/guide/): retrieved current guide requires Node >=22.12 and Vite >=6.4; installed Node meets its minimum. Exact Vitest/Vite pair remains to be resolved.
- [Foundry official site](https://www.getfoundry.sh/): Forge, Cast and Anvil are the intended contract tools. Installation documentation retrieval failed with unsupported Markdown content-type; local absence is independently observed. No installer was executed.

## Historical RPC evidence reviewed

Inspected RPC_HISTORY_CHECK.md, scripts/probe_fuji_history.py and checks/fuji-history-2026-11-06.json. The saved chainId is 43113. All four stored samples (60627346, 60617346, 59627346, 10000000) have 3249-byte code, 32-byte totalSupply values, slot-zero data and hashMatches=true. Older supply values differ. This M0 reviewed existing evidence; it did not run a new live RPC probe or overwrite the file. SHA-256 of hex text in that probe is not the analyzer's bytecode keccak256.

No new target/snapshot was requested, so a repeat probe was unnecessary. Historical availability must still be checked for every replay; these samples are not an archive guarantee, scanner acceptance test or provider correctness proof.

## Smallest proposed M1

1. Keep Windows Node 24.19.0/pnpm 12.4.2 for web/analyzer and Ubuntu WSL for Foundry. Resolve Foundry installation/version before contract checks; do not silently switch to Hardhat or install tools during M0.
2. Before installing, query exact stable package versions, engines and peers. Candidate: Next 16.4.5, matching React/react-dom 19 releases, TypeScript 5.x, stable viem 2.x, wagmi 3.x, TanStack Query 5.x, Zod, Vitest/Vite, ESLint and Tailwind. Only Next's displayed patch and local runtime/package-manager versions were observed; other patch pins are deliberately unresolved. Record the final compatible set before installation, exact manifests and one root pnpm-lock.yaml. Delay wallet dependencies until used if the shell does not need them. Pin a stable Foundry release and Solidity compiler; configure Cancun and explicit optimizer settings for reproducible future dispatch fixtures. Do not choose a compiler patch from memory.
3. Create root private workspace config and apps/web, packages/analyzer, packages/contracts, fixtures only as needed. English scan/lookup shell, no fabricated live reports; versioned report schema skeleton and clearly synthetic fixture. Local contract skeleton only, no registry implementation or deployment.
4. Schema/UI design must include complete/inconclusive/not-analyzable, nullable score, snapshot B/hash, coverage/confidence, same-block reads/header recheck, typed transport versus execution errors and explicit archive-unavailable replay state. Implement evidence adapters and golden rules only in their later milestones. Preserve approved scores.
5. Add placeholder-only env example, ignore secrets/build outputs and use local fonts/assets so build does not require font downloads. AI provider/model stays undecided; no key required.

Proposed exact verification commands from the repository root, after M1 defines scripts (none executed in M0):

```powershell
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm --filter @avaguard/web build
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/ai-agent-security/AvaGuard/packages/contracts && forge fmt --check && forge build --build-info && forge test -vv'
```

Root scripts must fail rather than hide missing workspace checks. Analyzer smoke checks should exercise schema rejection (including inconclusive with numeric score) and UI-facing status mapping, not pretend the scanner works. Add one meaningful local Solidity smoke test if a test contract is scaffolded. Manually inspect scan/lookup shells and unavailable states. Full authorization/hashing/transport/stale-state suites belong to later implementation, not a claimed M1 result.

## Blocking items and limits

- Foundry is missing in the checked WSL locations. Installation/setup needs its own authorized follow-up; no alternative toolchain was installed.
- Exact package peer/engine resolution and Foundry/Solidity pins must be recorded before M1 installation. Documentation compatibility alone is not a passing build.
- Team capacity and AI provider/model do not block the credential-free M1 shell. No decision on either was invented.

M0 discovery is complete with these explicit setup blockers. M1 has not started.

## M1 observed update — 2026-11-10

The project is now at C:/Users/LENOVO/Documents/Codex/AvaGuard. Foundry 1.9.0 installed from the official foundry.paradigm.xyz/foundry-rs distribution with successful attestations. Forge/Cast/Anvil version output and compiler/test evidence are in PROGRESS.md. Node remains 24.19.0; pnpm remains 12.4.2. Solc 0.8.30 compiled the local fixture with Cancun/optimizer 200 settings. M0 absence statements above are historical observations.

Rechecked https://nextjs.org/docs/app/getting-started/installation (displays 16.4.6, Node >=20.9) and https://build.avax.network/docs/avalanche-l1s/add-utility/deploy-smart-contract (explicit Cancun). Official npm metadata established the exact installed dependency set and peer requirements. https://getfoundry.sh/introduction/installation/ still returned unsupported Markdown in the web tool; installation used the official https://foundry.paradigm.xyz bootstrap and attested foundry-rs releases, not an unofficial mirror. Versions and reproducible commands are in README.md/PROGRESS.md. No new historical-state probe was run.
