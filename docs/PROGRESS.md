# Progress

## 2026-11-06 — M0 discovery

Status: M0 complete; M1 not started. Environment findings and the reviewable M1 scaffold/check plan are in ENVIRONMENT.md. Foundry setup and final dependency pins remain prerequisites for the affected M1 work.

### Work performed

- Read AGENTS.md, INIT_PROMPT.md, README.md, DECISIONS.md, PRODUCT_SPEC.md, SCANNER_SPEC.md, THREAT_MODEL.md, ACCEPTANCE.md, PLAN.md, SOURCES.md and RPC_HISTORY_CHECK.md.
- Inspected existing historical probe script and raw JSON, without running a fresh probe or altering saved evidence.
- Created ENVIRONMENT.md and this log; added discovery decisions to DECISIONS.md. No application source, dependencies, credentials, Git initialization/commit or deployment.

### Commands actually run and observed results

| Commands | Observed result |
| --- | --- |
| Get-Location; rg --files (including targeted instruction/spec patterns) | Correct AvaGuard workspace; planning files plus existing probe/evidence |
| Get-Content on the files listed above and scripts/probe_fuji_history.py / docs/checks/fuji-history-2026-11-06.json | Scope and historical sample contents inspected |
| Get-Command for node/npm/pnpm/corepack/git/forge/cast/anvil/solc/wsl/python | Windows JS/Git/Python/WSL commands found; Solidity tools absent |
| node --version; npm --version; pnpm --version; git --version; python --version; corepack --version | v24.19.0; 11.17.0; 12.4.2; 2.51.1.windows.1; 3.12.12; 0.35.0 |
| node -p "process.platform + ' ' + process.arch" | win32 x64 |
| git status --short; git rev-parse --show-toplevel; git log -1 --format="%h %s" | Initially clean; existing AvaGuard repository; 425a624 Create init folder |
| wsl --status; wsl --list --verbose | Sandbox E_ACCESSDENIED; external read-only retry confirmed Ubuntu WSL2 |
| wsl -d Ubuntu -- bash -lc (uname and tool loop) | Linux kernel returned; loop variable transmission failed, blank tool names discarded |
| wsl -d Ubuntu -- bash -lc 'command -v forge cast anvil solc node pnpm; ~/.foundry/bin/forge --version; ~/.foundry/bin/cast --version; ~/.foundry/bin/anvil --version; cat /etc/os-release' | Ubuntu 26.04 LTS; Foundry binaries absent; only Windows-mounted pnpm shim found |

Official documentation was retrieved with web search/open tools; exact URLs and observations are recorded in ENVIRONMENT.md. Direct Foundry/viem Markdown retrieval errors are disclosed there. No package registry resolution or installation ran.

Final documentation validation: `git diff --check` exited 0; `git diff --stat`, `git status --short` and a heading/status search confirmed only DECISIONS.md was modified and ENVIRONMENT.md / PROGRESS.md were added. The stat omits the two untracked new files. No application tests were claimed.

### Remaining work

Request M1 separately. Establish Foundry in WSL, record exact compatible package/compiler versions before installation, then implement and execute the proposed scaffold checks. No application tests/builds can run against the current planning-only repository. Preserve SCANNER_SPEC/ACCEPTANCE weights and golden cases. AI integration, deployment and wallet actions remain deferred.

## 2026-11-10 — M1 in progress

Current checkout relocated to C:/Users/LENOVO/Documents/Codex/AvaGuard. Required specs read; foundation scaffold created. Foundry official installer and metadata queries underway. Results pending; no completion claim yet.

### M1 completion — 2026-11-10 (Vietnam time)

Status: M1 complete within foundation scope. No scanner, full registry, AI integration, keys, deployment or publication was implemented.

#### Changes and environment

- Old workspace path was missing. Read-only search located the existing repository at C:/Users/LENOVO/Documents/Codex/AvaGuard. All edits were made there with explicit tool escalation because writable roots still named the old location. No repository was initialized or copied.
- Read AGENTS.md, INIT_PROMPT.md, ENVIRONMENT.md, DECISIONS.md, SCANNER_SPEC.md and supporting product/threat/acceptance/plan documents before implementation.
- Applied Sites local-only guidance: existing checkout, requested Next.js framework, no registration, source sync or publication.
- Official https://foundry.paradigm.xyz installer downloaded to /tmp/avaguard-foundry-installer.sh and run in Ubuntu WSL2, followed by ~/.foundry/bin/foundryup. Installer verified Sigstore/binary attestations; resolved v1.9.0. Forge/Cast/Anvil all report 1.9.0, commit 6056c5845d34205a83cf7108042adb137325c9df, build timestamp 2026-11-02T20:28:32.434285913Z. No shell-profile edit or wallet setup.
- Created private pnpm workspace, apps/web Scan/Lookup, packages/analyzer schema, packages/contracts smoke fixture, synthetic fixtures, placeholder env example, lint/type configs and one lockfile. Added tsbuildinfo ignore. See M1_SCHEMA.md for deferred report fields.
- Queried official npm metadata for engines/peers/versions before installation. Selected Node 24.19.0/pnpm 12.4.2, Next/eslint-config-next 16.4.6, React/react-dom 19.3.1, TypeScript 5.9.3, Zod 4.6.7, Vitest 5.1.0, ESLint 9.39.1, @types/node 24.19.2, @types/react 19.3.0 and @types/react-dom 19.2.3. Frozen resolution with strictPeerDependencies succeeded. Kept TypeScript 5.x rather than automatically selecting current 7.x. ESLint 9.39.1 emitted a deprecation warning during install; checks work with Next config's >=9 peer constraint.
- Solidity 0.8.30 availability confirmed via official solc package metadata and actual Foundry compilation. Explicit Cancun/optimizer 200 preserves M0 guidance. No claim is made that this smoke build validates future dispatcher golden fixtures.
- pnpm automatically added exact Next 16.4.6 entries to minimumReleaseAgeExclude; retained the narrowly pinned entries after inspecting them. No blanket age-policy disable.
- First non-escalated npm metadata command returned ENOTFOUND for registry.npmjs.org; stopped the obsolete retrying session after successful escalated queries; escalated metadata queries succeeded. Initial shell process attempts used the obsolete cwd and failed before execution. No environment/credential dumps.

#### Commands and actual results

