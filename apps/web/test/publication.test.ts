import { afterEach, expect, it, vi } from "vitest";
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { parseReportBody } from "@avaguard/analyzer";
import vector from "../../../fixtures/canonical-report-v1.json";
import { agrees, differences, publication } from "../lib/publication";
import { registryAbi } from "../lib/registry-abi";
import {
  classifyReceipt,
  validateSubmittedTransaction,
  verifySubmissionReceipt,
  type ContextReader,
  type ReceiptLike,
  type ReceiptReader,
  type Submission,
} from "../lib/receipt";

afterEach(() => {
  vi.useRealTimers();
});

const registry = "0x1111111111111111111111111111111111111111" as Address;
const attester = "0x2222222222222222222222222222222222222222" as Address;
const otherAddress = "0x3333333333333333333333333333333333333333" as Address;
const txHash = ("0x" + "a".repeat(64)) as Hex;
const runtimeCode = "0x6001600055" as Hex;
const runtimeCodehash = keccak256(runtimeCode);

function makeSubmission(): Submission {
  const body = parseReportBody(vector);
  const tuple = publication(body);
  return {
    hash: txHash,
    registry,
    registryCodehash: runtimeCodehash,
    attester,
    target: tuple.target,
    reportHash: tuple.reportHash,
    blockNumber: body.blockNumber,
    blockHash: tuple.blockHash,
    status: "pending",
  };
}

function makePublishedLog(
  overrides: {
    address?: Address;
    target?: Address;
    reportHash?: Hex;
    attester?: Address;
  } = {},
): Log {
  const body = parseReportBody(vector);
  const tuple = publication(body);
  const topics = encodeEventTopics({
    abi: registryAbi,
    eventName: "ReportPublished",
    args: {
      target: overrides.target ?? tuple.target,
      reportHash: overrides.reportHash ?? tuple.reportHash,
      attester: overrides.attester ?? attester,
    },
  });
  const data = encodeAbiParameters(
    [
      { type: "uint8" },
      { type: "bytes32" },
      { type: "address" },
      { type: "uint32" },
      { type: "uint64" },
      { type: "bytes32" },
      { type: "uint256" },
    ],
    [
      tuple.score,
      tuple.codehash,
      tuple.implementation,
      tuple.rulesetVersion,
      tuple.blockNumber,
      tuple.blockHash,
      1000n,
    ],
  );
  return {
    address: overrides.address ?? registry,
    blockHash: tuple.blockHash,
    blockNumber: tuple.blockNumber,
    data,
    logIndex: 0,
    removed: false,
    topics: topics as [Hex, ...Hex[]],
    transactionHash: txHash,
    transactionIndex: 0,
  };
}

function makeReader(overrides: Partial<ReceiptReader> = {}): ReceiptReader {
  const submission = makeSubmission();
  const receipt: ReceiptLike = {
    status: "success",
    transactionHash: txHash,
    logs: [makePublishedLog()],
  };
  return {
    async getChainId() {
      return 43113;
    },
    async getBlock() {
      return { hash: submission.blockHash };
    },
    async getCode() {
      return runtimeCode;
    },
    async getTransactionReceipt() {
      return receipt;
    },
    async waitForTransactionReceipt() {
      return receipt;
    },
    ...overrides,
  };
}

const okContext: ContextReader = async () => ({
  ok: true,
  data: { address: registry, codehash: runtimeCodehash },
});

it("checks every retrieved field even when the canonical body hash matches", () => {
  const body = parseReportBody(vector);
  const tuple = publication(body);
  const summary = { ...tuple, blockNumber: tuple.blockNumber.toString() };
  expect(tuple.implementation).toBe(zeroAddress);
  expect(agrees(body, summary)).toBe(true);
  expect(agrees(body, { ...summary, score: summary.score + 1 })).toBe(false);
  expect(agrees(body, { ...summary, blockNumber: "9007199254740993" })).toBe(
    false,
  );
});

it("compares proxy, coverage, findings and observations across snapshots", () => {
  const body = parseReportBody(vector);
  const current = structuredClone(body);
  current.blockNumber = "9007199254740993";
  for (const e of current.evidence) e.snapshot.blockNumber = current.blockNumber;
  expect(differences(body, current)).toEqual([]);
  current.proxy.implementation = body.address;
  current.coverage.checked.pop();
  current.findings[0].explanation += " changed";
  current.evidence.pop();
  const fields = differences(body, current).map((change) => change.field);
  for (const prefix of ["Proxy", "Coverage ", "Finding ", "Evidence "])
    expect(fields.some((field) => field.startsWith(prefix))).toBe(true);
});

