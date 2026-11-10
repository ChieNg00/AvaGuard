# M1 schema boundary

reportSchema validates a foundation result envelope, not a full deterministic report or a publication/import format. It is deliberately incomplete: evidence/findings, proxy resolution, per-evidence snapshot binding, mandatory coverage IDs, canonical serialization/hash, caller configuration and complete-report publication eligibility are deferred to M2/M3. Do not use it as a trust boundary for report publication.

Version fields are reserved at 1; finalize the full schema and canonical vector before the first published report. chainId and blockNumber are canonical decimal strings; addresses/hashes must already be lowercase. The local input form normalizes user address input separately. Complete envelopes require score/band agreement and evidence-method confidence. Inconclusive/no-code envelopes use explicit null score and band, never zero. Coverage entry IDs are unique across categories. Historical-state/transport failures are separate from execution reverts; no scanner/error classifier is implemented here.

The synthetic JSON fixture contains no actual chain observations. Schema tests exercise structural/status boundaries; they do not validate scoring semantics or any approved golden contract case. SCANNER_SPEC.md remains normative.
