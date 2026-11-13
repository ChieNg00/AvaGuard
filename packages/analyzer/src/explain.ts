import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import {
  confidenceSchema,
  decimalSchema,
  hashSchema,
  addressSchema,
} from "./evidence-schema";
import { dispatcherRules } from "./dispatcher";
import {
  byId,
  parseReportBody,
  reportHash,
  type DerivedEvidence,
  type ReportBody,
} from "./report-body";
import type { buildReport } from "./rules";

type Confidence = NonNullable<ReportBody["findings"][number]["confidence"]>;
type Coverage = ReportBody["coverage"];

export const EXPLAIN_PROMPT_VERSION = "1";
export const MAX_EXPLAIN_INPUT_BYTES = 16_384;
export const MAX_EXPLAIN_OUTPUT_BYTES = 8_192;
export const DEFAULT_EXPLAIN_REQUEST_TIMEOUT_MS = 2_500;
export const DEFAULT_EXPLAIN_DEADLINE_MS = 5_000;
export const DEFAULT_EXPLAIN_MAX_ATTEMPTS = 2;
export const DEFAULT_EXPLAIN_CACHE_SIZE = 64;

const encoder = new TextEncoder();
const ZERO_WORD = "0x" + "0".repeat(64);
const KNOWN_SIGNATURES = new Set<string>(
  dispatcherRules.flatMap((r) => [...r.signatures]),
);

type CheckTemplate = { readonly id: string; readonly text: string };
type RuleMeta = {
  readonly label: string;
  readonly suggestedChecks: readonly CheckTemplate[];
};

const RULE_METADATA: Record<string, RuleMeta> = {
  "R-MINT": {
    label: "Possible mint dispatcher entry point",
    suggestedChecks: [
      {
        id: "mint-authority",
        text: "Inspect verified source or contract ABI outside AvaGuard to check who can call mint and whether supply caps apply.",
      },
      {
        id: "mint-events",
        text: "Review historical Transfer events from the zero address on an explorer to observe past minting.",
      },
    ],
  },
  "R-PROXY": {
    label: "Supported ERC-1967 proxy resolution",
    suggestedChecks: [
      {
        id: "proxy-admin",
        text: "Inspect the ERC-1967 admin slot or owner contract to see how upgrades are authorized.",
      },
      {
        id: "impl-code",
        text: "Inspect the resolved implementation address and bytecode hash at this snapshot on an explorer.",
      },
    ],
  },
  "R-BLACKLIST": {
    label: "Possible blacklist dispatcher entry point",
    suggestedChecks: [
      {
        id: "blacklist-scope",
        text: "Check whether transfer and transferFrom enforce blacklist restrictions and who can update the list.",
      },
    ],
  },
  "R-FEE": {
    label: "Possible fee-setter dispatcher entry point",
    suggestedChecks: [
      {
        id: "fee-bounds",
        text: "Check whether fee-setting functions enforce maximum fee bounds or address exemptions.",
      },
    ],
  },
  "R-PAUSE": {
    label: "Possible pause dispatcher entry point",
    suggestedChecks: [
      {
        id: "pause-scope",
        text: "Check whether pause() restricts transfers and which role can pause or unpause.",
      },
    ],
  },
  "R-OWNER-EOA": {
    label: "Nonzero owner address without deployed bytecode",
    suggestedChecks: [
      {
        id: "owner-activity",
        text: "Inspect the owner address on an explorer for transaction history and verify whether privileged methods reference owner().",
      },
    ],
  },
  "R-NONSTANDARD": {
    label: "Required MVP read probe failed",
    suggestedChecks: [
      {
        id: "required-probes",
        text: "Verify totalSupply() and balanceOf(address(0)) behavior directly on an explorer.",
      },
    ],
  },
  "R-METADATA-ABSENT": {
    label: "Optional ERC-20 metadata unavailable",
    suggestedChecks: [
      {
        id: "optional-metadata",
        text: "Verify name(), symbol(), and decimals() directly if downstream display depends on optional metadata.",
      },
    ],
  },
  "R-OWNER-RENOUNCED": {
    label: "owner() returned the zero address",
    suggestedChecks: [
      {
        id: "other-roles",
        text: "Check for AccessControl roles, proxy admin slots, or custom controllers beyond owner().",
      },
    ],
  },
  "R-OWNER-CONTRACT": {
    label: "owner() address has deployed bytecode",
    suggestedChecks: [
      {
        id: "owner-contract-code",
        text: "Inspect the owner contract address to see whether it is a timelock, multisig, or custom contract.",
      },
    ],
  },
  "R-SOURCE-UNKNOWN": {
    label: "Source verification not attempted in MVP",
    suggestedChecks: [
      {
        id: "source-verification",
        text: "Check whether verified source code is published on an Avalanche Fuji explorer.",
      },
    ],
  },
  "R-PROXY-UNRESOLVED": {
    label: "DELEGATECALL observed without supported proxy resolution",
    suggestedChecks: [
      {
        id: "proxy-custom-layout",
        text: "Inspect verified source or bytecode manually for diamond, legacy, or custom delegatecall routing.",
      },
    ],
  },
};

export const KNOWN_RULE_IDS = Object.freeze(Object.keys(RULE_METADATA));

