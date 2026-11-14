# AvaGuard ERC20 risk signals on Avalanche

ERC-20 risk-signal workspace for Team1 Vietnam UniHack 2026. The local M5/M6 flow supports scanning, evidence-bound explanations, canonical report export, attester publication, lookup and independent replay. See [the local demo](docs/M5_DEMO.md) for startup commands and wallet setup.

## Current status — 2026-11-14

- M0–M6 have recorded local verification. [M6 PR #7](https://github.com/ChieNg00/AvaGuard/pull/7) merged into `main` at `76857b1`; both CI jobs passed for final PR head `193391f`. See [PROGRESS.md](docs/PROGRESS.md) for the fresh merged-checkout checks and their limits.
- Explanations work without a key. Optional AI behavior has been tested with local mocks only; no live Gemini adapter is implemented. Prompt v2 lets the model select validated evidence/check IDs and ordering; displayed conclusions remain deterministic.
- Publication and receipt recovery previously required the local Anvil/loopback environment; M7 preparation now adds explicit `local` and `fuji` server/client configuration modes (`AVAGUARD_ENV`), reproducible `RiskRegistry` artifact identity checks (`scripts/verify-registry-identity.mjs`), deployable Fuji demo contracts (`packages/contracts/src/DemoTokens.sol` + `script/DeployDemo.s.sol`), user-run deployment/verification scripts (`scripts/fuji-deploy.sh`), and delivery/demo docs ([M7 delivery runbook](docs/M7_DELIVERY.md), [demo script](docs/DEMO_SCRIPT.md)).
- Live Fuji broadcast, explorer source verification, real browser wallet smoke checks, public hosting, and submission recording remain user-executed after M7 preparation; see [M7 delivery runbook](docs/M7_DELIVERY.md) and [M7 execution guide](docs/M7_ANTIGRAVITY_PROMPT.md).

The M1/M2 sections below retain historical observations; use the current status, progress log and local demo for the implemented flow.

## Confirmed scope

- Two-person team; approximately three hours or more of availability per day. Whether that is per person remains to be clarified before assigning capacity.
- Scan ERC-20 contract addresses on Avalanche Fuji C-Chain only.
- Deterministic checks produce evidence and findings. AI explains them and cannot alter findings or scores.
- Only authorized attesters may publish report commitments to a registry.
- English interface first; a usable template report remains available when AI is disabled or fails.
- Prioritize stability and verifiable results. Transaction simulation, mainnet scanning and autonomous investigation are outside the first MVP.
- Submission deadline: 2026-11-21 23:59 Asia/Ho_Chi_Minh. Final Demo Day: 2026-11-30.

## Start here

1. Read `docs/PRODUCT_SPEC.md`, `docs/SCANNER_SPEC.md` and `docs/DECISIONS.md` together.
2. Read `docs/THREAT_MODEL.md` and `docs/ACCEPTANCE.md` before implementation.
3. Open this folder as the working project in Codex or Antigravity.
4. Review the current status and latest entries in `docs/PROGRESS.md`.
5. Follow the local M5/M6 demo above, or use `docs/M7_PREPARATION_PROMPT.md` to scope the next implementation request.

Codex recognizes AGENTS.md as project guidance. For Antigravity, explicitly ask it to read the file; automatic discovery has not been verified. INIT_PROMPT.md is ordinary portable project text, not a claim about an IDE-specific configuration format.

## Files

- `AGENTS.md`: durable working instructions.
- `INIT_PROMPT.md`: English prompt for discovery and initial scaffold only.
- `docs/PRODUCT_SPEC.md`: behavior, architecture and proposed data contract.
- `docs/SCANNER_SPEC.md`: v2 snapshot, dispatcher/proxy rules, scoring, coverage and canonical hash specification.
- `docs/DECISIONS.md`: confirmed choices, recommendations and open questions.
- `docs/THREAT_MODEL.md`: trust boundaries and failure behavior.
- `docs/ACCEPTANCE.md`: observable acceptance cases and demo requirements.
- `docs/PLAN.md`: milestones and a tentative two-person schedule.
- `docs/SOURCES.md`: source provenance and facts requiring revalidation.
- `docs/PHASE_PROMPTS.md`: bounded implementation prompts after discovery/foundation.
- `docs/RPC_HISTORY_CHECK.md`: actual read-only RPC observations and their limits.

The separate read-only infrastructure probe remains scripts/probe_fuji_history.py; historical results are in docs/checks/. See verified M1 commands below.

## M1 foundation — verified 2026-11-10

The current checkout is `C:/Users/LENOVO/Documents/Codex/AvaGuard` (the earlier `ai-agent-security/AvaGuard` path no longer exists).

- `apps/web`: English Scan and Lookup shells. Address format validation is local only. No chain reads or invented reports; replay and fresh-scan actions are separate, visibly planned.
- `packages/analyzer`: strict versioned result-envelope schema and 22 boundary tests. See `docs/M1_SCHEMA.md` for its intentional incompleteness. This is not a canonical/hash/publication implementation.
- `packages/contracts`: Foundry local read-probe fixture and two tests, including 256 fuzz runs. No registry or deployment script.
- `fixtures`: explicitly synthetic unavailable-state JSON used by schema tests.

Use Windows Node **24.19.0** and pnpm **12.4.2** for JavaScript. Foundry **1.9.0** is installed in Ubuntu WSL2 at `~/.foundry/bin`; no shell-profile modification was needed. Solidity is pinned to **0.8.30**, EVM **cancun**, optimizer enabled with **200** runs.

From the repository root in PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Open [Scan](http://localhost:3000/) and [Lookup](http://localhost:3000/lookup) while the local server is running. No environment variables, wallet or API key are needed for M1. The optional `.env.example` contains an unused placeholder; do not configure it for the shell.

Contract checks from PowerShell at the current checkout location:

```powershell
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && ~/.foundry/bin/forge fmt --check && ~/.foundry/bin/forge build --build-info && ~/.foundry/bin/forge test -vv'
```

For a different checkout path, adjust only the `cd` directory. On a new machine, install Foundry from the [official installer](https://getfoundry.sh/introduction/installation/) and select `foundryup --install v1.9.0`. The first build downloads pinned solc if missing. Web and contracts build locally; Foundry tests make no network transactions.

The initial lockfile was generated with `pnpm install --lockfile-only` before the successful frozen install. Keep one root `pnpm-lock.yaml`. Exact direct dependencies are pinned in manifests. Wallet/viem, Tailwind, OpenZeppelin and AI dependencies are deferred until needed; basic CSS and dependency-free Solidity tests keep M1 small.

Verified: frozen install, typecheck, warning-free lint after configuration repair, 22 schema tests, production build, Foundry format/build/tests, and HTTP 200 plus SSR limitation-text checks for both routes. Browser interaction/visual QA was not executed; opening the preview tab returned queued. See `docs/PROGRESS.md` for command evidence and remaining scope. Stop at M1; M2 requires a separate request.

## M2 evidence collection — 2026-11-12

The analyzer now provides a bounded same-block read adapter and evidence schema. Results are unscored and always not publishable. See docs/M2_EVIDENCE.md for API/configuration, error handling, proxy gaps and reproducible checks.

New required check: `pnpm test:integration` starts account-free Anvil in Ubuntu WSL2, loads the existing fixture runtime without deploying or sending transactions, tests collection and exact replay, then shuts down its own node. Run the contract build command above first to generate the fixture artifact. Port 18545 must be free. No RPC or AI credentials are needed.

M2 adds pinned viem 2.57.18 for ABI/keccak utilities. The root lockfile was updated before frozen installation. Current checks: 77 unit/mock/schema tests, 2 local Anvil integration tests, existing 2 Forge tests (including 256 fuzz cases), typecheck/lint/build. The UI still validates address input only; full scan/lookup/replay remains unavailable. M1 observations above are historical and do not imply those features were added.

No new live Fuji scans, golden score changes, registry, AI or deployment. M3 is a separate milestone.
