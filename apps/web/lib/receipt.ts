import {
  keccak256,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type Address,
  type Hex,
  type Log,
  type RpcLog,
} from "viem";
import { registryAbi } from "./registry-abi";

export type SubmissionStatus =
  | "pending"
  | "confirmed"
  | "reverted"
  | "unverified";

export type Submission = {
  hash: Hex;
  registry: Address;
  registryCodehash: Hex;
  attester: Address;
  target: Address;
  reportHash: Hex;
  blockNumber: string;
  blockHash: Hex;
  status: SubmissionStatus;
};

export type ReceiptLike = {
  status: "success" | "reverted";
  transactionHash: Hex;
  logs: (Log | RpcLog)[];
};

export type NetworkFailureOutcome = {
  status: "unavailable" | "wrong-network" | "mismatch";
  message: string;
};

export type ReceiptOutcome =
  | { status: "confirmed"; hash: Hex }
  | { status: "reverted"; hash: Hex }
  | { status: "unverified"; hash: Hex }
  | { status: "pending" | "timeout"; message: string }
  | NetworkFailureOutcome;

export type ReceiptReader = {
  getChainId(): Promise<number>;
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: Hex | null }>;
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  getTransactionReceipt(args: { hash: Hex }): Promise<ReceiptLike>;
  waitForTransactionReceipt(args: {
    hash: Hex;
    timeout?: number;
    retryCount?: number;
    signal?: AbortSignal;
  }): Promise<ReceiptLike>;
};

export type ContextReader = (
  block: string,
  hash: string,
) => Promise<
  | { readonly ok: true; readonly data: { address: Address; codehash: Hex } }
  | { readonly ok: false; readonly error: string }
>;

export function classifyReceipt(
  receipt: ReceiptLike,
  submission: Pick<
    Submission,
    "registry" | "target" | "reportHash" | "attester"
  >,
): Extract<ReceiptOutcome, { status: "confirmed" | "reverted" | "unverified" }> {
  if (receipt.status !== "success")
    return { status: "reverted", hash: receipt.transactionHash };
  const published = parseEventLogs({
    abi: registryAbi,
    logs: receipt.logs,
    eventName: "ReportPublished",
  }).some(
    (event) =>
      event.address.toLowerCase() === submission.registry.toLowerCase() &&
      event.args.target.toLowerCase() === submission.target.toLowerCase() &&
      event.args.reportHash.toLowerCase() ===
        submission.reportHash.toLowerCase() &&
      event.args.attester.toLowerCase() === submission.attester.toLowerCase(),
  );
  return published
    ? { status: "confirmed", hash: receipt.transactionHash }
    : { status: "unverified", hash: receipt.transactionHash };
}

type NetworkCheck = { ok: true } | { ok: false; outcome: NetworkFailureOutcome };

async function verifySubmissionNetwork(
  reader: ReceiptReader,
  checkContext: ContextReader,
  submission: Submission,
): Promise<NetworkCheck> {
  const ctx = await checkContext(submission.blockNumber, submission.blockHash);
  if (!ctx.ok)
    return {
      ok: false,
      outcome: { status: "unavailable", message: ctx.error },
    };
  if (
    ctx.data.address.toLowerCase() !== submission.registry.toLowerCase() ||
    ctx.data.codehash.toLowerCase() !== submission.registryCodehash.toLowerCase()
  )
    return {
      ok: false,
      outcome: {
        status: "mismatch",
        message:
          "Reader registry or snapshot mismatch. Switch back to the original local Anvil network (43113) and use Check receipt.",
      },
    };
  if ((await reader.getChainId()) !== 43113)
    return {
      ok: false,
      outcome: {
        status: "wrong-network",
        message:
          "Wrong wallet network. Select the original local Anvil network (43113) and use Check receipt.",
      },
    };
  const [snapshot, code] = await Promise.all([
    reader.getBlock({ blockNumber: BigInt(submission.blockNumber) }),
    reader.getCode({ address: submission.registry }),
  ]);
  if (
    !code ||
    keccak256(code).toLowerCase() !==
      submission.registryCodehash.toLowerCase() ||
    snapshot.hash?.toLowerCase() !== submission.blockHash.toLowerCase()
  )
    return {
      ok: false,
      outcome: {
        status: "mismatch",
        message:
          "Wallet and reader registry or snapshot mismatch. Select the original local Anvil network (43113) and use Check receipt.",
      },
    };
  return { ok: true };
}

export async function verifySubmissionReceipt({
  reader,
  checkContext,
  submission,
  wait,
  timeoutMs = 60000,
  signal,
  getChainRevision,
}: {
  reader: ReceiptReader;
  checkContext: ContextReader;
  submission: Submission;
  wait: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  getChainRevision?: () => number;
}): Promise<ReceiptOutcome> {
  const throwIfAborted = () => {
    if (signal?.aborted)
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException("Aborted", "AbortError");
  };
  try {
    throwIfAborted();
    const chainBefore = getChainRevision?.();
    const initialNetwork = await verifySubmissionNetwork(
      reader,
      checkContext,
      submission,
    );
    throwIfAborted();
    if (!initialNetwork.ok) return initialNetwork.outcome;
    const receipt = wait
      ? await reader.waitForTransactionReceipt({
          hash: submission.hash,
          timeout: timeoutMs,
          retryCount: 0,
          signal,
        })
      : await reader.getTransactionReceipt({ hash: submission.hash });
    throwIfAborted();
    if (getChainRevision && getChainRevision() !== chainBefore) {
      const currentNetwork = await verifySubmissionNetwork(
        reader,
        checkContext,
        submission,
      );
      throwIfAborted();
      if (!currentNetwork.ok) return currentNetwork.outcome;
    }
    return classifyReceipt(receipt, submission);
  } catch (e) {
    if (
      signal?.aborted ||
      (typeof e === "object" && e !== null && "name" in e && e.name === "AbortError")
    )
      throw e;
    if (e instanceof TransactionReceiptNotFoundError)
      return {
        status: "pending",
        message:
          "Transaction is still pending. Use Check receipt again once confirmed.",
      };
    if (e instanceof WaitForTransactionReceiptTimeoutError)
      return {
        status: "timeout",
        message:
          "Receipt timed out. Use Check receipt to verify the submitted transaction.",
      };
    return {
      status: "unavailable",
      message:
        "Receipt unavailable. Use Check receipt to verify the submitted transaction.",
    };
  }
}
