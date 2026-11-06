# Scanner specification v2

Merged 2026-11-06. Ruleset remains version 1 because no implementation or published v1 report exists. schemaVersion and promptVersion are independent.

## Result and snapshot

- Status is complete, inconclusive or not-analyzable. The latter two have no signalScore/band and cannot publish a scored report.
- Fetch chain ID and block B (number/hash) first, latest for a new scan or explicitly requested historical B for replay. Pass blockNumber B to EVERY getCode/getStorageAt/eth_call, including owner code, proxy/beacon and metadata reads. Freeze the call sender/options in the versioned analyzer configuration; never use the connected wallet as the probe caller.
- Re-fetch the header before completion. Compare its hash to the selected snapshot and, for replay, the attested blockHash. Wrong network, mismatched/missing header or mixed block data is inconclusive. No consensus reorg recovery subsystem is needed; RPC consistency checks remain required.
- Classify transport/rate-limit errors, execution reverts, malformed ABI data, missing historical state and invalid protocol responses separately. Retry transient transport failures a bounded number of times at the SAME B. Exhaustion or ambiguity in a required read makes the entire scan inconclusive, without a partial score. Do not use one catch-all to create token findings.
- Excluded checks are not called and appear in coverage.notChecked. Diagnostic partial evidence is distinct from a complete publishable report.

## Dispatcher evidence

Disassemble with instruction offsets and skip PUSH data correctly. Require PUSH4 <selector> followed by EQ within the next two decoded opcodes in the SAME linear basic block; a DUP1 immediately before PUSH4 is allowed. A bare PUSH4 constant or raw byte match is not evidence. Handle truncated PUSH data explicitly.

This recognizes a Solidity-style dispatcher heuristic, not full reachability or control-flow proof. Nearby EQ is necessary, not sufficient proof of a callable or privileged function. Label dispatcher-match findings possible capability. Non-Solidity, custom/optimized dispatch layouts and privileged-function access control are not evaluated comprehensively. Absence of a match does not prove absence of a capability. Add negative controls for constants outside dispatch and disclose remaining false-positive limits.

Derive selectors from full signatures with viem. Never hardcode remembered selector hex.

## Proxy resolution

Resolve at B in order:

1. ERC-1967 implementation slot, computed as keccak256(utf8("eip1967.proxy.implementation")) minus 1 and encoded as 32 bytes.
2. If empty, beacon slot computed similarly from "eip1967.proxy.beacon"; call implementation() on that beacon at B.
3. If neither resolves, recognize the exact standard ERC-1167 runtime pattern and extract its implementation. Variants/vanity optimizations are unsupported initially.

Assert computed slots and fixture resolution in tests. Validate slot/address shape and nonempty implementation code. Record kind/status, implementation/address/hash, beacon/address/hash when relevant. Bound resolution depth and detect loops; nested/custom/contradictory resolution is an explicit gap, not a successful scan of empty code.

Extract dispatcher signals from implementation CODE, but call owner/totalSupply/etc. against TARGET state. Confidence: slot-read for slots, call-result for beacon call, bytecode-pattern for minimal-proxy recognition, with linked evidence for each step.

If disassembled target code contains DELEGATECALL without supported resolution, emit info R-PROXY-UNRESOLVED (0). Empty slots never establish not-a-proxy. Diamond, legacy unstructured and custom/nested proxies are not covered. ERC-1167 integration behavior has parser-only unit coverage initially. Standard ERC-1167 fixes the implementation address; do not equate its presence with upgradeability or give it R-PROXY points. R-PROXY v1 applies to supported ERC-1967 direct/beacon resolution.

## Findings and score

Every finding contains id, severity, weight, confidence, evidence IDs and a deterministic explanation template. Confidence describes evidence METHOD, not probability: dispatcher-match, slot-read, call-result, bytecode-pattern. Evidence records include bounded raw values, offsets/slots/call context and snapshot. Error/status evidence is distinct from a successful observation.

