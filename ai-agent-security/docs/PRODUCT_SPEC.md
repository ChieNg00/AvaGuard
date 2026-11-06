# AvaGuard product specification

Updated 2026-11-06. Working title: AvaGuard. SCANNER_SPEC.md is the normative v2 analysis/hash specification; consult DECISIONS.md for remaining setup decisions.

## Problem and intended user

An Avalanche builder or token user wants to understand observable administrative capabilities and analysis gaps before interacting with an ERC-20 contract. The product presents evidence and a readable explanation. It does not certify safety or replace an audit.

## Main flow

1. Enter a contract address on a Fuji-only scan page. A wallet is not required to read or scan.
2. Validate the address, network and deployed bytecode. Select a reproducible block snapshot.
3. Collect chain evidence and supported proxy information. Source verification is explicitly not checked in MVP.
4. Run versioned deterministic rules. Display risk signals, signal score, confidence and coverage together before optional AI explanation. Inconclusive scans have no score.
5. Explain using AI when configured, otherwise use clearly labeled templates. The evidence report is identical in either mode.
6. An authorized attester signs publication in an injected browser wallet. Server code never signs or sends transactions or holds wallet private keys.
7. Lookup offers Verify report at the original block and Scan current state with a semantic diff. Unavailable historical state never falls back silently to latest.

## Initial evidence model

- Read code and supported state at the same block. Record block number/hash and detect an unavailable or changed snapshot rather than silently mixing blocks.
- ERC-20 reads such as decimals, symbol and totalSupply can support identification, but missing or deceptive responses do not establish compliance or safety.
- owner(), paused() and similar optional methods provide specific observations only. A zero owner does not rule out role-based or other control.
- Selector evidence requires the disassembled dispatcher pattern in SCANNER_SPEC.md. It indicates possible capability; access control of privileged functions is not evaluated.
- Source verification is not checked and has zero weight. If later implemented, distinguish verified, explicitly unverified and provider unavailable.
- Resolve direct ERC-1967, beacon and standard ERC-1167 patterns as specified in SCANNER_SPEC.md, including implementation/beacon hashes. ERC-1167 initially has parser-only test coverage. It is not inherently upgradeable.
- Capability presence such as minting, pausing or upgradeability is not by itself proof of malicious intent. Findings must describe the actual evidence and control conditions.

## Proposed report contract

The implementation must formalize this schema and canonical serialization before publication:

- schemaVersion, rulesetVersion, chainId, targetAddress.
- blockNumber, blockHash, observedAt, targetCodeHash.
- proxy resolution status, implementationAddress and implementationCodeHash when supported; null when unknown or not applicable, with explicit reason.
- evidence[] with stable IDs, method/source, block reference, bounded raw result and interpretation.
- findings[] with rule ID, severity or informational status, evidence IDs, confidence and explanation template.
- coverage object with checked, notChecked, unavailable and notApplicable lists with stable IDs/reasons, as defined in SCANNER_SPEC.md.
- signalScore and band as defined in SCANNER_SPEC.md. Bands are Few signals, Some signals and Many signals. Unknown required data makes the result inconclusive; no score is returned.
- reportHash computed from the canonical deterministic payload. Optional AI text is stored separately with provenance and is not allowed to mutate this payload.

## Registry proposal

- Allowlisted attesters publish; the owner administers that list. Test both authorizations independently.
- Retain a historical record/event and distinguish the latest report from older snapshots.
- Use Ownable2Step with owner-managed attesters. Store score, codehash, implementation, reportHash, rulesetVersion, uint64 blockNumber, bytes32 blockHash, publication timestamp and attester. Publication events preserve historical data. Bind chainId and complete proxy/evidence data in the canonical report hash.
- Validate score <= 100, nonempty target, live target.codehash matching the supplied codehash and a snapshot not in the future. Snapshot hash, findings, proxy state and score remain attested; no on-chain historical blockhash check in MVP.
- A hash cannot retrieve a report. With no database in MVP, support canonical JSON export/import and approved versioned demo reports. Historical replay reconstructs only with the original ruleset and available state. Lookup says report body unavailable when appropriate; a full finding diff requires that body.
- A client freshness check compares supported current code/proxy/state evidence and time. Same bytecode does not imply same owner, fee or blacklist state. General dynamic-state safety is outside scope.
- Prefer isCodeStale for the registry's codehash-only view; false means only no target-code change detected, not report freshness. State/implementation comparison belongs to Scan current state.

## AI boundary

AI receives bounded validated findings, linked evidence, coverage and signalScore, never raw chain names/symbols/source text. Validate evidence references and reject invented findings. Template fallback covers missing key, quota, timeout, invalid output and provider outage. Suggested read-only checks remain unexecuted text. Cache by the exact canonical explain input plus promptVersion and model. Do not call fallback text AI-generated.

## Proposed layout after M1

    apps/web/                 Scan and lookup UI; server adapters
    packages/analyzer/        Evidence schema and deterministic checks
    packages/contracts/       Registry and local test contracts
    fixtures/                 Versioned synthetic reports and expectations
    docs/                     Requirements, decisions and progress

Do not create placeholder application code in M0. Create these directories only as M1 scaffolding needs them.

Use Next.js/TypeScript, viem, wagmi injected-only, zod/vitest/Tailwind and Foundry/OpenZeppelin. Preserve this existing layout rather than adding duplicate web/ and contracts/ roots from the example prompt. Pin compatible versions after discovery. Foundry/WSL availability is not yet established. Deployment uses user-run Foundry keystore commands; server env contains no wallet private keys. No RainbowKit, WalletConnect project ID or server database is needed for MVP.