| Command | Result |
| --- | --- |
| node --version; pnpm --version | v24.19.0; 12.4.2 |
| npm view for next engines/peers, react, typescript, zod, vitest engines, ESLint/config/types and solc@0.8.30 | Versions/compatibility inspected; exact chosen versions above |
| ~/.foundry/bin/forge --version; cast --version; anvil --version (WSL) | All 1.9.0; attestation verification succeeded during install |
| pnpm install --lockfile-only | Exit 0; root lockfile created BEFORE frozen install |
| pnpm install --frozen-lockfile | Exit 0; 363 packages installed; lockfile current; supply-chain policy check passed |
| pnpm typecheck | Exit 0 for web and analyzer; rerun after Next build also passed |
| pnpm lint | Initial exit 0 with rootDir/anonymous-export warnings; repaired monorepo rootDir/config export, rerun clean |
| pnpm test | Exit 0; 1 file, 22 schema tests passed |
| pnpm build | Exit 0; Next 16.4.6 compiled and prerendered /, /lookup and /_not-found |
| forge fmt; forge fmt --check; forge build --build-info | Exit 0; compiled 2 files with actual Solc 0.8.30 |
| forge test -vv | Exit 0; 2 passed, 0 failed/skipped; fuzz supply/read invariant ran 256 cases, zero-holder rejection passed |
| pnpm --filter @avaguard/web start | Local production server ready on port 3000 |
| Invoke-WebRequest / and /lookup | Both HTTP 200; SSR limitation-text assertions passed |
| open_in_codex http://localhost:3000/ | Returned queued; not evidence of browser rendering or interaction QA |
| git --work-tree=. diff --check | Exit 0; CRLF conversion notices only |
| git --work-tree=. status --short | Existing planning files retained; expected M1 additions/docs only |

Git commands without explicit --work-tree sometimes failed in this relocated checkout; used per-command --work-tree=. for inspection, without modifying Git config. Build output and node_modules remain ignored. No commit was made.

#### Verification limits and next milestone

Schema tests cover version/network/address/snapshot shapes, strict unknown-field rejection, unique coverage IDs, nullable failure scores, method confidence and score-band boundaries. They do not test a scanner, canonical hash, rule weights, registry authorization or real RPC error classification. Full report evidence/proxy/hash contract belongs to M2/M3; approved golden scores and scanner specification are unchanged.

HTTP/SSR checks establish serving and truthful shell text. Interactive browser and responsive visual QA remain unverified. M1 contains no live scanner or report importer, so those product actions remain visibly unavailable. Historical RPC evidence was not re-probed: no new target/snapshot was requested. Next decision is a bounded M2 request; no AI provider/model selected.


Final compiler artifact metadata independently confirms 0.8.30+commit.73712a01, evmVersion=cancun, optimizer=true/runs=200. Corrected one extra EOF blank line found by final diff check; subsequent diff check exited 0. Stopped the owned local production server after HTTP checks; restart with pnpm dev to preview.

## 2026-11-12 — M2 in progress

Read required specs and inspected M1/user changes. Evidence-only collection implementation started; verification pending. A pre-existing generated apps/web/next-env.d.ts modification was observed; no manual edit was made; Next regenerates it during build. Pinning viem 2.57.18 from official registry metadata for ABI/keccak utilities. No score/rules/registry/AI/deployment.

### M2 completion — 2026-11-12 (Vietnam time)

Status: M2 evidence collection complete within the requested backend scope. All CollectionResult outputs are evidence-only, unscored and explicitly publishable=false. No M3 rule engine, registry, AI integration, deployment or golden-score changes.

#### Implementation

- Added evidence-schema.ts, transport.ts, probes.ts and collector.ts. Stable evidence IDs, explicit chain/snapshot/request context, bounded raw/decoded data and code hashes, method confidence per evidence, typed error/status observations, coverage and proxy dependency links.
- Added a separate collectionSchema: collected/inconclusive/not-analyzable. Before a valid snapshot, snapshot=null and chainId stays null until observed; wrong network retains the actual observed chain ID. No fabricated block/hash.
- Removed the M1 requirement for aggregate confidence. Typed findings/evidence live on the legacy scored skeleton; empty findings are valid. Collection itself generates no findings or score and is not that legacy report type.
- Fixed zero-address caller, gas=3000000/value=0, configuration version 1. Every state request (including retries, owner/beacon/implementation code and nested-layout checks) uses explicit B. Header/hash and network are rechecked before a successful collection/no-code result. Historical requests never select latest.
- Classified transport/rate-limit, confirmed execution revert, malformed ABI return, historical-state-unavailable, protocol failure, snapshot mismatch and deadline independently. Transient failures get at most 3 same-B attempts; read timeout 5s / collection deadline 30s. Optional metadata transport failure also invalidates collection. Raw provider messages/URLs are not retained as error diagnostics.
- Collected ERC-20 read probes, optional owner/metadata, computed ERC-1967 slots, beacon call and dependency hashes. Exact ERC-1167 parser evidence has bytecode-pattern confidence linked to raw source code. One-hop bound, known loop/nested/invalid/empty dependency gaps. No dispatcher/capability findings.
- Existing ReadProbeFixture used without adding Solidity fixtures. Anvil test loads compiled runtime and initial storage via dev-only RPC; no deployment/transaction or wallet. Node uses accounts=0, silent output and loopback only, with owned-PID teardown.
- UI remains input validation only with truthful full-scanner/registry-unavailable messages; no new route pretends to scan/publish.
- Updated README, M1_SCHEMA boundary, M2_EVIDENCE API/configuration documentation. Added viem 2.57.18 with one updated root lockfile; exact viem/ox minimumReleaseAgeExclude entries added by pnpm were inspected and retained, no blanket disable.
- The initial checkout had a generated next-env.d.ts change. No manual edit was made to that file; Next regenerated its standard version during build. All unrelated project/source files were retained.

#### Commands and observed results

| Command/check | Actual result |
| --- | --- |
| Read required AGENTS/PROGRESS/M1_SCHEMA/SCANNER_SPEC/ACCEPTANCE and supporting decisions/source/package files | Read before implementation; existing checkout inspected at the user-specified moved location |
| npm view viem version engines --json | Official registry returned 2.57.18; pinned exactly |
| pnpm install --lockfile-only, then pnpm install --frozen-lockfile | Both exit 0; viem dependency graph added; root lockfile current |
| Final pnpm install --frozen-lockfile | Exit 0, resolution skipped, no manifest/lock mismatch |
| pnpm typecheck | Initial TS narrowing errors in proxy branches; repaired without weakening types. Subsequent runs exit 0 for analyzer/web |
| pnpm lint | Exit 0 |
| pnpm test | Final 3 files / 77 tests passed: 23 schema regressions, 34 collector/parser mocks, 20 HTTP/error tests |
| pnpm test:integration | Final 1 file / 2 passed, no skipped tests; compiled fixture collection, exact replay and empty-code handling on owned Anvil |
| WSL forge fmt --check; forge build --build-info; forge test -vv | Exit 0; pinned compiler build current; 2 tests passed, 0 failed/skipped; fuzz 256 runs |
| pnpm build | Exit 0; Next production build compiled/typechecked and generated /, /lookup, /_not-found |
| pnpm --filter @avaguard/web start plus Invoke-WebRequest / and /lookup | HTTP 200 for both; SSR assertions for unavailable scan/report-body/replay text passed |
| Local Anvil port check after integration | Listener stopped; owned node teardown completed |
| Local production server teardown | Stopped after SSR checks |
| git --work-tree=. diff -- docs/SCANNER_SPEC.md docs/ACCEPTANCE.md | No changes to normative scanner/golden score requirements |