it("confirms only a successful receipt matching registry, target, reportHash and attester", () => {
  const submission = makeSubmission();
  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: txHash,
        logs: [makePublishedLog()],
      },
      {
        ...submission,
        registry: submission.registry.toLowerCase() as Address,
        attester: submission.attester.toLowerCase() as Address,
      },
    ),
  ).toEqual({ status: "confirmed", hash: txHash });

  expect(
    classifyReceipt(
      {
        status: "reverted",
        transactionHash: txHash,
        logs: [makePublishedLog()],
      },
      submission,
    ),
  ).toEqual({ status: "reverted", hash: txHash });

  expect(
    classifyReceipt(
      { status: "success", transactionHash: txHash, logs: [] },
      submission,
    ),
  ).toEqual({ status: "unverified", hash: txHash });

  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: txHash,
        logs: [makePublishedLog({ address: otherAddress })],
      },
      submission,
    ),
  ).toEqual({ status: "unverified", hash: txHash });

  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: txHash,
        logs: [makePublishedLog({ reportHash: ("0x" + "b".repeat(64)) as Hex })],
      },
      submission,
    ),
  ).toEqual({ status: "unverified", hash: txHash });

  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: txHash,
        logs: [makePublishedLog({ attester: otherAddress })],
      },
      submission,
    ),
  ).toEqual({ status: "unverified", hash: txHash });

  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: txHash,
        logs: [makePublishedLog({ target: otherAddress })],
      },
      submission,
    ),
  ).toEqual({ status: "unverified", hash: txHash });
});

