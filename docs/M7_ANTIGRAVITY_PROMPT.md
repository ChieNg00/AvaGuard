# Antigravity execution prompt for AvaGuard M7 preparation

Open `C:/Users/LENOVO/Documents/Codex/AvaGuard` and execute **M7 delivery preparation**. Implement the missing local code, tests and deployment documentation needed to prepare the existing MVP for a later authorized Fuji demo. Start with a short actionable plan, then carry it through to a verified local handoff. Do not stop after proposing a plan.

Use English for code, product UI and project documentation. Give progress updates and the final maintainer report in Vietnamese. Work in this repository, preserve unrelated edits and do not start parallel coding agents or subagents.

This task ends with a reviewable local diff and tested preparation. It does not authorize public deployment, wallet import, real-wallet transactions, source publication, hosting publication, account creation, paid services or live AI calls. Existing isolated local test transactions are allowed. Finish the work within that scope before reporting the external steps that remain.

## 1. Read the project and establish the actual base

Read these files explicitly; do not assume Antigravity automatically loads AGENTS.md:

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/SCANNER_SPEC.md` — normative scanner, hash, replay and AI behavior
- `docs/ACCEPTANCE.md` and `docs/THREAT_MODEL.md`
- `docs/PRODUCT_SPEC.md`, `docs/PLAN.md` and the latest entries in `docs/PROGRESS.md`
- `docs/M7_PREPARATION_PROMPT.md` — the readiness review behind this task
- `docs/M5_DEMO.md`, `packages/contracts/README.md` and `.github/workflows/ci.yml`

Historical M0/M1/M2 sections describe earlier states. Use the latest recorded implementation and inspect the code. `INIT_PROMPT.md` and the old M6 execution/fix prompts are historical context, not additional milestones to execute.

Run from the repository root:

```powershell
git status --short --branch
git log -1 --oneline --decorate
git merge-base --is-ancestor 76857b144122b5266eb3dac5ddadc844ff2fdf9c HEAD
```

At preparation time, `main` was `76857b1`, the merge of [M6 PR #7](https://github.com/ChieNg00/AvaGuard/pull/7). [CI run 43558473091](https://github.com/ChieNg00/AvaGuard/actions/runs/43558473091) passed both jobs for final PR head `193391f`; the merge has the same tree. The November 14 local review passed 136 unit tests, 16 Solidity tests, all 13 integration tests, browser acceptance, typecheck, lint and production build. These are previous observations, not results for your new changes.

The workspace contains uncommitted review/prompt edits in README and docs. Inspect and preserve them, including untracked documents. Do not use reset, clean, forced checkout or stash/drop operations to discard the handoff. Reuse an appropriate checkout; a local `codex/m7-delivery-preparation` branch is suitable if a branch is needed. Do not reset a newer valid base to the recorded SHA. If the ancestry check fails, investigate the history before editing.

Record the actual starting SHA, existing edits and your implementation plan in PROGRESS.md. Inspect the manifests and tool versions. Current pins include Node 24, pnpm 12.4.2, Next 16.4.6, viem 2.57.18, Foundry 1.9.0, Solidity 0.8.30, Cancun, optimizer 200 and OpenZeppelin Contracts 5.4.0. Keep the one root lockfile. Do not perform routine dependency upgrades or introduce a replacement framework.

## 2. Trace the existing boundaries before changing them

Inspect these paths and their tests:

| Area | Existing paths and behavior to understand |
| --- | --- |
| Server reads/publication context | `apps/web/app/actions.ts`: `scan`, `walletContext`, `lookup`, `replay`; `walletContext` currently requires local mode, loopback HTTP and an Anvil client. |
| Browser publication | `apps/web/app/publish.tsx`: loopback hostname guards in both submission and receipt recovery; injected wallet, account/network/report revisions, live attester checks and simulation. |
| Receipt validation | `apps/web/lib/receipt.ts`: original submission binding, expected transaction hashes, matching events, verified nonce/replacement evidence, bounded recovery and network changes. |
| Registry identity/payload | `apps/web/lib/registry-abi.ts`, `apps/web/lib/publication.ts`, `packages/contracts/src/RiskRegistry.sol`. |
| Display and import | `apps/web/app/layout.tsx`, `report.tsx`, `inspection.tsx`, `shared.tsx`: environment labels, template explanations, canonical import, replay and current-state diff. |
| Explanation | `packages/analyzer/src/explain.ts`, `apps/web/lib/explain-server.ts`, `apps/web/app/api/explain/route.ts`: prompt v2, bounded input/output, local mock provider and immediate template. |
| Demo/test setup | `packages/contracts/src/GoldenFixtures.sol`, `scripts/local-demo.sh`, `packages/analyzer/test/anvil.integration.test.ts`, `apps/web/test/browser.mjs`, `scripts/browser-check.mjs`. |

The current gaps are specific:

1. Changing `FUJI_RPC_URL` or deploying the current web build does not enable Fuji publication; both server and browser enforce local-only behavior.
2. Golden fixtures contain capability stubs and owner/proxy state populated through Anvil methods. They are deterministic scoring controls, not deployable equivalents of the intended functioning token demo.
3. The explanation provider is a local mock only. Real Core extension use, Fuji deployments, source verification and a hosted app have no recorded verification.

Resolve the first two gaps and prepare the delivery artifacts below. Preserve the third as an honest limitation; do not add a live AI integration to this task.

## 3. Implement explicit local and Fuji publication modes

Keep the smallest design that fits the existing application. A small shared configuration/context type is preferable to scattered environment checks; do not add a service layer or wallet framework without a concrete need.

### Configuration and identity

- Keep `AVAGUARD_ENV=local` and its loopback/Anvil protections. Add an explicit Fuji mode, such as `AVAGUARD_ENV=fuji`, with documented server-controlled RPC and registry configuration. Never infer the mode solely from chain ID; local Anvil also uses 43113.
- Validate configuration. Missing/invalid mode, registry or publication configuration must fail closed for publication with a clear UI message. Where the read RPC is valid, scanning must remain usable without a configured registry, wallet or AI key.
- Fuji publication must work from an intended hosted origin. Adapt the existing loopback guards deliberately, including the receipt-recovery path. Keep local-mode origin restrictions; do not simply remove all guards or add a general insecure bypass.
- Use the expected chain ID 43113, known configured registry, verified registry runtime and original snapshot hash. Keep RPC URLs and any provider credentials server-only; expose only public configuration needed by the browser. A request must not supply an arbitrary reader URL or registry address.
- Compare the checked-in ABI/runtime identity against the pinned contract build and make that agreement reproducibly verifiable. Do not accept any deployed code merely because it answers the expected methods. Do not weaken identity checking to make a fixture pass.
- Preserve bounded RPC reads and explicit unavailable states. A failed network read must not be interpreted as lack of permission, empty code or successful validation.

### Wallet and receipt behavior

- Use the existing injected browser provider. Scan stays wallet-free. The server must never accept wallet secrets, sign, send a transaction or expose a signing endpoint.
- Preserve the live attester check, publication simulation, wallet/reader registry and snapshot agreement, and account/network/report checks immediately before signing. Unauthorized/revoked attesters must not produce a confirmed publication state.
- Preserve the submitted hash and original attester, registry, report and snapshot after submission. Account or network changes must not lose the transaction or trigger automatic resubmission. Receipt recovery remains read-only and bound to that original context.
- Retain strict requested-hash/receipt-hash checks, matching registry events, verified sender/nonce replacement handling, mid-read `A -> B -> A` network-change detection and the distinction between genuine pending and unavailable history. Do not restore speculative pending-nonce inference.
- Make environment labels and recovery guidance accurate for both modes. Keep local tests useful; do not relabel an Anvil success as a Fuji result.
- Any network-switch UI must use an explicit user action. Choose the smallest user flow; do not add automatic switching or wallet dependencies just to complete this milestone.

## 4. Add deployable owned demo contracts

Keep existing golden fixtures, expected scores and negative controls unchanged. Add separate, clearly named demo contracts in the existing contracts package.

The demo set must cover the existing acceptance scope:

- A functioning ordinary ERC-20 baseline, with standard transfer/approval behavior.
- A token with controlled minting.
- A token with a real pause or fee capability. Prefer the simpler option; do not implement both merely for breadth. This example may share a contract with the minting example if the demo clearly explains the resulting signals.
- One supported ERC-1967 upgradeable example with explicit initialization and authorized upgrade control.
- A misleading-selector negative control; reuse an appropriate existing control when that suffices and label it accurately.

Requirements:

- Use explicit constructor/initializer inputs for owner, initial supply and proxy dependencies. Proxy state must be initialized through the proxy; an implementation constructor does not initialize proxy storage.
- Protect initialization and administrative operations. Test initialization only once, correct owner/supply/proxy state, intended token behavior and rejected unauthorized mint/pause/upgrade actions where applicable. Do not claim the scanner proves these authorization properties; they are tests of our owned demo contracts.
- Reuse pinned OpenZeppelin primitives where appropriate. If another dependency is necessary, justify it, check official compatibility, pin it and preserve the one-lockfile workspace. Do not create a broader token/proxy framework.
- Exercise real deployment and initialization on the isolated local test node. The demo deployment path must not rely on `anvil_setCode`, `anvil_setStorageAt`, impersonation or privileged development RPCs. The test harness may continue using its existing isolated impersonation to submit local test transactions; this must not leak into public scripts.
- Collect analyzer reports from the deployed demo examples and verify actual findings, evidence links, coverage, snapshot/hash and replay. State-dependent behavior must come from observed on-chain local state. Record the observed scores using the unchanged rules; do not edit a locked golden score or promise a score before testing the compiled contract.
- Preserve compiler settings/build-info and avoid changing RiskRegistry's ABI or report semantics unless a concrete blocker is demonstrated.

## 5. Prepare user-run deployment and hosting artifacts

Read current official Avalanche and Foundry documentation for the exact commands and verification service selected. Use current official hosting documentation for any host-specific configuration. Record URLs and access dates in the runbook or SOURCES.md. Documentation availability is not proof that a deployment or verification succeeded.

### Deployment preparation

Provide a reproducible deployment script or small command sequence plus a runbook. Do not leave unexplained pseudocode for deployment ordering or initialization.

- Default to local dry-run/simulation. Broadcasting must be a separate explicit action, with no accidental broadcast from a documented dry-run command. Validate the inputs required by each operation; missing required keystore, owner, attester or RPC inputs must fail clearly rather than silently substitute a development credential or address. A simulation that does not sign should not require a real keystore.
- Cover Fuji network preflight, faucet steps, separate public deployer/admin and browser-attester addresses, encrypted Foundry keystore usage, registry and demo deployment order, initializer/constructor arguments and owner-run `setAttester` authorization.
- Never write or request raw private keys, seed phrases or passwords in chat, env files, logs or committed scripts. The user enters keystore credentials locally. Prepare keystore creation/import instructions without executing them.
- Prepare read-back checks for chain ID, registry runtime, owner, attester membership and deployed demo initialization. Include exact compiler/optimizer/EVM/build-info and constructor inputs needed for registry source verification. Document how to inspect verification status without pretending it is already verified.
- Keep report publication in the injected browser wallet. A deployment helper must not publish a report using the deployer or turn the web server into a signer.
- Existing `scripts/local-demo.sh` must remain a working local reproduction. Preserve its role or document a tested replacement; do not redirect it to public Fuji.
- Include a compact public execution checklist listing the later external actions and expected evidence. Use `not deployed`, `not verified` or `not recorded` for missing outputs. Do not populate real-address tables with synthetic or Anvil values.

### Hosting preparation

- Document the actual Next.js server runtime, package root, build/start commands and environment variables required for Scan, Lookup and browser publication. This app uses server actions/routes; do not assume a static export is sufficient.
- Update placeholder-only environment examples for both modes. Do not overwrite or print the maintainer's `.env.local` or copy secrets into examples/browser bundles. Keep host credentials out of the repository.
- Prepare the no-key template path as the default. The local mock provider must not become a production endpoint, and ambient Gemini credentials must not enable external calls.
- Do not select a paid plan, create an account, create a hosted project or publish the app. If no hosting target is selected, produce a provider-neutral deployment section and identify the remaining target-specific decision; complete the rest of this task.
- Keep the no-database MVP. Explanation caches are process-local and temporary; canonical report export/import is the retrieval mechanism. Document that a report hash alone cannot retrieve the JSON body.

## 6. Prepare the judges' demo and operational notes

Create `docs/M7_DELIVERY.md` and `docs/DEMO_SCRIPT.md`, or extend an existing equivalent if one now exists. Link them from README and retain historical progress evidence.

The delivery document must include runnable setup/deployment preparation, environment examples, local results, a clearly pending real-address/link table, manual Core smoke steps, source-verification steps, canonical JSON distribution/import instructions and the remaining public-release checks. Update the threat model only where configuration/hosting changes introduce a concrete new trust boundary.

The 2–3 minute demo script must show:

1. Wallet-free scan and the snapshot binding.
2. Signal score beside coverage/confidence, with one finding and its evidence; no safety certification.
3. A labeled template explanation. Optional mocked AI behavior, if shown, must be identified as mocked.
4. Canonical export and authorized browser-wallet publication.
5. Lookup from a clean session, JSON import/commitment agreement and independent replay of the original block.
6. A negative control or clearly denied unauthorized publication; distinguish replay from a new current-state scan.

Prepare a fallback route for unavailable historical state, missing body or RPC failure; never silently substitute latest. The public demo steps are future actions until executed. Include a concise slide outline and a recording/link checklist, not fabricated slides/video URLs, latency measurements or deployed addresses. Actual slide/video production and publication are outside this preparation request.

## 7. Preserve analyzer and M6 invariants

Do not change these contracts while adapting delivery:

- Same-block collection, final header/hash consistency, code hashes and ruleset/configuration versioning.
- Required transport failure means inconclusive with no numeric score. Empty code is not analyzable. Historical replay never silently becomes latest.
- Dispatcher matches indicate possible capability only. Access control is not evaluated by the scanner. Empty proxy slots do not prove a non-proxy.
- Golden scores, negative controls, canonical JSON vector and publication tuple remain unchanged. Changes to genuine observed demo state may change its report; deployment mode alone must not change the deterministic payload for the same snapshot.
- Score bands remain Few signals 0–24, Some signals 25–59 and Many signals 60–100. Coverage and confidence stay beside the score, including zero.
- M6 prompt v2 remains evidence-bound: model output selects supplied IDs/order/checks; displayed conclusions are deterministic. Do not reintroduce free-form score, severity, safety or access-control claims.
- Templates, export, lookup and publication remain usable when explanation preparation fails, an AI request is delayed or a projection expires. Preserve byte limits, cache boundaries and stale-response rejection.
- Registry commitment matching proves the recorded bytes agree; it does not prove the analysis is correct. Registry live target-code equality does not prove implementation/state freshness.

## 8. Prove the new behavior

Use the existing Vitest, Foundry, Anvil and Chromium tooling. Add meaningful regressions for changed boundaries, not tests that merely restate configuration constants.

| Case | Required observable result |
| --- | --- |
| Missing/invalid publication config | Publication unavailable with an accurate reason; valid read-only scanning and the template remain usable. |
| Local mode | Existing loopback/Anvil flow passes; the local origin/network restrictions remain effective. |
| Fuji mode from a non-loopback test origin | The real configuration and browser paths support check/publish/receipt recovery through controlled local test infrastructure. Do not bypass those paths just to pass the test. Label this as a simulated Fuji configuration test, not live Fuji verification. |
| Wrong chain, wrong registry runtime or conflicting snapshot on the same chain ID | Reject publication and reject an incorrectly attributed receipt; no false confirmation. |
| Unauthorized/revoked attester and wallet/report changes | Fail or invalidate readiness correctly, including revocation after an earlier successful check. Existing on-chain authorization remains the final gate. |
| Pending, reverted, mismatching and replaced receipts | Preserve hash/context and existing recovery behavior; no auto-resubmission, speculative nonce or unsupported success claim. |
| Real local demo deployment | Constructor/initializer state, token behavior and access restrictions pass; proxy calls use target storage and analyzer evidence resolves the intended implementation. |
| Export/import/replay | Canonical hash and publication tuple agree. Original-block replay matches or returns an explicit unavailable result; current-state scan remains separate. |
| M6 and golden regressions | Existing templates, invalid-output fallback, input/output bounds, stale AI response guards, golden findings/scores and locked canonical vector still pass. |
| Deployment scripts and documentation | Syntax and local dry-run/initialization checks pass; broadcast is opt-in; commands refer to existing paths and documented inputs. |

For hosted-origin tests, map a controlled test hostname to the loopback application in the browser harness. Test RPC/provider behavior remains local and disposable. If a test transport seam is needed, keep it internal to tests; never add a client-selectable production bypass or weaken the actual Fuji checks.

Run targeted tests while implementing, then the final workspace suite after the last relevant source change. From the repository root in PowerShell:

```powershell
pnpm typecheck
pnpm lint
pnpm test
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && ~/.foundry/bin/forge fmt --check && ~/.foundry/bin/forge build --build-info && ~/.foundry/bin/forge test -vv'
pnpm test:integration
pnpm build
pnpm test:browser
git diff --check
git status --short --branch
```

If dependencies are missing, use `pnpm install --frozen-lockfile`. If matching Chromium is missing on Windows, use `pnpm --filter @avaguard/web exec playwright-core install chromium`. On a Linux checkout use native Foundry; do not assume WSL paths there. Adjust the recorded absolute path only if the checkout actually moved.

Build Solidity artifacts before integration, and the web app before browser acceptance. Run integration and browser suites sequentially: both use Anvil port 18545. Browser acceptance also uses ports 31845/31846. Preserve the port-conflict checks; do not terminate unrelated servers or browsers. Clean up only processes started by your checks.

The browser runner currently reports one selected integration test and twelve filtered/skipped cases while executing its browser scenarios. Record that separately from the full integration suite. Inspect exit codes, assertions, skipped tests and warnings. A sandbox/WSL permission failure is an environment blocker, not a passing test or evidence that Foundry is absent. Use the available permission mechanism for required local checks; if it remains blocked, complete unaffected work and report the exact limitation.

## 9. Handoff and stop

Update PROGRESS.md with the actual base SHA, changed paths, implementation decisions, commands actually run, observed failures/fixes, final counts and remaining manual/public checks. Never copy the baseline counts into a new passing report without running the checks.

Deliver a Vietnamese handoff containing:

1. What local/Fuji configuration, demo contracts and runbook artifacts changed, and why.
2. A compact verification table with actual commands/results, including filtered/skipped tests and any unexecuted checks.
3. Exact local reproduction steps and links to the new runbook/demo script.
4. Remaining decisions or inputs: hosting target and public deployer/admin/attester addresses, without requesting secrets.
5. The concrete next external actions for later authorization: real Core smoke, Fuji deployment/attester setup, registry source verification, browser publication/replay, hosting and final media/link checks.

Finish all local work that does not depend on those external actions. Do not ask for permission again for ordinary local edits, tests or documentation covered by this request. Do not make a missing hosting choice or AI credential an excuse to leave independent preparation unfinished.

Leave the diff for review; do not commit, push or merge. Stop after **M7 preparation**, and state whether its local acceptance passed. Keep **M7 public delivery** open until real deployment, verified source, accessible app/report links and submission materials have been produced and checked under a subsequent explicit instruction.