Mock coverage includes: all state/proxy/owner reads at B, fixed caller/options, initial/pre-snapshot errors, wrong chain, bounded transient retries/recovery/timeouts, malformed/confirmed-revert separation, optional-read transport failure, final header/hash/network mismatch, unavailable historical header/state with no latest fallback, no-code, direct/beacon dependency resolution and unsupported loops/empty/nested/malformed dependencies, exact clone parser controls, mixed evidence snapshots/duplicate/dangling IDs and no findings/score on RPC errors. HTTP tests check protocol IDs/envelopes, result/error exclusivity, size bounds and sanitized error classification.

Anvil asserts an empty account list, supply=1000 and balanceOf(0)=0 from the existing compiled runtime/storage, reverting absent optional methods, same-B requests, exact original-snapshot replay and not-analyzable empty address. These are local observations, not Fuji measurements or approved risk-score fixtures. Constructor semantics remain covered by the existing Forge suite.

#### Limits and next milestone

Collection is not a complete deterministic report or publication eligibility check. Canonical reportHash, full report body/import validation, dispatcher/rule findings and scoring remain M3; registry/AI/UI vertical slice are later milestones. Proxy resolution follows only supported one-hop layouts; custom/diamond/legacy/nested control flow and clone integration remain declared gaps. No real Fuji historical-state availability/throughput claim was added. Each requested replay must still check the actual target/block; configured provider honesty is trusted.

Browser interaction/visual QA was not run; UI regression is production build plus HTTP/SSR checks. No account, key, paid provider or AI credential was created. No transaction was sent. Stop after M2; request M3 separately.
Final review: lint/build and git --work-tree=. diff --check passed after documentation/whitespace cleanup. No changes to SCANNER_SPEC.md or ACCEPTANCE.md; only M2 source/tests, dependency lock/config, UI status text and documentation changed. New files were reviewed; build artifacts and node_modules remain ignored.

### 2026-11-12 — M2 self-beacon review

Inspected HEAD `56de31cbfd7ab85594fbeaa2a9ccdb6d43c51332`. The working tree started clean and `git diff --stat e293627 HEAD` showed identical tracked content. The earlier review recorded 77 passing unit tests and a startup failure before the Anvil assertions ran.

The resolver checked the implementation address for loops only after calling the beacon. A target acting as its own beacon could return a third address with code and appear resolved. The new guard identifies the loop directly from the linked beacon-slot evidence, records the unsupported reason and continues ordinary target probes.

| Command | Result of this review |
| --- | --- |
| `pnpm exec vitest run packages/analyzer/test/collector.test.ts -t self-beacon` before the fix | 0 passed, 1 failed, 34 skipped by the name filter. Expected unsupported, received resolved. |
| `pnpm exec vitest run packages/analyzer/test/collector.test.ts` after the fix | 35 passed, 0 failed, 0 skipped, including direct, beacon, empty, nested, loop and self-beacon cases. |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | Each exited 0. |
| `pnpm test` | 78 passed, 0 failed, 0 skipped. |
| `pnpm test:integration` | Ran before and after the fix. Both runs executed 2 tests, 2 passed, 0 failed, 0 skipped. Snapshot collection, replay and empty-code assertions ran against local Anvil. |

The existing integration runner succeeded with WSL access in this checkout. The historical startup failure did not recur and its original cause remains unconfirmed. All requested M2 acceptance checks passed.

### 2026-11-12 — M3 in progress

Started from clean HEAD fa0586d5ca07a477a54be28eaed01910e6a30ff6. The self-beacon fix and regression are tracked. Baseline pnpm test passed 78 tests. Sandbox WSL returned Wsl/E_ACCESSDENIED during startup. With WSL access pnpm test:integration passed both Anvil tests. Implementing and verifying ruleset 1 against Scanner Spec v2.

### M3 acceptance — 2026-11-12 (Vietnam time)

M3 passed on the current checkout at HEAD `fa0586d5ca07a477a54be28eaed01910e6a30ff6`. Changes are in the working tree. Scanner Spec v2, ruleset 1, configuration 1 and the locked acceptance scores are unchanged.

#### Analyzer API

- `collectEvidence(transport, input)` retains its M2 behavior. `buildReport(collection)` evaluates the completed snapshot locally. Complete reports expose per-finding evidence and confidence, coverage, score, band, canonical body and hash. Inconclusive and empty-code reports retain diagnostics with null score, band and hash.
- The decoder records instruction offsets and skips PUSH operands. Incomplete PUSH instructions are explicit runtime coverage gaps. A signature match records its selector, PUSH4 offset, EQ offset and source code evidence ID. A comparison within two instructions of PUSH4 in the same linear block indicates a possible entry point. The unreachable-comparison control demonstrates the remaining reachability limitation.
- Supported proxy resolution selects implementation code for dispatch checks. State probes retain the target address. Direct and beacon ERC-1967 paths have positively linked dependency observations. The self-beacon regression retains independently observed mint and owner signals (35 points). The standard clone test exercises parsing and rule selection using mock state.
- `R-SOURCE-UNKNOWN` links a scope declaration to the target snapshot. Its confidence field is explicitly null because source verification has no observation method. Other findings carry a method from the ruleset. Import preserves metadata text case. RPC error codes and instruction offsets are decimal strings in canonical JSON.
- `canonicalReportJson(body)` and `reportHash(body)` select the deterministic fields. `parseReportBody(input)` validates imported structure, references and score consistency. `verifyCommitment(json, expectedHash)` checks the bytes offline. `replayReport(transport, body, expectedHash)` checks the original body commitment and re-collects at its exact block number/hash. Historical failures, mismatches and successful replay have separate outcomes.

#### Golden fixtures

All ten used compiled Solidity runtime, local Anvil state, the M2 collector and the M3 rules. Each test asserts the complete finding ID set, evidence links, score, band and coverage. Every row includes the zero-weight source scope finding.

