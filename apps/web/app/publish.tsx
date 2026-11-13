"use client";
import { useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  keccak256,
  type Address,
  type EIP1193Provider,
} from "viem";
import { avalancheFuji } from "viem/chains";
import type { ReportBody } from "@avaguard/analyzer";
import { registryAbi as abi } from "../lib/registry-abi";
import { publication } from "../lib/publication";
import {
  validateSubmittedTransaction,
  verifySubmissionReceipt,
  type Submission,
} from "../lib/receipt";
import { walletContext } from "./actions";

const INITIAL_MESSAGE =
  "Connect the disposable attester wallet to check permission.";

function injected() {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

export function Publish({ body }: { body: ReportBody }) {
  const expected = publication(body);
  const reportKey = `${body.blockHash}:${body.address}:${expected.reportHash}`;
  const [trackedKey, setTrackedKey] = useState(reportKey);
  const [ready, setReady] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const [submission, setSubmission] = useState<Submission>();
  const [message, setMessage] = useState(INITIAL_MESSAGE);

  if (trackedKey !== reportKey) {
    setTrackedKey(reportKey);
    setReady(undefined);
    setBusy(false);
    setSubmission(undefined);
    setMessage(INITIAL_MESSAGE);
  }

  const state = useRef({
    reportRevision: 0,
    walletRevision: 0,
    chainRevision: 0,
    receiptCheckId: 0,
    lock: false,
    receiptLock: false,
    submission: undefined as Submission | undefined,
    abort: undefined as AbortController | undefined,
  });

  useEffect(() => {
    const ref = state.current;
    const provider = injected();
    const onAccountsChanged = () => {
      ref.walletRevision++;
      setReady(undefined);
      const current = ref.submission;
      if (!current) {
        setMessage("Wallet changed. Check the account and network again.");
        return;
      }
      if (current.status === "pending" && !ref.receiptLock) {
        setMessage(
          "Wallet account changed. Use Check receipt to verify the original submission.",
        );
      } else if (
        current.status === "reverted" ||
        current.status === "unverified" ||
        current.status === "replaced"
      ) {
        setMessage("Wallet changed. Check the account and network again.");
      }
    };
    const onChainChanged = () => {
      ref.walletRevision++;
      ref.chainRevision++;
      setReady(undefined);
      const current = ref.submission;
      if (!current) {
        setMessage("Wallet changed. Check the account and network again.");
        return;
      }
      if (current.status === "pending" && !ref.receiptLock) {
        setMessage(
          "Wallet network changed. Select the original local Anvil network (43113) and use Check receipt.",
        );
      } else if (
        current.status === "reverted" ||
        current.status === "unverified" ||
        current.status === "replaced"
      ) {
        setMessage("Wallet changed. Check the account and network again.");
      }
    };
    provider?.on("accountsChanged", onAccountsChanged);
    provider?.on("chainChanged", onChainChanged);
    return () => {
      ref.abort?.abort();
      ref.abort = undefined;
      ref.reportRevision++;
      ref.receiptCheckId++;
      ref.lock = false;
      ref.receiptLock = false;
      ref.submission = undefined;
      provider?.removeListener("accountsChanged", onAccountsChanged);
      provider?.removeListener("chainChanged", onChainChanged);
    };
  }, [reportKey]);

  async function readReceiptFor(
    target: Submission,
    { wait, reportToken }: { wait: boolean; reportToken: number },
  ) {
    const ref = state.current;
    if (ref.receiptLock) return;
    ref.receiptLock = true;
    const checkId = ++ref.receiptCheckId;
    const controller = new AbortController();
    ref.abort = controller;
    try {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
        if (ref.reportRevision === reportToken && ref.receiptCheckId === checkId)
          setMessage("Open AvaGuard on loopback.");
        return;
      }
      const provider = injected();
      if (!provider) {
        if (ref.reportRevision === reportToken && ref.receiptCheckId === checkId)
          setMessage(
            "No injected wallet detected. Reconnect the wallet on local Anvil (43113) and use Check receipt.",
          );
        return;
      }
      const reader = createPublicClient({
        transport: custom(provider, { retryCount: 0 }),
      });
      const checkChainRevision = ref.chainRevision;
      const outcome = await verifySubmissionReceipt({
        reader,
        checkContext: walletContext,
        submission: target,
        wait,
        signal: controller.signal,
        getChainRevision: () => ref.chainRevision,
        onVerifiedTransaction: (meta) => {
          if (
            ref.reportRevision !== reportToken ||
            ref.receiptCheckId !== checkId ||
            ref.chainRevision !== checkChainRevision
          )
            return;
          const current = ref.submission;
          if (
            !current ||
            current.hash.toLowerCase() !== target.hash.toLowerCase()
          )
            return;
          const updated: Submission = {
            ...current,
            nonce: meta.nonce,
            submittedBlock: meta.submittedBlock ?? current.submittedBlock,
          };
          ref.submission = updated;
          setSubmission(updated);
        },
      });
      if (ref.reportRevision !== reportToken || ref.receiptCheckId !== checkId)
        return;
      const currentTarget =
        ref.submission?.hash.toLowerCase() === target.hash.toLowerCase()
          ? ref.submission
          : target;
      if (outcome.status === "confirmed") {
        const confirmed: Submission = { ...currentTarget, status: "confirmed" };
        ref.submission = confirmed;
        setSubmission(confirmed);
        setMessage("Confirmed publication: " + outcome.hash);
        return;
      }
      if (outcome.status === "reverted") {
        const reverted: Submission = { ...currentTarget, status: "reverted" };
        ref.submission = reverted;
        setSubmission(reverted);
        setMessage(
          "Publication reverted: " +
            outcome.hash +
            ". Check wallet before trying again.",
        );
        return;
      }
      if (outcome.status === "unverified") {
        const unverified: Submission = {
          ...currentTarget,
          status: "unverified",
        };
        ref.submission = unverified;
        setSubmission(unverified);
        setMessage(
          "Publication not verified (receipt contains no matching ReportPublished event): " +
            outcome.hash,
        );
        return;
      }
      if (outcome.status === "replaced") {
        const replaced: Submission = {
          ...currentTarget,
          status: "replaced",
          replacementHash: outcome.replacementHash,
        };
        ref.submission = replaced;
        setSubmission(replaced);
        setMessage(
          "Transaction replaced: original " +
            outcome.originalHash +
            " was superseded by " +
            outcome.replacementHash +
            ". Check wallet and Lookup before trying again.",
        );
        return;
      }
      setMessage(outcome.message);
    } catch (e) {
      if (
        controller.signal.aborted ||
        (typeof e === "object" &&
          e !== null &&
          "name" in e &&
          e.name === "AbortError")
      )
        return;
      if (ref.reportRevision === reportToken && ref.receiptCheckId === checkId)
        setMessage(
          "Receipt unavailable. Use Check receipt to verify the submitted transaction.",
        );
    } finally {
      if (ref.abort === controller) ref.abort = undefined;
      if (ref.receiptCheckId === checkId) ref.receiptLock = false;
    }
  }

  async function run(write: boolean) {
    const ref = state.current;
    if (ref.lock) return;
    const active = ref.submission;
    if (
      write &&
      (active?.status === "pending" || active?.status === "confirmed")
    )
      return;
    ref.lock = true;
    setBusy(true);
    setReady(undefined);
    const reportToken = ref.reportRevision;
    const walletToken = ref.walletRevision;
    function ensurePreSignUnchanged() {
      if (
        ref.reportRevision !== reportToken ||
        ref.walletRevision !== walletToken
      )
        throw new Error("Wallet or report changed.");
    }
    let stage = "Wallet check failed";
    try {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))
        throw new Error("Open AvaGuard on loopback.");
      const ctx = await walletContext(body.blockNumber, body.blockHash);
      if (!ctx.ok) throw new Error(ctx.error);
      const provider = injected();
      if (!provider) throw new Error("No injected wallet detected.");
      const transport = custom(provider, { retryCount: 0 });
      const reader = createPublicClient({ transport });
      const wallet = createWalletClient({ chain: avalancheFuji, transport });
      const accounts = write
        ? await wallet.getAddresses()
        : await wallet.requestAddresses();
      const rawAccount = accounts[0];
      if (!rawAccount) throw new Error("Wallet is disconnected.");
      const account = getAddress(rawAccount);
      if (write && (!ready || account !== getAddress(ready)))
        throw new Error("Wallet account changed. Check the wallet again.");
      if ((await wallet.getChainId()) !== 43113)
        throw new Error(
          "Wrong wallet network. Select the local Anvil network (43113).",
        );
      const address = ctx.data.address;
      const [snapshot, code, allowed] = await Promise.all([
        reader.getBlock({ blockNumber: BigInt(body.blockNumber) }),
        reader.getCode({ address }),
        reader.readContract({
          address,
          abi,
          functionName: "attesters",
          args: [account],
        }),
      ]);
      if (
        !code ||
        keccak256(code) !== ctx.data.codehash ||
        snapshot.hash !== body.blockHash
      )
        throw new Error("Wallet and reader registry or snapshot mismatch.");
      if (!allowed) throw new Error("Account lacks live attester permission.");
      const args = [publication(body)] as const;
      stage =
        "Publication simulation failed (check duplicates, permission and live code)";
      await reader.simulateContract({
        account,
        address,
        abi,
        functionName: "publish",
        args,
      });
      const latestAccount = (await wallet.getAddresses())[0];
      if (
        !latestAccount ||
        getAddress(latestAccount) !== account ||
        (await wallet.getChainId()) !== 43113
      )
        throw new Error("Wallet account or network changed.");
      const submittedBlockBefore = await reader
        .getBlockNumber()
        .catch(() => undefined);
      ensurePreSignUnchanged();
      if (!write) {
        setReady(account);
        setMessage("Authorized local attester: " + account);
        return;
      }
      const txInput = encodeFunctionData({
        abi,
        functionName: "publish",
        args,
      });
      const chainAtSubmit = ref.chainRevision;
      stage = "Wallet rejected or failed to submit the transaction";
      const hash = await wallet.writeContract({
        account,
        address,
        abi,
        functionName: "publish",
        args,
      });
      if (ref.reportRevision !== reportToken) return;
      const next: Submission = {
        hash,
        registry: address,
        registryCodehash: ctx.data.codehash,
        attester: account,
        submittedBlock: submittedBlockBefore,
        input: txInput,
        value: 0n,
        target: args[0].target,
        reportHash: args[0].reportHash,
        blockNumber: body.blockNumber,
        blockHash: body.blockHash,
        status: "pending",
      };
      ref.submission = next;
      setSubmission(next);
      setMessage("Pending receipt: " + hash);
      let activeSubmission = next;
      if (ref.chainRevision === chainAtSubmit) {
        const submittedTx = await reader
          .getTransaction({ hash })
          .catch(() => undefined);
        if (ref.reportRevision !== reportToken) return;
        const verified =
          ref.chainRevision === chainAtSubmit && ref.submission === next
            ? validateSubmittedTransaction(submittedTx, hash, account)
            : null;
        if (verified) {
          activeSubmission = {
            ...next,
            nonce: verified.nonce,
            submittedBlock: verified.submittedBlock ?? next.submittedBlock,
          };
          ref.submission = activeSubmission;
          setSubmission(activeSubmission);
        }
      }
      await readReceiptFor(activeSubmission, { wait: true, reportToken });
    } catch (e) {
      if (ref.reportRevision === reportToken)
        setMessage(
          e instanceof Error && e.constructor === Error
            ? e.message
            : stage + ".",
        );
    } finally {
      if (ref.reportRevision === reportToken) {
        ref.lock = false;
        setBusy(false);
      }
    }
  }

  async function checkReceipt() {
    const ref = state.current;
    const target = ref.submission;
    if (
      ref.lock ||
      ref.receiptLock ||
      !target ||
      target.status !== "pending"
    )
      return;
    ref.lock = true;
    setBusy(true);
    const reportToken = ref.reportRevision;
    setMessage("Checking receipt…");
    try {
      await readReceiptFor(target, { wait: false, reportToken });
    } finally {
      if (ref.reportRevision === reportToken) {
        ref.lock = false;
        setBusy(false);
      }
    }
  }

  const pending = submission?.status === "pending";
  const confirmed = submission?.status === "confirmed";
  return (
    <article>
      <h3>Publish commitment</h3>
      <p role="status">{message}</p>
      {submission && (
        <p>
          Submitted transaction: <code>{submission.hash}</code>
          {submission.replacementHash && (
            <>
              {" "}
              · Replacement transaction:{" "}
              <code>{submission.replacementHash}</code>
            </>
          )}
        </p>
      )}
      <button
        type="button"
        disabled={busy || pending || confirmed}
        onClick={() => void run(false)}
      >
        Check wallet
      </button>{" "}
      <button
        type="button"
        disabled={!ready || busy || pending || confirmed}
        onClick={() => void run(true)}
      >
        Publish
      </button>
      {pending && (
        <>
          {" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => void checkReceipt()}
          >
            Check receipt
          </button>
        </>
      )}
    </article>
  );
}