| Rule | Weight | Severity | Trigger and limited meaning |
| --- | --- | --- | --- |
| R-MINT | 25 | high | Dispatcher match: mint(address,uint256) or mint(uint256); possible entry point, authority/caps unknown |
| R-PROXY | 25 | high | Supported ERC-1967 direct/beacon resolution; delegation/configuration signal |
| R-BLACKLIST | 20 | high | Dispatcher match: blacklist(address), addToBlacklist(address), setBlacklist(address,bool) |
| R-FEE | 15 | medium | Dispatcher match: setFee(uint256), setTax(uint256), setTaxFee(uint256), setBuyFee(uint256), setSellFee(uint256) |
| R-PAUSE | 10 | medium | Dispatcher match: pause() |
| R-OWNER-EOA | 10 | medium | Nonzero owner() address with no deployed code at B; describe exactly that, not guaranteed EOA identity/control |
| R-NONSTANDARD | 10 | medium | Confirmed execution revert or malformed ABI result from either MVP read probe totalSupply() or balanceOf(address(0)); count once |
| R-METADATA-ABSENT | 0 | info | Optional name/symbol/decimals absent, execution-reverting or malformed; record which and why |
| R-OWNER-RENOUNCED | 0 | info | owner() returns zero; no proof that all control is renounced |
| R-OWNER-CONTRACT | 0 | info | owner address has code; multisig status unknown |
| R-SOURCE-UNKNOWN | 0 | info | Source verification not attempted in MVP |
| R-PROXY-UNRESOLVED | 0 | info | Disassembled DELEGATECALL without supported proxy resolution |

ERC-20 also requires other methods/events, including transfer, approve, transferFrom and allowance. totalSupply/balanceOf are the two required READ probes selected for this MVP, NOT a complete compliance test. name/symbol/decimals are optional. R-NONSTANDARD is an internal legacy rule ID; UI wording is "required read probe failed", never a blanket noncompliant/malicious verdict. Missing or reverting owner() is an optional unknown with no penalty.

signalScore = min(100, sum of unique finding weights). Bands: Few signals 0-24; Some signals 25-59; Many signals 60-100. Weights/severity are an approved heuristic convention, not calibrated exploit likelihood. Multiple selectors for one rule never multiply its weight. Golden scores test formula agreement only.

## Coverage

Use { checked: [], notChecked: [], unavailable: [], notApplicable: [] } with deterministically ordered entries, stable IDs and reasons. checked means completed as specified, not passed. Show coverage beside every score. Required read failures prevent a numeric score; they cannot become a zero-weight unknown in an otherwise scored scan.

Always declare source verification; privileged-function access control; tokenomics/liquidity/holder concentration; non-Solidity/custom dispatchers; unsupported proxy forms; and clone integration behavior as not checked. Add runtime gaps. Distinguish unsupported, not applicable, absent and provider unavailable.

## Report hashing

reportHash = keccak256(UTF-8 canonical JSON of schemaVersion, chainId, blockNumber, blockHash, address, codehash, proxy resolution including implementation/beacon code hashes, rulesetVersion, evidence, findings, coverage, signalScore). Include all deterministic finding fields: id/severity/weight/confidence/evidence references. Fixed caller/probe options are defined by the versioned ruleset.

Normalize addresses/hex lowercase; integers use decimal strings except bounded score/weight/version numbers. Use explicit nulls, recursively sorted keys, findings by ID, evidence by stable ID and coverage entries by ID. Reject duplicate IDs, invalid types, non-finite numbers and unsupported schema versions. Provide a canonical test vector. Exclude wall-clock scan time, duration, provider URLs, publish time and AI text. Identical snapshot/input/configuration must reproduce the same hash.

## AI and caches

Validate deterministic reports and construct explain input server-side: findings, linked evidence, coverage, signalScore, rulesetVersion. Never send arbitrary chain names/symbols/source strings to AI. Model output is schema/evidence-ID bound; reject invented/duplicate findings and use labeled template fallback. Suggested read-only checks remain text and never execute. AI cannot change score/reportHash.

Explanation cache key = keccak256(canonical JSON of EXACT full explain input) + promptVersion + model name. Keep provenance and prompt/model versions separate from reportHash. A scanner state cache, if added, uses chain/target/blockHash/ruleset/schema/configuration, never codehash alone. Bound request sizes, deadlines and retry counts.

## Verification versus fresh scan

Verify report requires original canonical body (JSON export/import, approved fixture, or reconstructed report), original ruleset, and historical state at stored B. Compare header hash and reportHash. Imported JSON hash equality is "commitment matches"; successful independent replay is "replay matches". Missing body, unavailable state or unsupported ruleset gets an explicit unavailable/inconclusive result. Never substitute latest.

Scan current state uses a new B. Diff score, added/removed findings, changed evidence/confidence/weight and target/implementation/beacon addresses/hashes. Since B is hashed, a new snapshot changes reportHash even with unchanged signals: use semantic comparison for freshness. Without an original body, show a limited on-chain summary/code comparison and mark the full diff unavailable.

Registry snapshot fields are attested data; there is no historical blockhash validation on-chain in MVP. The live target.codehash == codehash publication check does not validate implementation/state, access control, findings or score. Replay unavailability does not prove a report is false.
