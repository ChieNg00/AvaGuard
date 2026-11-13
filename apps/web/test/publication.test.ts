import { afterEach, expect, it, vi } from "vitest";
import {
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
      async getTransactionReceipt({ hash }) {
        throw new TransactionReceiptNotFoundError({ hash });
      },
    }),
    checkContext: okContext,
    submission,
    wait: false,
  });
  expect(pending.status).toBe("pending");

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
