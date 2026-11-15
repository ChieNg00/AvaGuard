# M7 PR #8 delivery review fixes — execution prompt

Prepared 2026-11-15. Use this prompt for the next local implementation task in Codex or Antigravity. [M7_REVIEW_AND_NEXT_PLAN.md](M7_REVIEW_AND_NEXT_PLAN.md) contains the findings, evidence and later delivery gates.

## Objective and boundary

Fix the five delivery-path findings from the review of PR #8 at `4937c727c2d51d1ca2f819abc8812eae470b7de0`. Deliver a reviewable local diff with a usable runbook and focused regression evidence. Do not repeat the already implemented M7 feature work.

Read `AGENTS.md`, `docs/DECISIONS.md`, `docs/SCANNER_SPEC.md`, `docs/ACCEPTANCE.md`, the latest `docs/PROGRESS.md`, the review above, and `docs/M7_DELIVERY.md`. Inspect the actual branch, HEAD and working tree; do not reset the checkout or overwrite documentation/other work added after the review. Confirm whether each finding still exists. Record the actual base and scope in PROGRESS.md when implementation starts.

Use English in code/UI/docs and Vietnamese for the final handoff. Do not spawn subagents. Preserve ruleset/schema/canonical hashes, locked golden fixtures, current compiler/Cancun profile, one lockfile, browser signing and the local/Fuji wallet/receipt guards.

This prompt authorizes only local fixes and isolated tests. Do not push/merge, create/import/unlock a real keystore, obtain credentials, broadcast on Fuji, publish source or hosting, change repo visibility, or call a live AI provider. Use mocks or the existing account-free/impersonated Anvil harness. Never print a key/password, or add password arguments to runnable examples.

## Required changes

### 1. Make deployment read-back a trustworthy verification step (R1)

- In `scripts/fuji-deploy.sh`, validate the expected public deployment inputs before any RPC work. Require owner and attester for a verification result that claims to check those roles. A full-suite check must also have the six deployed addresses and effective initial-holder/supply values needed for its claims.
- Keep the implementation small: explicit arguments/environment variables or a minimal public deployment record are sufficient. Avoid a new deployment framework.
- Check registry identity, expected owner, authorized attester, required nonempty code, expected token owners/supply and the proxy's exact implementation address. Validate initial holder balance at initial deployment where that is an asserted invariant; distinguish later legitimate token-state changes from identity checks.
- Assign each RPC result separately and propagate failure before printing it. Do not nest required reads inside successful `echo` commands. Missing, malformed or failed reads are unavailable/failure, never a verified result.
- Return nonzero for wrong owner, unauthorized attester, wrong proxy implementation, missing code, failed calls or invalid required input. If a registry-only inspection mode is retained, name/output it clearly and never call it a full-suite pass.
- Use one explicit snapshot for the verification reads and recheck the header if claiming a coherent deployment-state result. Exclude an uncontrolled latest-read mixture from the evidence record.
- Add bounded shell/RPC regressions for a valid case and one-property mutations: wrong owner, false attester, wrong implementation, empty code, RPC error and omitted input. Include the observed failing `totalSupply()`-inside-`echo` case. Test both the exit code and which invariant failed. Do not use real network endpoints.

### 2. Repair the encrypted-keystore workflow (R2 and R3)

- Recheck installed `cast`/`forge` version and relevant `--help` output. The reviewed version is 1.9.0; do not assume another version's flags.
- Replace the invalid `cast wallet new ... --unsafe-password` example with named encrypted-keystore creation that prompts invisibly on the user's machine. Do not execute wallet creation/import as part of this task.
- Choose and document unambiguous account-name versus path semantics. Either support a separate `--account` forwarded to Forge, or require an explicit keystore path and resolve it before `cd packages/contracts`. Remove the misleading `name-or-path` promise if not implemented.
- Reject ambiguous/conflicting signer options and absent required selection. Keep simulation as the default, with no signer/key access. Keep broadcast an explicit user-run option.
- Test argument forwarding using temporary stub executables; confirm dry-run never receives `--broadcast` or signer-unlock options. No real keystore is needed for these checks.

### 3. Make the documented Linux entry point runnable (R4)

- Prefer consistent `bash scripts/fuji-deploy.sh ...` examples if the script remains non-executable, or intentionally deliver its executable Git mode if permitted.
- Check every relevant delivery/prompt/README invocation. Test `--help` from a Git export or fresh Linux checkout, so Windows mount permissions do not hide the problem.

### 4. Make verification inputs reproduce deployment inputs (R5)

- Carry the effective `INITIAL_HOLDER` into baseline, mint/pause and proxy-initializer argument encoding; preserve owner-as-default only when the holder was not supplied.
- Use consistent public variable names across deployment, read-back and explorer commands, including the implementation address. Explicitly show how the user records/fills those values from actual deployment output.
- Validate the constructor/initializer encodings offline with both owner-equals-holder and owner-differs-from-holder inputs. Preserve compiler/build-info data needed to reproduce the deployed bytecode.
- Recheck the chosen explorer's current official verification guidance; document provider/endpoint/key requirements without creating an account/key or submitting source. A documented command is not a verified explorer result.

## Documentation and acceptance

Update `docs/M7_DELIVERY.md`, the review finding status, `docs/PLAN.md`, `README.md` and `docs/PROGRESS.md` as needed. Preserve historical check records. Keep all real Fuji address/hash/link entries pending until actually observed. Align hosting instructions with the repository's Node 24/pnpm pins; a provider choice remains proposed until selected. Describe the decoy as selector constants without supported dispatcher evidence, not proof that matching functions are harmless.

Run focused deployment regressions first and demonstrate that the new negative cases expose the old behavior. Then run checks appropriate to the changed files; for the final M7 handoff use:

```powershell
pnpm typecheck
pnpm lint
pnpm test
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && ~/.foundry/bin/forge fmt --check && ~/.foundry/bin/forge build --build-info && ~/.foundry/bin/forge test -vv'
node scripts/verify-registry-identity.mjs
pnpm test:integration
pnpm build
pnpm test:browser
git diff --check
```

Also run `bash -n` on any changed shell scripts and the new focused shell/RPC checks. Build contract artifacts before integration tests and the web app before browser tests. Run integration and browser suites sequentially because they share a port. Use existing dependencies; install only if needed with the frozen lockfile. Report commands actually executed, counts, warnings and skipped tests separately; prior green CI is baseline evidence only.

## Stop and hand off

Return a local diff and a Vietnamese summary: which R1-R5 findings were resolved, commands/results, remaining limitations and the concrete next public-delivery inputs. Do not mark M7 delivered after these local checks. The next decision is maintainer review/merge followed by an explicitly authorized Fuji deployment and hosting session using public addresses, user-operated wallet credentials and the corrected runbook.