const TRUSTED_COVERAGE_LABELS: Record<string, string> = {
  "target-code": "Target runtime bytecode read at snapshot",
  "proxy-implementation-slot": "ERC-1967 implementation storage slot read",
  "proxy-beacon-slot": "ERC-1967 beacon storage slot read",
  "beacon-code": "Beacon contract bytecode read",
  "beacon-implementation": "Beacon implementation() view probe",
  "proxy-minimal-pattern": "Exact ERC-1167 runtime pattern check",
  "implementation-code": "Resolved implementation bytecode read",
  "implementation-nested-slot": "Nested implementation ERC-1967 slot check",
  "implementation-nested-beacon": "Nested implementation ERC-1967 beacon check",
  "total-supply": "totalSupply() read probe",
  "balance-zero": "balanceOf(address(0)) read probe",
  owner: "owner() read probe",
  "owner-code": "owner() address bytecode read",
  "metadata-name": "Optional name() read probe",
  "metadata-symbol": "Optional symbol() read probe",
  "metadata-decimals": "Optional decimals() read probe",
  dispatcher: "Linear basic-block selector comparison inspection",
  rules: "Ruleset 1 deterministic evaluation",
  "truncated-push": "Incomplete PUSH operand truncated bytecode inspection",
  "proxy-runtime-gap": "Unsupported proxy resolution layout or loop",
  "source-verification": "Source code verification not attempted",
  "privileged-access": "Privileged-function access control not evaluated",
  tokenomics: "Tokenomics, liquidity, and holder concentration not evaluated",
  "custom-dispatch": "Non-Solidity or custom dispatcher layouts not evaluated",
  "unsupported-proxies": "Custom, diamond, legacy, and nested proxies unsupported",
  "clone-integration": "ERC-1167 integration behavior not evaluated",
  "contract-reads": "Contract probes skipped when target has no bytecode",
  "snapshot-workflow": "Snapshot header or transport consistency failure",
};

const CONFIDENCE_NOTES: Record<Confidence | "scope", string> = {
  "dispatcher-match":
    "Confidence method: dispatcher-match (PUSH4 selector followed by EQ within two linear instructions; indicates a possible entry point without proving reachability or access control).",
  "slot-read":
    "Confidence method: slot-read (direct ERC-1967 storage slot read at the snapshot block; confirms slot contents at that block only).",
  "call-result":
    "Confidence method: call-result (deterministic eth_call or bytecode probe at the snapshot block with the fixed zero-address caller).",
  "bytecode-pattern":
    "Confidence method: bytecode-pattern (exact runtime bytecode instruction pattern check; custom control flow is not evaluated).",
  scope:
    "Confidence method: scope declaration (explicit MVP boundary; no verification call was made).",
};

export type ExplainProvenance = "template" | "ai-assisted";

export type ExplainedFinding = {
  findingId: string;
  weight: number;
  severity: "info" | "medium" | "high";
  confidence: Confidence | null;
  evidenceIds: string[];
  confidenceNote: string;
  summary: string;
  suggestedChecks: string[];
};

export type ReportExplanation = {
  provenance: ExplainProvenance;
  reportHash: string | null;
  rulesetVersion: number;
  signalScore: number | null;
  band: string | null;
  overview: string;
  findings: ExplainedFinding[];
  coverageSummary: string;
  fallbackReason?: string;
  model?: string;
  promptVersion?: string;
  cached?: boolean;
};

const observationFactSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("metadata-probe"),
    probe: z.enum(["name", "symbol", "decimals"]),
    outcome: z.enum([
      "observed",
      "execution-revert",
      "malformed-return",
      "unavailable",
    ]),
  }),
  z.strictObject({
    kind: z.literal("owner-address"),
    address: addressSchema,
  }),
  z.strictObject({
    kind: z.literal("beacon-implementation"),
    address: addressSchema,
  }),
  z.strictObject({
    kind: z.literal("code-presence"),
    hasCode: z.boolean(),
    codehash: hashSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal("storage-slot"),
    isZero: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("numeric-probe"),
    value: decimalSchema,
  }),
  z.strictObject({
    kind: z.literal("probe-failure"),
    outcome: z.enum(["execution-revert", "malformed-return", "unavailable"]),
  }),
]);

const projectedObservationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: z.string().min(1).max(100),
    kind: z.literal("derived"),
    sourceEvidenceId: z.string().min(1).max(100),
    observation: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("dispatcher-match"),
        signature: z.string().min(1).max(100),
        selector: z.string().regex(/^0x[0-9a-f]{8}$/),
        offset: decimalSchema,
        eqOffset: decimalSchema,
      }),
      z.strictObject({
        kind: z.literal("delegatecall"),
        offset: decimalSchema,
      }),
      z.strictObject({
        kind: z.literal("scope"),
        coverageId: z.literal("source-verification"),
      }),
    ]),
  }),
  z.strictObject({
    id: z.string().min(1).max(100),
    kind: z.literal("read"),
    method: z.enum(["eth_getCode", "eth_getStorageAt", "eth_call"]),
    targetAddress: addressSchema,
    slot: hashSchema.nullable(),
    confidence: confidenceSchema.nullable(),
    outcome: z.enum([
      "observed",
      "execution-revert",
      "malformed-return",
      "unavailable",
    ]),
    errorKind: z
      .enum([
        "transport",
        "rate-limit",
        "execution-revert",
        "malformed-return",
        "historical-state-unavailable",
        "snapshot-mismatch",
        "wrong-network",
        "invalid-response",
        "deadline",
      ])
      .nullable(),
    codehash: hashSchema.nullable(),
    derivation: z.literal("erc1167-runtime").nullable(),
    sourceEvidenceId: z.string().min(1).max(100).nullable(),
    fact: observationFactSchema,
  }),
]);

const projectedCoverageItemSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/).max(64),
  label: z.string().min(1).max(160),
});

export const explainInputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  rulesetVersion: z.literal(1),
  chainId: z.literal("43113"),
  blockNumber: decimalSchema,
  blockHash: hashSchema,
  address: addressSchema,
  codehash: hashSchema,
  reportHash: hashSchema,
  signalScore: z.number().int().min(0).max(100),
  band: z.enum(["Few signals", "Some signals", "Many signals"]),
  proxy: z.strictObject({
    kind: z.enum(["unresolved", "erc1967", "beacon", "erc1167"]),
    status: z.enum(["unresolved", "resolved", "unsupported"]),
    implementation: addressSchema.nullable(),
    implementationCodeHash: hashSchema.nullable(),
    beacon: addressSchema.nullable(),
    beaconCodeHash: hashSchema.nullable(),
    evidenceIds: z.array(z.string().min(1).max(100)).max(30),
  }),
  findings: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(160),
        severity: z.enum(["info", "medium", "high"]),
        weight: z.number().int().min(0).max(100),
        confidence: confidenceSchema.nullable(),
        evidenceIds: z.array(z.string().min(1).max(100)).min(1).max(64),
        allowedCheckIds: z.array(z.string().min(1).max(64)).max(16),
      }),
    )
    .max(64),
  observations: z.array(projectedObservationSchema).max(96),
  coverage: z.strictObject({
    checked: z.array(projectedCoverageItemSchema).max(100),
    notChecked: z.array(projectedCoverageItemSchema).max(100),
    unavailable: z.array(projectedCoverageItemSchema).max(100),
    notApplicable: z.array(projectedCoverageItemSchema).max(100),
  }),
});

export type ExplainInput = z.infer<typeof explainInputSchema>;
type ProjectedObservation = z.infer<typeof projectedObservationSchema>;
type ReadEvidence = Exclude<ReportBody["evidence"][number], DerivedEvidence>;

function bandForScore(score: number) {
  return score < 25
    ? "Few signals"
    : score < 60
      ? "Some signals"
      : "Many signals";
}

function confidenceNote(confidence: Confidence | null) {
  return CONFIDENCE_NOTES[confidence ?? "scope"];
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(
      entries.map(([key, child]) => [key, sortedKeys(child)]),
    );
  }
  return value;
}

export function canonicalExplainInputJson(input: ExplainInput): string {
  const validated = explainInputSchema.parse(input);
  return JSON.stringify(sortedKeys(validated));
}

export function explainCacheKey(
  input: ExplainInput,
  promptVersion: string,
  model: string,
): string {
  const digest = keccak256(stringToHex(canonicalExplainInputJson(input)));
  return `${digest}:${encodeURIComponent(promptVersion)}:${encodeURIComponent(model)}`;
}

function projectReadFact(e: ReadEvidence): z.infer<typeof observationFactSchema> {
  if (
    e.id === "metadata-name" ||
    e.id === "metadata-symbol" ||
    e.id === "metadata-decimals"
  ) {
    const probe = e.id.replace("metadata-", "") as "name" | "symbol" | "decimals";
    return { kind: "metadata-probe", probe, outcome: e.outcome };
  }
  if (e.outcome !== "observed") {
    return { kind: "probe-failure", outcome: e.outcome };
  }
  if (e.id === "owner" && e.decoded) {
    return {
      kind: "owner-address",
      address: addressSchema.parse(e.decoded.toLowerCase()),
    };
  }
  if (e.id === "beacon-implementation" && e.decoded) {
    return {
      kind: "beacon-implementation",
      address: addressSchema.parse(e.decoded.toLowerCase()),
    };
  }
  if (e.request.method === "eth_getCode") {
    return {
      kind: "code-presence",
      hasCode: e.raw !== "0x",
      codehash: e.codehash,
    };
  }
  if (e.request.method === "eth_getStorageAt") {
    return { kind: "storage-slot", isZero: e.raw === ZERO_WORD };
  }
  if ((e.id === "total-supply" || e.id === "balance-zero") && e.decoded) {
    return { kind: "numeric-probe", value: decimalSchema.parse(e.decoded) };
  }
  return { kind: "probe-failure", outcome: "unavailable" };
}

function projectObservation(
  item: ReportBody["evidence"][number],
): ProjectedObservation {
  if ("observation" in item) {
    if (
      item.observation.kind === "dispatcher-match" &&
      !KNOWN_SIGNATURES.has(item.observation.signature)
    ) {
      throw new Error(`Unknown dispatcher signature: ${item.observation.signature}`);
    }
    return {
      id: item.id,
      kind: "derived",
      sourceEvidenceId: item.sourceEvidenceId,
      observation: item.observation,
    };
  }
  return {
    id: item.id,
    kind: "read",
    method: item.request.method,
    targetAddress: item.request.address,
    slot: item.request.slot,
    confidence: item.confidence,
    outcome: item.outcome,
    errorKind: item.error?.kind ?? null,
    codehash: item.codehash,
    derivation: item.derivation,
    sourceEvidenceId: item.sourceEvidenceId,
    fact: projectReadFact(item),
  };
}

