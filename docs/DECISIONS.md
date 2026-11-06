# Decisions and outstanding questions

Updated 2026-11-06, Vietnam time. User-approved v2 merge takes precedence over older recommendations.

## Confirmed by the user

| Decision | Status and provenance |
| --- | --- |
| Product direction | AI agents and security; SnowPass is reference only. Confirmed in this chat. |
| Scan target | Contract/token addresses, stability and verifiability first. Confirmed in personal Claude chat and narrowed here to ERC-20. |
| Network | Fuji only for MVP. Confirmed in this chat. |
| Publisher | Authorized attesters only. Confirmed in this chat. |
| AI role | Explain deterministic results, with graceful fallback. Confirmed in this chat. No autonomous investigation. |
| UI language | English first. Confirmed in personal Claude chat. |
| Team | Two people, no existing code or running prototype. Confirmed in this chat. |
| Immediate work | Prepare folders, instructions and initialization prompts for Codex/Antigravity. |
| Working title and tools | AvaGuard; ChatGPT Plus and Codex are primary. Antigravity instructions remain portable. |
| Publication and deployment | Injected attester wallet signs publish; server never signs transactions. Foundry keystore for user-run deployment. |
| Claims and scoring | Signal score, confidence and coverage; approved weights and golden scores in SCANNER_SPEC.md and ACCEPTANCE.md. |
| Historical state | Replay at original B, never silently latest. Probe succeeded at four sampled blocks on Nov 6; not a service guarantee. See RPC_HISTORY_CHECK.md. |

## Recommended defaults requiring validation

- Next.js with TypeScript for the web and server routes; viem for chain reads; a minimal wallet connector for publication.
- Deterministic analyzer as a separate TypeScript package to make unit testing independent of the UI and model provider.
- Foundry Solidity registry and fixture tests; discover local/WSL availability in M0, and report blockers before changing toolchain.
- No database in MVP. Export/import canonical report JSON and keep approved demo reports as versioned fixtures. Missing body and unavailable replay have explicit UI states; general hosted report retention is not promised.
- Delay AI credentials until the deterministic flow works. The personal Claude chat accepted Gemini with fallback; provider/model/free availability is not verified here. Do not silently switch to a different provider.
- The user approved formula/weights in SCANNER_SPEC.md. Their semantic validity is evaluated with negative controls, not inferred from fixed score tests.
- Resolve direct ERC-1967, beacon and standard ERC-1167; exact minimal-proxy parser coverage only initially. Custom, nested and other unsupported layouts remain coverage gaps. Empty slots do not establish not-a-proxy.

## Open before implementation of the affected behavior

1. Check Foundry/WSL and package compatibility in M0; name final versions before installation.
2. Confirm member roles and whether daily availability is per person or total.
3. Validate that tested Solidity fixture builds exhibit the supported dispatcher pattern. If a golden case differs, report evidence rather than silently editing expected scores.
4. Verify historical availability for the actual report/target at replay time; select optional archive infrastructure only if needed and authorized.

## M0 discovery record — 2026-11-06

- Observed: Windows Node 24.19.0, pnpm 12.4.2, Git 2.51.1.windows.1; Ubuntu 26.04 on WSL2 is available. Foundry is absent from checked WSL PATH/default binary directory and Windows PATH. See ENVIRONMENT.md for commands, limitations and primary sources.
- Proposed M1 execution split: existing Windows Node/pnpm for web/analyzer, Ubuntu WSL for Foundry. Pin packageManager to pnpm@12.4.2 and use one root lockfile when M1 is authorized. This is a discovery recommendation, not an installation performed or a new user confirmation.
- Use explicit Cancun EVM target following current Avalanche guidance; keep identical compiler/optimizer/EVM settings in build-info for eventual source verification. Exact Foundry/Solidity and dependency patches must be resolved and recorded before installation. No unobserved version is declared installed or compatible.
- Reviewed the existing four successful historical RPC samples; did not run a new probe. Per-request historical-state checks and archive-unavailable UI remain mandatory.
- M0 is complete with Foundry setup and final version resolution identified as M1 prerequisites. No AI provider/model selected. The concrete minimal scaffold and exact proposed checks are in ENVIRONMENT.md; M1 has not started.

## Deferred scope (unchanged)

Transaction interception/simulation, browser extension, automated trading, wallet custody, arbitrary chain scanning, cross-chain messaging, own L1, community voting, ML-based scam verdicts and autonomous LLM tool planning.

The AI agents and security event category does not itself require an autonomous agent. Describe the MVP honestly as AI-assisted analysis. If autonomy is added later, reopen scope and threat modeling.
