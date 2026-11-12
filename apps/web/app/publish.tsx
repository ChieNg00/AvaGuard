"use client";
import { useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  keccak256,
  parseEventLogs,
  type Address,
  type EIP1193Provider,
} from "viem";
import { avalancheFuji } from "viem/chains";
import type { ReportBody } from "@avaguard/analyzer";
import { registryAbi as abi } from "../lib/registry-abi";
import { publication } from "../lib/publication";
import { walletContext } from "./actions";

function injected() {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}
export function Publish({ body }: { body: ReportBody }) {
  const revision = useRef(0),
    lock = useRef(false);
  const [ready, setReady] = useState<Address>(),
    [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false),
    [message, setMessage] = useState(
      "Connect the disposable attester wallet to check permission.",
    );
  useEffect(() => {
    const provider = injected();
    const invalidate = () => {
      revision.current++;
    };
    const changed = () => {
      invalidate();
      setReady(undefined);
      setMessage("Wallet changed. Check the account and network again.");
    };
    provider?.on("accountsChanged", changed);
    provider?.on("chainChanged", changed);
    return () => {
      invalidate();
      provider?.removeListener("accountsChanged", changed);
      provider?.removeListener("chainChanged", changed);
    };
  }, []);
  async function run(write: boolean) {
    if (lock.current || sent) return;
    lock.current = true;
    setBusy(true);
    setReady(undefined);
    const token = revision.current;
    function current() {
      if (revision.current !== token)
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
      const account = accounts[0];
      if (!account) throw new Error("Wallet is disconnected.");
      if (write && account !== ready)
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
      if (
        getAddress((await wallet.getAddresses())[0]) !== account ||
        (await wallet.getChainId()) !== 43113
      )
        throw new Error("Wallet account or network changed.");
      current();
      if (!write) {
        setReady(account);
        setMessage("Authorized local attester: " + account);
        return;
      }
      stage = "Wallet rejected or failed to submit the transaction";
      const hash = await wallet.writeContract({
        account,
        address,
        abi,
        functionName: "publish",
        args,
      });
      setSent(true);
      setMessage("Pending receipt: " + hash);
      stage =
        "Receipt unavailable. Check the submitted transaction in your wallet";
      const receipt = await reader.waitForTransactionReceipt({
        hash,
        timeout: 60000,
      });
      current();
      const published = parseEventLogs({abi, logs: receipt.logs, eventName: "ReportPublished"})
        .some(event => event.address.toLowerCase() === address.toLowerCase() &&
          event.args.reportHash === args[0].reportHash && event.args.attester.toLowerCase() === account.toLowerCase());
      setSent(published);
      setMessage(
        (receipt.status === "reverted" ? "Publication reverted: " :
          published ? "Confirmed publication: " : "Receipt contains no matching publication: ") + receipt.transactionHash,
      );
    } catch (e) {
      if (revision.current === token)
        setMessage(
          e instanceof Error && e.constructor === Error
            ? e.message
            : stage + ".",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <article>
      <h3>Publish commitment</h3>
      <p role="status">{message}</p>
      <button disabled={busy || sent} onClick={() => run(false)}>
        Check wallet
      </button>{" "}
      <button disabled={!ready || busy || sent} onClick={() => run(true)}>
        Publish
      </button>
    </article>
  );
}