function projectCoverageGroup(items: Coverage["checked"]) {
  return [...items].sort(byId).map((item) => {
    const id = z.string().regex(/^[a-z0-9-]+$/).max(64).parse(item.id);
    return {
      id,
      label: TRUSTED_COVERAGE_LABELS[id] ?? "Declared coverage item",
    };
  });
}

export class ExplainInputError extends Error {
  readonly code: "invalid-report" | "oversized-input";
  constructor(code: "invalid-report" | "oversized-input", message: string) {
    super(message);
    this.code = code;
  }
}

export function buildExplainInput(rawBody: ReportBody): {
  body: ReportBody;
  input: ExplainInput;
  canonicalJson: string;
  digest: Hex;
} {
  let body: ReportBody;
  try {
    body = parseReportBody(rawBody);
  } catch (e) {
    throw new ExplainInputError(
      "invalid-report",
      e instanceof Error ? e.message : "Invalid report body",
    );
  }
  for (const f of body.findings) {
    if (!RULE_METADATA[f.id]) {
      throw new ExplainInputError("invalid-report", `Unknown finding rule: ${f.id}`);
    }
  }
  const hash = reportHash(body);
  const evidenceById = new Map(body.evidence.map((e) => [e.id, e]));
  const linkedIds = new Set<string>([
    ...body.proxy.evidenceIds,
    ...body.findings.flatMap((f) => f.evidenceIds),
  ]);
  const observations = [...linkedIds]
    .sort()
    .map((id) => {
      const item = evidenceById.get(id);
      if (!item) {
        throw new ExplainInputError(
          "invalid-report",
          `Missing evidence item: ${id}`,
        );
      }
      return projectObservation(item);
    });

  const input = explainInputSchema.parse({
    schemaVersion: body.schemaVersion,
    rulesetVersion: body.rulesetVersion,
    chainId: body.chainId,
    blockNumber: body.blockNumber,
    blockHash: body.blockHash,
    address: body.address,
    codehash: body.codehash,
    reportHash: hash,
    signalScore: body.signalScore,
    band: bandForScore(body.signalScore),
    proxy: {
      kind: body.proxy.kind,
      status: body.proxy.status,
      implementation: body.proxy.implementation,
      implementationCodeHash: body.proxy.implementationCodeHash,
      beacon: body.proxy.beacon,
      beaconCodeHash: body.proxy.beaconCodeHash,
      evidenceIds: [...body.proxy.evidenceIds].sort(),
    },
    findings: [...body.findings].sort(byId).map((f) => ({
      id: f.id,
      label: RULE_METADATA[f.id].label,
      severity: f.severity,
      weight: f.weight,
      confidence: f.confidence,
      evidenceIds: [...f.evidenceIds].sort(),
      allowedCheckIds: RULE_METADATA[f.id].suggestedChecks.map((c) => c.id),
    })),
    observations,
    coverage: {
      checked: projectCoverageGroup(body.coverage.checked),
      notChecked: projectCoverageGroup(body.coverage.notChecked),
      unavailable: projectCoverageGroup(body.coverage.unavailable),
      notApplicable: projectCoverageGroup(body.coverage.notApplicable),
    },
  });

  const canonicalJson = canonicalExplainInputJson(input);
  if (encoder.encode(canonicalJson).byteLength > MAX_EXPLAIN_INPUT_BYTES) {
    throw new ExplainInputError(
      "oversized-input",
      "Projected explain input exceeds the maximum byte limit.",
    );
  }
  return {
    body,
    input,
    canonicalJson,
    digest: keccak256(stringToHex(canonicalJson)),
  };
}

function summarizeCoverage(coverage: ExplainInput["coverage"] | Coverage): string {
  const notCheckedIds = coverage.notChecked.map((c) => c.id);
  const unavailableIds = coverage.unavailable.map((c) => c.id);
  const notApplicableIds = coverage.notApplicable.map((c) => c.id);
  const parts = [
    `${coverage.checked.length} checked`,
    `${coverage.notChecked.length} outside scope (${notCheckedIds.join(", ") || "none"})`,
    `${coverage.unavailable.length} unavailable${unavailableIds.length ? ` (${unavailableIds.join(", ")})` : ""}`,
  ];
  if (coverage.notApplicable.length > 0) {
    parts.push(
      `${coverage.notApplicable.length} not applicable (${notApplicableIds.join(", ")})`,
    );
  }
  return `Coverage: ${parts.join("; ")}.`;
}

