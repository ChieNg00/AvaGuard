import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { toFunctionSelector, type Hex } from "viem";
import {
  buildExplainInput,
  buildReport,
  buildTemplateExplanation,
  canonicalReportJson,
  createExplainService,
  EXPLAIN_PROMPT_VERSION_V3,
  explainCacheKey,
  parseReportBody,
  ReadError,
  reportHash,
  type ExplainInput,
  type ExplainLanguage,
  type ReportBody,
} from "../src";
import { OWNER, TARGET, mock } from "./mock";

const push = (sig: string) => "63" + toFunctionSelector(sig).slice(2);

async function makeMintableReport() {
  const mintRuntime = ("0x" + push("mint(address,uint256)") + "14") as Hex;
  const collection = await collectWithMock((method, params) => {
    if (method === "eth_getCode" && params[0] === TARGET) return mintRuntime;
    if (method === "eth_getCode" && params[0] === OWNER) return "0x";
  });
  return collection;
}

async function makeDecoyZeroReport() {
  const decoyRuntime = ("0x" + push("mint(address,uint256)") + "00") as Hex;
  return collectWithMock((method, params) => {
    if (method === "eth_getCode" && params[0] === TARGET) return decoyRuntime;
    if (method === "eth_call") {
      const call = params[0] as { data: Hex };
      if (call.data === "0x8da5cb5b") throw new ReadError("execution-revert");
    }
  });
}

async function collectWithMock(override?: Parameters<typeof mock>[0]) {
  const { collectEvidence } = await import("../src");
  const collection = await collectEvidence(mock(override).transport, {
    address: TARGET,
  });
  const report = buildReport(collection);
  if (report.status !== "complete") {
    throw new Error(`Expected complete report, got ${report.status}`);
  }
  return report;
}

function makeValidV3Payload(
  input: ExplainInput,
  language: ExplainLanguage = "en",
  overrides?: {
    narrativeOverview?: string;
    itemNarrative?: string;
  },
) {
  const defaultOverview =
    language === "vi"
      ? `Bao cao ghi nhan diem tin hieu ${input.signalScore} / 100 va khong phai la chung nhan an toan hay ket qua kiem toan.`
      : `This snapshot records ${input.signalScore} / 100 signals and is not a safety verdict or audit.`;

  return {
    narrativeOverview: overrides?.narrativeOverview ?? defaultOverview,
    items: input.findings.map((f, index) => ({
      findingId: f.id,
      citedEvidenceIds: [...f.evidenceIds],
      ...(f.allowedCheckIds.length > 0
        ? { suggestedCheckIds: [f.allowedCheckIds[0]] }
        : {}),
      narrative:
        index === 0 && overrides?.itemNarrative
          ? overrides.itemNarrative
          : language === "vi"
            ? `Tin hieu ${f.id} dua tren bang chung da thu thap va chua xac minh quyen truy cap.`
            : `Signal ${f.id} reflects observed snapshot evidence with access control unverified.`,
    })),
  };
}

function publicationTuple(body: ReportBody) {
  return {
    target: body.address,
    score: body.signalScore,
    codehash: body.codehash,
    implementation:
      body.proxy.implementation ?? "0x0000000000000000000000000000000000000000",
    reportHash: reportHash(body),
    rulesetVersion: body.rulesetVersion,
    blockNumber: body.blockNumber,
    blockHash: body.blockHash,
  };
}

