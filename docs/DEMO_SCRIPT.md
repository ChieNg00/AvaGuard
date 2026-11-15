# AvaGuard 2–3 Minute Demo Script & Slide Outline

Target runtime: **2m 30s** (max 3m 00s). Show observed behavior strictly as risk signals + snapshot evidence — never describe a `0 / 100` score as a safety guarantee or audit.

This is a recording template. Scores below are observed local Anvil references; replace or confirm them with actual Fuji evidence before narration. Public source, app, report and media links remain pending. Follow [M7_EXECUTION_PLAN.md](M7_EXECUTION_PLAN.md) and reconfirm the event's media limit before recording.

## 1. Timed Recording Script (6 Beats)

### Beat 1 — Snapshot-Bound Scan & Honest Banding (~25s)
- **Screen**: Open `/` (`Avalanche Fuji · 43113` or `Local Anvil · 43113`). Paste `DemoMintPauseToken` (`AGMP`) and click **Scan contract**.
- **Narration**: *"AvaGuard scans ERC-20 bytecode and state on a single pinned block header — chain 43113, exact block number, and block hash — so reads cannot tear across blocks. Notice `DemoMintPauseToken` scores `45 / 100 · Some signals`, with explicit coverage next to the score."*

### Beat 2 — Evidence-Bound Explanation & Contrast Cases (~35s)
- **Screen**: Point to the findings (`R-MINT`, `R-OWNER-EOA`, `R-PAUSE`, `R-SOURCE-UNKNOWN`) and their evidence IDs. Quickly scan `DemoBaselineToken` (`0 / 100 · Few signals`) and `DecoyConstantToken` (`0 / 100 · Few signals`), then scan `DemoTokenProxy` (`AGUP`, `60 / 100 · Many signals · erc1967`).
- **Narration**: *"Every finding cites concrete evidence IDs rather than raw guesses. An ordinary token (`DemoBaselineToken`) scores `0`, and a decoy contract (`DecoyConstantToken`) with selector constant bytes (`mint(address,uint256)`) and no supported dispatcher evidence also stays `0 / 100 · Few signals` (absence of dispatcher signals is not proof that matching functions are harmless), while `DemoTokenProxy` resolves its ERC-1967 implementation slot and reaches `60 / 100 · Many signals`."*

### Beat 3 — Wallet Network Guard & Authorized Attester Publication (~35s)
- **Screen**: Export canonical JSON (`Export canonical JSON`), then click **Check wallet** on a non-Fuji chain (`0x1`) -> show **Switch wallet to 43113** button -> click it explicitly -> click **Check wallet** with authorized attester -> click **Publish** and show confirmed tx hash.
- **Narration**: *"The server never holds private keys or sends transactions. Publication uses the attester's injected browser wallet, refuses wrong networks unless explicitly switched to 43113, and verifies authorized attester status plus exact `RiskRegistry` runtime bytecode before submitting the compact commitment."*

### Beat 4 — `/lookup` & Canonical JSON Commitment Check (~25s)
- **Screen**: Open `/lookup`, paste the published token address, click **Find latest**. Note `"Report body unavailable."`, then import the exported canonical JSON file.
- **Narration**: *"`RiskRegistry` keeps only a compact commitment and block snapshot on-chain — zero server database required. Importing the canonical JSON recomputes `keccak256` locally and proves the body agrees field-for-field with the on-chain commitment."*

### Beat 5 — Independent Original-Block Replay & Current-State Comparison (~20s)
- **Screen**: Click **Replay original block**, highlight `Original-block replay: replay-matches`, and click **Scan current state**.
- **Narration**: *"Any verifier can click **Replay original block** to re-run deterministic reads read-only against the exact block recorded on-chain, or compare against current chain state while flagging code changes."*

### Beat 6 — Wrap-Up & Boundaries (~10s)
- **Screen**: Briefly highlight coverage panel and README/runbook link.
- **Narration**: *"AvaGuard reports reproducible bytecode and snapshot evidence with explicit unknowns — turning raw Avalanche contract state into verifiable signals rather than uncheckable claims."*

## 2. Live / Recording Fallback Routes (Fail-Closed Behavior)

Use these prepared explanations if a real network condition occurs during a live demo, and describe them as explicit failure handling:

1. **Historical state pruned (`historical-state-unavailable`)**: Do **not** switch to `latest` or claim the published report is invalid. Point directly to the UI message showing that historical archival state for block `B` is unavailable on this RPC endpoint.
2. **Missing canonical JSON (`Report body unavailable.`)**: Show that `/lookup` displays only the on-chain summary tuple and keeps replay disabled until a byte-exact matching JSON is imported — never guessing missing evidence.
3. **RPC failure or rate limit during scan**: AvaGuard renders `inconclusive` with no numeric score, never misreporting a transport failure as a contract revert or low risk.
4. **AI provider disabled or rejected**: AvaGuard shows the labeled `Template explanation` badge bound only to deterministic evidence IDs.

## 3. Concise Presentation Outline (5 Slides)

1. **Problem**: Token checks can mislead users when they mix blocks, treat isolated selector constants as confirmed privileged functions, or present summaries without verifiable snapshot provenance.
2. **Architecture**: Deterministic `@avaguard/analyzer` (pinned single-block collector + ERC-1967/beacon/minimal-proxy resolution + ruleset `v1`) -> `RiskRegistry` on Avalanche (`43113`) -> Next.js web app + client wallet signing.
3. **Showcase Contracts**: Four deployed demo targets (`0`, `45`, `60`, `0` decoy) demonstrating coverage, proxy resolution, and selector-constant false-positive resistance (while distinguishing lack of dispatcher evidence from safety proof).
4. **Trust Boundaries**: Zero server keys, config fail-closed (`local` vs `fuji`), `registryRuntimeHash` pinning, canonical JSON `keccak256` commitment, and AI constrained to validated evidence IDs.
5. **Verification & Next Steps**: Automated unit/Foundry/Anvil/Playwright suite + reproducible Foundry deployment & verification runbook (`docs/M7_DELIVERY.md`).

## 4. Pre-Recording & Submission Checklist

- [ ] Hosted HTTPS URL (`AVAGUARD_ENV=fuji`) verified live (`not recorded`).
- [ ] All 6 contracts (`RiskRegistry`, 4 demo contracts + implementation) deployed on Fuji (`43113`) with accessible verified source on the selected provider (`not deployed`).
- [ ] Canonical JSON bundles exported from Fuji scans and attached cleanly (`not recorded`).
- [ ] Video walkthrough (`2–3m`, clear 1080p audio/captions) uploaded and linked (`not recorded`).
- [ ] Slide deck exported and linked (`not recorded`).