function templateSummaryForFinding(
  finding: ExplainInput["findings"][number],
  input: ExplainInput,
  observations: Map<string, ProjectedObservation>,
): string {
  const ids = finding.evidenceIds;
  switch (finding.id) {
    case "R-MINT":
    case "R-BLACKLIST":
    case "R-FEE":
    case "R-PAUSE": {
      const matches = ids
        .map((id) => observations.get(id))
        .filter(
          (o): o is Extract<ProjectedObservation, { kind: "derived" }> =>
            o?.kind === "derived" && o.observation.kind === "dispatcher-match",
        );
      const detail = matches
        .map((m) => {
          const obs = m.observation as Extract<
            DerivedEvidence["observation"],
            { kind: "dispatcher-match" }
          >;
          return `${m.id} (${obs.signature}, selector ${obs.selector} at byte offset ${obs.offset}, EQ at ${obs.eqOffset})`;
        })
        .join("; ");
      const capability =
        finding.id === "R-MINT"
          ? "minting"
          : finding.id === "R-BLACKLIST"
            ? "blacklisting"
            : finding.id === "R-FEE"
              ? "fee configuration"
              : "pausing";
      return `${finding.id} contributes +${finding.weight} (${finding.severity}): ${detail || ids.join(", ")} records a possible dispatcher entry point for ${capability}. Reachability, limits, and who can invoke it remain unverified.`;
    }
    case "R-PROXY": {
      const proxyKind =
        input.proxy.kind === "beacon"
          ? `ERC-1967 beacon proxy via beacon ${input.proxy.beacon}`
          : "direct ERC-1967 implementation slot";
      return `R-PROXY contributes +${finding.weight} (${finding.severity}): ${ids.join(", ")} resolved a ${proxyKind} pointing to implementation ${input.proxy.implementation} (codehash ${input.proxy.implementationCodeHash}) at block ${input.blockNumber}. Upgrade authority and future target state remain unverified.`;
    }
    case "R-PROXY-UNRESOLVED":
      return `R-PROXY-UNRESOLVED contributes +${finding.weight} (${finding.severity}): ${ids.join(", ")} observed DELEGATECALL in runtime bytecode without supported ERC-1967 or exact ERC-1167 resolution. Custom proxy routing remains unexamined.`;
    case "R-OWNER-EOA": {
      const ownerObs = observations.get("owner");
      const ownerAddr =
        ownerObs?.kind === "read" && ownerObs.fact.kind === "owner-address"
          ? ownerObs.fact.address
          : "nonzero address";
      return `R-OWNER-EOA contributes +${finding.weight} (${finding.severity}): owner and owner-code show a nonzero owner() address (${ownerAddr}) with no deployed bytecode at block ${input.blockNumber}. Whether this address holds privileged control or is an unverified account remains unknown.`;
    }
    case "R-OWNER-CONTRACT": {
      const ownerObs = observations.get("owner");
      const ownerCode = observations.get("owner-code");
      const ownerAddr =
        ownerObs?.kind === "read" && ownerObs.fact.kind === "owner-address"
          ? ownerObs.fact.address
          : "nonzero address";
      const codehash =
        ownerCode?.kind === "read" && ownerCode.fact.kind === "code-presence"
          ? ownerCode.fact.codehash
          : null;
      return `R-OWNER-CONTRACT contributes +${finding.weight} (${finding.severity}): owner and owner-code show a nonzero owner() address (${ownerAddr}) with deployed bytecode${codehash ? ` (codehash ${codehash})` : ""}. Whether it is a multisig, timelock, or other controller is unknown.`;
    }
    case "R-OWNER-RENOUNCED":
      return `R-OWNER-RENOUNCED contributes +${finding.weight} (${finding.severity}): owner returned the zero address at block ${input.blockNumber}. Other control paths such as role-based access or proxy admins remain unverified.`;
    case "R-NONSTANDARD": {
      const failed = ids
        .map((id) => {
          const obs = observations.get(id);
          return obs?.kind === "read" ? `${id} (${obs.outcome})` : id;
        })
        .join(", ");
      return `R-NONSTANDARD contributes +${finding.weight} (${finding.severity}): required read probe failed for ${failed}. Other ERC-20 methods were not tested.`;
    }
    case "R-METADATA-ABSENT": {
      const failed = ids
        .map((id) => {
          const obs = observations.get(id);
          return obs?.kind === "read" && obs.fact.kind === "metadata-probe"
            ? `${obs.fact.probe}() (${obs.fact.outcome})`
            : id;
        })
        .join(", ");
      return `R-METADATA-ABSENT contributes +${finding.weight} (${finding.severity}): optional metadata probe unavailable for ${failed}. Metadata absence has zero weight.`;
    }
    case "R-SOURCE-UNKNOWN":
      return `R-SOURCE-UNKNOWN contributes +${finding.weight} (${finding.severity}): source-scope records that contract source verification was not attempted in MVP.`;
    default:
      return `${finding.id} contributes +${finding.weight} (${finding.severity}) based on ${ids.join(", ")}.`;
  }
}