| Fixture | Expected | Observed | Band | Evidence under test |
| --- | ---: | ---: | --- | --- |
| CleanToken | 0 | 0 | Few signals | Successful reads, absent owner interface |
| MintableToken | 35 | 35 | Some signals | Mint comparison and nonzero owner without code |
| DecoyConstantToken | 0 | 0 | Few signals | Returns the mint bytes4 constant via a different function |
| BlacklistFeeToken | 45 | 45 | Some signals | Blacklist and fee comparisons, nonzero owner without code |
| UpgradeableToken | 60 | 60 | Many signals | Implementation slot, implementation mint comparison, target owner |
| BeaconProxyToken | 60 | 60 | Many signals | Beacon slot, beacon call, implementation mint comparison, target owner |
| NoMetadataToken | 0 | 0 | Few signals | Successful required reads, optional metadata failures |
| NotErc20Contract | 10 | 10 | Few signals | Both required reads revert, one weighted finding |
| RenouncedMintToken | 25 | 25 | Some signals | Mint comparison and zero owner |
| ContractOwnerToken | 25 | 25 | Some signals | Mint comparison and deployed owner code |

#### Commands and observed results

| Check | Result |
| --- | --- |
| Baseline `pnpm test` / `pnpm test:integration` | 78 unit and 2 Anvil tests passed, including the tracked M2 self-beacon regression. The first sandbox integration startup failed before assertions. A direct WSL probe returned Wsl/E_ACCESSDENIED. The WSL-enabled run passed. |
| WSL `forge build --build-info` / `forge test -vv` | Solc 0.8.30 compiled the fixtures. Four tests passed, including the decoy selector control and 256 fuzz runs. Forge emitted lint warnings for empty selector stubs, test-initialized storage and the intentional bytes4 cast. |
| Initial three-fixture Anvil run | CleanToken 0, MintableToken 35 and DecoyConstantToken 0 passed, nine tests excluded by the explicit filter. |
| `pnpm typecheck` / `pnpm lint` | Both exited 0. Final lint was clean after removing an unused test import. |
| `pnpm test` | Four files, 107 passed. Controls cover dispatcher windows and boundaries, truncated PUSH, the cap, duplicate weighting, evidence sufficiency, self-beacon, clone, RPC failures, canonicalization, import and replay. |
| `pnpm test:integration` with WSL access | Twelve passed, zero skipped. Includes ten golden fixtures, original-block collection through scored report and replay of the compiled ReadProbeFixture, and empty-code handling. |
| `pnpm build` | Production build and static routes passed. An additional sandbox run hit EPERM creating a prerender directory under .next. A rerun with workspace build access completed all routes. |
| Foundry `cast keccak < fixtures/canonical-report-v1.json` | Independently matched the fixed vector digest `0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd`. The file contains the exact canonical UTF-8 bytes. |
| `git diff --check` | Exit 0. Git reported line-ending conversion notices. |

To reproduce on a fresh checkout, build the Solidity artifacts in packages/contracts with the pinned Foundry configuration before running the Anvil suite. The runner loads runtime and initializes fixture storage on its own local account-free node. Historical availability on Fuji remains per request. Clone integration, custom dispatcher reachability, unsupported proxy layouts and privileged access control retain their declared coverage limits. No M3 acceptance item remains open.

## Cross-platform Anvil integration runner — 2026-11-13

Windows launches Anvil through Ubuntu WSL2 and reads its Linux PID. Linux launches Anvil from PATH and signals the spawned child directly. Both paths share the same arguments, port preflight and chain-ID check.

On Windows, `pnpm typecheck` exited 0 and `pnpm test` passed all 107 tests. The sandboxed integration run failed during WSL startup (exit 4294967295). With WSL access, `pnpm test:integration` passed all 12 tests. A subsequent loopback bind confirmed port 18545 was free. The test bodies match HEAD. Native Linux execution awaits the GitHub-hosted Ubuntu run.

### M4 local registry — 2026-11-13

Started from `071e87b0665a92c08e5fe172bda0cc992f980a89` on `feat/registry` with an existing progress-note edit. M4 covers local publication, retrieval and canonical body verification.

The publication tuple, trust boundary and lookup API are documented in [the contracts README](../packages/contracts/README.md). The spec left duplicate and snapshot ordering open. M4 rejects a duplicate hash registry-wide, indexes accepted hashes by target in publication order and selects latest by greatest snapshot block, breaking ties by last successful publication.

The locked M3 vector retains its synthetic block 32 and fixed block hash. Its exact bytes hash to `0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd`. The Anvil test collects a separate ReadProbeFixture report with a real local header and matching target runtime, deploys the registry on its own loopback node, authorizes a distinct impersonated attester and publishes. It reads history by target, compares the retrieved commitment with latest, and checks matching JSON, mismatching JSON and missing body. All transaction code lives in the test.

| Command | Observed local result |
| --- | --- |
| `pnpm install --frozen-lockfile` with registry access | Passed with OpenZeppelin Contracts pinned to 5.4.0 in the root lockfile. |
| WSL `forge fmt --check` | Passed. Initial check saw CRLF differences in four existing fixture/test files. The Solidity-only LF attribute makes Windows checkouts compatible with WSL formatting. Existing fixture source has no content diff. |
| WSL `forge build --build-info` and `forge test -vv` | Solc 0.8.30 build passed. 16 passed, zero failed/skipped, including 12 registry tests and 256 fuzz runs in the existing read-probe test. Existing fixture lint warnings remain. |
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | Typecheck and lint exited 0. All 107 unit tests passed. |
| `pnpm test:integration` with WSL | All 13 Anvil tests passed, including the 10 golden scores and publication/lookup. |
| `pnpm build` | Passed with workspace build access after sandbox prerender hit EPERM. Production routes /, /lookup and /_not-found were generated. |

M4 local checks passed on Windows with Ubuntu WSL. Hosted CI for these working-tree changes, injected-wallet publication and Fuji deployment remain unverified. UI and public-network work belong to later milestones.

## M5 local browser flow — implementation started from e50d2ae

The Scan and Lookup pages now use bounded server reads and the M3 canonical body. Publication uses the injected provider, the compiled M4 ABI, the local registry runtime hash, live permission and the wallet's snapshot hash. A successful receipt must include the matching registry event. The server has no transaction endpoint. Setup and reproduction commands are in [M5_DEMO.md](M5_DEMO.md).

| Local command | Observed result on Windows + Ubuntu WSL, 2026-11-13 |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed with a single workspace lockfile. |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | All exited 0. The production build completed without a running read RPC. |
| `pnpm test` | 109 tests passed across five files, including tuple agreement and semantic differences. |
| `forge fmt --check`, `forge build --build-info`, `forge test -vv` in packages/contracts | All passed. 16 Solidity tests passed. Existing fixture lint warnings remain. |
| `pnpm test:integration` | 13 Anvil tests passed. The test deployment now polls boundedly for its receipt after an observed pending result. |
| `pnpm test:browser` after production build and Chromium installation | The filtered browser scenario passed. Empty-code scan, wallet-free MintableToken score 35 and canonical download were observed. Wrong network, conflicting header with the same chain ID and rejected submission were exercised. The app confirmed the local receipt and matching event for transaction `0xae0d5a049fa7ec6fa18fd8f786f86c414b5dc5c7e88c00ef839e43483f5ad1e4`. This hash belongs to the ephemeral test node. |
| Fresh Chromium context | Empty lookup, latest, history index 0, missing body, malformed JSON, invalid schema, altered valid JSON, matching import, original-block replay, current-state comparison and simulated pruned-state replay passed. |
| Demo setup syntax | WSL Bash syntax and Foundry keystore options checked. Actual interactive deployer keystore and Core wallet setup remain manual. |

