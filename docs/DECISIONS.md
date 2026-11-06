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

## Explicitly deferred

Transaction interception/simulation, browser extension, automated trading, wallet custody, arbitrary chain scanning, cross-chain messaging, own L1, community voting, ML-based scam verdicts and autonomous LLM tool planning.

The AI agents and security event category does not itself require an autonomous agent. Describe the MVP honestly as AI-assisted analysis. If autonomy is added later, reopen scope and threat modeling.
