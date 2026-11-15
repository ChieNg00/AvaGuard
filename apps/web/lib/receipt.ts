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
import { networkLabelForMode, type AvaguardMode } from "./publication-config";

export type SubmissionStatus =
  | "pending"
  | "confirmed"
  | "reverted"
  | "unverified"
  | "replaced";

export type Submission = {
  hash: Hex;
  replacementHash?: Hex;
  registry: Address;
  registryCodehash: Hex;
  attester: Address;
  mode?: AvaguardMode;
  networkLabel?: string;
  /** Verified nonce observed from a node transaction matching `hash` and `attester`. */
  nonce?: number;
  submittedBlock?: bigint;
  input?: Hex;
  value?: bigint;
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

export type ReplacementInfo = {
  reason?: string;
  replacedTransaction?: {
    hash?: Hex;
    from?: Address;
    nonce?: number;
  };
  transaction?: {
    hash?: Hex;
    from?: Address;
    nonce?: number;
  };
  transactionReceipt?: {
    transactionHash?: Hex;
    status?: string;
  };
};

export type VerifiedTransactionMetadata = {
  nonce: number;
  submittedBlock?: bigint;
};

export type NetworkFailureOutcome = {
  status: "unavailable" | "wrong-network" | "mismatch";
  message: string;
};

export type ReceiptOutcome =
  | { status: "confirmed"; hash: Hex }
  | { status: "reverted"; hash: Hex }
  | { status: "unverified"; hash: Hex }
  | { status: "replaced"; originalHash: Hex; replacementHash: Hex }
  | { status: "pending" | "timeout"; message: string }
  | NetworkFailureOutcome;

export type ReplacementBlockTransaction = {
  from?: Address;
  hash?: Hex;
  nonce?: number;
};

export type ReceiptReader = {
  getChainId(): Promise<number>;
  getBlockNumber?(): Promise<bigint>;
  getBlock(args: {
    blockNumber: bigint;
    includeTransactions?: boolean;
  }): Promise<{
    hash: Hex | null;
    transactions?: readonly (Hex | ReplacementBlockTransaction)[];
  }>;
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  getTransaction?: {
    (args: { hash: Hex }): Promise<{
      hash: Hex;
      from: Address;
      nonce: number;
      blockNumber: bigint | null;
    }>;
    (args: { sender: Address; nonce: number }): Promise<{
      hash: Hex;
      from: Address;
      nonce: number;
      blockNumber: bigint | null;
    }>;
  };
  getTransactionReceipt(args: { hash: Hex }): Promise<ReceiptLike>;
  waitForTransactionReceipt(args: {
    hash: Hex;
    timeout?: number;
    retryCount?: number;
    signal?: AbortSignal;
    onReplaced?: (response: ReplacementInfo) => void;
    replacement?: {
      from: Address;
      nonce: number;
      to?: Address | null;
      input?: Hex;
      value?: bigint;
    };
  }): Promise<ReceiptLike>;
};

export type ContextReader = (
  block: string,
  hash: string,
) => Promise<
  | {
      readonly ok: true;
      readonly data: { address: Address; codehash: Hex; mode?: AvaguardMode };
    }
  | { readonly ok: false; readonly error: string }
>;

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const MAX_VERIFIED_BLOCK_LOOKBACK = 128n;
const MAX_UNBOUNDED_BLOCK_LOOKBACK = 16n;

function isValidTxHash(hash: unknown): hash is Hex {
  return typeof hash === "string" && TX_HASH_REGEX.test(hash);
}

function isValidNonce(nonce: unknown): nonce is number {
  return typeof nonce === "number" && Number.isInteger(nonce) && nonce >= 0;
}

function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  return (
    Boolean(signal?.aborted) ||
    (typeof err === "object" &&
      err !== null &&
      "name" in err &&
      err.name === "AbortError")
  );
}