Early Edge runs timed out. Final browser checks used pinned Playwright with its matching Chromium binary and a test-only provider. Hosted Actions and a real wallet extension have not been exercised for this branch. Both existing CI jobs use checkout v7; browser acceptance runs in the existing contracts-and-integration job after Forge artifacts are built.

## M5 PR #6 review fixes — implemented on f3f91d2

- **Receipt recovery (P2)**: extracted pure receipt classification and submission/network-validated receipt checks into `apps/web/lib/receipt.ts`, and updated `apps/web/app/publish.tsx` so submitted hashes remain visible as selectable text and lock `Publish` / `Check wallet` while pending, survive post-hash `accountsChanged` / `chainChanged` events, and recover via a single-flight read-only **Check receipt** action bound to the original registry, codehash, attester, snapshot and `reportHash`. Reverted or unverified receipts are shown explicitly without auto-resubmitting; retrying a reverted receipt requires a deliberate re-check of the wallet.
- **Lookup import race (P3)**: updated `apps/web/app/inspection.tsx` to track pending file imports and active comparisons separately, display an importing state, disable and guard **Replay original block** and **Scan current state** while a file is loading, supersede older file reads and invalidate outstanding comparisons on new imports, and preserve size, schema, hash and summary checks plus recovery after malformed JSON.
- **Demo notes and regressions**: added recovery guidance to [M5_DEMO.md](M5_DEMO.md) and expanded `apps/web/test/publication.test.ts` and `apps/web/test/browser.mjs` with deterministic tests for receipt recovery, `on`/`removeListener` wallet events, wrong-network and same-chain-ID snapshot mismatch guards, pre-hash rejections, reverted and event-mismatched receipts, delayed `File.text()` reads, reverse-order file selection, held current-state comparisons, and recovery after malformed JSON.

| Local command (Windows + Ubuntu WSL, 2026-11-13) | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed with lockfile up to date across 3 workspace projects. |
| `pnpm typecheck` | Exited 0 (`tsc --noEmit` across workspace). |
| `pnpm lint` | Exited 0 (`eslint .`, zero warnings/errors). |
| `pnpm test` | 5 test files, 113 unit tests passed (including 6 tests in `apps/web/test/publication.test.ts`). |
| `forge fmt --check`, `forge build --build-info`, `forge test -vv` (`packages/contracts`) | Passed (3 suites, 16 Solidity tests passed; existing GoldenFixtures lint warnings unchanged). |
| `pnpm test:integration` | Passed (13 Anvil integration tests passed via WSL). |
| `pnpm build` | Exited 0 (Next.js 16.4.6 production build for `/` and `/lookup`). |
| `pnpm test:browser` | Passed (ephemeral Anvil + Chromium suite: `publishes an analyzer snapshot and verifies the body against its retrieved commitment`, 1 passed / 12 filtered-skipped, exercising M5 end-to-end flow, receipt recovery, wallet events, reverted/unverified receipts, and import races). |

- **Hosted CI vs local state**: GitHub Actions run `43294543183` passed on `f3f91d2`, and the first P2/P3 review fixes above were committed in `24c1ac1`, which passed GitHub Actions run `43347475910` (`workspace-checks` and `contracts-and-integration`) on `codex/m5-local-flow`.

## M5 PR #6 receipt hardening follow-ups — working tree on `5bfcadb` (built on `24c1ac1`)

- **Confirmed `5bfcadb` receipt guards & mid-read `A -> B -> A` protection**: compared replacement receipt handling in `apps/web/lib/receipt.ts` and `apps/web/app/publish.tsx`, discarded receipts read across mid-read `A -> B -> A` `chainChanged` round-trips, and preserved post-submission account changes via saved `attester`.
- **P2 post-timeout replacement lookup & verified nonce rules (no speculative pending nonce)**: removed pre-sign `getTransactionCount({ blockTag: "pending" })` fallback in `apps/web/app/publish.tsx`. Original tx `nonce` (and mined `submittedBlock`) are stored only after `validateSubmittedTransaction` confirms case-insensitive `hash` + `from === attester` and valid non-negative integer `nonce` while the report, submission, and network revision still match. Without a verified nonce, `waitForTransactionReceipt` receives no predicted `replacement` hint, **Check receipt** retries `getTransaction({ hash })`, and `wait: true` only classifies replacement when `viem` supplies consistent `onReplaced` proof (never from a mismatched hash alone).
- **P2 strict direct receipt hash binding & candidate validation**: every direct `getTransactionReceipt({ hash: H })` (both for original `A` and replacement candidate `B`) goes through `validateReceiptForHash` (`/^0x[0-9a-fA-F]{64}$/`, valid `status`/`logs`, exact case-insensitive match with requested `H`), returning retryable `"unavailable"` instead of fake replacement if missing, malformed, or equal to `C !== H`. Candidates from `getTransaction({ sender, nonce })` must match `attester`, verified `nonce`, valid hash, and `blockNumber !== null`; mid-read `chainChanged` checks guard every lookup step without enforcing `calldata`/`to` equality (supporting both speed-up and cancel replacements).
- **P3 partial-history vs genuine pending distinction**: kept bounded block scans (`128n` when `submittedBlock` is known, `16n` when unknown). `"Transaction is still pending. Use Check receipt again once confirmed."` is emitted only when node reads show exact `A` unmined (`blockNumber === null`); partial scans (e.g., submitted at block `100`, replacement at `101`, head at `240` scanning `240..112`) or unknown `submittedBlock` return retryable `"unavailable"` (`"Receipt unavailable. The searched blocks do not cover the original submission. Use Check receipt to try again."`) while preserving `A` and **Check receipt**.
- **Regressions and clean workspace note**: added TDD regressions (observed failing before each fix) in `apps/web/test/publication.test.ts` (14 tests covering `7/8` speculative nonce rejection + nonce-8 recovery, `A->C`/`B->C`/`B->B` hash binding, `onReplaced` proof, corrupt candidates, mid-read `A->B->A` candidate reads, `100/101/240` bounded scan vs `blockNumber === null` positive control, and missing/malformed `transactionHash`) plus Chromium/Anvil E2E tests in `apps/web/test/browser.mjs` (contradictory `mismatched-hash`, `missing-hash`, competing-nonce race, and `evm_setAutomine(false)` post-timeout Anvil replacement). Note: `apps/web/next-env.d.ts` matches `5bfcadb` cleanly.

