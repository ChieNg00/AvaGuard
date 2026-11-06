# AvaGuard ERC20 risk signals on Avalanche

Planning workspace for Team1 Vietnam UniHack 2026. AvaGuard is the working title.
Status: v2 documentation merged and sampled historical Fuji RPC reads verified. No scanner, registry or UI implementation, installed project dependencies, keys or deployments yet.

## Confirmed scope

- Two-person team; approximately three hours or more of availability per day. Whether that is per person remains to be clarified before assigning capacity.
- Scan ERC-20 contract addresses on Avalanche Fuji C-Chain only.
- Deterministic checks produce evidence and findings. AI explains them and cannot alter findings or scores.
- Only authorized attesters may publish report commitments to a registry.
- English interface first; a usable template report remains available when AI is disabled or fails.
- Prioritize stability and verifiable results. Transaction simulation, mainnet scanning and autonomous investigation are outside the first MVP.
- Submission deadline: 2026-11-21 23:59 Asia/Ho_Chi_Minh. Final Demo Day: 2026-11-30.

## Start here

1. Read `docs/PRODUCT_SPEC.md`, `docs/SCANNER_SPEC.md` and `docs/DECISIONS.md` together.
2. Read `docs/THREAT_MODEL.md` and `docs/ACCEPTANCE.md` before implementation.
3. Open this folder as the working project in Codex or Antigravity.
4. Ask the coding assistant: `Read AGENTS.md and INIT_PROMPT.md. Execute M0 only.`
5. Review the observed setup results and proposed choices before requesting M1.

Codex recognizes AGENTS.md as project guidance. For Antigravity, explicitly ask it to read the file; automatic discovery has not been verified. INIT_PROMPT.md is ordinary portable project text, not a claim about an IDE-specific configuration format.

## Files

- `AGENTS.md`: durable working instructions.
- `INIT_PROMPT.md`: English prompt for discovery and initial scaffold only.
- `docs/PRODUCT_SPEC.md`: behavior, architecture and proposed data contract.
- `docs/SCANNER_SPEC.md`: v2 snapshot, dispatcher/proxy rules, scoring, coverage and canonical hash specification.
- `docs/DECISIONS.md`: confirmed choices, recommendations and open questions.
- `docs/THREAT_MODEL.md`: trust boundaries and failure behavior.
- `docs/ACCEPTANCE.md`: observable acceptance cases and demo requirements.
- `docs/PLAN.md`: milestones and a tentative two-person schedule.
- `docs/SOURCES.md`: source provenance and facts requiring revalidation.
- `docs/PHASE_PROMPTS.md`: bounded implementation prompts after discovery/foundation.
- `docs/RPC_HISTORY_CHECK.md`: actual read-only RPC observations and their limits.

No runnable application commands exist yet. The infrastructure probe is scripts/probe_fuji_history.py; results are in docs/checks/. M0 still records tool availability and M1 establishes exact setup commands. Do not treat proposed folder names or technologies as installed software.
