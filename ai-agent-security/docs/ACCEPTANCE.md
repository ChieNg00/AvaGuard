# Acceptance and evaluation

These are planned APPLICATION checks, not completed tests. Planning files and a read-only historical RPC probe exist; no scanner/registry/UI implementation has been tested. SCANNER_SPEC.md defines v2 behavior.

## Analyzer

### Locked score fixtures

Each fixture must expose only the stated weighted signals, with successful read probes unless failure is the purpose. Always include source/access-control/dispatcher/unsupported-proxy coverage limits.

| Fixture | Expected signalScore | Required signals |
| --- | --- | --- |
| CleanToken | 0 | No weighted signals, no owner interface |
| MintableToken | 35 | R-MINT 25 + R-OWNER-EOA 10 |
| BlacklistFeeToken | 45 | R-BLACKLIST 20 + R-FEE 15 + R-OWNER-EOA 10 |
| UpgradeableToken | 60 | Direct ERC-1967 proxy 25 + mint 25 + owner-no-code 10 |
| BeaconProxyToken | 60 | Beacon ERC-1967 proxy 25 + mint 25 + owner-no-code 10 |
| DecoyConstantToken | 0 | mint bytes4 constant without supported dispatch: no R-MINT |
| NoMetadataToken | 0 | totalSupply/balanceOf only; R-METADATA-ABSENT info, no R-NONSTANDARD |
| NotErc20Contract | 10 | Confirmed read-probe execution failure, R-NONSTANDARD once |
| RenouncedMintToken | 25 | R-MINT + R-OWNER-RENOUNCED info; no claim all privileges renounced |
| ContractOwnerToken | 25 | R-MINT + R-OWNER-CONTRACT info; no assumed multisig |

NoMetadataToken is a minimal read-probe fixture, not proof that those two functions satisfy the complete ERC-20 standard. Preserve scores; report conflicting compiler/fixture behavior instead of weakening tests. Pin compiler/optimizer settings so dispatcher tests are reproducible. These expectations verify the formula; negative controls evaluate interpretation.

### Additional negative controls and behavior

- Exact standard ERC-1167 bytecode parser unit tests: valid implementation extraction, wrong prefix/suffix/length, truncated PUSH, variants unsupported. Initial suite does not claim clone integration coverage.
- Raw selector inside PUSH payload, bare PUSH4 constant, EQ beyond the allowed window and control-flow boundary: no dispatcher evidence. Add a constant outside dispatch near EQ to document/reduce heuristic false positives.
- Transport timeouts/429/ambiguous errors: bounded retries at original B, then inconclusive with no partial score and no token-revert finding. Historical state missing is unavailable/inconclusive, never token behavior.
- Confirmed execution revert or malformed totalSupply/balanceOf: R-NONSTANDARD once. Optional metadata failures have weight zero. owner() failure has no penalty. RPC transport during optional metadata attempted as part of the scan still makes the required workflow inconclusive.
- Assert through mock transport that EVERY code/storage/call request, including beacon and owner code, uses B. Header mismatch or wrong chain invalidates completion.
- Same target/block/ruleset/configuration yields identical reportHash across runs and reordered collection results; changed confidence/coverage/evidence/implementation hash changes it. Publish time and AI text do not.
- Same target codehash with different owner, state, implementation or coverage never reuses a stale explanation. Test full-input cache, promptVersion and model-name separation.
- Replay original B matches the original report; current-state scan is a different action. Archive unavailable never falls back. New B changes reportHash even when semantic findings do not change.
- UI never uses safe or secure as score/band text and always displays coverage beside signal score, including zero. Inconclusive displays no numerical score.

- Reject malformed addresses. An EOA or empty-code address returns not-analyzable, without a reassuring risk score.
- A known ERC-20 fixture gives reproducible evidence, findings and canonical reportHash for the same snapshot and ruleset.
- Mint capability, pause capability and fee-control examples cite specific evidence. A matching selector without support remains an indicator or unknown.
- Include a negative-control contract with misleading selectors or reverting optional methods. The analyzer must not claim privileges it has not established.
- owner() missing, zero or reverting does not establish absence of admin powers.
- RPC failure and explorer timeout remain unavailable. An explicit unverified result is distinct from an unavailable response.
- A supported ERC-1967 implementation change invalidates the old freshness assessment. Unrecognized proxy patterns retain an explicit coverage limit.
- Same bytecode with changed owner/configuration must not reuse a stale state-dependent result. Cache keys include network, address, snapshot, ruleset and relevant dependencies.
- Scoring tests check intended rule behavior, not just that values match an arbitrary formula. Store the rationale with each fixture.

## AI and UI

- The scan and evidence report work with no AI credential.
- Timeout, rate limit, invalid JSON, invented evidence IDs and prompt-injection strings trigger a labeled fallback or rejection without changing the deterministic payload.
- AI explanation and template explanation have distinguishable provenance.
- Wallet connection is required for a wallet publication action, not for scanning.
- Errors, partial coverage, unsupported cases, historical snapshot and stale status are visible; never show an unconditional safe badge.

## Registry and retrieval

- Only owner-authorized attesters can publish. Unauthorized callers revert.
- Only the designated administrator can manage attesters. Removing an attester prevents future publication.
- Report history and latest pointer semantics are tested; replay/duplicate behavior is explicit.
- Different deterministic report bytes change reportHash. Retrieved content is checked against the commitment.
- Chain ID, subject, snapshot and ruleset are bound by the report and publication design.
- Test score bounds, wrong live codehash, no-code target, future snapshot, overwrite/latest and historical events, two-step ownership transfer and codehash-only stale semantics.
- Browser wallet signs publication; server routes never accept wallet private keys or send transactions. Revoked attesters fail even if UI had previously enabled publish.
- Registry snapshot hash/number and findings are attested, not independently validated by its codehash check. Verify report body hash/import separately from historical replay.

## End-to-end demo

Deploy only after separate user authorization. Use owned Fuji examples: ordinary ERC-20 baseline, controlled minting, pause or fee capability, and a supported upgradeable proxy. The baseline is a control, not a certified safe contract.

The 2-3 minute video shows one complete scan, evidence, explanation/fallback, authorized publication and lookup. Include one denied unauthorized publication or a clear analyzer negative control. Record measured latency and actual addresses only after running the demo.

Before submission: working app, repo and run instructions, verified registry source, accessible slides/video and report retrieval. Confirm each link is accessible to judges. Target submission before the official deadline of 2026-11-21 23:59 Vietnam time.