| Local command (Windows + Ubuntu WSL, 2026-11-13, on final working tree over `5bfcadb`) | Observed result |
| --- | --- |
| `pnpm typecheck` | Exited 0 (`tsc --noEmit` across workspace). |
| `pnpm lint` | Exited 0 (`eslint .`). |
| `pnpm test` | 5 test files, 121 unit tests passed (14 tests in `apps/web/test/publication.test.ts`). |
| `pnpm build` | Exited 0 (Next.js 16.4.6 production build for `/` and `/lookup`). |
| `forge fmt --check`, `forge build --build-info`, `forge test -vv` (`packages/contracts`) | Exited 0 (3 suites, 16 Solidity tests passed; pre-existing GoldenFixtures lint warnings unchanged). |
| `pnpm test:integration` | Exited 0 (13 Anvil integration tests passed via WSL). |
| `pnpm test:browser` | Exited 0 (`publishes an analyzer snapshot and verifies the body against its retrieved commitment`: 1 passed / 12 filtered-skipped, exercising full M5 flow, contradictory `mismatched-hash`, `missing-hash`, competing-nonce race, `A -> B -> A` discard/recovery, `viem` replacement, and post-timeout Anvil replacement). |
| `git diff --check` | Exited 0. |

- **Hosted CI vs local state**: GitHub Actions run `43347475910` (`workspace-checks` and `contracts-and-integration`) passed on the older commit `24c1ac1`; commit `5bfcadb` and `f769712` are only verified locally and have not yet run on hosted CI.
- **Remaining manual checks**: interactive Core wallet smoke test on local Anvil (see [M5_DEMO.md](M5_DEMO.md)), maintainer review + commit/push on `codex/m5-local-flow` and final PR #6 SHA CI verification before merging, then starting M6.

## M5 PR #6 callback replacement classification fix — working tree on `f769712`

- **P2 `wait: true` `onReplaced` evidence-source hardening**: updated `classifyReplacedFromEvent` in `apps/web/lib/receipt.ts`. When `submission.nonce` is unverified (`undefined`), `replacedTransaction` must pass `validateSubmittedTransaction` (requiring valid case-insensitive `hash === A`, `from === attester`, and non-negative integer `nonce === tx.nonce`); missing `orig.hash` no longer passes `origHashMatches`. When `submission.nonce` is already verified, that verified `attester` + `nonce` validates replacement `tx`, while contradictory `replacedTransaction` or `transactionReceipt` metadata returns retryable `unavailable`. Valid speed-up/cancel replacements (`to`/`input`/`value` differences) remain supported, hash `A` stays visible, `Publish` stays locked, **Check receipt** stays usable, and no new transaction is sent.
- **TDD regressions (`apps/web/test/publication.test.ts`, 16 tests)**: added a real `viem` `createPublicClient` + `custom` transport `waitForTransactionReceipt` regression test (`refuses wait:true onReplaced when submission.nonce is unverified and eth_getTransactionByHash(A) omits hash`) plus callback evidence-source assertions (`enforces evidence-source rules for wait:true onReplaced across unverified and verified submission.nonce`). Before patching `classifyReplacedFromEvent`, the missing-hash fixture failed with `Status: "replaced"` instead of `"unavailable"`; after the fix, the missing-hash fixture returns `"unavailable"` (including a read-only `wait: false` re-check with zero write calls) and its single-change positive control (`hash: txHash`) returns `{ status: "replaced", originalHash: A, replacementHash: B }`.

| Local command (Windows, 2026-11-13, working tree on `f769712`) | Observed result |
| --- | --- |
| `pnpm exec vitest run apps/web/test/publication.test.ts` | Exited 0 (`16 passed (16)`, after observed pre-fix failure `2 failed \| 14 passed`). |
| `pnpm typecheck` | Exited 0 (`tsc --noEmit` across workspace). |
| `pnpm lint` | Exited 0 (`eslint .`). |
| `pnpm test` | Exited 0 (`5 passed (5)` files, `123 passed (123)` unit tests). |
| `pnpm build` | Exited 0 (Next.js `16.4.6` production build for `/`, `/_not-found`, `/lookup`). |
| `pnpm test:integration` | Exited 0 (`1 passed (1)` file, `13 passed (13)` Anvil integration tests). |
| `pnpm test:browser` | Exited 0 (`publishes an analyzer snapshot and verifies the body against its retrieved commitment`: `1 passed \| 12 skipped (13)`). |
| `git diff HEAD --check` | Exited 0. |

- **Commit/CI note**: `f769712` committed the prior working tree edits from `5bfcadb`; the current callback fix and tests in `apps/web/lib/receipt.ts`, `apps/web/test/publication.test.ts`, and `docs/PROGRESS.md` remain uncommitted in the working tree on `codex/m5-local-flow` for maintainer review. Hosted CI (`43347475910`) reflects only older commit `24c1ac1`, and interactive Core wallet testing remains manual.

## M6 handoff preparation · 2026-11-14

