# M7 PR #8 review and next delivery plan

Reviewed 2026-11-15, Vietnam time. Review baseline: clean `m7/Fuji-deployment` at `4937c727c2d51d1ca2f819abc8812eae470b7de0`, compared with M6/main `76857b144122b5266eb3dac5ddadc844ff2fdf9c`. This is a focused M7 code/runbook readiness review, not an exhaustive security audit.

## Decision

M7 local preparation is implemented and its existing automated checks pass. **Fix update (2026-11-15):** local code, regression, and runbook fixes for all five findings (`R1`–`R5`) have been implemented on top of `4937c72` and verified locally (still uncommitted in the working tree awaiting maintainer review, commit/push, and fresh CI before merge/public execution). No live Fuji transactions, explorer verifications, or hosting deployments were executed. The findings below document the original `4937c72` baseline reviewed on Nov 15.

[PR #8](https://github.com/ChieNg00/AvaGuard/pull/8) was open and unmerged when checked. [CI run 43590294061](https://github.com/ChieNg00/AvaGuard/actions/runs/43590294061) passed both `workspace-checks` and `contracts-and-integration` for head `4937c72`. This is PR-head evidence, not a post-merge or live-Fuji result.

The next implementation request is [M7_PR8_REVIEW_FIX_PROMPT.md](M7_PR8_REVIEW_FIX_PROMPT.md). It is local hardening of the existing M7 work, not another product milestone.

## Findings to resolve

All five findings are P2: concrete defects in the delivery path that should be fixed before public execution. File/line references describe the reviewed commit.

### R1 — Read-back returns success for invalid deployment state and failed reads

Location: `scripts/fuji-deploy.sh:210-237`, especially owner/attester output at 213-219 and command substitutions inside `echo` at 223-235.

`--readback` checks registry code identity, but only prints the owner, attester flag and demo state. It never compares the owner with `--owner`, requires authorization to be true, or compares the proxy implementation with an expected deployment address. A failing `cast call` inside `echo "$(...)"` also loses its failure exit status; the branch finishes with `exit 0`.

Two reproductions used a synthetic HTTP JSON-RPC server on WSL loopback and the real compiled registry runtime. No key, real deployment or transaction was involved:

- Expected owner `0x1111111111111111111111111111111111111111`, returned owner `0x3333333333333333333333333333333333333333`, attester authorization `false`: script exited **0**.
- Correct owner and authorized attester, but the baseline `totalSupply()` RPC returned error `-32000` with `synthetic baseline read failure`: stderr reported the failure, stdout printed an empty supply, and the script still exited **0**.

Make verification expectations explicit and required for a full-suite check. Compare observed values, propagate RPC/decoding errors and return nonzero on any failed invariant. If registry-only inspection remains useful, label it separately so its success cannot be mistaken for full-suite verification. The browser still independently checks live attester permission; this finding concerns the deployment verification gate.

### R2 — Keystore creation command is invalid and contradicts the interactive-password instructions

Location: `docs/M7_DELIVERY.md:21-25`.

The documented `cast wallet new ~/.foundry/keystores --unsafe-password` omits the value required by `--unsafe-password <PASSWORD>`. Local **cast 1.9.0** help explicitly identifies that option as a cleartext password argument; the normal encrypted-keystore path uses a hidden prompt by default. The command also does not select the `fuji-deployer` filename used later.

Document a named encrypted-keystore command with a hidden local password prompt, verified against the installed version. Do not add a password value to the command, create a key during the fix, or print a private key. CLI help was inspected in this review; wallet creation was not executed.

### R3 — The deployment wrapper treats a keystore account name as a filesystem path

Location: `scripts/fuji-deploy.sh:35` and `244-248`; affected example: `docs/M7_DELIVERY.md:63-68`.

The wrapper advertises `--keystore <name-or-path>` and the runbook supplies `fuji-deployer`, but the wrapper changes into `packages/contracts` and forwards the value to Foundry's `--keystore`. Local **forge 1.9.0** help distinguishes `--keystore <PATHS>` from `--account <ACCOUNT_NAMES>`, which looks up a filename under `~/.foundry/keystores`. A named account created/imported as instructed is therefore not selected by the documented wrapper command.

A read-only CLI probe with an intentionally absent filename confirmed the distinction: `cast wallet address --keystore <missing-name>` reported a missing relative file, while `--account <missing-name>` reported the path under the default keystore directory. Both exited 1 before accessing any key; no wallet was created or unlocked.

Either support an explicit account option and forward it to `--account`, or consistently require and resolve a keystore file path before changing directories. Validate conflicting/missing inputs before network work. Test argument forwarding with stub executables; no signer needs to be unlocked.

### R4 — The documented direct script invocation fails on a fresh Linux checkout

Location: `scripts/fuji-deploy.sh` Git file mode; direct invocations in `docs/M7_DELIVERY.md`.

Git records the new script as **100644**, without an executable bit, while the runbook uses `./scripts/fuji-deploy.sh`. Extracting this file from `git archive HEAD` into a temporary Linux directory and attempting `--help` produced `PermissionError` / errno 13. Running the same file with `bash` returned 0 and displayed help. The temporary directory was removed afterward.

Use `bash scripts/fuji-deploy.sh` consistently in documented commands, or deliver the executable file mode. Verify from a Git export/checkout on Linux, since Windows mount permissions can hide this defect.

### R5 — Source-verification arguments ignore the supported initial-holder override

Location: `docs/M7_DELIVERY.md:116`, `123`, and `135`.

`DeployDemo.s.sol` and `fuji-deploy.sh --initial-holder` support an initial holder distinct from the owner. The runbook constructs baseline, mint/pause and proxy-initializer arguments using `OWNER_ADDRESS` for both roles. For a deployment using the override, those bytes differ from the actual creation inputs. The existing Anvil demo test already deploys with distinct owner and holder addresses.

Use the effective deployment `INITIAL_HOLDER` and one consistent set of public address variable names throughout deployment, read-back and source verification. Define the default once. Check encoded constructor/initializer arguments offline for both equal-owner and distinct-holder cases. No explorer rejection was observed or claimed in this review.

## Fresh verification on the reviewed head

| Check | Observed result |
| --- | --- |
| `pnpm typecheck` | Exit 0, both workspaces. |
| `pnpm lint` | Exit 0. |
| `pnpm test` | Exit 0; 8 files / 144 tests passed. |
| WSL `forge fmt --check`, `forge build --build-info`, `forge test -vv` | Exit 0; 4 suites / 20 tests passed, including 256 fuzz cases. Existing golden-fixture warnings and `reentrancy-events` warnings in `DemoTokens.sol` were emitted. No warning-free claim. |
| `pnpm test:integration` | Exit 0; all 15 Anvil tests passed, including registry artifact identity and deployed demo behavior/replay. |
| `pnpm build` | Exit 0; `/`, `/_not-found`, `/api/explain`, `/lookup`. Existing `.env.local` was loaded by Next.js; its contents were not read or reported. |
| `pnpm test:browser` | Exit 0; local Anvil and simulated non-loopback Fuji configuration flows passed. Runner reports 1 passed / 14 filtered out; the full integration suite passed separately. |
| Deployment negative probes | Confirmed R1 with two loopback RPC cases and R4 with a temporary Git export. These are observations of defects, not passing release acceptance. |
| Documentation checks | `git diff --check` passed; 69 relative Markdown links across the six changed/added documents resolved. |

Initial sandboxed Foundry execution failed with `Wsl/E_ACCESSDENIED`; the permission-enabled WSL run succeeded. An initial mock server in Windows was unreachable from WSL, so that attempt established no code result; both successful reproductions ran the mock inside WSL. Browser/integration suites ran sequentially because they share an Anvil port.

## Proposed next work and completion gates

| Order | Work | Completion evidence | Scope/authorization |
| --- | --- | --- | --- |
| 1 | Fix R1-R5 and synchronize the runbook | Negative read-back cases exit nonzero; valid suite passes; keystore selection and fresh-Linux commands are tested; constructor bytes match selected holder; applicable existing checks pass. | Local fixes & tests completed in working tree on `4937c72`; awaiting maintainer commit, push, and fresh CI. |
| 2 | Review the fix and PR #8 | Review findings closed against the actual final head; CI passes for that head; documented residual limitations. | Push/merge requires the maintainer's explicit instruction. This review did neither. |
| 3 | Prepare the actual deployment inputs | Public owner/attester addresses, effective holder, selected hosting target, intended HTTPS origin and verification provider; dry-run results and exact build artifacts. | No need for another plugin. Do not request secrets in chat. Wallet setup remains user-operated and explicitly authorized. |
| 4 | Execute the authorized Fuji deployment and source verification | Six real contract addresses with deployment tx/block references; successful state read-back; explorer links and exact verification status. | Separate approval for real-wallet use, Fuji broadcast and source publication under `AGENTS.md`. |
| 5 | Publish the app and test a real injected wallet | Accessible HTTPS app; wrong-network and unauthorized-account rejection; successful authorized publish with retained tx hash and confirmed event; receipt recovery evidence. | Hosting/publication and real-wallet actions need explicit instruction. Preserve browser-only signing. |
| 6 | Assemble judge evidence | Canonical Fuji JSON for the four demo targets, corresponding commitments, actual original-block replay outcomes, working report download links, video and slides. | Create local drafts first; public uploads/submission require authorization. |

Keep the distinction between source verification of our deployed contracts and analyzer coverage: the scanner still reports source verification as not checked. A new block changes `reportHash`; record the actual Fuji report, not a copied Anvil result. Never substitute latest-state scanning for an unavailable historical replay.

Proposed sequencing against the repository's existing calendar: local fixes/review on November 15; authorized deployment and hosting checks on November 16-17; feature freeze on November 18; media/link verification on November 19-20; contingency on November 21. These are targets, not completed work or reserved capacity. The repository records submission at November 21, 23:59 Vietnam time. The organizer page could not be accessed with the web tool during this review, so recheck that deadline and submission requirements before delivery.

## Deferred and unverified

- M7 public delivery remains incomplete: no Fuji addresses, source verification, live Core/MetaMask result, hosted app, or final media were established by this review.
- M6's live Gemini adapter remains unimplemented/unvalidated. Continue with the labeled template path for delivery unless a separate live-AI task is requested. Keep model/provider selection and credentials separate from the current fixes.
- No new plugin, dependency, autonomous-agent system, database, chain or scoring rule is needed for the proposed next task.
- No new live Fuji/history probe was run. Per-request historical availability remains necessary.

## Documentation reference

Local CLI evidence: `cast wallet new --help`, `forge script --help`, and `forge --version` / `cast --version` (1.9.0, commit `6056c5845d34205a83cf7108042adb137325c9df`). The Foundry web-reference URLs listed by the earlier runbook could not be fetched; the CLI conclusions above use observed installed help.

Current [Avalanche contract-verification guidance](https://build.avax.network/docs/tooling/contract-verification) was consulted on 2026-11-15. It documents build-info/Standard JSON and matching compiler settings, and provides a Builder Hub `--verifier custom` route. This does not verify the runbook's Routescan endpoint or a deployed contract. Select and recheck the actual provider/endpoint before a separately authorized source-publication step.