describe("Prompt v3 guarded narrative explanations", () => {
  it("preserves deterministic report fields, canonical hash, and publication tuple for valid EN and VI outputs", async () => {
    const vectorJson = await readFile(
      new URL("../../../fixtures/canonical-report-v1.json", import.meta.url),
      "utf8",
    );
    const vectorBody = parseReportBody(JSON.parse(vectorJson));
    expect(reportHash(vectorBody)).toBe(
      "0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd",
    );

    const mintable = await makeMintableReport();
    const templateMint = buildTemplateExplanation(mintable.body);
    const beforeJson = canonicalReportJson(mintable.body);
    const beforeHash = reportHash(mintable.body);
    const beforeTuple = publicationTuple(mintable.body);

    const service = createExplainService({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          return makeValidV3Payload(input, opts.language ?? "en");
        },
      },
    });

    const enRes = await service.explainReport(mintable.body, {
      language: "en",
    });
    expect(enRes.cacheHit).toBe(false);
    expect(enRes.explanation.provenance).toBe("ai-assisted");
    expect(enRes.explanation.promptVersion).toBe("3");
    expect(enRes.explanation.language).toBe("en");
    expect(enRes.explanation.aiSummary).toContain("35 / 100");
    expect(enRes.explanation.overview).toBe(templateMint.overview);
    expect(enRes.explanation.findings.map((f) => f.summary)).toEqual(
      templateMint.findings.map((f) => f.summary),
    );
    expect(enRes.explanation.findings.map((f) => f.evidenceIds)).toEqual(
      templateMint.findings.map((f) => f.evidenceIds),
    );
    for (const f of enRes.explanation.findings) {
      expect(f.aiNote).toBeTruthy();
    }

    const viRes = await service.explainReport(mintable.body, {
      language: "vi",
    });
    expect(viRes.cacheHit).toBe(false);
    expect(viRes.explanation.provenance).toBe("ai-assisted");
    expect(viRes.explanation.promptVersion).toBe("3");
    expect(viRes.explanation.language).toBe("vi");
    expect(viRes.explanation.aiSummary).toContain("35 / 100");
    expect(viRes.explanation.overview).toBe(templateMint.overview);

    expect(canonicalReportJson(mintable.body)).toBe(beforeJson);
    expect(reportHash(mintable.body)).toBe(beforeHash);
    expect(publicationTuple(mintable.body)).toEqual(beforeTuple);
  });

  it("caches English and Vietnamese v3 explanations under independent cache keys", async () => {
    const mintable = await makeMintableReport();
    const { input } = buildExplainInput(mintable.body);

    const keyEn = explainCacheKey(
      input,
      EXPLAIN_PROMPT_VERSION_V3,
      "gemini-3.5-flash-lite",
      "en",
    );
    const keyVi = explainCacheKey(
      input,
      EXPLAIN_PROMPT_VERSION_V3,
      "gemini-3.5-flash-lite",
      "vi",
    );
    expect(keyEn).not.toBe(keyVi);

    let calls = 0;
    const service = createExplainService({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(reqInput, opts) {
          calls++;
          return makeValidV3Payload(reqInput, opts.language ?? "en");
        },
      },
    });

    const firstEn = await service.explainReport(mintable.body, {
      language: "en",
    });
    expect(firstEn.cacheHit).toBe(false);
    expect(calls).toBe(1);

    const firstVi = await service.explainReport(mintable.body, {
      language: "vi",
    });
    expect(firstVi.cacheHit).toBe(false);
    expect(calls).toBe(2);

    const secondEn = await service.explainReport(mintable.body, {
      language: "en",
    });
    expect(secondEn.cacheHit).toBe(true);
    expect(secondEn.explanation.language).toBe("en");

    const secondVi = await service.explainReport(mintable.body, {
      language: "vi",
    });
    expect(secondVi.cacheHit).toBe(true);
    expect(secondVi.explanation.language).toBe("vi");
    expect(calls).toBe(2);
  });

  it("allows honest negated EN and VI safety/audit disclaimers as positive controls", async () => {
    const decoy = await makeDecoyZeroReport();

    const service = createExplainService({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input, opts) {
          if (opts.language === "vi") {
            return makeValidV3Payload(input, "vi", {
              narrativeOverview:
                "Điểm 0 / 100 không phải là chứng nhận an toàn hay kết quả kiểm toán.",
              itemNarrative:
                "Chưa chứng minh chủ sở hữu có quyền hay hợp đồng an toàn.",
            });
          }
          return makeValidV3Payload(input, "en", {
            narrativeOverview:
              "A score of 0 / 100 is not a safety verdict and not an audit.",
            itemNarrative:
              "Absence of weighted dispatcher hits does not confirm safety or access control.",
          });
        },
      },
    });

    const enRes = await service.explainReport(decoy.body, { language: "en" });
    expect(enRes.explanation.provenance).toBe("ai-assisted");
    expect(enRes.explanation.aiSummary).toContain("not a safety verdict");

    const viRes = await service.explainReport(decoy.body, { language: "vi" });
    expect(viRes.explanation.provenance).toBe("ai-assisted");
    expect(viRes.explanation.aiSummary).toContain(
      "không phải là chứng nhận an toàn",
    );

    const unaccentedViService = createExplainService({
      enabled: true,
      promptVersion: EXPLAIN_PROMPT_VERSION_V3,
      provider: {
        model: "gemini-3.5-flash-lite",
        async explain(input) {
          return makeValidV3Payload(input, "vi", {
            narrativeOverview:
              "Diem 0 / 100 khong phai la chung nhan an toan hay ket qua kiem toan.",
            itemNarrative:
              "Chua chung minh chu so huu co quyen hay hop dong an toan.",
          });
        },
      },
    });
    const unaccentedViRes = await unaccentedViService.explainReport(decoy.body, {
      language: "vi",
    });
    expect(unaccentedViRes.explanation.provenance).toBe("ai-assisted");
    expect(unaccentedViRes.explanation.aiSummary).toContain(
      "khong phai la chung nhan an toan",
    );
  });

  it("rejects markup, links, EN/VI safety/privilege claims, mismatched scores, and schema violations then recovers", async () => {
    const mintable = await makeMintableReport();
    const { input } = buildExplainInput(mintable.body);

    const invalidPayloads: Array<{ name: string; marker: string; payload: unknown }> = [
      {
        name: "HTML script tag",
        marker: "<script>",
        payload: makeValidV3Payload(input, "en", {
          narrativeOverview:
            "Signal summary <script>alert(1)</script> for observed rules.",
        }),
      },
      {
        name: "backtick markup",
        marker: "`mint()`",
        payload: makeValidV3Payload(input, "en", {
          itemNarrative: "Possible `mint()` dispatcher entry point detected.",
        }),
      },
      {
        name: "raw URL",
        marker: "https://evil.example",
        payload: makeValidV3Payload(input, "en", {
          narrativeOverview:
            "See external notes at https://evil.example for details on this token.",
        }),
      },
      {
        name: "Markdown link",
        marker: "[check](https://evil.example)",
        payload: makeValidV3Payload(input, "en", {
          itemNarrative:
            "Inspect [check](https://evil.example) outside AvaGuard.",
        }),
      },
      {
        name: "English safety and audit claim",
        marker: "completely safe and audited",
        payload: makeValidV3Payload(input, "en", {
          narrativeOverview:
            "This token is completely safe and audited with verified behavior.",
        }),
      },
      {
        name: "English proven privilege claim",
        marker: "proves the owner can mint",
        payload: makeValidV3Payload(input, "en", {
          itemNarrative:
            "This proves the owner can mint unlimited tokens at any time.",
        }),
      },
      {
        name: "Vietnamese safety and audit claim",
        marker: "hoàn toàn an toàn",
        payload: makeValidV3Payload(input, "vi", {
          narrativeOverview:
            "Hợp đồng này hoàn toàn an toàn và đã được kiểm toán đầy đủ.",
        }),
      },
      {
        name: "Vietnamese proven privilege claim",
        marker: "chứng minh chủ sở hữu có quyền",
        payload: makeValidV3Payload(input, "vi", {
          itemNarrative:
            "Bằng chứng này chứng minh chủ sở hữu có quyền mint vô hạn.",
        }),
      },
      {
        name: "unaccented Vietnamese safety and audit claim",
        marker: "hoan toan an toan",
        payload: makeValidV3Payload(input, "vi", {
          narrativeOverview:
            "Hop dong nay hoan toan an toan va da duoc kiem toan.",
        }),
      },
      {
        name: "unaccented Vietnamese zero-risk claim",
        marker: "Khong co rui ro",
        payload: makeValidV3Payload(input, "vi", {
          narrativeOverview: "Khong co rui ro nao trong hop dong nay.",
        }),
      },
      {
        name: "unaccented Vietnamese proven privilege claim",
        marker: "chung minh chu so huu co quyen",
        payload: makeValidV3Payload(input, "vi", {
          itemNarrative:
            "Bang chung nay chung minh chu so huu co quyen mint.",
        }),
      },
      {
        name: "mismatched score citation",
        marker: "0 / 100",
        payload: makeValidV3Payload(input, "en", {
          narrativeOverview:
            "Signal score is 0 / 100 based on the observed dispatchers.",
        }),
      },
      {
        name: "unknown extra field",
        marker: "EXTRA_REJECTED_VALUE",
        payload: {
          ...makeValidV3Payload(input, "en"),
          extraField: "EXTRA_REJECTED_VALUE",
        },
      },
      {
        name: "omitted finding",
        marker: "ai-assisted",
        payload: {
          ...makeValidV3Payload(input, "en"),
          items: makeValidV3Payload(input, "en").items.slice(0, -1),
        },
      },
    ];

    for (const testCase of invalidPayloads) {
      let shouldRecover = false;
      const service = createExplainService({
        enabled: true,
        promptVersion: EXPLAIN_PROMPT_VERSION_V3,
        maxAttempts: 1,
        provider: {
          model: "gemini-3.5-flash-lite",
          async explain(reqInput, opts) {
            return shouldRecover
              ? makeValidV3Payload(reqInput, opts.language ?? "en")
              : testCase.payload;
          },
        },
      });

      const rejected = await service.explainReport(mintable.body, {
        language: "vi",
      });
      expect(rejected.explanation.provenance, testCase.name).toBe("template");
      expect(rejected.explanation.fallbackReason, testCase.name).toMatch(
        /evidence or schema validation/i,
      );
      expect(rejected.explanation.aiSummary, testCase.name).toBeUndefined();
      expect(service.cacheSize(), testCase.name).toBe(0);
      if (testCase.marker !== "ai-assisted") {
        expect(JSON.stringify(rejected.explanation), testCase.name).not.toContain(
          testCase.marker,
        );
      }

      shouldRecover = true;
      const recovered = await service.explainReport(mintable.body, {
        language: "vi",
      });
      expect(recovered.explanation.provenance, testCase.name).toBe(
        "ai-assisted",
      );
      expect(recovered.explanation.language, testCase.name).toBe("vi");
      expect(service.cacheSize(), testCase.name).toBe(1);
    }
  });
});
