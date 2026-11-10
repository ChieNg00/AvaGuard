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