/** Extracts verified nonce and optional mined block only when hash and sender match case-insensitively. */
export function validateSubmittedTransaction(
  tx: unknown,
  expectedHash: Hex,
  expectedAttester: Address,
): VerifiedTransactionMetadata | null {
  if (typeof tx !== "object" || tx === null) return null;
  const candidate = tx as {
    hash?: unknown;
    from?: unknown;
    nonce?: unknown;
    blockNumber?: unknown;
  };
  if (!isValidTxHash(candidate.hash)) return null;
  if (candidate.hash.toLowerCase() !== expectedHash.toLowerCase()) return null;
  if (
    typeof candidate.from !== "string" ||
    candidate.from.toLowerCase() !== expectedAttester.toLowerCase()
  )
    return null;
  if (!isValidNonce(candidate.nonce)) return null;
  return {
    nonce: candidate.nonce,
    submittedBlock:
      typeof candidate.blockNumber === "bigint" && candidate.blockNumber >= 0n
        ? candidate.blockNumber
        : undefined,
  };
}

function validateReceiptForHash(
  receipt: ReceiptLike,
  expectedHash: Hex,
):
  | { ok: true; receipt: ReceiptLike }
  | { ok: false; outcome: { status: "unavailable"; message: string } } {
  if (
    !isValidTxHash(receipt.transactionHash) ||
    (receipt.status !== "success" && receipt.status !== "reverted") ||
    !Array.isArray(receipt.logs)
  )
    return {
      ok: false,
      outcome: {
        status: "unavailable",
        message:
          "Receipt is missing a valid transaction hash. Use Check receipt to verify the submitted transaction.",
      },
    };
  if (receipt.transactionHash.toLowerCase() !== expectedHash.toLowerCase())
    return {
      ok: false,
      outcome: {
        status: "unavailable",
        message:
          "Receipt transaction hash did not match the requested transaction. Use Check receipt to try again.",
      },
    };
  return { ok: true, receipt };
}

