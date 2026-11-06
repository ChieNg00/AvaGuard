# Initialization prompt

You are working on AvaGuard (working title), a two-person Team1 Vietnam UniHack 2026 project: evidence-based ERC-20 risk signals on Avalanche Fuji C-Chain. First read AGENTS.md, README.md, docs/DECISIONS.md, docs/PRODUCT_SPEC.md, docs/SCANNER_SPEC.md, docs/THREAT_MODEL.md, docs/ACCEPTANCE.md and docs/PLAN.md. Apply them as project context alongside the user's current instructions. Consult docs/SOURCES.md for provenance.

SnowPass is an organizer/reference example, not this product. The MVP is AI-assisted analysis, not an autonomous agent. English UI and project files; explain progress to the user in Vietnamese if they are speaking Vietnamese.

## Confirmed product boundary

Scan ERC-20 addresses on Fuji only. Deterministic rules produce evidence and findings; AI only explains those findings with labeled template fallback. Publish through an allowlisted injected browser wallet, never a server signer. Deploy using a user-run Foundry keystore. Use wagmi injected-only, no RainbowKit. Prioritize reproducible analysis. Do not add transaction simulation, mainnet, a custom L1, trading or autonomous tools.

## Select the requested milestone

If the user only says to initialize or run this prompt, execute M0 only. If the user explicitly requests M1, use observed M0 results and perform M1. This prompt does not authorize M2-M7, deployment, publication or account/credential setup.

## M0 Discovery and decisions

1. Inspect the existing folder and applicable instructions. Preserve unrelated files. This repository starts with planning files and no application code.
2. Check actual Node, package-manager, Git and Solidity tool availability without printing secrets. Inspect existing configuration only when relevant. Never dump environment variables or credential files.
3. Check current official Avalanche guidance for Fuji chain parameters, supported EVM target, local contract tooling and source verification. Check official package documentation for compatibility of the proposed web stack. Record exact sources and observations; do not trust obsolete claims in a transcript.
4. Verify the agreed Foundry/WSL and pnpm/Next.js toolchain. Do not assume WSL exists or silently install an alternative. Read docs/RPC_HISTORY_CHECK.md and inspect actual historical-read probe results; recheck availability for new targets/snapshots when needed. Do not interpret one probe as an archive-service guarantee.
5. Record findings in docs/ENVIRONMENT.md and material choices in docs/DECISIONS.md. Mark observations versus recommendations. Create docs/PROGRESS.md with commands actually run and their results.
6. Describe the smallest M1 scaffold and exact verification commands. Identify only blocking decisions. Preserve approved weights and golden scores in SCANNER_SPEC.md/ACCEPTANCE.md; do not select an AI provider/model silently. Include same-block consistency, transport-versus-execution errors and archive-unavailable UI in the plan.
7. Stop after discovery. No package installation, application source, external calls to an AI provider, Git initialization, commits or deployments during M0.

M0 completion: tool availability and blockers are observed, current network/tool assumptions have sources or explicit uncertainty, and a concrete M1 scaffold plan is reviewable.

## M1 Foundation, only when requested

1. Use the agreed toolchain. Scaffold apps/web, packages/analyzer, packages/contracts and fixtures only as needed. Keep one workspace lockfile. Pin compatible versions; avoid unrelated dependencies and agent frameworks.
2. Create the English scan/lookup shell and a versioned report-schema skeleton. Mark fixture content clearly; do not show invented live scan results or fake on-chain publication.
3. Configure local/test use and ignore secrets. An example environment file must contain placeholders only. Do not create secrets or require an AI API key for the scaffold. Keep provider integration deferred.
4. Add the minimal local contract development scaffold without implementing the full registry or deploying it.
5. Run the exact supported type/build checks and meaningful workspace smoke checks. Report skipped checks and why. Resolve scaffold failures before marking completion.
6. Update README with commands actually verified and PROGRESS with results. Summarize changed files, important decisions and the next milestone. Stop at M1.

## Non-negotiable correctness

- No function-name-only scam verdicts, raw byte opcode matching, codehash-only state cache, unconditional safe badge or fabricated successful checks.
- All required state reads share one B, with header/hash consistency checks. Required transport failure yields inconclusive with no score; execution revert remains separate. Unknown/unavailable/unsupported is distinct from absent or passed.
- No AI output can change evidence, severity, score or publication payloads.
- Do not silently implement a generic mutable registry without deciding canonical report hashing, authorized publisher identity, snapshot semantics and report retrieval first.
- Follow the defined canonical hash schema, export/import body model, exact-input explain cache, coverage and evidence-method confidence. Verify report and Scan current state are separate actions. Never label a low signal score safe or secure.

After M1, use docs/PHASE_PROMPTS.md for bounded implementation requests. Each phase stops and reports actual commands/results; documentation preparation alone is not authorization to execute those phases.

The submission deadline is Nov 21, 2026 at 23:59 Vietnam time. Optimize for a small working flow that the team understands and can demonstrate.
