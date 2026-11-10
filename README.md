# AvaGuard ERC20 risk signals on Avalanche

M1 foundation workspace for Team1 Vietnam UniHack 2026. AvaGuard is the working title.
Status: M1 local web/schema/contract foundation verified on 2026-11-10. Scanner, registry, AI integration and deployment are deferred.

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
4. Review the M1 commands and limits below; M0/M1 have been executed.
5. Request a bounded M2 milestone separately when ready.

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
