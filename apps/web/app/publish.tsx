"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  checkPublicationOrigin,
  type PublicPublicationConfig,
} from "../lib/publication-config";
import {
  validateSubmittedTransaction,
  verifySubmissionReceipt,
  type Submission,
} from "../lib/receipt";
import { walletContext } from "./actions";

function initialPublicationMessage(config: PublicPublicationConfig): string {
  if (!config.enabled) return config.reason;
  const walletKind =
    config.mode === "local" ? "disposable attester wallet" : "attester wallet";
  return `Connect the ${walletKind} on ${config.networkLabel} to check permission.`;
}

function isUnrecognizedChainError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  return (
    candidate.code === 4902 || candidate.data?.originalError?.code === 4902
  );
}

function injected() {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

function subscribeNoop() {
  return () => {};
}

function getLocationOrigin(): string {
  return window.location.origin;
}

function getServerOrigin(): string {
  return "";
}

export function Publish({
  body,
  publicationConfig,
}: {
  body: ReportBody;
  publicationConfig: PublicPublicationConfig;
}) {
  const expected = publication(body);
  const reportKey = `${body.blockHash}:${body.address}:${expected.reportHash}`;
  const initialMsg = initialPublicationMessage(publicationConfig);
  const clientOrigin = useSyncExternalStore(
    subscribeNoop,
    getLocationOrigin,
    getServerOrigin,
  );
  const originCheck =
    clientOrigin && publicationConfig.enabled
      ? checkPublicationOrigin(publicationConfig, new URL(clientOrigin))
      : ({ ok: true } as const);
  const [trackedKey, setTrackedKey] = useState(reportKey);
  const [ready, setReady] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [submission, setSubmission] = useState<Submission>();
  const [message, setMessage] = useState(initialMsg);

  if (trackedKey !== reportKey) {
    setTrackedKey(reportKey);
    setReady(undefined);
    setBusy(false);
    setWrongNetwork(false);
    setSubmission(undefined);
    setMessage(initialMsg);
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
      setWrongNetwork(false);
      const current = ref.submission;
      if (!current) {
        setMessage("Wallet changed. Check the account and network again.");
        return;
      }
      if (current.status === "pending" && !ref.receiptLock) {
        const label = current.networkLabel ?? publicationConfig.networkLabel;
        setMessage(
          `Wallet network changed. Select the original ${label} and use Check receipt.`,
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
  }, [reportKey, publicationConfig]);

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
    const activeLabel = target.networkLabel ?? publicationConfig.networkLabel;
    try {
      const originCheck = checkPublicationOrigin(
        publicationConfig,
        window.location,
      );
      if (!originCheck.ok) {
        if (ref.reportRevision === reportToken && ref.receiptCheckId === checkId)
          setMessage(originCheck.error);
        return;
      }
      const provider = injected();
      if (!provider) {
        if (ref.reportRevision === reportToken && ref.receiptCheckId === checkId)
          setMessage(
            `No injected wallet detected. Reconnect the wallet on ${activeLabel} and use Check receipt.`,
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
        setWrongNetwork(false);
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
      if (outcome.status === "wrong-network") {
        setWrongNetwork(true);
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
    setWrongNetwork(false);
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
      if (!publicationConfig.enabled) {
        throw new Error(publicationConfig.reason);
      }
      const originCheck = checkPublicationOrigin(
        publicationConfig,
        window.location,
      );
      if (!originCheck.ok) {
        throw new Error(originCheck.error);
      }
      const ctx = await walletContext(body.blockNumber, body.blockHash);
      if (!ctx.ok) throw new Error(ctx.error);
      if (ctx.data.mode !== publicationConfig.mode) {
        throw new Error(
          "Publication environment changed. Rescan before publishing.",
        );
      }
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
      if ((await wallet.getChainId()) !== 43113) {
        setWrongNetwork(true);
        throw new Error(
          `Wrong wallet network. Select ${publicationConfig.networkLabel}.`,
        );
      }
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
        const modeLabel =
          publicationConfig.mode === "local" ? "local" : "Fuji";
        setMessage(`Authorized ${modeLabel} attester: ${account}`);
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
        mode: publicationConfig.mode,
        networkLabel: publicationConfig.networkLabel,
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

  async function switchNetwork() {
    const ref = state.current;
    if (ref.lock || ref.receiptLock || !publicationConfig.enabled) return;
    const originCheck = checkPublicationOrigin(
      publicationConfig,
      window.location,
    );
    if (!originCheck.ok) {
      setMessage(originCheck.error);
      return;
    }
    const provider = injected();
    if (!provider) {
      setMessage("No injected wallet detected.");
      return;
    }
    ref.lock = true;
    setBusy(true);
    const reportToken = ref.reportRevision;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa869" }],
      });
      if (ref.reportRevision !== reportToken) return;
      setWrongNetwork(false);
      setMessage(
        ref.submission?.status === "pending"
          ? "Wallet switched to chain 43113. Select Check receipt to verify the submitted transaction."
          : "Wallet switched to chain 43113. Select Check wallet to verify attester permission.",
      );
    } catch (e) {
      if (ref.reportRevision !== reportToken) return;
      if (isUnrecognizedChainError(e)) {
        if (publicationConfig.mode === "fuji") {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xa869",
                  chainName: "Avalanche Fuji C-Chain",
                  nativeCurrency: {
                    name: "Avalanche",
                    symbol: "AVAX",
                    decimals: 18,
                  },
                  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
                  blockExplorerUrls: ["https://testnet.snowscan.xyz"],
                },
              ],
            });
            if (ref.reportRevision !== reportToken) return;
            setWrongNetwork(false);
            setMessage(
              ref.submission?.status === "pending"
                ? "Avalanche Fuji (43113) added to wallet. Select Check receipt to verify the submitted transaction."
                : "Avalanche Fuji (43113) added to wallet. Select Check wallet to verify attester permission.",
            );
            return;
          } catch {
            if (ref.reportRevision === reportToken) {
              setMessage(
                "Wallet declined adding Avalanche Fuji (43113). Select it manually.",
              );
            }
            return;
          }
        }
        setMessage(
          "Chain 43113 is not configured in the wallet. Add local Anvil (http://127.0.0.1:8545, chain ID 43113) manually.",
        );
        return;
      }
      setMessage(
        `Wallet did not switch networks. Select ${publicationConfig.networkLabel} manually.`,
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
  const disabledByConfig = !publicationConfig.enabled || !originCheck.ok;
  const displayedMessage =
    !originCheck.ok && !submission ? originCheck.error : message;
  return (
    <article>
      <h3>Publish commitment</h3>
      <p role="status">{displayedMessage}</p>
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
        disabled={disabledByConfig || busy || pending || confirmed}
        onClick={() => void run(false)}
      >
        Check wallet
      </button>{" "}
      <button
        type="button"
        disabled={disabledByConfig || !ready || busy || pending || confirmed}
        onClick={() => void run(true)}
      >
        Publish
      </button>
      {wrongNetwork && !disabledByConfig && !confirmed && (
        <>
          {" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => void switchNetwork()}
          >
            Switch wallet to 43113
          </button>
        </>
      )}
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
