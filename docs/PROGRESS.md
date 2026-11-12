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