it("handles pending, timeout and transport errors without losing submission state", async () => {
  const submission = makeSubmission();

  const pending = await verifySubmissionReceipt({
    reader: makeReader({
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        if (hash?.toLowerCase() === txHash.toLowerCase()) {
          return {
            hash: txHash,
            from: attester,
            nonce: 7,
            blockNumber: null,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
      async getTransactionReceipt({ hash }) {
        throw new TransactionReceiptNotFoundError({ hash });
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(pending.status).toBe("pending");

  const unconfirmedMissingTx = await verifySubmissionReceipt({
    reader: makeReader({
      async getTransactionReceipt({ hash }) {
        throw new TransactionReceiptNotFoundError({ hash });
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(unconfirmedMissingTx.status).toBe("unavailable");

  vi.useFakeTimers();
  const waitPromise = verifySubmissionReceipt({
    reader: makeReader({
      waitForTransactionReceipt({ hash, timeout = 60000 }) {
        return new Promise((_, reject) => {
          setTimeout(
            () => reject(new WaitForTransactionReceiptTimeoutError({ hash })),
            timeout,
          );
        });
      },
    }),
    checkContext: okContext,
    submission,
    wait: true,
    timeoutMs: 60000,
  });
  await vi.advanceTimersByTimeAsync(60000);
  expect((await waitPromise).status).toBe("timeout");

  const transportError = await verifySubmissionReceipt({
    reader: makeReader({
      async getTransactionReceipt() {
        throw new Error("RPC connection reset");
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(transportError.status).toBe("unavailable");
});

it("blocks receipt confirmation on wrong network, same-chain-ID mismatch and mid-read chainChanged", async () => {
  const submission = makeSubmission();
  const getReceiptSpy = vi.fn(async () => ({
    status: "success" as const,
    transactionHash: txHash,
    logs: [makePublishedLog()],
  }));

  const wrongChain = await verifySubmissionReceipt({
    reader: makeReader({
      async getChainId() {
        return 1;
      },
      getTransactionReceipt: getReceiptSpy,
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(wrongChain.status).toBe("wrong-network");
  expect(getReceiptSpy).not.toHaveBeenCalled();

  const snapshotMismatch = await verifySubmissionReceipt({
    reader: makeReader({
      async getChainId() {
        return 43113;
      },
      async getBlock() {
        return { hash: ("0x" + "f".repeat(64)) as Hex };
      },
      getTransactionReceipt: getReceiptSpy,
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(snapshotMismatch.status).toBe("mismatch");
  expect(getReceiptSpy).not.toHaveBeenCalled();

  const codeMismatch = await verifySubmissionReceipt({
    reader: makeReader({
      async getCode() {
        return "0x" as Hex;
      },
      getTransactionReceipt: getReceiptSpy,
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(codeMismatch.status).toBe("mismatch");
  expect(getReceiptSpy).not.toHaveBeenCalled();

  const serverMismatch = await verifySubmissionReceipt({
    reader: makeReader({ getTransactionReceipt: getReceiptSpy }),
    checkContext: async () => ({
      ok: true,
      data: { address: otherAddress, codehash: runtimeCodehash },
    }),
    submission,
    wait: false,
  });
  expect(serverMismatch.status).toBe("mismatch");
  expect(getReceiptSpy).not.toHaveBeenCalled();

  const serverUnavailable = await verifySubmissionReceipt({
    reader: makeReader({ getTransactionReceipt: getReceiptSpy }),
    checkContext: async () => ({
      ok: false,
      error: "Reader registry or snapshot mismatch.",
    }),
    submission,
    wait: false,
  });
  expect(serverUnavailable).toEqual({
    status: "unavailable",
    message: "Reader registry or snapshot mismatch.",
  });
  expect(getReceiptSpy).not.toHaveBeenCalled();

  // Mid-read chainChanged to a wrong network must prevent confirmation.
  let chainRev = 1;
  let chainId = 43113;
  let resolveReceipt!: (value: ReceiptLike) => void;
  const midRead = verifySubmissionReceipt({
    reader: makeReader({
      async getChainId() {
        return chainId;
      },
      getTransactionReceipt() {
        return new Promise((resolve) => {
          resolveReceipt = resolve;
        });
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
    getChainRevision: () => chainRev,
  });
  await vi.waitFor(() => expect(resolveReceipt).toBeDefined());
  chainRev = 2;
  chainId = 1;
  resolveReceipt({
    status: "success",
    transactionHash: txHash,
    logs: [makePublishedLog()],
  });
  expect((await midRead).status).toBe("wrong-network");
});

it("rethrows AbortError when cancelled by report change or unmount", async () => {
  const submission = makeSubmission();
  const controller = new AbortController();
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = verifySubmissionReceipt({
    reader: makeReader({
      waitForTransactionReceipt({ signal }) {
        started();
        if (signal?.aborted)
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        return new Promise((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    }),
    checkContext: okContext,
    submission,
    wait: true,
    signal: controller.signal,
  });
  await waiting;
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("does not classify a replacement transaction receipt as confirming or reverting the original hash", async () => {
  const submission = makeSubmission();
  const replacementHash = ("0x" + "b".repeat(64)) as Hex;

  expect(
    classifyReceipt(
      {
        status: "success",
        transactionHash: ("0x" + txHash.slice(2).toUpperCase()) as Hex,
        logs: [makePublishedLog()],
      },
      submission,
    ),
  ).toEqual({
    status: "confirmed",
    hash: ("0x" + txHash.slice(2).toUpperCase()) as Hex,
  });

  expect(
    classifyReceipt(
      {
        status: "reverted",
        transactionHash: replacementHash,
        logs: [],
      },
      submission,
    ),
  ).toMatchObject({
    status: "unavailable",
  });

  const withoutOnReplaced = await verifySubmissionReceipt({
    reader: makeReader({
      async waitForTransactionReceipt() {
        return {
          status: "success",
          transactionHash: replacementHash,
          logs: [makePublishedLog()],
        };
      },
    }),
    checkContext: okContext,
    submission,
    wait: true,
  });
  expect(withoutOnReplaced.status).toBe("unavailable");

  for (const status of ["reverted", "success"] as const) {
    const replacementReceipt: ReceiptLike = {
      status,
      transactionHash: replacementHash,
      logs: status === "success" ? [makePublishedLog()] : [],
    };
    const replacedOutcome = await verifySubmissionReceipt({
      reader: makeReader({
        async waitForTransactionReceipt({ onReplaced }) {
          onReplaced?.({
            reason: "replaced",
            replacedTransaction: {
              hash: txHash,
              from: attester,
              nonce: 7,
            },
            transaction: {
              hash: replacementHash,
              from: attester,
              nonce: 7,
            },
            transactionReceipt: replacementReceipt,
          });
          return replacementReceipt;
        },
      }),
      checkContext: okContext,
      submission: { ...submission, nonce: 7 },
      wait: true,
    });
    expect(replacedOutcome).toEqual({
      status: "replaced",
      originalHash: txHash,
      replacementHash,
    });
  }
});

it("discards a receipt read during an A -> B -> A chainChanged round-trip and recovers on A", async () => {
  const submission = makeSubmission();
  let chainRev = 1;
  let currentChainId = 43113;
  let resolveReceipt!: (value: ReceiptLike) => void;

  const firstAttempt = verifySubmissionReceipt({
    reader: makeReader({
      async getChainId() {
        return currentChainId;
      },
      getTransactionReceipt() {
        return new Promise((resolve) => {
          resolveReceipt = resolve;
        });
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
    getChainRevision: () => chainRev,
  });

  await vi.waitFor(() => expect(resolveReceipt).toBeDefined());
  // Switch A -> B while receipt read is in flight, then switch back B -> A before resolving.
  chainRev = 2;
  currentChainId = 1;
  const receiptReadOnB: ReceiptLike = {
    status: "reverted",
    transactionHash: txHash,
    logs: [],
  };
  chainRev = 3;
  currentChainId = 43113;
  resolveReceipt(receiptReadOnB);

  const firstOutcome = await firstAttempt;
  expect(firstOutcome.status).toBe("pending");
  expect(firstOutcome).toMatchObject({
    status: "pending",
    message: expect.stringMatching(/Wallet network changed while reading/),
  });

  // Re-reading steadily on A confirms the original submission.
  const retryOutcome = await verifySubmissionReceipt({
    reader: makeReader(),
    checkContext: okContext,
    submission,
    wait: false,
    getChainRevision: () => chainRev,
  });
  expect(retryOutcome).toEqual({ status: "confirmed", hash: txHash });
});

it("detects a replacement transaction mined after the initial wait timed out", async () => {
  const replacementHash = ("0x" + "c".repeat(64)) as Hex;
  const submission = {
    ...makeSubmission(),
    nonce: 7,
    submittedBlock: 10n,
  } as Submission;

  vi.useFakeTimers();
  const waitPromise = verifySubmissionReceipt({
    reader: makeReader({
      waitForTransactionReceipt({ hash, timeout = 60000 }) {
        return new Promise((_, reject) => {
          setTimeout(
            () => reject(new WaitForTransactionReceiptTimeoutError({ hash })),
            timeout,
          );
        });
      },
    }),
    checkContext: okContext,
    submission,
    wait: true,
    timeoutMs: 60000,
  });
  await vi.advanceTimersByTimeAsync(60000);
  expect((await waitPromise).status).toBe("timeout");
  vi.useRealTimers();

  // After timeout, B is mined with the same attester + nonce while A is dropped/unmined.
  const recheck = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getBlock({ blockNumber, includeTransactions }: { blockNumber: bigint; includeTransactions?: boolean }) {
          if (includeTransactions && blockNumber === 12n) {
            return {
              hash: submission.blockHash,
              transactions: [
                {
                  from: attester,
                  nonce: 7,
                  hash: replacementHash,
                },
              ],
            };
          }
          return {
            hash: submission.blockHash,
            transactions: [],
          };
        },
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === replacementHash.toLowerCase()) {
            return {
              status: "reverted",
              transactionHash: replacementHash,
              logs: [],
            };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getBlockNumber() {
        return 12n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });

  expect(recheck).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash,
  });
});

it("treats receipts missing or malformed transactionHash as unavailable rather than replaced", async () => {
  const submission = makeSubmission();

  const missing = classifyReceipt(
    {
      status: "success",
      transactionHash: undefined as unknown as Hex,
      logs: [makePublishedLog()],
    },
    submission,
  );
  expect(missing.status).toBe("unavailable");
  expect(missing.status).not.toBe("replaced");

  const malformed = classifyReceipt(
    {
      status: "reverted",
      transactionHash: "0x1234" as Hex,
      logs: [],
    },
    submission,
  );
  expect(malformed.status).toBe("unavailable");

  const recovered = await verifySubmissionReceipt({
    reader: makeReader({
      async getTransactionReceipt() {
        return {
          status: "success",
          transactionHash: "" as Hex,
          logs: [makePublishedLog()],
        };
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(recovered.status).toBe("unavailable");
});

it("refuses speculative nonce 7 when A was sent at nonce 8 and tracks A once verified", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  const hashC = ("0x" + "c".repeat(64)) as Hex;
  const unverifiedSubmission = makeSubmission(); // nonce is undefined initially
  let passedReplacement: unknown = "unset";

  // During initial wait without verified nonce, receipt B without onReplaced proof must not become replaced.
  const waitWithoutProof = await verifySubmissionReceipt({
    reader: makeReader({
      async waitForTransactionReceipt(args) {
        passedReplacement = args.replacement;
        return {
          status: "success",
          transactionHash: hashB,
          logs: [makePublishedLog()],
        };
      },
    }),
    checkContext: okContext,
    submission: unverifiedSubmission,
    wait: true,
  });
  expect(passedReplacement).toBeUndefined();
  expect(waitWithoutProof.status).toBe("unavailable");

  // During Check receipt before node knows A, mined B at nonce 7 must not be reported as replacing A.
  const missingOrig = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return {
              status: "success",
              transactionHash: hashB,
              logs: [makePublishedLog()],
            };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions && blockNumber === 11n) {
            return {
              hash: unverifiedSubmission.blockHash,
              transactions: [{ from: attester, nonce: 7, hash: hashB }],
            };
          }
          return { hash: unverifiedSubmission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 11n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: unverifiedSubmission,
    wait: false,
  });
  expect(missingOrig.status).toBe("unavailable");

  // Mismatched transaction identity from getTransaction({ hash: A }) must never donate nonce 7 to A.
  const corruptOrig = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return { status: "reverted", transactionHash: hashB, logs: [] };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions && blockNumber === 11n) {
            return {
              hash: unverifiedSubmission.blockHash,
              transactions: [{ from: attester, nonce: 7, hash: hashB }],
            };
          }
          return { hash: unverifiedSubmission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 11n;
      },
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("hash" in args && args.hash) {
          return {
            hash: hashB,
            from: otherAddress,
            nonce: 7,
            blockNumber: null,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: unverifiedSubmission,
    wait: false,
  });
  expect(corruptOrig.status).toBe("unavailable");

  // Recovery: node returns exact A (case-insensitive hash/from) with true nonce 8 pending.
  const trackedAt8 = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return { status: "success", transactionHash: hashB, logs: [] };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions && blockNumber === 11n) {
            return {
              hash: unverifiedSubmission.blockHash,
              transactions: [{ from: attester, nonce: 7, hash: hashB }],
            };
          }
          return { hash: unverifiedSubmission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 11n;
      },
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("hash" in args && args.hash) {
          return {
            hash: ("0x" + txHash.slice(2).toUpperCase()) as Hex,
            from: attester.toLowerCase() as Address,
            nonce: 8,
            blockNumber: null,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: unverifiedSubmission,
    wait: false,
  });
  expect(trackedAt8).toMatchObject({
    status: "pending",
    message: expect.stringMatching(/still pending/),
  });

  // Once tracked at verified nonce 8, a real replacement C at nonce 8 is detected accurately.
  const trackedSubmission: Submission = {
    ...unverifiedSubmission,
    nonce: 8,
    submittedBlock: 10n,
  };
  const replacedAt8 = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashC.toLowerCase()) {
            return { status: "reverted", transactionHash: hashC, logs: [] };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions && blockNumber === 12n) {
            return {
              hash: trackedSubmission.blockHash,
              transactions: [
                { from: attester, nonce: 7, hash: hashB },
                { from: attester, nonce: 8, hash: hashC },
              ],
            };
          }
          return { hash: trackedSubmission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 12n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: trackedSubmission,
    wait: false,
  });
  expect(replacedAt8).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashC,
  });
});

it("binds direct receipt reads to the requested hash for original A and candidate B", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  const hashC = ("0x" + "c".repeat(64)) as Hex;
  const submission: Submission = {
    ...makeSubmission(),
    nonce: 7,
    submittedBlock: 10n,
  };

  // 1. Ask for receipt of A, RPC returns receipt of unrelated C -> unavailable, never C as replacement.
  const askARecvC = await verifySubmissionReceipt({
    reader: makeReader({
      async getTransactionReceipt() {
        return {
          status: "success",
          transactionHash: hashC,
          logs: [makePublishedLog()],
        };
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(askARecvC.status).toBe("unavailable");

  // 2a. Find candidate B via sender/nonce, ask receipt for B, RPC returns C -> unavailable.
  const askBFromSenderNonceRecvC = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return {
              status: "success",
              transactionHash: hashC,
              logs: [makePublishedLog()],
            };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("sender" in args) {
          return {
            hash: hashB,
            from: attester,
            nonce: 7,
            blockNumber: 11n,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(askBFromSenderNonceRecvC.status).toBe("unavailable");

  // 2b. Find candidate B via block scan, ask receipt for B, RPC returns C -> unavailable.
  const askBFromScanRecvC = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return {
              status: "reverted",
              transactionHash: hashC,
              logs: [],
            };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions && blockNumber === 11n) {
            return {
              hash: submission.blockHash,
              transactions: [{ from: attester, nonce: 7, hash: hashB }],
            };
          }
          return { hash: submission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 11n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(askBFromScanRecvC.status).toBe("unavailable");

  // 3. Find candidate B and get matching receipt B -> replaced with both A and B.
  const askBRecvB = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return {
              status: "success",
              transactionHash: hashB,
              logs: [makePublishedLog()],
            };
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("sender" in args) {
          return {
            hash: hashB,
            from: attester,
            nonce: 7,
            blockNumber: 11n,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(askBRecvB).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashB,
  });
});

it("returns retryable unavailable instead of pending when block scan stops before submittedBlock 100", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  const submission: Submission = {
    ...makeSubmission(),
    nonce: 7,
    submittedBlock: 100n,
  };
  const scannedBlocks: bigint[] = [];

  const partial = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          throw new TransactionReceiptNotFoundError({ hash });
        },
        async getBlock({ blockNumber, includeTransactions }) {
          if (includeTransactions) {
            scannedBlocks.push(blockNumber);
            if (blockNumber === 101n) {
              return {
                hash: submission.blockHash,
                transactions: [{ from: attester, nonce: 7, hash: hashB }],
              };
            }
          }
          return { hash: submission.blockHash, transactions: [] };
        },
      }),
      async getBlockNumber() {
        return 240n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });

  // Bounded finite scan from 240 down to 112 (does not reach 101 or 100).
  expect(scannedBlocks.length).toBeGreaterThan(0);
  expect(scannedBlocks.length).toBeLessThanOrEqual(129);
  expect(scannedBlocks).not.toContain(101n);
  expect(partial.status).toBe("unavailable");
  if ("message" in partial) {
    expect(partial.message).not.toMatch(/still pending/i);
    expect(partial.message).toMatch(/do not cover the original submission/i);
  }

  // Without submittedBlock known, missing receipt/tx must not conclude pending either.
  const unknownBlockOutcome = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getBlockNumber() {
        return 240n;
      },
      async getTransaction({ hash }: { hash?: Hex; sender?: Address; nonce?: number }) {
        throw new TransactionReceiptNotFoundError({ hash: hash ?? txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: { ...makeSubmission(), nonce: 7 },
    wait: false,
  });
  expect(unknownBlockOutcome.status).toBe("unavailable");

  // Positive control: when node returns exact A with blockNumber === null, status is still pending.
  const realPending = await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getBlockNumber() {
        return 240n;
      },
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("hash" in args && args.hash?.toLowerCase() === txHash.toLowerCase()) {
          return {
            hash: txHash,
            from: attester,
            nonce: 7,
            blockNumber: null,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(realPending).toMatchObject({
    status: "pending",
    message: expect.stringMatching(/still pending/),
  });
});

it("validates transaction identity, rejects corrupt replacement candidates, and discards candidate reads across mid-read chainChanged", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  expect(
    validateSubmittedTransaction(
      {
        hash: ("0x" + txHash.slice(2).toUpperCase()) as Hex,
        from: attester.toLowerCase(),
        nonce: 8,
        blockNumber: null,
      },
      txHash,
      attester,
    ),
  ).toEqual({ nonce: 8, submittedBlock: undefined });
  expect(
    validateSubmittedTransaction(
      { hash: hashB, from: attester, nonce: 7, blockNumber: null },
      txHash,
      attester,
    ),
  ).toBeNull();
  expect(
    validateSubmittedTransaction(
      { hash: txHash, from: otherAddress, nonce: 7, blockNumber: null },
      txHash,
      attester,
    ),
  ).toBeNull();
  expect(
    validateSubmittedTransaction(
      { hash: txHash, from: attester, nonce: -1, blockNumber: null },
      txHash,
      attester,
    ),
  ).toBeNull();

  // onVerifiedTransaction persists true nonce 8 discovered during Check receipt.
  let observedNonce: number | undefined;
  await verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getTransactionReceipt({ hash }) {
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("hash" in args && args.hash?.toLowerCase() === txHash.toLowerCase()) {
          return {
            hash: txHash,
            from: attester,
            nonce: 8,
            blockNumber: null,
          };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: makeSubmission(),
    wait: false,
    onVerifiedTransaction: (meta) => {
      observedNonce = meta.nonce;
    },
  });
  expect(observedNonce).toBe(8);

  const tracked: Submission = {
    ...makeSubmission(),
    nonce: 7,
    submittedBlock: 10n,
  };

  // Unmined or mismatched sender/nonce candidates are never marked as replaced.
  for (const badCandidate of [
    { hash: hashB, from: attester, nonce: 7, blockNumber: null },
    { hash: hashB, from: otherAddress, nonce: 7, blockNumber: 11n },
    { hash: hashB, from: attester, nonce: 8, blockNumber: 11n },
  ]) {
    const out = await verifySubmissionReceipt({
      reader: {
        ...makeReader({
          async getTransactionReceipt({ hash }) {
            if (hash.toLowerCase() === hashB.toLowerCase()) {
              return { status: "success", transactionHash: hashB, logs: [] };
            }
            throw new TransactionReceiptNotFoundError({ hash });
          },
        }),
        async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
          if ("sender" in args) return badCandidate;
          throw new TransactionReceiptNotFoundError({ hash: txHash });
        },
      } as ReceiptReader,
      checkContext: okContext,
      submission: tracked,
      wait: false,
    });
    expect(out.status).toBe("unavailable");
  }

  // Mid-read A -> B -> A chainChanged while reading candidate receipt B discards the candidate receipt.
  let chainRev = 1;
  let chainId = 43113;
  let resolveCandidateReceipt!: (value: ReceiptLike) => void;
  const midReadCandidate = verifySubmissionReceipt({
    reader: {
      ...makeReader({
        async getChainId() {
          return chainId;
        },
        getTransactionReceipt({ hash }) {
          if (hash.toLowerCase() === hashB.toLowerCase()) {
            return new Promise((resolve) => {
              resolveCandidateReceipt = resolve;
            });
          }
          throw new TransactionReceiptNotFoundError({ hash });
        },
      }),
      async getTransaction(args: { hash?: Hex; sender?: Address; nonce?: number }) {
        if ("sender" in args) {
          return { hash: hashB, from: attester, nonce: 7, blockNumber: 11n };
        }
        throw new TransactionReceiptNotFoundError({ hash: txHash });
      },
    } as ReceiptReader,
    checkContext: okContext,
    submission: tracked,
    wait: false,
    getChainRevision: () => chainRev,
  });
  await vi.waitFor(() => expect(resolveCandidateReceipt).toBeDefined());
  chainRev = 2;
  chainId = 1;
  chainRev = 3;
  chainId = 43113;
  resolveCandidateReceipt({
    status: "success",
    transactionHash: hashB,
    logs: [],
  });
  expect(await midReadCandidate).toMatchObject({
    status: "pending",
    message: expect.stringMatching(/Wallet network changed while reading/),
  });
});

it("refuses wait:true onReplaced when submission.nonce is unverified and eth_getTransactionByHash(A) omits hash (real viem client)", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  const block32Hash = makeSubmission().blockHash;
  const block33Hash = ("0x" + "d".repeat(64)) as Hex;
  const rHex = ("0x" + "1".repeat(64)) as Hex;
  const sHex = ("0x" + "2".repeat(64)) as Hex;
  const zeroBloom = ("0x" + "0".repeat(512)) as Hex;
  const emptyLogsRoot = ("0x" + "0".repeat(64)) as Hex;

  async function runScenario({ includeOrigHash }: { includeOrigHash: boolean }) {
    const submission = makeSubmission(); // attester set, nonce undefined
    const seenMethods: string[] = [];
    const client = createPublicClient({
      pollingInterval: 10,
      transport: custom({
        async request({ method, params }) {
          seenMethods.push(method);
          const args = Array.isArray(params) ? params : [];
          if (method === "eth_chainId") return "0xa869";
          if (method === "eth_blockNumber") return "0x21";
          if (method === "eth_getCode") return runtimeCode;
          if (method === "eth_getTransactionReceipt") {
            const reqHash = String(args[0] ?? "").toLowerCase();
            if (reqHash === txHash.toLowerCase()) return null;
            if (reqHash === hashB.toLowerCase()) {
              return {
                blockHash: block33Hash,
                blockNumber: "0x21",
                contractAddress: null,
                cumulativeGasUsed: "0x5208",
                effectiveGasPrice: "0x1",
                from: attester,
                gasUsed: "0x5208",
                logs: [],
                logsBloom: zeroBloom,
                status: "0x1",
                to: otherAddress,
                transactionHash: hashB,
                transactionIndex: "0x0",
                type: "0x0",
              };
            }
            return null;
          }
          if (method === "eth_getTransactionByHash") {
            const reqHash = String(args[0] ?? "").toLowerCase();
            if (reqHash === txHash.toLowerCase()) {
              return {
                ...(includeOrigHash ? { hash: txHash } : {}),
                blockHash: null,
                blockNumber: null,
                from: attester,
                gas: "0x5208",
                gasPrice: "0x1",
                input: "0x",
                nonce: "0x7",
                r: rHex,
                s: sHex,
                to: registry,
                transactionIndex: null,
                type: "0x0",
                v: "0x1b",
                value: "0x0",
              };
            }
            return null;
          }
          if (method === "eth_getBlockByNumber") {
            const blockNum = String(args[0] ?? "").toLowerCase();
            const includeTxs = Boolean(args[1]);
            if (blockNum === "0x20") {
              return {
                hash: block32Hash,
                number: "0x20",
                parentHash: emptyLogsRoot,
                nonce: "0x0000000000000000",
                sha3Uncles: emptyLogsRoot,
                logsBloom: zeroBloom,
                transactionsRoot: emptyLogsRoot,
                stateRoot: emptyLogsRoot,
                receiptsRoot: emptyLogsRoot,
                miner: zeroAddress,
                difficulty: "0x0",
                extraData: "0x",
                size: "0x0",
                gasLimit: "0x1c9c380",
                gasUsed: "0x0",
                timestamp: "0x65",
                transactions: [],
                uncles: [],
              };
            }
            if (blockNum === "0x21") {
              return {
                hash: block33Hash,
                number: "0x21",
                parentHash: block32Hash,
                nonce: "0x0000000000000000",
                sha3Uncles: emptyLogsRoot,
                logsBloom: zeroBloom,
                transactionsRoot: emptyLogsRoot,
                stateRoot: emptyLogsRoot,
                receiptsRoot: emptyLogsRoot,
                miner: zeroAddress,
                difficulty: "0x0",
                extraData: "0x",
                size: "0x0",
                gasLimit: "0x1c9c380",
                gasUsed: "0x5208",
                timestamp: "0x66",
                transactions: includeTxs
                  ? [
                      {
                        blockHash: block33Hash,
                        blockNumber: "0x21",
                        from: attester,
                        gas: "0x5208",
                        gasPrice: "0x2",
                        hash: hashB,
                        input: "0x1234",
                        nonce: "0x7",
                        r: rHex,
                        s: sHex,
                        to: otherAddress,
                        transactionIndex: "0x0",
                        type: "0x0",
                        v: "0x1b",
                        value: "0x0",
                      },
                    ]
                  : [],
                uncles: [],
              };
            }
          }
          throw new Error(`Unexpected RPC method in test: ${method}`);
        },
      }),
    });

    const outcome = await verifySubmissionReceipt({
      reader: client,
      checkContext: okContext,
      submission,
      wait: true,
      timeoutMs: 5000,
    });
    return { client, submission, outcome, seenMethods };
  }

  // Missing orig.hash when submission.nonce is unverified must never announce B as replacement.
  const missingOrigHash = await runScenario({ includeOrigHash: false });
  expect(missingOrigHash.seenMethods).toContain("eth_getTransactionByHash");
  expect(missingOrigHash.seenMethods).not.toContain("eth_sendTransaction");
  expect(missingOrigHash.seenMethods).not.toContain("eth_sendRawTransaction");
  expect(missingOrigHash.outcome).toMatchObject({
    status: "unavailable",
    message: expect.stringMatching(/Check receipt/i),
  });

  // Subsequent Check receipt (read-only wait: false) also refuses to announce B and sends no transaction.
  const recheckWhileMissing = await verifySubmissionReceipt({
    reader: missingOrigHash.client,
    checkContext: okContext,
    submission: missingOrigHash.submission,
    wait: false,
  });
  expect(recheckWhileMissing.status).toBe("unavailable");
  expect(missingOrigHash.seenMethods).not.toContain("eth_sendTransaction");
  expect(missingOrigHash.seenMethods).not.toContain("eth_sendRawTransaction");

  // Positive control differing only by returning hash: A proves full wait:true replacement detection.
  const withOrigHash = await runScenario({ includeOrigHash: true });
  expect(withOrigHash.outcome).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashB,
  });
});

it("enforces evidence-source rules for wait:true onReplaced across unverified and verified submission.nonce", async () => {
  const hashB = ("0x" + "b".repeat(64)) as Hex;
  const hashC = ("0x" + "c".repeat(64)) as Hex;
  const baseSubmission = makeSubmission();
  const receiptB: ReceiptLike = {
    status: "success",
    transactionHash: hashB,
    logs: [],
  };

  async function runOnReplaced(
    submission: Submission,
    info: Parameters<
      NonNullable<Parameters<ReceiptReader["waitForTransactionReceipt"]>[0]["onReplaced"]>
    >[0],
    returnedReceipt: ReceiptLike = receiptB,
  ) {
    return verifySubmissionReceipt({
      reader: makeReader({
        async waitForTransactionReceipt({ onReplaced }) {
          onReplaced?.(info);
          return returnedReceipt;
        },
      }),
      checkContext: okContext,
      submission,
      wait: true,
    });
  }

  // When submission.nonce is unverified, replacedTransaction must prove hash=A, from=attester, nonce=B.nonce.
  expect(
    (
      await runOnReplaced(baseSubmission, {
        reason: "replaced",
        replacedTransaction: undefined,
        transaction: { hash: hashB, from: attester, nonce: 7 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(baseSubmission, {
        reason: "replaced",
        replacedTransaction: { from: attester, nonce: 7 },
        transaction: { hash: hashB, from: attester, nonce: 7 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(baseSubmission, {
        reason: "replaced",
        replacedTransaction: { hash: txHash, from: otherAddress, nonce: 7 },
        transaction: { hash: hashB, from: attester, nonce: 7 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(baseSubmission, {
        reason: "replaced",
        replacedTransaction: { hash: txHash, from: attester, nonce: 8 },
        transaction: { hash: hashB, from: attester, nonce: 7 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  // Case-insensitive A and attester with valid proof succeed (speed-up/cancel allowed).
  expect(
    await runOnReplaced(baseSubmission, {
      reason: "cancelled",
      replacedTransaction: {
        hash: ("0x" + txHash.slice(2).toUpperCase()) as Hex,
        from: attester.toLowerCase() as Address,
        nonce: 7,
      },
      transaction: {
        hash: ("0x" + hashB.slice(2).toUpperCase()) as Hex,
        from: attester.toUpperCase().replace("0X", "0x") as Address,
        nonce: 7,
      },
      transactionReceipt: receiptB,
    }),
  ).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashB,
  });

  // When submission.nonce IS verified, use verified sender/nonce even if replacedTransaction is omitted,
  // unless callback carries contradictory original data or invalid/mismatched replacement proof.
  const verifiedSubmission: Submission = { ...baseSubmission, nonce: 7 };
  expect(
    await runOnReplaced(verifiedSubmission, {
      reason: "replaced",
      replacedTransaction: undefined,
      transaction: { hash: hashB, from: attester, nonce: 7 },
      transactionReceipt: receiptB,
    }),
  ).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashB,
  });

  expect(
    await runOnReplaced(verifiedSubmission, {
      reason: "replaced",
      replacedTransaction: { from: attester, nonce: 7 },
      transaction: { hash: hashB, from: attester, nonce: 7 },
      transactionReceipt: receiptB,
    }),
  ).toEqual({
    status: "replaced",
    originalHash: txHash,
    replacementHash: hashB,
  });

  for (const contradictoryOrig of [
    { hash: hashC, from: attester, nonce: 7 },
    { hash: "" as Hex, from: attester, nonce: 7 },
    { hash: txHash, from: otherAddress, nonce: 7 },
    { hash: txHash, from: attester, nonce: 8 },
    { hash: txHash, from: attester, nonce: -1 },
    null as unknown as { hash?: Hex },
  ]) {
    expect(
      (
        await runOnReplaced(verifiedSubmission, {
          reason: "replaced",
          replacedTransaction: contradictoryOrig,
          transaction: { hash: hashB, from: attester, nonce: 7 },
          transactionReceipt: receiptB,
        })
      ).status,
    ).toBe("unavailable");
  }

  // Mismatched B sender/nonce or B===A or mismatched receipt hash still rejected.
  expect(
    (
      await runOnReplaced(verifiedSubmission, {
        reason: "replaced",
        replacedTransaction: { hash: txHash, from: attester, nonce: 7 },
        transaction: { hash: hashB, from: otherAddress, nonce: 7 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(verifiedSubmission, {
        reason: "replaced",
        replacedTransaction: { hash: txHash, from: attester, nonce: 7 },
        transaction: { hash: hashB, from: attester, nonce: 8 },
        transactionReceipt: receiptB,
      })
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(
        verifiedSubmission,
        {
          reason: "replaced",
          replacedTransaction: { hash: txHash, from: attester, nonce: 7 },
          transaction: { hash: hashC, from: attester, nonce: 7 },
          transactionReceipt: receiptB,
        },
        receiptB,
      )
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(
        verifiedSubmission,
        {
          reason: "replaced",
          replacedTransaction: { hash: txHash, from: attester, nonce: 7 },
          transaction: { hash: hashB, from: attester, nonce: 7 },
          transactionReceipt: { transactionHash: hashC, status: "success" },
        },
        receiptB,
      )
    ).status,
  ).toBe("unavailable");

  expect(
    (
      await runOnReplaced(
        verifiedSubmission,
        {
          reason: "replaced",
          replacedTransaction: { hash: txHash, from: attester, nonce: 7 },
          transaction: { hash: hashB, from: attester, nonce: 7 },
          transactionReceipt: { transactionHash: hashB, status: "reverted" },
        },
        receiptB,
      )
    ).status,
  ).toBe("unavailable");
});