export function buildTemplateExplanationFromInput(
  input: ExplainInput,
  fallbackReason?: string,
): ReportExplanation {
  const observations = new Map(input.observations.map((o) => [o.id, o]));
  const weighted = input.findings.filter((f) => f.weight > 0);
  const rawTotal = weighted.reduce((acc, f) => acc + f.weight, 0);
  const cloneNote =
    input.proxy.kind === "erc1167" && input.proxy.implementation
      ? ` Target matches the exact ERC-1167 minimal proxy pattern pointing to implementation ${input.proxy.implementation} (zero proxy weight).`
      : "";

  let overview: string;
  if (input.signalScore === 0) {
    overview = `Signal score is 0 / 100 (${input.band}) under ruleset ${input.rulesetVersion} at block ${input.blockNumber}. No weighted risk signals were triggered by the checked read probes and linear dispatcher rules.${cloneNote} A score of 0 is not an audit or safety verdict: source verification, privileged access control, custom dispatchers, unsupported proxies, and tokenomics remain outside scope.`;
  } else {
    const breakdown = weighted
      .map((f) => `${f.id} (+${f.weight})`)
      .join(" + ");
    const capNote =
      rawTotal > input.signalScore
        ? ` (sum ${rawTotal} capped at ${input.signalScore})`
        : "";
    overview = `Signal score is ${input.signalScore} / 100 (${input.band}) under ruleset ${input.rulesetVersion} at block ${input.blockNumber}, derived from ${breakdown}${capNote}.${cloneNote} Weights represent heuristic capability indicators, not exploit probability, and privileged access control remains unverified.`;
  }

  const findings: ExplainedFinding[] = input.findings.map((f) => ({
    findingId: f.id,
    weight: f.weight,
    severity: f.severity,
    confidence: f.confidence,
    evidenceIds: f.evidenceIds,
    confidenceNote: confidenceNote(f.confidence),
    summary: templateSummaryForFinding(f, input, observations),
    suggestedChecks: RULE_METADATA[f.id].suggestedChecks.map((c) => c.text),
  }));

  return {
    provenance: "template",
    reportHash: input.reportHash,
    rulesetVersion: input.rulesetVersion,
    signalScore: input.signalScore,
    band: input.band,
    overview,
    findings,
    coverageSummary: summarizeCoverage(input.coverage),
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

export function buildTemplateExplanation(
  body: ReportBody,
  fallbackReason?: string,
): ReportExplanation {
  const { input } = buildExplainInput(body);
  return buildTemplateExplanationFromInput(input, fallbackReason);
}

type IncompleteReport = Exclude<
  ReturnType<typeof buildReport>,
  { status: "complete" }
>;

export function buildIncompleteExplanation(
  result: IncompleteReport,
): ReportExplanation {
  const overview =
    result.status === "not-analyzable"
      ? `Target has no deployed bytecode at this snapshot (reason: ${result.reason}). Contract read probes and ruleset ${result.rulesetVersion} checks are not applicable, so no numeric signal score is assigned. Empty code does not establish safety.`
      : `Scan is inconclusive (reason: ${result.reason}) and cannot assign a numeric signal score. Required transport, snapshot-consistency, or state checks failed and are never converted into contract risk findings or a reassuring verdict.`;

  return {
    provenance: "template",
    reportHash: null,
    rulesetVersion: result.rulesetVersion,
    signalScore: null,
    band: null,
    overview,
    findings: [],
    coverageSummary: summarizeCoverage(result.coverage),
  };
}

const aiItemSchema = z.strictObject({
  findingId: z.string().min(1).max(64),
  citedEvidenceIds: z.array(z.string().min(1).max(100)).min(1).max(32),
  summary: z.string().min(1).max(600),
  suggestedCheckIds: z.array(z.string().min(1).max(64)).max(3).optional(),
});

const aiOutputSchema = z.strictObject({
  overview: z.string().min(1).max(600),
  items: z.array(aiItemSchema).min(1).max(32),
  coverageNote: z.string().min(1).max(400).optional(),
});

const UNSUPPORTED_CLAIM_PATTERNS = [
  /\b(safe|safety|secure|safely|certified|certify|certifies|harmless|benign|trustworthy|risk[- ]free|zero[- ]risk|no[- ]risk|audited|scam|rug[- ]?pull|honeypot|malicious|exploit|legitimate)\b/i,
  /\bno\s+risk\b/i,
  /\b(?:fully|erc-?20)\s+compliant\b/i,
  /\b(?:confirmed|guaranteed)\s+(?:eoa|multisig|safe|control)\b/i,
  /\bis\s+(?:an?\s+eoa|a\s+multisig|not\s+a\s+proxy)\b/i,
  /\ball\s+(?:admin\s+|owner\s+)?(?:privileges|powers|control)\s+(?:(?:are|were|have\s+been)\s+)?renounced\b/i,
  /\b(?:only\s+(?:the\s+)?owner\s+can|exclusively\s+controlled|owner\s+can\s+mint|cannot\s+mint|can\s+definitely)\b/i,
];

const UNSAFE_MARKUP_PATTERN =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F<>]|https?:\/\/|javascript:|data:/i;

function assertValidProse(text: string, label: string) {
  if (UNSAFE_MARKUP_PATTERN.test(text)) {
    throw new ExplainValidationError(
      "unsupported-claim",
      `${label} contains disallowed markup or control characters.`,
    );
  }
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      throw new ExplainValidationError(
        "unsupported-claim",
        `${label} makes an unsupported safety, verdict, or access-control claim.`,
      );
    }
  }
}

export type ExplainValidationCode =
  | "invalid-json"
  | "oversized"
  | "schema-invalid"
  | "evidence-invalid"
  | "unsupported-claim";

