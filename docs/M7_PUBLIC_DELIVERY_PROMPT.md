# M7 continuation prompt: merged preparation to public delivery

Use this prompt after PR #8. The earlier M7 preparation and PR #8 fix prompts are historical. Read actual repository/CI state and the November 16 G1 evidence before continuing.

Copy the block below into Codex or Antigravity. It starts with local preparation and read-only checks. Merely pasting it does not authorize signing, public deployment, source upload, hosting publication or submission.

```text
Continue AvaGuard M7 using docs/M7_EXECUTION_PLAN.md.

Read AGENTS.md, docs/DECISIONS.md, docs/SCANNER_SPEC.md,
docs/ACCEPTANCE.md, docs/PROGRESS.md, docs/M7_EXECUTION_PLAN.md,
docs/M7_DELIVERY.md and docs/DEMO_SCRIPT.md first.

Discuss with the user in Vietnamese. Use English for code and project docs.
Do not spawn agents. Preserve unrelated work and existing project architecture.

Known baseline, to recheck:
- PR #8 is merged at c7bd311cfb8d0253dedec9719c2d50a542963792.
- Final PR head was b994134ba49cf34a179028c23cff3b9ae73117c7.
- Post-merge CI run 43709090662 passed both jobs.
- R1-R5 are closed. Do not repeat the original fix task or the PR merge.
- G0 continuation refreshed origin/main and created codex/m7-public-delivery
  at c7bd311, preserving all 11 existing documentation files byte-for-byte.
  See docs/releases/m7-fuji/README.md for current technical evidence.
  Execution source/artifact hashes were frozen for G2; documentation remains
  uncommitted and the working tree is not claimed clean.
- G2 completed on November 16 under explicit user authorization and local
  user-operated keystore signing: six deployed Fuji contracts, one attester
  authorization, seven successful receipts and strict full initial-state
  readback at block 61141800. Exact hashes/addresses are in
  docs/releases/m7-fuji/g2-deployment-2026-11-16.json and
  docs/releases/m7-fuji/g2-initial-readback-2026-11-16.json.
  Do not rerun deployment. Owner nonce is now 7 at the post-receipt snapshot.
  Source verification, browser report publication, hosting, report bundle
  and media remain pending.
- The user confirmed no existing hosting/domain and requested a recommendation.
  The plan now recommends Vercel Hobby with its assigned *.vercel.app domain
  for an eligible personal/non-commercial demo, targeting USD 0 within included
  usage. Account selection/creation and public deployment remain pending.
- The user reported both testnet wallets set up and supplied public addresses.
  November 16 funded G1 refresh passed: six creations, one attester authorization,
  4,858,094 estimated gas, no signer/broadcast/receipts. Owner had 0.1 AVAX,
  nonce 0; attester had 0.39999999999664 AVAX, nonce 1. All six predicted
  contract addresses still had empty code in the funded postflight RPC check.
  Public roles and JSON evidence are in docs/releases/m7-fuji/README.md.
  docs/releases/m7-fuji/G2_HANDOFF.md is now the completed execution record.
  The user confirmed a local cast wallet address --account fuji-deployer
  returned the supplied owner. Password entry remained user-operated. Funding and
  signer-address checks are complete; do not repeat them without a state change.
  Do not recreate or unlock wallets automatically, or repeat the full later-phase
  input form. The later G2 session completed signing and strict readback;
  do not repeat the historical nonce-zero simulation/broadcast as a new task.

G2 authorization has been fulfilled. Further work defaults to preparation and
read-only verification. First inspect
the conversation for any later, explicit authorization and retain its scope;
do not ask again for an action already authorized. Never infer permission to
broadcast, create credentials/accounts, buy services, publish source/hosting,
push repository changes or submit the entry from a planning request.

Routine git fetch, non-destructive local branch preparation and read-only
Fuji RPC checks are included in preparation. Do not stop to ask permission
for each of these; use the tool's approval mechanism if the environment needs
it. Continue independent work when wallet addresses are missing.

Preserve completed G0/G1/G2 work; complete only missing or stale checks:
1. Inspect git status and current refs. Preserve the planning diff before
   synchronizing to merged main; never reset or discard it. Record the exact
   selected source SHA and CI evidence. Create codex/m7-public-delivery only
   if a new follow-up branch is needed.
2. Inspect pinned toolchain and build artifacts; run the registry identity
   check. If artifacts are missing, rebuild using the existing compiler
   profile. Reuse passing CI evidence; do not rerun the whole suite for prose.
3. Reuse the supplied owner/attester addresses and owner-as-holder default
   recorded in the G2 handoff unless the user changes them. Hosting account/domain, signing
   operator details, verifier choice and event reconfirmation belong to later
   gates; do not require them before a no-signer simulation. Record confirmed
   inputs separately from proposals. If the user still has no wallets, use
   docs/M7_WALLET_SETUP.md and finish all independent preparation.
4. Prepare a public evidence record with pending fields. Do not invent a
   deployment address, hash, scan latency, source status or hosted URL.
5. Reuse the completed G1 and on-chain G2 evidence. No new deployment simulation
   or broadcast is needed for G3/G4. Read-only checks may confirm the existing
   deployment; retain its strict initial-state readback snapshot as evidence.
6. Resolve verifier endpoint and host build settings from current official
   documentation. Builder Hub and Routescan are different providers. Verify
   exact Node/pnpm selection and server-action execution budget for hosting.
7. Prepare source-verification/hosting handoffs using the actual receipt-derived
   addresses, frozen build-info and effective INITIAL_HOLDER. Do not substitute
   predictions or redeploy the completed suite to fill a missing document field.

If further public execution is separately authorized, continue G3-G6 in order
using the completed G2 deployment. The safeguards below also apply to any
separately requested corrective deployment; do not infer a redeployment request:
- User controls the encrypted Foundry deployer keystore and local password
  prompt. No raw keys, passwords, recovery phrases or secrets in chat/logs/env
  files. Browser attester signs publications; the server never signs.
- Record every real deployment/authorization receipt and all six addresses.
  Run full initial-state --readback before token state changes. Registry-only
  checks and --allow-post-deploy-state do not replace initial readback.
- Source-verify all six using the same build-info and INITIAL_HOLDER-aware
  constructor/initializer arguments. Record provider-specific source links.
- Deploy the selected HTTPS host using the reviewed source, server-only Fuji
  configuration and exact production origin. Preview publication stays off.
- Exercise the real injected wallet and independent lookup/import/replay.
  Publish four showcase report commitments and distribute their canonical
  JSON only within authorized scope. Retain actual publication hashes.
- Keep Template explanation truthful: live Gemini is not implemented.
  Do not add a provider, database, chain or new scoring rule to this scope.
- Original-block replay never falls back to latest. Record unavailable state
  explicitly. Local scores and CI mocks are not live Fuji evidence.
- Recheck organizer requirements, prepare video/slides/links, and leave
  submission pending until it is actually authorized and confirmed.

On failure, use the recovery table in the plan. Do not blindly rerun an
interrupted deployment or submit a duplicate report after a receipt timeout.
Prepare the safe recovery action and evidence before requesting any additional
permission. Finish independent work while inputs are missing.

Update docs/PROGRESS.md and the delivery/evidence record with actual commands,
results and remaining gaps. Run checks appropriate to changed behavior; use
the existing full CI suite for a changed release candidate. Report separately:
completed local checks, completed public actions, untested assumptions and
remaining user decisions. Stop at the authorized gate.
```

Current G1 public inputs, supplied November 16 (owner default for holder):

```text
OWNER_ADDRESS=0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1
ATTESTER_ADDRESS=0xc6f32290379CA39273306e3758aB0a2b813ce3eB
INITIAL_HOLDER=0xC9AA1b7E3773Fe270da206DE551bbBe7FCE34fD1
```

Later public-execution fields; these do not block G0 or G1 simulation:

```text
Requested gate(s):
Release source SHA / CI URL:
Wallet / human signing operator:
Hosting provider / existing account / approved cost limit:
Stable HTTPS origin, if assigned:
Fuji verifier / confirmed endpoint:
Event deadline and required submission fields, if reconfirmed:
External actions explicitly authorized in this session:
```
