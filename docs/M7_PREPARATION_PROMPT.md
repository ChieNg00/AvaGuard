# M7 delivery preparation — review and next implementation prompt

Prepared 2026-11-14 from `main` at `76857b144122b5266eb3dac5ddadc844ff2fdf9c`. This document scopes the next request. No M7 application changes or public delivery were performed during preparation.

For the full agent execution handoff, use [M7_ANTIGRAVITY_PROMPT.md](M7_ANTIGRAVITY_PROMPT.md). This document retains the readiness findings and scope rationale.

## Reviewed starting point

- [M6 PR #7](https://github.com/ChieNg00/AvaGuard/pull/7) is merged. [CI run 43558473091](https://github.com/ChieNg00/AvaGuard/actions/runs/43558473091) passed `workspace-checks` and `contracts-and-integration` for final PR head `193391f07b2c62bf0d95e065dd01956abaaee5e5`. The merge commit has the same tree as that head.
- M2–M4 implement same-block evidence collection, ruleset 1, canonical hashing, historical replay and the authorized registry. M5 supplies the local scan/export/publish/lookup flow and receipt/import-race handling.
- M6 supplies immediate templates and optional mocked explanations. Prompt v2 accepts only finding/evidence/check selections; conclusions, score, coverage and report hash remain deterministic. There is no live Gemini adapter.
- Fresh checks on the merged checkout are recorded in [PROGRESS.md](PROGRESS.md). These are local acceptance results, not evidence of a real Core extension session or Fuji deployment.

## Delivery gaps found in the code

| Gap | Evidence | Required next outcome |
| --- | --- | --- |
| Publication is local-only | `apps/web/app/actions.ts::walletContext` requires local mode, loopback HTTP and an Anvil client. `apps/web/app/publish.tsx` separately requires a loopback browser hostname for publication and receipt recovery. | Explicit Fuji mode with preserved registry, network, snapshot, attester and receipt validation. Changing only an RPC URL or hosting the current build is insufficient. |
| Demo fixtures cannot reproduce their configured test state on Fuji as written | `GoldenFixtures.sol` uses empty capability methods and uninitialized owner/proxy storage. `scripts/local-demo.sh` and integration tests initialize state with Anvil methods. | Separate deployable demo contracts with constructor/initializer setup and real controlled behavior. Keep existing golden fixtures and scores unchanged. |
| AI provider is local mock only | `apps/web/lib/explain-server.ts` creates only a loopback provider; ambient Gemini credentials are ignored. | Ship the labeled template path by default. Treat a live provider adapter and credential validation as separately requested optional work. |
| Real wallet verification is unrecorded | Browser tests use a test-only injected EIP-1193 provider; M5_DEMO.md lists manual Core steps. | Record a real extension smoke result when explicitly authorized; do not infer it from Chromium test success. |
| Delivery assets and public evidence are absent from the tracked repository | There is only a local demo setup script; no recorded Fuji registry/fixture addresses, source-verification result, hosted app, slides or video. | Prepare the runbook and demo materials locally, then record real outputs after authorized execution. |

The historical Fuji samples are observations from November 6, not an archive guarantee. Each actual replay still needs its own original-block check. This review did not rescan a live target or audit all code for new defects.

## Prompt for the next implementation request

Execute **M7 delivery preparation only**. Deliver a locally tested implementation and deployment/submission runbook. Read `AGENTS.md`, `docs/DECISIONS.md`, `docs/SCANNER_SPEC.md`, `docs/ACCEPTANCE.md`, `docs/THREAT_MODEL.md` and the latest progress entry first. Use English for code, UI and documentation; report to the maintainer in Vietnamese. Do not start subagents.

### 1. Establish the base

- Inspect `git status --short --branch` and the current HEAD; preserve unrelated edits. Confirm that M6 and its review fixes are present. Reuse the existing checkout unless it is unsuitable.
- Record the actual starting SHA and a short plan in PROGRESS.md when implementation starts. Keep the current package manager, lockfile, compiler and EVM settings unless a concrete compatibility issue requires a reviewed change.
- Check current official Avalanche, Foundry and hosting documentation for the integration details actually used. Record links, dates and exact commands; do not assume older verification endpoints or hosting limits are still valid.

### 2. Make publication ready for Fuji

- Introduce explicit local/Fuji configuration. Keep local Anvil checks for local mode. Fuji mode must use server-controlled RPC/registry configuration, chain ID 43113 and the expected registry runtime; do not accept arbitrary client-supplied endpoints or registry addresses.
- Adapt both server and browser loopback gates, environment labels and receipt-recovery messages. A missing or invalid configuration must disable publication with a clear explanation.
- Preserve browser-only signing, live attester authorization, simulation, snapshot/hash agreement between reader and wallet, registry code checks, wallet/report revision guards, submitted-hash retention, replacement validation and read-only receipt recovery. A matching chain ID alone cannot distinguish the local test node from Fuji.
- Keep scanning wallet-free. Server code must never sign/send transactions or receive a private key. Keep the report schema, approved scores and canonical vector unchanged.
- Derive or verify the registry ABI/runtime hash from the pinned build; document the check needed before using a real deployment. Avoid adding wallet frameworks solely for this task.

### 3. Prepare deployable owned examples

- Preserve `GoldenFixtures.sol` and the approved golden controls. Add separate demo contracts for the acceptance flow: a standard ERC-20 baseline, controlled minting, pause or fee capability, and one supported ERC-1967 proxy. Retain a misleading-selector negative control for the demonstration.
- Use explicit constructor/initializer inputs for owner, supply and proxy dependencies. Do not depend on `anvil_setCode` or `anvil_setStorageAt` in the public deployment path, and do not describe selector stubs as functioning token controls.
- Test actual initialization, intended authorization and token/proxy behavior locally. Collect reports from the deployed local demo contracts, verify their evidence and explain any observed score differences without weakening the existing golden expectations.
- Prepare user-run keystore deployment and owner-managed attester authorization commands. Use public addresses as parameters; passwords are entered locally. Keep publication itself in the injected browser wallet.

### 4. Prepare the delivery runbook and demo package

- Provide local dry-run instructions, Fuji chain/configuration preflight, faucet steps, encrypted keystore usage, deployment order, public-address parameters, source-verification commands and read-back checks. Separate read-only commands from commands that broadcast.
- Preserve build-info and exact Solidity 0.8.30/Cancun/optimizer-200 settings for reproducible verification. Source verification of our registry is a delivery task; scanned-token source verification remains outside the analyzer's MVP scope.
- Document the existing Next.js server runtime requirements, build/start commands and server environment configuration. Prepare hosting without creating an account or publishing a site. The no-key template path must work; in-memory explanation projections are not durable report storage.
- Prepare a judges' quickstart and a 2–3 minute demo script: wallet-free scan, evidence/coverage/confidence, labeled explanation, export, authorized publication, lookup/import and original-block replay; include a negative control or denied unauthorized publisher. Keep commitment matching distinct from replay matching.
- Include a report JSON retrieval plan and an address/link table whose unknown values are explicitly `not deployed` or `not recorded`. Never use the synthetic canonical fixture or ephemeral Anvil addresses as Fuji evidence. Record latency only after measurement.
- Carry forward the manual Core extension smoke checklist and public-link accessibility checks. Slides/video publication and real network outcomes remain pending until they are actually produced.

### 5. Verify before handoff

Add focused regressions for the new boundaries: local/Fuji mode isolation, invalid RPC/network/registry configuration, hosted-origin publication, same-chain-ID snapshot mismatch, unauthorized or revoked attester, stale wallet state and receipt recovery. Exercise the Fuji configuration path through controlled local test infrastructure; do not send public transactions as a test.

Run the checks supported by the repository. On Windows, use PowerShell for pnpm and Ubuntu WSL for Foundry:

```powershell
pnpm typecheck
pnpm lint
pnpm test
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && ~/.foundry/bin/forge fmt --check && ~/.foundry/bin/forge build --build-info && ~/.foundry/bin/forge test -vv'
pnpm test:integration
pnpm build
pnpm test:browser
git diff --check
```

Install dependencies with the frozen lockfile only if needed. Build contract artifacts before integration checks; build the web app before browser checks. Run integration and browser suites sequentially because they share the ephemeral Anvil port. Report skipped/filtered tests distinctly from the full suite. The current browser runner filters to one integration case that launches the full browser flow.

The handoff must identify changed files, actual commands/results, unresolved manual checks, the prepared deployment steps and the exact external actions still awaiting authorization. Do not mark M7 delivery complete after local checks alone.

### 6. Stop at the preparation boundary

Leave a reviewable local diff. Do not push, merge, create credentials/accounts, import wallets, call a live AI provider, use a paid service, broadcast to Fuji, publish contract source or publish the app. Local automated tests may use their existing isolated Anvil harness. Public deployment, real-wallet actions and hosting require a subsequent explicit instruction under the project's approval rules.

## Subsequent decisions

After preparation passes review, confirm the public deployer/admin and attester addresses and intended hosting target. Execute the approved Fuji deployment/source verification and browser publication, record actual addresses/hashes, replay at the original block and verify judge access to report files and links. A live Gemini path can be added separately if desired; it must preserve the M6 evidence-bound output contract and deterministic fallback.

Keep the existing November 18 feature-freeze target and November 21 submission target from PLAN.md in view; these are planning targets, not evidence that delivery is ready.