export class ExplainValidationError extends Error {
  readonly code: ExplainValidationCode;
  constructor(code: ExplainValidationCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function validateAiResponse(
  raw: unknown,
  input: ExplainInput,
  meta: { model: string; promptVersion: string; cached?: boolean },
): ReportExplanation {
  let payload: unknown;
  if (typeof raw === "string") {
    if (encoder.encode(raw).byteLength > MAX_EXPLAIN_OUTPUT_BYTES) {
      throw new ExplainValidationError(
        "oversized",
        "AI explanation response exceeded the byte limit.",
      );
    }
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ExplainValidationError(
        "invalid-json",
        "AI explanation response was not valid JSON.",
      );
    }
  } else {
    let serialized: string;
    try {
      serialized = JSON.stringify(raw);
    } catch {
      throw new ExplainValidationError(
        "invalid-json",
        "AI explanation response could not be serialized.",
      );
    }
    if (
      !serialized ||
      encoder.encode(serialized).byteLength > MAX_EXPLAIN_OUTPUT_BYTES
    ) {
      throw new ExplainValidationError(
        "oversized",
        "AI explanation response exceeded the byte limit.",
      );
    }
    payload = raw;
  }

  const parsedResult = aiOutputSchema.safeParse(payload);
  if (!parsedResult.success) {
    throw new ExplainValidationError(
      "schema-invalid",
      "AI explanation response violated the strict output schema.",
    );
  }
  const parsed = parsedResult.data;

  assertValidProse(parsed.overview, "overview");
  if (parsed.coverageNote) {
    assertValidProse(parsed.coverageNote, "coverageNote");
  }

  const expectedById = new Map(input.findings.map((f) => [f.id, f]));
  const itemsById = new Map<string, (typeof parsed.items)[number]>();
  for (const item of parsed.items) {
    if (!expectedById.has(item.findingId)) {
      throw new ExplainValidationError(
        "evidence-invalid",
        `Invented finding ID in AI response: ${item.findingId}`,
      );
    }
    if (itemsById.has(item.findingId)) {
      throw new ExplainValidationError(
        "evidence-invalid",
        `Duplicate finding ID in AI response: ${item.findingId}`,
      );
    }
    const expected = expectedById.get(item.findingId)!;
    const allowedEvidence = new Set(expected.evidenceIds);
    if (new Set(item.citedEvidenceIds).size !== item.citedEvidenceIds.length) {
      throw new ExplainValidationError(
        "evidence-invalid",
        `Duplicate cited evidence IDs for ${item.findingId}`,
      );
    }
    for (const evId of item.citedEvidenceIds) {
      if (!allowedEvidence.has(evId)) {
        throw new ExplainValidationError(
          "evidence-invalid",
          `Invalid or cross-finding evidence citation ${evId} for ${item.findingId}`,
        );
      }
    }
    if (item.suggestedCheckIds) {
      if (
        new Set(item.suggestedCheckIds).size !== item.suggestedCheckIds.length
      ) {
        throw new ExplainValidationError(
          "schema-invalid",
          `Duplicate suggested check IDs for ${item.findingId}`,
        );
      }
      const allowedChecks = new Set(expected.allowedCheckIds);
      for (const checkId of item.suggestedCheckIds) {
        if (!allowedChecks.has(checkId)) {
          throw new ExplainValidationError(
            "schema-invalid",
            `Invalid suggested check ID ${checkId} for ${item.findingId}`,
          );
        }
      }
    }
    assertValidProse(item.summary, `finding ${item.findingId}`);
    itemsById.set(item.findingId, item);
  }

  if (itemsById.size !== expectedById.size) {
    throw new ExplainValidationError(
      "schema-invalid",
      "AI response omitted one or more findings.",
    );
  }

  const findings: ExplainedFinding[] = input.findings.map((expected) => {
    const item = itemsById.get(expected.id)!;
    const checkMap = new Map(
      RULE_METADATA[expected.id].suggestedChecks.map((c) => [c.id, c.text]),
    );
    const suggestedChecks = (item.suggestedCheckIds ?? []).map(
      (checkId) => checkMap.get(checkId)!,
    );
    return {
      findingId: expected.id,
      weight: expected.weight,
      severity: expected.severity,
      confidence: expected.confidence,
      evidenceIds: [...item.citedEvidenceIds],
      confidenceNote: confidenceNote(expected.confidence),
      summary: item.summary.trim(),
      suggestedChecks,
    };
  });

  const baseCoverage = summarizeCoverage(input.coverage);
  return {
    provenance: "ai-assisted",
    reportHash: input.reportHash,
    rulesetVersion: input.rulesetVersion,
    signalScore: input.signalScore,
    band: input.band,
    overview: parsed.overview.trim(),
    findings,
    coverageSummary: parsed.coverageNote
      ? `${baseCoverage} Note: ${parsed.coverageNote.trim()}`
      : baseCoverage,
    model: meta.model,
    promptVersion: meta.promptVersion,
    cached: Boolean(meta.cached),
  };
}

export type ExplainProviderErrorKind =
  | "timeout"
  | "rate-limit"
  | "outage"
  | "oversized"
  | "invalid-json";

export class ExplainProviderError extends Error {
  readonly kind: ExplainProviderErrorKind;
  constructor(kind: ExplainProviderErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface ExplainProvider {
  readonly model: string;
  explain(
    input: ExplainInput,
    options: { promptVersion: string; signal: AbortSignal },
  ): Promise<unknown>;
}

export type ExplainServiceOptions = {
  provider?: ExplainProvider | null;
  enabled?: boolean;
  promptVersion?: string;
  requestTimeoutMs?: number;
  deadlineMs?: number;
  maxAttempts?: number;
  maxCacheEntries?: number;
};

function fallbackReasonFor(error: unknown): string {
  if (error instanceof ExplainProviderError) {
    if (error.kind === "timeout") {
      return "AI explanation timed out; showing template.";
    }
    if (error.kind === "rate-limit") {
      return "AI provider rate limit reached; showing template.";
    }
    if (error.kind === "oversized") {
      return "AI explanation exceeded size bounds; showing template.";
    }
    if (error.kind === "invalid-json") {
      return "AI response was malformed JSON; showing template.";
    }
    return "AI provider unavailable; showing template.";
  }
  if (error instanceof ExplainValidationError) {
    return "AI response failed evidence or schema validation; showing template.";
  }
  return "AI provider unavailable; showing template.";
}

export function createExplainService(options: ExplainServiceOptions = {}) {
  const promptVersion = options.promptVersion ?? EXPLAIN_PROMPT_VERSION;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_EXPLAIN_REQUEST_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? DEFAULT_EXPLAIN_DEADLINE_MS;
  const maxAttempts = Math.max(
    1,
    options.maxAttempts ?? DEFAULT_EXPLAIN_MAX_ATTEMPTS,
  );
  const maxCacheEntries = Math.max(
    1,
    options.maxCacheEntries ?? DEFAULT_EXPLAIN_CACHE_SIZE,
  );
  const cache = new Map<string, ReportExplanation>();

  function getCached(key: string): ReportExplanation | undefined {
    const hit = cache.get(key);
    if (!hit) return undefined;
    cache.delete(key);
    cache.set(key, hit);
    return { ...hit, cached: true };
  }

  function setCached(key: string, value: ReportExplanation) {
    if (cache.has(key)) cache.delete(key);
    while (cache.size >= maxCacheEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    cache.set(key, { ...value, cached: false });
  }

  async function callProviderWithBounds(
    provider: ExplainProvider,
    input: ExplainInput,
    activePromptVersion: string,
  ): Promise<unknown> {
    const deadline = Date.now() + deadlineMs;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new ExplainProviderError("timeout", "Explain deadline exceeded.");
      }
      const controller = new AbortController();
      const attemptTimeout = Math.min(remaining, requestTimeoutMs);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          provider.explain(input, {
            promptVersion: activePromptVersion,
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(
                new ExplainProviderError(
                  "timeout",
                  "AI explanation request timed out.",
                ),
              );
            }, attemptTimeout);
          }),
        ]);
      } catch (err) {
        const mapped =
          err instanceof ExplainProviderError
            ? err
            : err instanceof Error && err.name === "AbortError"
              ? new ExplainProviderError("timeout", "Request aborted on timeout.")
              : new ExplainProviderError("outage", "AI provider request failed.");
        const retryable =
          mapped.kind === "timeout" ||
          mapped.kind === "rate-limit" ||
          mapped.kind === "outage";
        if (!retryable || attempt === maxAttempts - 1) throw mapped;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ExplainProviderError("outage", "AI provider attempts exhausted.");
  }

  async function explainFromInput(
    input: ExplainInput,
    override?: { enabled?: boolean; promptVersion?: string },
  ): Promise<{ explanation: ReportExplanation; cacheHit: boolean }> {
    const enabled = override?.enabled ?? options.enabled ?? false;
    const provider = options.provider ?? null;
    const activePromptVersion = override?.promptVersion ?? promptVersion;

    if (!enabled) {
      return {
        explanation: buildTemplateExplanationFromInput(
          input,
          "AI explanation disabled; showing template.",
        ),
        cacheHit: false,
      };
    }
    if (!provider) {
      return {
        explanation: buildTemplateExplanationFromInput(
          input,
          "AI provider unconfigured; showing template.",
        ),
        cacheHit: false,
      };
    }

    const key = explainCacheKey(input, activePromptVersion, provider.model);
    const cached = getCached(key);
    if (cached) {
      return { explanation: cached, cacheHit: true };
    }

    try {
      const raw = await callProviderWithBounds(
        provider,
        input,
        activePromptVersion,
      );
      const validated = validateAiResponse(raw, input, {
        model: provider.model,
        promptVersion: activePromptVersion,
        cached: false,
      });
      setCached(key, validated);
      return { explanation: validated, cacheHit: false };
    } catch (error) {
      return {
        explanation: buildTemplateExplanationFromInput(
          input,
          fallbackReasonFor(error),
        ),
        cacheHit: false,
      };
    }
  }

  async function explainReport(
    rawBody: ReportBody,
    override?: { enabled?: boolean; promptVersion?: string },
  ): Promise<{ explanation: ReportExplanation; cacheHit: boolean }> {
    const { input } = buildExplainInput(rawBody);
    return explainFromInput(input, override);
  }

  return {
    explainFromInput,
    explainReport,
    cacheSize: () => cache.size,
  };
}