/** Classifies a direct receipt read strictly for the submitted transaction hash. */
export function classifyReceipt(
  receipt: ReceiptLike,
  submission: Pick<
    Submission,
    "hash" | "registry" | "target" | "reportHash" | "attester"
  >,
):
  | Extract<ReceiptOutcome, { status: "confirmed" | "reverted" | "unverified" }>
  | { status: "unavailable"; message: string } {
  const validated = validateReceiptForHash(receipt, submission.hash);
  if (!validated.ok) return validated.outcome;
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

function classifyReplacedFromEvent(
  receipt: ReceiptLike,
  replacedInfo: ReplacementInfo,
  submission: Submission,
):
  | Extract<ReceiptOutcome, { status: "replaced" }>
  | { status: "unavailable"; message: string } {
  if (
    !isValidTxHash(receipt.transactionHash) ||
    (receipt.status !== "success" && receipt.status !== "reverted") ||
    !Array.isArray(receipt.logs)
  )
    return {
      status: "unavailable",
      message:
        "Receipt is missing a valid transaction hash. Use Check receipt to verify the submitted transaction.",
    };
  const unavailable = {
    status: "unavailable" as const,
    message:
      "Replacement receipt details did not match the submitted transaction. Use Check receipt to verify the submitted transaction.",
  };
  const tx = replacedInfo.transaction;
  const orig = replacedInfo.replacedTransaction;
  const evReceipt = replacedInfo.transactionReceipt;
  const hashMatches =
    tx &&
    isValidTxHash(tx.hash) &&
    tx.hash.toLowerCase() === receipt.transactionHash.toLowerCase() &&
    tx.hash.toLowerCase() !== submission.hash.toLowerCase();
  const fromMatches =
    tx &&
    typeof tx.from === "string" &&
    tx.from.toLowerCase() === submission.attester.toLowerCase();
  const evReceiptMatches =
    evReceipt === undefined ||
    (typeof evReceipt === "object" &&
      evReceipt !== null &&
      (evReceipt.transactionHash === undefined ||
        (isValidTxHash(evReceipt.transactionHash) &&
          evReceipt.transactionHash.toLowerCase() ===
            receipt.transactionHash.toLowerCase())) &&
      (evReceipt.status === undefined || evReceipt.status === receipt.status));

  if (
    !hashMatches ||
    !fromMatches ||
    !tx ||
    !isValidNonce(tx.nonce) ||
    !evReceiptMatches
  )
    return unavailable;

  if (submission.nonce === undefined) {
    const origMeta = validateSubmittedTransaction(
      orig,
      submission.hash,
      submission.attester,
    );
    if (!origMeta || origMeta.nonce !== tx.nonce) return unavailable;
  } else {
    if (!isValidNonce(submission.nonce) || tx.nonce !== submission.nonce)
      return unavailable;
    if (orig !== undefined) {
      if (typeof orig !== "object" || orig === null) return unavailable;
      if (
        orig.hash !== undefined &&
        (!isValidTxHash(orig.hash) ||
          orig.hash.toLowerCase() !== submission.hash.toLowerCase())
      )
        return unavailable;
      if (
        orig.from !== undefined &&
        (typeof orig.from !== "string" ||
          orig.from.toLowerCase() !== submission.attester.toLowerCase())
      )
        return unavailable;
      if (
        orig.nonce !== undefined &&
        (!isValidNonce(orig.nonce) || orig.nonce !== submission.nonce)
      )
        return unavailable;
    }
  }

  return {
    status: "replaced",
    originalHash: submission.hash,
    replacementHash: receipt.transactionHash,
  };
}

type NetworkCheck = { ok: true } | { ok: false; outcome: NetworkFailureOutcome };

async function verifySubmissionNetwork(
  reader: ReceiptReader,
  checkContext: ContextReader,
  submission: Submission,
): Promise<NetworkCheck> {
  const label =
    submission.networkLabel ??
    networkLabelForMode(submission.mode ?? "local");
  const ctx = await checkContext(submission.blockNumber, submission.blockHash);
  if (!ctx.ok)
    return {
      ok: false,
      outcome: { status: "unavailable", message: ctx.error },
    };
  if (submission.mode && ctx.data.mode && ctx.data.mode !== submission.mode)
    return {
      ok: false,
      outcome: {
        status: "mismatch",
        message: `Publication environment changed. Switch back to ${label} and use Check receipt.`,
      },
    };
  if (
    ctx.data.address.toLowerCase() !== submission.registry.toLowerCase() ||
    ctx.data.codehash.toLowerCase() !== submission.registryCodehash.toLowerCase()
  )
    return {
      ok: false,
      outcome: {
        status: "mismatch",
        message: `Reader registry or snapshot mismatch. Switch back to the original ${label} and use Check receipt.`,
      },
    };
  if ((await reader.getChainId()) !== 43113)
    return {
      ok: false,
      outcome: {
        status: "wrong-network",
        message: `Wrong wallet network. Select the original ${label} and use Check receipt.`,
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
        message: `Wallet and reader registry or snapshot mismatch. Select the original ${label} and use Check receipt.`,
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
  onVerifiedTransaction,
}: {
  reader: ReceiptReader;
  checkContext: ContextReader;
  submission: Submission;
  wait: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  getChainRevision?: () => number;
  onVerifiedTransaction?: (meta: VerifiedTransactionMetadata) => void;
}): Promise<ReceiptOutcome> {
  const throwIfAborted = () => {
    if (signal?.aborted)
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException("Aborted", "AbortError");
  };
  const chainBefore = getChainRevision?.();
  const hasChainChanged = () =>
    Boolean(getChainRevision && getChainRevision() !== chainBefore);

  async function handleMidReadChainChange(): Promise<ReceiptOutcome> {
    const label =
      submission.networkLabel ??
      networkLabelForMode(submission.mode ?? "local");
    try {
      const currentNetwork = await verifySubmissionNetwork(
        reader,
        checkContext,
        submission,
      );
      throwIfAborted();
      if (!currentNetwork.ok) return currentNetwork.outcome;
      return {
        status: "pending",
        message: `Wallet network changed while reading the receipt. Use Check receipt to verify the original submission on ${label}.`,
      };
    } catch (err) {
      if (isAbortError(err, signal)) throw err;
      return {
        status: "unavailable",
        message:
          "Receipt unavailable. Use Check receipt to verify the submitted transaction.",
      };
    }
  }

  async function fetchDirectReceiptOutcome(
    targetHash: Hex,
  ): Promise<ReceiptOutcome | null> {
    try {
      const receipt = await reader.getTransactionReceipt({ hash: targetHash });
      throwIfAborted();
      if (hasChainChanged()) return await handleMidReadChainChange();
      if (targetHash.toLowerCase() === submission.hash.toLowerCase())
        return classifyReceipt(receipt, submission);
      const validated = validateReceiptForHash(receipt, targetHash);
      if (!validated.ok) return validated.outcome;
      return {
        status: "replaced",
        originalHash: submission.hash,
        replacementHash: validated.receipt.transactionHash,
      };
    } catch (err) {
      if (isAbortError(err, signal)) throw err;
      if (hasChainChanged()) return await handleMidReadChainChange();
      if (err instanceof TransactionReceiptNotFoundError) return null;
      throw err;
    }
  }

  async function resolveMissingReceipt(): Promise<ReceiptOutcome> {
    let verifiedNonce = submission.nonce;
    let verifiedSubmittedBlock = submission.submittedBlock;
    let exactOrigPending = false;

    if (reader.getTransaction) {
      let origTx:
        | {
            hash: Hex;
            from: Address;
            nonce: number;
            blockNumber: bigint | null;
          }
        | undefined;
      try {
        origTx = await reader.getTransaction({ hash: submission.hash });
      } catch (err) {
        if (isAbortError(err, signal)) throw err;
        origTx = undefined;
      }
      throwIfAborted();
      if (hasChainChanged()) return await handleMidReadChainChange();

      if (origTx) {
        const meta = validateSubmittedTransaction(
          origTx,
          submission.hash,
          submission.attester,
        );
        if (
          !meta ||
          (verifiedNonce !== undefined && meta.nonce !== verifiedNonce)
        )
          return {
            status: "unavailable",
            message:
              "Original transaction details did not match the submitted transaction. Use Check receipt to try again.",
          };
        verifiedNonce = meta.nonce;
        if (meta.submittedBlock !== undefined)
          verifiedSubmittedBlock = meta.submittedBlock;
        onVerifiedTransaction?.(meta);

        if (origTx.blockNumber !== null && origTx.blockNumber !== undefined) {
          const minedOutcome = await fetchDirectReceiptOutcome(submission.hash);
          if (minedOutcome) return minedOutcome;
          return {
            status: "unavailable",
            message:
              "Transaction receipt is not yet available for the mined block. Use Check receipt to verify the submitted transaction.",
          };
        }
        exactOrigPending = true;
      }
    }

    if (verifiedNonce === undefined)
      return {
        status: "unavailable",
        message:
          "Receipt unavailable. Original transaction details are not available yet. Use Check receipt to verify the submitted transaction.",
      };

    if (reader.getTransaction) {
      let found:
        | {
            hash: Hex;
            from: Address;
            nonce: number;
            blockNumber: bigint | null;
          }
        | undefined;
      try {
        found = await reader.getTransaction({
          sender: submission.attester,
          nonce: verifiedNonce,
        });
      } catch (err) {
        if (isAbortError(err, signal)) throw err;
        found = undefined;
      }
      throwIfAborted();
      if (hasChainChanged()) return await handleMidReadChainChange();

      if (found) {
        const validCandidate =
          isValidTxHash(found.hash) &&
          typeof found.from === "string" &&
          found.from.toLowerCase() === submission.attester.toLowerCase() &&
          isValidNonce(found.nonce) &&
          found.nonce === verifiedNonce;
        if (!validCandidate)
          return {
            status: "unavailable",
            message:
              "Transaction lookup data did not match the submitted account or nonce. Use Check receipt to try again.",
          };
        if (found.hash.toLowerCase() === submission.hash.toLowerCase()) {
          if (found.blockNumber === null || found.blockNumber === undefined)
            return {
              status: "pending",
              message:
                "Transaction is still pending. Use Check receipt again once confirmed.",
            };
          const origOutcome = await fetchDirectReceiptOutcome(submission.hash);
          if (origOutcome) return origOutcome;
          return {
            status: "unavailable",
            message:
              "Transaction receipt is not yet available for the mined block. Use Check receipt to verify the submitted transaction.",
          };
        }
        if (found.blockNumber === null || found.blockNumber === undefined)
          return {
            status: "unavailable",
            message:
              "Replacement candidate is not yet mined. Use Check receipt to verify the submitted transaction.",
          };
        const candidateOutcome = await fetchDirectReceiptOutcome(found.hash);
        if (candidateOutcome) return candidateOutcome;
        return {
          status: "unavailable",
          message:
            "Replacement candidate receipt is unavailable. Use Check receipt to try again.",
        };
      }
    }

    if (!reader.getBlockNumber) {
      if (exactOrigPending)
        return {
          status: "pending",
          message:
            "Transaction is still pending. Use Check receipt again once confirmed.",
        };
      return {
        status: "unavailable",
        message:
          "Receipt unavailable. The searched blocks do not cover the original submission. Use Check receipt to try again.",
      };
    }

    const latestBlock = await reader.getBlockNumber();
    throwIfAborted();
    if (hasChainChanged()) return await handleMidReadChainChange();

    const windowStart =
      latestBlock > MAX_VERIFIED_BLOCK_LOOKBACK
        ? latestBlock - MAX_VERIFIED_BLOCK_LOOKBACK
        : 0n;
    let minBlock: bigint;
    let coveredOriginalSubmission = false;
    if (verifiedSubmittedBlock !== undefined) {
      if (verifiedSubmittedBlock > latestBlock) {
        minBlock = latestBlock;
        coveredOriginalSubmission = false;
      } else if (verifiedSubmittedBlock < windowStart) {
        minBlock = windowStart;
        coveredOriginalSubmission = false;
      } else {
        minBlock = verifiedSubmittedBlock;
        coveredOriginalSubmission = true;
      }
    } else {
      minBlock =
        latestBlock > MAX_UNBOUNDED_BLOCK_LOOKBACK
          ? latestBlock - MAX_UNBOUNDED_BLOCK_LOOKBACK
          : 0n;
      coveredOriginalSubmission = false;
    }

    for (let blockNum = latestBlock; blockNum >= minBlock; blockNum--) {
      throwIfAborted();
      if (hasChainChanged()) return await handleMidReadChainChange();
      const block = await reader.getBlock({
        blockNumber: blockNum,
        includeTransactions: true,
      });
      throwIfAborted();
      if (hasChainChanged()) return await handleMidReadChainChange();
      const match = block.transactions?.find(
        (tx): tx is ReplacementBlockTransaction & { hash: Hex } =>
          typeof tx === "object" &&
          tx !== null &&
          typeof tx.from === "string" &&
          tx.from.toLowerCase() === submission.attester.toLowerCase() &&
          isValidNonce(tx.nonce) &&
          tx.nonce === verifiedNonce &&
          isValidTxHash(tx.hash),
      );
      if (match) {
        const candidateOutcome = await fetchDirectReceiptOutcome(match.hash);
        if (candidateOutcome) return candidateOutcome;
        return {
          status: "unavailable",
          message:
            "Receipt unavailable for the mined transaction. Use Check receipt to try again.",
        };
      }
    }

    if (exactOrigPending)
      return {
        status: "pending",
        message:
          "Transaction is still pending. Use Check receipt again once confirmed.",
      };
    if (!coveredOriginalSubmission)
      return {
        status: "unavailable",
        message:
          "Receipt unavailable. The searched blocks do not cover the original submission. Use Check receipt to try again.",
      };
    return {
      status: "unavailable",
      message:
        "Receipt unavailable. Original transaction is neither confirmed nor visible as pending. Use Check receipt to verify the submitted transaction.",
    };
  }

  try {
    throwIfAborted();
    const initialNetwork = await verifySubmissionNetwork(
      reader,
      checkContext,
      submission,
    );
    throwIfAborted();
    if (!initialNetwork.ok) return initialNetwork.outcome;
    let replacedInfo: ReplacementInfo | undefined;
    const replacement =
      submission.nonce !== undefined
        ? {
            from: submission.attester,
            nonce: submission.nonce,
            to: submission.registry,
            input: submission.input,
            value: submission.value ?? 0n,
          }
        : undefined;
    const receipt = wait
      ? await reader.waitForTransactionReceipt({
          hash: submission.hash,
          timeout: timeoutMs,
          retryCount: 0,
          signal,
          onReplaced: (info) => {
            replacedInfo = info;
          },
          ...(replacement ? { replacement } : {}),
        })
      : await reader.getTransactionReceipt({ hash: submission.hash });
    throwIfAborted();
    if (hasChainChanged()) return await handleMidReadChainChange();
    if (wait && replacedInfo)
      return classifyReplacedFromEvent(receipt, replacedInfo, submission);
    return classifyReceipt(receipt, submission);
  } catch (e) {
    if (isAbortError(e, signal)) throw e;
    if (chainBefore !== undefined && hasChainChanged())
      return await handleMidReadChainChange();
    if (e instanceof TransactionReceiptNotFoundError) {
      try {
        return await resolveMissingReceipt();
      } catch (err) {
        if (isAbortError(err, signal)) throw err;
        return {
          status: "unavailable",
          message:
            "Receipt unavailable. Use Check receipt to verify the submitted transaction.",
        };
      }
    }
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
