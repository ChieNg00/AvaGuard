# M1 schema boundary and M2 evolution

The M1 reportSchema remains a scored foundation envelope for regression compatibility, not a canonical publication/import format. It has no rule engine or hashing. Evidence/findings are now typed with individual confidence and reference/snapshot checks. Empty findings and evidence are valid for this skeleton: aggregate confidence is no longer required. Score/band shape checks retained from M1 do not constitute score computation or scoring validation.

M2 adds a separate collectionSchema and collectEvidence API; see M2_EVIDENCE.md. Every collection is explicitly not publishable, has no numeric score/band, and can have no findings. It uses snapshot=null for errors before a valid snapshot exists, rather than supplying fake block data. This is the result type to use for M2, not the legacy reportSchema.

Version fields remain 1 before any published report exists. Finalize the full deterministic report body and canonical vector in M3 before publication. chainId and blockNumber are decimal strings; addresses/hashes are lowercase. No UI/server publication gate should rely on the M1 envelope. SCANNER_SPEC.md remains normative.

The M1 JSON fixture is synthetic, not a Fuji observation. Existing schema/status/band boundary regressions remain, with aggregate-confidence tests updated to the user-requested per-evidence/per-finding model. They do not validate risk interpretation or any approved golden scoring case.