- GitHub reports that [M5 PR #6](https://github.com/ChieNg00/AvaGuard/pull/6) merged into `main` at `a727bd5`. [Run 43362174955](https://github.com/ChieNg00/AvaGuard/actions/runs/43362174955) passed both `workspace-checks` and `contracts-and-integration` for final PR head `a284e18`. The repo still has no recorded manual Core extension smoke result.
- On the local M5 checkout at `a284e18`, a fresh `pnpm test` exited 0 with 123 passing tests across five files. This is the baseline before M6 implementation.
- **Antigravity M6 prompt**: [Antigravity execution prompt](M6_ANTIGRAVITY_PROMPT.md) covers the no-key UI, mocked provider, evidence validation, cache and acceptance checks. M6 implementation and live provider verification remain pending.

## M6 · Explain — completed and verified offline (2026-11-14)

- **Base checkout**: Started from `m6/AI-explanation-integration` at `a284e18` (identical tree to `origin/main` `a727bd5`; `git diff --stat a284e18..a727bd5` empty; `git merge-base --is-ancestor a284e18 a727bd5` exited 0; `.git/ORIG_HEAD.lock` update blocked by sandbox permissions). Preserved pre-existing uncommitted handoff files (`apps/web/next-env.d.ts`, `docs/PHASE_PROMPTS.md`, `docs/M6_ANTIGRAVITY_PROMPT.md`); left `pnpm-lock.yaml`, `.env.example`, and `packages/contracts` untouched.
- **Changed and added files**:
  - `packages/analyzer/src/explain.ts`, `packages/analyzer/src/index.ts`: Added `./explain` module with `EXPLAIN_PROMPT_VERSION = "1"`, bounded sizes (`MAX_EXPLAIN_INPUT_BYTES = 16_384`, `MAX_EXPLAIN_OUTPUT_BYTES = 8_192`), deterministic template builders (`buildTemplateExplanation`, `buildTemplateExplanationFromInput`, `buildIncompleteExplanation`), field-by-field `buildExplainInput` (excluding raw `name`/`symbol`/`decimals`, `finding.explanation`, `proxy.reason`, `coverage[].reason`, raw bytecode, and RPC errors), `canonicalExplainInputJson`, `explainCacheKey` (`keccak256` + `promptVersion` + `model`), strict `validateAiResponse` (strict object schema, exact finding set, per-finding non-empty unique `citedEvidenceIds`, per-finding `suggestedCheckIds` allowlist, markup and safety/access-control claim rejection), and `createExplainService` with an LRU cache of validated successes.
  - `packages/analyzer/test/explain.test.ts`: Added 6 unit tests covering canonical JSON/`reportHash`/`publication` invariance (locked vector `0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd`), MintableToken (35) and DecoyConstantToken (0), `not-analyzable` and `inconclusive` zero-call templates, schema/evidence/safety-claim rejections, untrusted-marker exclusion, timeout/429/outage/oversized fallback recovery, and cache hit/invalidation rules.
  - `apps/web/lib/explain-server.ts`, `apps/web/app/api/explain/route.ts`, `apps/web/test/explain.test.ts`: Added bounded LRU/TTL server projection store (`avaguard.m6.explainRuntime`), loopback-only `createLoopbackHttpExplainProvider` (`AVAGUARD_ENV === "local"`, `AVAGUARD_AI_ENABLED === "1"`, loopback `AVAGUARD_LOCAL_EXPLAIN_URL`; ambient `GEMINI_API_KEY` ignored), strict `POST /api/explain` (`{ reportHash }`, 512-byte limit, 400/404/413/200), and 4 route unit tests.
  - `apps/web/app/actions.ts`, `apps/web/app/report.tsx`, `apps/web/app/shared.tsx`, `apps/web/app/inspection.tsx`, `apps/web/app/globals.css`: Integrated deterministic template explanations immediately alongside reports (`Template explanation` / `AI-assisted explanation` provenance badges, cited evidence IDs, confidence notes, inert unexecuted suggested checks), non-blocking `/api/explain` enhancement aborted on unmount or rescan (`key={`${scanRevision}:${result.data.reportHash}`}`), Lookup pre-import insufficient-evidence notice, and local verified-body template rendering.
  - `apps/web/test/browser.mjs`: Extended Chromium acceptance checks for no-code template, MintableToken score 35 + template + citations, Lookup insufficient-evidence notice + template, delayed Scan #1 pending + export while pending + Scan #2 fresh result discarding stale Scan #1 AI response, and unsafe-claim fallback to `Template explanation` (`failed evidence or schema validation; showing template.`). Fixed `heldRequests` draining so held mock HTTP responses are never sent twice.
- **Checks run after final code/test edits**:
  - `pnpm typecheck; pnpm lint; pnpm test; pnpm build` (sandboxed): exited 0 — `tsc --noEmit` in both workspaces passed; `eslint .` passed; Vitest passed 7 files / 133 tests (`packages/analyzer/test/schema.test.ts` 23, `packages/analyzer/test/transport.test.ts` 20, `packages/analyzer/test/explain.test.ts` 6, `packages/analyzer/test/rules.test.ts` 29, `packages/analyzer/test/collector.test.ts` 35, `apps/web/test/explain.test.ts` 4, `apps/web/test/publication.test.ts` 16); `next build` compiled routes `/`, `/_not-found`, `/api/explain`, and `/lookup`.
  - `pnpm test:integration` (`BypassSandbox: true`; WSL/Anvil exits `4294967295` inside standard sandbox): exited 0 — `packages/analyzer/test/anvil.integration.test.ts` passed `13 passed (13)` on local Anvil.
  - `pnpm test:browser` (`BypassSandbox: true` after sandbox WSL failure): exited 0 — `node scripts/browser-check.mjs` started local Anvil + two Next.js servers and passed all M5 + M6 Chromium Playwright flows and `publishes an analyzer snapshot and verifies the body against its retrieved commitment`.
  - `git status --short --branch; git diff --check`: exited 0 with no whitespace/conflict-marker errors.
- **Reproduce the no-key flow locally**:
  1. Start local Anvil + the web app without setting any external AI API keys (`AVAGUARD_AI_ENABLED` unset/disabled or omitted), scan a deployed fixture or empty address, and verify the UI immediately displays `Template explanation`, cited evidence IDs, and confidence notes while `canonicalJson`, `reportHash`, and `publication` remain identical to deterministic M4/M5 outputs.
  2. For automated end-to-end verification (including delayed stale-response discard and validation-fallback via an injected local loopback HTTP mock server, without external network calls), run `pnpm build` followed by `pnpm test:browser` (and `pnpm test:integration` for the full 13-test Anvil suite).
- **Provider scope & remaining manual checks**:
  - All M6 provider tests use an injected offline `ExplainProvider` in Vitest and a local loopback HTTP mock (`AVAGUARD_LOCAL_EXPLAIN_URL`) in `apps/web/test/browser.mjs`; no external AI provider or real Gemini API call was made.
  - Pending user-authorized checks outside M6 scope: optional manual Core browser extension wallet smoke test against local Anvil, and any separately authorized Gemini API credential/live-adapter check before production or M7 work.

## M6 PR #7 review fixes — completed locally from `9f0fd21` (2026-11-14)

- **Base checkout**: `m6/AI-explanation-integration` at `9f0fd21` (preserving pre-existing `apps/web/next-env.d.ts`, `docs/PHASE_PROMPTS.md`, and `docs/M6_PR7_REVIEW_FIX_PROMPT.md`).
- **Fixes implemented and changed files**:
  1. **P1 · Bind every displayed AI conclusion to the report**:
     - [packages/analyzer/src/explain.ts](../packages/analyzer/src/explain.ts), [apps/web/app/report.tsx](../apps/web/app/report.tsx): Bumped `EXPLAIN_PROMPT_VERSION` from `"1"` to `"2"` (propagated to cache keys and `Prompt v2` provenance display). Replaced free-form `overview`/`summary`/`coverageNote` in `aiOutputSchema` and `aiItemSchema` with strict bounded selections (`{ items: [{ findingId, citedEvidenceIds, suggestedCheckIds? }] }`), rejecting any unknown fields, free-form conclusions, missing/duplicate findings, empty/duplicate/cross-finding citations, or unknown/cross-finding `suggestedCheckIds`. Rendered all `overview`, `summary`, `coverageSummary`, and `confidenceNote` text from `buildTemplateExplanationFromInput`, kept all required evidence IDs (`[...expected.evidenceIds]`, including both `owner` and `owner-code` for `R-OWNER-EOA`), preserved model item ordering, and resolved `suggestedCheckIds` via each finding's allowlist.
     - [packages/analyzer/test/explain.test.ts](../packages/analyzer/test/explain.test.ts), [apps/web/test/explain.test.ts](../apps/web/test/explain.test.ts), [apps/web/test/browser.mjs](../apps/web/test/browser.mjs): Updated valid controls and added negative regressions derived by one-property edits (wrong score in `overview`, unsupported mint authority in item `summary`, false `coverageNote`, missing/duplicate/invented/empty/cross-finding/unknown-check errors, plus partial `owner` citation displaying `owner` + `owner-code`, recovery on subsequent valid output, and stale-response check switching `mint-authority` vs `mint-events`).
  2. **P2 · Keep Scan and Lookup usable if explanation preparation fails**:
     - [packages/analyzer/src/explain.ts](../packages/analyzer/src/explain.ts), [apps/web/lib/explain-server.ts](../apps/web/lib/explain-server.ts), [apps/web/app/actions.ts](../apps/web/app/actions.ts): Extracted `projectExplainInput` without the `16,384`-byte AI input limit so `buildTemplateExplanation` stays independent of `MAX_EXPLAIN_INPUT_BYTES`; added `tryRegisterBody` on the explain runtime; updated `scan` to apply the 16,384-byte limit only when registering/enabling AI projections, returning the complete scan (`body`, `band`, `reportHash`, canonical export, publication tuple) with template and concise status (`aiEnabled: false`) when projection preparation fails, making zero provider calls.
     - [apps/web/app/inspection.tsx](../apps/web/app/inspection.tsx), [apps/web/test/explain.test.ts](../apps/web/test/explain.test.ts), [apps/web/test/browser.mjs](../apps/web/test/browser.mjs): Moved optional `buildTemplateExplanation` computation out of React render into `load()` after `verifyCommitment` and `agrees` succeed; when a canonical body has an uninterpretable finding ID (`R-FUTURE-SIGNAL` in Chromium Lookup test), keeps the body imported, displays application-defined limitation text (`Explanation unavailable`), keeps `Coverage`, `Replay original block`, and `Scan current state` functional, and restores normal `Template explanation` when importing a supported record.
  3. **P2 · Enforce both HTTP limits while reading bytes**:
     - [apps/web/lib/bounded-read.ts](../apps/web/lib/bounded-read.ts), [apps/web/app/api/explain/route.ts](../apps/web/app/api/explain/route.ts), [apps/web/lib/explain-server.ts](../apps/web/lib/explain-server.ts): Added shared streaming reader (`readBoundedText` / `readBoundedJson`) that checks `Content-Length` early, counts `Uint8Array.byteLength` before retaining each chunk, cancels the stream and releases the reader immediately on overflow (`512` bytes for `POST /api/explain`, `8,192` bytes for `createLoopbackHttpExplainProvider`), and decodes UTF-8 fatally across chunk boundaries before `JSON.parse`.
     - [apps/web/test/explain.test.ts](../apps/web/test/explain.test.ts): Added finite multi-chunk stream tests for `512`/`513` and `8,192`/`8,193` bytes with absent or understated `Content-Length`, whitespace-padded valid controls, UTF-8 split across chunks, overflow cancellation before trailing chunks, zero lookup/retry/cache side effects, and recovery on subsequent valid responses.
- **Pre-fix regressions vs post-fix passes observed**:
  - **Finding 1**: `pnpm exec vitest run packages/analyzer/test/explain.test.ts` before fix -> failed (`5 failed | 1 passed (6)` because prompt version was `"1"` and old validator required free-form `overview`/`summary`); after fix -> passed (`6 passed (6)`).
  - **Finding 2**: `pnpm exec vitest run packages/analyzer/test/explain.test.ts apps/web/test/explain.test.ts` before fix -> failed (`2 failed | 9 passed (11)` with `ExplainInputError: Projected explain input exceeds the maximum byte limit.` inside `buildTemplateExplanation`); after fix -> passed (`11 passed (11)`).
  - **Finding 3**: `pnpm exec vitest run apps/web/test/explain.test.ts` before fix -> failed (`2 failed | 5 passed (7)`, `tracked513.stats().cancelled === false` and `lastStats().cancelled === false` because `request.text()` / `response.text()` buffered overflow); after fix -> passed (`7 passed (7)` in `apps/web/test/explain.test.ts`, `13 passed (13)` combined with `packages/analyzer/test/explain.test.ts`).
- **Final verification suite after last code/test edit (`2026-11-14`)**:
  - `pnpm exec vitest run packages/analyzer/test/explain.test.ts apps/web/test/explain.test.ts` -> exited 0 (`2 passed (2)` files, `13 passed (13)` tests).
  - `pnpm typecheck` -> exited 0 (`tsc --noEmit` in both packages).
  - `pnpm lint` -> exited 0 (`eslint .`).
  - `pnpm test` -> exited 0 (`7 passed (7)` files, `136 passed (136)` unit tests: `schema` 23, `transport` 20, `publication` 16, `explain` web 7, `rules` 29, `explain` analyzer 6, `collector` 35).
  - `pnpm build` -> exited 0 (Next.js `16.4.6` production build for `/`, `/_not-found`, `/api/explain`, `/lookup`).
  - `wsl.exe -d Ubuntu bash -c 'export PATH="$HOME/.foundry/bin:$PATH" && cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && forge fmt --check && forge build --build-info && forge test -vv'` (`BypassSandbox: true`; WSL exits `Wsl/E_ACCESSDENIED` inside sandbox) -> exited 0 (`3` suites, `16 passed, 0 failed, 0 skipped`, 256 fuzz runs, pre-existing `GoldenFixtures.sol` forge lint warnings only).
  - `pnpm test:integration` (`BypassSandbox: true`; Anvil/WSL exits `4294967295` inside sandbox) -> exited 0 (`1 passed (1)` file, `13 passed (13)` Anvil integration tests).
  - `pnpm test:browser` (`BypassSandbox: true` after sandbox WSL check failed) -> exited 0 (`node scripts/browser-check.mjs`: M5 + M6 Chromium acceptance suite passed, including `R-FUTURE-SIGNAL` Lookup import/replay/diff recovery, delayed `mint-authority` stale-response discard vs `mint-events`, and free-form validation fallback; Vitest filtered integration run reported `1 passed | 12 skipped (13)` for `publishes an analyzer snapshot and verifies the body against its retrieved commitment`).
  - `git diff --check; git status --short --branch` -> exited 0 with clean formatting; local diff left uncommitted on `m6/AI-explanation-integration`.
- **Remaining / outside M6 scope**: Live Gemini API provider testing with real credentials, manual Core wallet extension smoke test against local Anvil, pushing/merging PR #7, and M7 remain outside this task.
