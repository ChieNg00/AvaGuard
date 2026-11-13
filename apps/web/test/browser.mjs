// Invoked only by the ephemeral Anvil integration suite.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

const [rpc, registry, fixture, attester] = process.argv.slice(2);
assert.equal(rpc, "http://127.0.0.1:18545");
let rpcSeq = 0;
async function anvilRpc(method, params = []) {
  const r = await (
    await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: ++rpcSeq,
        jsonrpc: "2.0",
        method,
        params,
      }),
    })
  ).json();
  if (r.error) throw Error(r.error.message);
  return r.result;
}
let prune = false;
const proxy = createServer(async (req, res) => {
  try {
    let data = "";
    for await (const chunk of req) data += chunk;
    const call = JSON.parse(data);
    const response =
      prune && call.method === "eth_getCode" && call.params[1] !== "latest"
        ? JSON.stringify({
            jsonrpc: "2.0",
            id: call.id,
            error: { code: -32000, message: "historical state unavailable" },
          })
        : await (
            await fetch(rpc, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: data,
            })
          ).text();
    res.setHeader("content-type", "application/json");
    res.end(response);
  } catch {
    res.writeHead(502).end();
  }
});
proxy.listen(0, "127.0.0.1");
await once(proxy, "listening");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    "31845",
  ],
  {
    cwd: "apps/web",
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      AVAGUARD_ENV: "local",
      REGISTRY_ADDRESS: registry,
      FUJI_RPC_URL: "http://127.0.0.1:" + proxy.address().port,
    },
  },
);
const closed = once(server, "exit");

async function installProvider(targetPage, initialAccount) {
  await targetPage.exposeFunction("testRpc", async ({ method, params }) =>
    anvilRpc(method, params ?? []),
  );
  await targetPage.evaluate((account) => {
    const listeners = new Map();
    const replacedMap = new Map();
    let sendGate = null;
    let receiptGate = null;
    let receiptResultOverride = null;
    window.walletState = {
      mode: "wrong",
      receiptMode: "ok",
      txLookupMode: "ok",
      activeAccount: account,
      sendCount: 0,
      sendPending: false,
      holdSend: false,
      receiptPending: false,
      holdReceipt: false,
      lastTxHash: null,
      lastReplacementHash: null,
    };
    window.emitWallet = (event, data) => {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(data);
    };
    window.listenerCount = (event) => listeners.get(event)?.size ?? 0;
    window.releaseSend = () => {
      sendGate?.();
      sendGate = null;
    };
    window.releaseReceipt = (override = null) => {
      receiptResultOverride = override;
      receiptGate?.();
      receiptGate = null;
    };
    window.ethereum = {
      on(event, fn) {
        const set = listeners.get(event) ?? new Set();
        set.add(fn);
        listeners.set(event, set);
      },
      removeListener(event, fn) {
        listeners.get(event)?.delete(fn);
      },
      async request(call) {
        const s = window.walletState;
        if (["eth_accounts", "eth_requestAccounts"].includes(call.method))
          return [s.activeAccount];
        if (s.mode === "wrong" && call.method === "eth_chainId") return "0x1";
        if (call.method === "eth_sendTransaction") {
          if (s.mode === "reject")
            throw Object.assign(Error("Rejected"), { code: 4001 });
          if (s.holdSend) {
            s.sendPending = true;
            await new Promise((resolve) => {
              sendGate = resolve;
            });
            s.sendPending = false;
            s.holdSend = false;
          }
          s.sendCount++;
          let nextCall = call;
          if (s.mode === "reverted" || s.mode === "replaced-reverted") {
            nextCall = {
              ...call,
              params: [
                {
                  ...call.params[0],
                  data: "0xdeadbeef",
                  gas: call.params[0]?.gas ?? "0x30d40",
                },
              ],
            };
          } else if (s.mode === "no-event") {
            nextCall = {
              ...call,
              params: [
                {
                  ...call.params[0],
                  to: s.activeAccount,
                  data: "0x",
                  gas: "0x5208",
                },
              ],
            };
          }
          const realHash = await window.testRpc(nextCall);
          if (
            s.mode === "replaced-reverted" ||
            s.mode === "replaced-success"
          ) {
            const realTx = await window.testRpc({
              method: "eth_getTransactionByHash",
              params: [realHash],
            });
            const origHash =
              realHash.slice(0, -1) + (realHash.endsWith("0") ? "1" : "0");
            replacedMap.set(origHash.toLowerCase(), {
              ...realTx,
              hash: origHash,
              blockNumber: null,
              blockHash: null,
              transactionIndex: null,
            });
            s.lastTxHash = origHash;
            s.lastReplacementHash = realHash;
            return origHash;
          }
          s.lastTxHash = realHash;
          s.lastReplacementHash = null;
          return realHash;
        }
        if (
          call.method === "eth_getTransactionByHash" ||
          call.method === "eth_getTransactionBySenderAndNonce"
        ) {
          if (call.method === "eth_getTransactionByHash") {
            const pending = replacedMap.get(String(call.params[0]).toLowerCase());
            if (pending) return pending;
          }
          const tx = await window.testRpc(call);
          const matchesLast =
            tx &&
            s.lastTxHash &&
            String(tx.hash).toLowerCase() === s.lastTxHash.toLowerCase();
          if (s.txLookupMode === "null" && matchesLast) return null;
          if (s.receiptMode === "null" && matchesLast)
            return { ...tx, blockNumber: null, blockHash: null, transactionIndex: null };
          return tx;
        }
        if (call.method === "eth_getTransactionReceipt") {
          if (s.holdReceipt) {
            s.receiptPending = true;
            await new Promise((resolve) => {
              receiptGate = resolve;
            });
            s.receiptPending = false;
            s.holdReceipt = false;
          }
          if (receiptResultOverride) {
            const nextOverride = receiptResultOverride;
            receiptResultOverride = null;
            return nextOverride;
          }
          if (s.receiptMode === "unavailable")
            throw Object.assign(Error("Receipt RPC unavailable"), {
              code: -32000,
            });
          if (s.receiptMode === "null") return null;
          if (s.receiptMode === "missing-hash")
            return { status: "0x1", logs: [] };
          if (s.receiptMode === "mismatched-hash")
            return {
              status: "0x1",
              transactionHash: "0x" + "e".repeat(64),
              blockHash: "0x" + "1".repeat(64),
              blockNumber: "0x1",
              transactionIndex: "0x0",
              logs: [],
            };
        }
        const result = await window.testRpc(call);
        if (s.mode === "mismatch" && call.method === "eth_getBlockByNumber")
          result.hash = "0x" + "f".repeat(64);
        return result;
      },
    };
  }, initialAccount);
}

let browser, activePage;
try {
  const url = "http://127.0.0.1:31845";
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error("Test Next server exited");
    if (
      await fetch(url)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await delay(250);
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  activePage = page;
  page.setDefaultTimeout(12000);
  await page.goto(url);
  await page.getByLabel("Target contract address").fill("0x" + "9".repeat(40));
  await page.getByRole("button", { name: "Scan contract" }).click();
  await page.getByText(/no-bytecode · No score available/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Publish", exact: true }).count(),
    0,
  );
  await page.getByLabel("Target contract address").fill(fixture);
  await page.getByRole("button", { name: "Scan contract" }).click();
  await page.getByText("35 / 100 · Some signals").waitFor();
  console.log("Rendered score 35");
  const download = page.waitForEvent("download");
  await page.getByText("Export canonical JSON").click();
  const json = await readFile(await (await download).path(), "utf8");
  console.log("Exported canonical body");

  await installProvider(page, attester);
  async function check(targetPage, mode, label) {
    console.log("Wallet scenario", mode);
    await targetPage.evaluate((m) => {
      window.walletState.mode = m;
    }, mode);
    await targetPage.getByText("Check wallet", { exact: true }).click();
    await targetPage.getByText(label).waitFor();
  }
  await check(page, "wrong", /Wrong wallet network/);
  assert(
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .isDisabled(),
  );
  await check(page, "mismatch", /registry or snapshot mismatch/);
  await check(page, "reject", /Authorized local attester/);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Wallet rejected/).waitFor();
  await check(page, "ok", /Authorized local attester/);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Confirmed publication: 0x[0-9a-f]{64}/).waitFor();
  console.log(await page.getByText(/Confirmed publication:/).innerText());

  const fresh = await browser.newPage();
  activePage = fresh;
  fresh.setDefaultTimeout(12000);
  await fresh.goto(url + "/lookup");
  await fresh.getByLabel("Target contract address").fill("0x" + "9".repeat(40));
  await fresh.getByText("Find latest").click();
  await fresh.getByText(/No published reports/).waitFor();
  await fresh.getByLabel("Target contract address").fill(fixture);
  await fresh.getByText("Find latest").click();
  await fresh.getByText("Report body unavailable.", { exact: true }).waitFor();
  await fresh.getByLabel(/History index/).fill("0");
  await fresh.getByText("Read history entry").click();
  await fresh.getByText("Report body unavailable.", { exact: true }).waitFor();

  async function uploadNamed(name, text, expected) {
    await fresh.getByLabel("Import canonical JSON").setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    if (expected) await fresh.getByText(expected).waitFor();
  }
  await uploadNamed("report.json", "{", /Malformed JSON/);
  await uploadNamed("report.json", "{}", /Invalid report schema/);
  const changed = JSON.parse(json);
  changed.findings[0].explanation += " altered";
  await uploadNamed("report.json", JSON.stringify(changed), /Hash mismatch/);
  await uploadNamed(
    "report.json",
    json,
    /Hash and registry summary fields agree/,
  );
  await fresh.getByText("Replay original block").click();
  await fresh.getByText(/Original-block replay: replay-matches/).waitFor();
  await fresh.getByText("Scan current state").click();
  await fresh.getByText(/No semantic changes/).waitFor();

  // P3: Import race regressions on Lookup
  await fresh.evaluate(() => {
    const origText = File.prototype.text;
    const gates = new Map();
    window.gateFile = (name) => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      gates.set(name, { gate, release, done: null });
    };
    window.releaseFile = async (name) => {
      const entry = gates.get(name);
      if (!entry) throw new Error("Missing gate for " + name);
      gates.delete(name);
      entry.release();
      if (entry.done) await entry.done;
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    File.prototype.text = function patchedText() {
      const p = origText.call(this);
      const entry = gates.get(this.name);
      if (!entry) return p;
      const combined = (async () => {
        await entry.gate;
        return p;
      })();
      entry.done = combined.catch(() => {});
      return combined;
    };
  });

  const replayBtn = fresh.getByRole("button", { name: "Replay original block" });
  const scanBtn = fresh.getByRole("button", { name: "Scan current state" });

  // 1. Delayed single file guards Replay & Scan current state, then accepts without reselecting.
  await fresh.evaluate(() => window.gateFile("delayed-valid.json"));
  await uploadNamed("delayed-valid.json", json, /Importing report body/);
  assert(await replayBtn.isDisabled());
  assert(await scanBtn.isDisabled());
  await fresh.evaluate(() => window.releaseFile("delayed-valid.json"));
  await fresh.getByText(/Hash and registry summary fields agree/).waitFor();
  assert(!(await replayBtn.isDisabled()));
  assert(!(await scanBtn.isDisabled()));

  // 2. File A followed by File B completing in reverse order.
  await fresh.evaluate(() => {
    window.gateFile("race-a.json");
    window.gateFile("race-b.json");
  });
  await uploadNamed("race-a.json", "{", /Importing report body/);
  await uploadNamed("race-b.json", json, /Importing report body/);
  await fresh.evaluate(() => window.releaseFile("race-b.json"));
  await fresh.getByText(/Hash and registry summary fields agree/).waitFor();
  assert(!(await replayBtn.isDisabled()));
  assert(!(await scanBtn.isDisabled()));
  await fresh.evaluate(() => window.releaseFile("race-a.json"));
  await fresh.getByText(/Hash and registry summary fields agree/).waitFor();
  assert.equal(await fresh.getByText(/Malformed JSON/).count(), 0);
  assert(!(await replayBtn.isDisabled()));
  assert(!(await scanBtn.isDisabled()));

  // 3. Starting an import invalidates an outstanding comparison.
  let compareSawRequest;
  const compareSeen = new Promise((resolve) => {
    compareSawRequest = resolve;
  });
  let releaseCompareRoute;
  await fresh.route("**/lookup", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      compareSawRequest();
      await new Promise((resolve) => {
        releaseCompareRoute = resolve;
      });
    }
    await route.continue();
  });
  await scanBtn.click();
  await fresh.getByText("Reading…").waitFor();
  await compareSeen;
  await uploadNamed(
    "after-compare.json",
    json,
    /Hash and registry summary fields agree/,
  );
  const compareResponse = fresh.waitForResponse(
    (res) =>
      res.url().includes("/lookup") && res.request().method() === "POST",
  );
  releaseCompareRoute();
  await compareResponse;
  await fresh.unroute("**/lookup");
  await fresh.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  assert.equal(await fresh.locator('pre[role="status"]').innerText(), "");

  // 4. Recovery after malformed JSON leaves Replay disabled, restores Scan current state, and allows re-import.
  await uploadNamed("bad.json", "{", /Malformed JSON/);
  assert(await replayBtn.isDisabled());
  assert(!(await scanBtn.isDisabled()));
  await scanBtn.click();
  await fresh.getByText(/Full diff unavailable without original body/).waitFor();
  await uploadNamed(
    "recovered.json",
    json,
    /Hash and registry summary fields agree/,
  );
  assert(!(await replayBtn.isDisabled()));
  await replayBtn.click();
  await fresh.getByText(/Original-block replay: replay-matches/).waitFor();

  // Original pruned-state replay check
  prune = true;
  await replayBtn.click();
  await fresh
    .getByText(/inconclusive · historical-state-unavailable/)
    .waitFor();
  prune = false;

  // P2: Receipt recovery and wallet events with provider installed before Publish subscribes.
  await anvilRpc("evm_mine", []);
  const recoveryBlock = parseInt(await anvilRpc("eth_blockNumber", []), 16);
  const recoveryPage = await browser.newPage();
  activePage = recoveryPage;
  recoveryPage.setDefaultTimeout(12000);
  await recoveryPage.goto(url);
  await installProvider(recoveryPage, attester);

  await recoveryPage.getByLabel("Target contract address").fill(fixture);
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("35 / 100 · Some signals").waitFor();
  await recoveryPage.getByText("Block " + recoveryBlock).waitFor();

  assert.equal(
    await recoveryPage.evaluate(() => window.listenerCount("accountsChanged")),
    1,
  );
  assert.equal(
    await recoveryPage.evaluate(() => window.listenerCount("chainChanged")),
    1,
  );

  const checkWalletBtn = recoveryPage.getByRole("button", {
    name: "Check wallet",
    exact: true,
  });
  const publishBtn = recoveryPage.getByRole("button", {
    name: "Publish",
    exact: true,
  });
  const checkReceiptBtn = recoveryPage.getByRole("button", {
    name: "Check receipt",
    exact: true,
  });

  // Pre-hash rejection still permits retry.
  await check(recoveryPage, "reject", /Authorized local attester/);
  await publishBtn.click();
  await recoveryPage.getByText(/Wallet rejected/).waitFor();
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Submitted transaction:/).count(),
    0,
  );

  // Publish once, capture real hash even if accountsChanged fires while wallet dialog is open,
  // fail initial receipt read at application boundary, then test pending/wrong-network/same-chain-ID mismatch/recovery.
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.sendCount = 0;
    window.walletState.holdSend = true;
    window.walletState.receiptMode = "unavailable";
  });
  await publishBtn.click();
  await recoveryPage.waitForFunction(
    () => window.walletState.sendPending === true,
  );
  const changedAccount = "0x" + "8".repeat(40);
  await recoveryPage.evaluate((nextAcc) => {
    window.walletState.activeAccount = nextAcc;
    window.emitWallet("accountsChanged", [nextAcc]);
    window.releaseSend();
  }, changedAccount);

  await recoveryPage.getByText(/Receipt unavailable/).waitFor();
  const txHash = await recoveryPage.evaluate(
    () => window.walletState.lastTxHash,
  );
  assert.match(txHash, /^0x[0-9a-f]{64}$/);
  const hashCode = recoveryPage.locator("article code", { hasText: txHash });
  await hashCode.waitFor();
  assert.notEqual(
    await hashCode.evaluate((el) => getComputedStyle(el).userSelect),
    "none",
  );
  assert(await publishBtn.isDisabled());
  assert(await checkWalletBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Pending receipt response (null) keeps hash visible and Publish locked.
  await recoveryPage.evaluate(() => {
    window.walletState.receiptMode = "null";
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/still pending/).waitFor();
  await hashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Wrong-network read (0x1) after chainChanged cannot confirm or submit twice.
  await recoveryPage.evaluate(() => {
    window.walletState.receiptMode = "ok";
    window.walletState.mode = "wrong";
    window.emitWallet("chainChanged", "0x1");
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/Wrong wallet network/).waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Same-chain-ID mismatch (43113 with conflicting blockHash) after chainChanged cannot confirm or submit twice.
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "mismatch";
    window.emitWallet("chainChanged", "0xa869");
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/registry or snapshot mismatch/).waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Single active receipt check lock + mid-read chainChanged to wrong network cannot confirm.
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "ok";
    window.walletState.holdReceipt = true;
    window.emitWallet("chainChanged", "0xa869");
  });
  await checkReceiptBtn.click();
  await recoveryPage.waitForFunction(
    () => window.walletState.receiptPending === true,
  );
  assert(await checkReceiptBtn.isDisabled());
  assert(await publishBtn.isDisabled());
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "wrong";
    window.emitWallet("chainChanged", "0x1");
    window.releaseReceipt();
  });
  await recoveryPage.getByText(/Wrong wallet network/).waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Mid-read chainChanged round-trip A -> B -> A must discard the receipt read during B.
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "ok";
    window.walletState.receiptMode = "ok";
    window.walletState.holdReceipt = true;
    window.emitWallet("chainChanged", "0xa869");
  });
  await checkReceiptBtn.click();
  await recoveryPage.waitForFunction(
    () => window.walletState.receiptPending === true,
  );
  await recoveryPage.evaluate((hash) => {
    window.emitWallet("chainChanged", "0x1");
    window.emitWallet("chainChanged", "0xa869");
    window.releaseReceipt({
      status: "0x0",
      transactionHash: hash,
      logs: [],
    });
  }, txHash);
  await recoveryPage.getByText(/Wallet network changed while reading/).waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert.equal(await hashCode.innerText(), txHash);
  assert(await publishBtn.isDisabled());
  assert(await checkWalletBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Receipt missing transactionHash must stay unavailable (not replaced), keeping original hash and Check receipt.
  await recoveryPage.evaluate(() => {
    window.walletState.receiptMode = "missing-hash";
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/missing a valid transaction hash/).waitFor();
  assert.equal(await recoveryPage.getByText(/Transaction replaced/).count(), 0);
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert.equal(await hashCode.innerText(), txHash);
  assert(await publishBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Contradictory receipt with mismatched transactionHash C must stay retryable and never fake replacement.
  await recoveryPage.evaluate(() => {
    window.walletState.receiptMode = "mismatched-hash";
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/did not match/).waitFor();
  assert.equal(await recoveryPage.getByText(/Transaction replaced/).count(), 0);
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  await hashCode.waitFor();
  assert.equal(await hashCode.innerText(), txHash);
  assert(await publishBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Restore local Anvil network (keeping changedAccount active!) and recover with original attester.
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "ok";
    window.walletState.receiptMode = "ok";
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText("Confirmed publication: " + txHash).waitFor();
  await hashCode.waitFor();
  assert.equal(await hashCode.innerText(), txHash);
  assert(await publishBtn.isDisabled());
  assert(await checkWalletBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Replacement transaction B (reverted) via viem must show both hashes and never mark A confirmed or reverted.
  await anvilRpc("evm_mine", []);
  const replacedRevertedBlock = parseInt(
    await anvilRpc("eth_blockNumber", []),
    16,
  );
  await recoveryPage.evaluate((origAcc) => {
    window.walletState.activeAccount = origAcc;
    window.walletState.mode = "ok";
    window.walletState.sendCount = 0;
  }, attester);
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + replacedRevertedBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "replaced-reverted";
  });
  await publishBtn.click();
  await recoveryPage.getByText(/Transaction replaced/).waitFor();
  const { origReverted, repReverted } = await recoveryPage.evaluate(() => ({
    origReverted: window.walletState.lastTxHash,
    repReverted: window.walletState.lastReplacementHash,
  }));
  await recoveryPage
    .locator("article code", { hasText: origReverted })
    .waitFor();
  await recoveryPage
    .locator("article code", { hasText: repReverted })
    .waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  assert(await publishBtn.isDisabled());
  assert.equal(await checkReceiptBtn.count(), 0);
  assert(!(await checkWalletBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Replacement transaction B (success with ReportPublished) must also stay in replaced state and block duplicate send.
  await anvilRpc("evm_mine", []);
  const replacedSuccessBlock = parseInt(
    await anvilRpc("eth_blockNumber", []),
    16,
  );
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "ok";
  });
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + replacedSuccessBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.sendCount = 0;
    window.walletState.mode = "replaced-success";
  });
  await publishBtn.click();
  await recoveryPage.getByText(/Transaction replaced/).waitFor();
  const { origSuccess, repSuccess } = await recoveryPage.evaluate(() => ({
    origSuccess: window.walletState.lastTxHash,
    repSuccess: window.walletState.lastReplacementHash,
  }));
  await recoveryPage
    .locator("article code", { hasText: origSuccess })
    .waitFor();
  await recoveryPage
    .locator("article code", { hasText: repSuccess })
    .waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  assert(await publishBtn.isDisabled());
  await check(recoveryPage, "ok", /Publication simulation failed/);
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Reverted receipt + deliberate retry after checking wallet again.
  await anvilRpc("evm_mine", []);
  const revertedBlock = parseInt(await anvilRpc("eth_blockNumber", []), 16);
  await recoveryPage.evaluate((origAcc) => {
    window.walletState.activeAccount = origAcc;
    window.walletState.mode = "ok";
    window.walletState.sendCount = 0;
  }, attester);
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + revertedBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "reverted";
  });
  await publishBtn.click();
  await recoveryPage.getByText(/Publication reverted: 0x[0-9a-f]{64}/).waitFor();
  const revertedHash = await recoveryPage.evaluate(
    () => window.walletState.lastTxHash,
  );
  await recoveryPage
    .locator("article code", { hasText: revertedHash })
    .waitFor();
  assert(await publishBtn.isDisabled());
  assert(!(await checkWalletBtn.isDisabled()));

  // Deliberate new attempt after checking wallet again succeeds.
  await check(recoveryPage, "ok", /Authorized local attester/);
  await publishBtn.click();
  await recoveryPage
    .getByText(/Confirmed publication: 0x[0-9a-f]{64}/)
    .waitFor();

  // Successful receipt without ReportPublished shows unverified and keeps hash available.
  await anvilRpc("evm_mine", []);
  const noEventBlock = parseInt(await anvilRpc("eth_blockNumber", []), 16);
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "ok";
  });
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + noEventBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.mode = "no-event";
  });
  await publishBtn.click();
  await recoveryPage.getByText(/Publication not verified/).waitFor();
  const noEventHash = await recoveryPage.evaluate(
    () => window.walletState.lastTxHash,
  );
  await recoveryPage
    .locator("article code", { hasText: noEventHash })
    .waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert(await publishBtn.isDisabled());

  // Post-timeout replacement: initial wait times out, replacement B is mined on Anvil, then Check receipt detects B.
  await anvilRpc("evm_mine", []);
  const postTimeoutBlock = parseInt(
    await anvilRpc("eth_blockNumber", []),
    16,
  );
  await recoveryPage.evaluate((origAcc) => {
    window.walletState.activeAccount = origAcc;
    window.walletState.mode = "ok";
    window.walletState.receiptMode = "ok";
    window.walletState.sendCount = 0;
  }, attester);
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + postTimeoutBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await anvilRpc("evm_setAutomine", [false]);
  await recoveryPage.evaluate(() => {
    const origSetTimeout = window.setTimeout.bind(window);
    window.__origSetTimeout = origSetTimeout;
    window.setTimeout = (fn, delay, ...args) =>
      origSetTimeout(fn, delay === 60000 ? 150 : delay, ...args);
  });
  await publishBtn.click();
  await recoveryPage.getByText(/Receipt timed out/).waitFor();
  await recoveryPage.evaluate(() => {
    if (window.__origSetTimeout) {
      window.setTimeout = window.__origSetTimeout;
      delete window.__origSetTimeout;
    }
  });
  const postTimeoutOrigHash = await recoveryPage.evaluate(
    () => window.walletState.lastTxHash,
  );
  assert.match(postTimeoutOrigHash, /^0x[0-9a-f]{64}$/);
  await recoveryPage
    .locator("article code", { hasText: postTimeoutOrigHash })
    .waitFor();
  assert(await publishBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );
  const origPendingTx = await anvilRpc("eth_getTransactionByHash", [
    postTimeoutOrigHash,
  ]);
  assert(origPendingTx);
  await anvilRpc("anvil_dropTransaction", [postTimeoutOrigHash]);
  const repPostTimeoutHash = await anvilRpc("eth_sendTransaction", [
    {
      from: attester,
      to: attester,
      value: "0x0",
      nonce: origPendingTx.nonce,
      gas: "0x5208",
    },
  ]);
  await anvilRpc("evm_mine", []);
  await anvilRpc("evm_setAutomine", [true]);
  assert.equal(
    await anvilRpc("eth_getTransactionReceipt", [postTimeoutOrigHash]),
    null,
  );
  assert(await anvilRpc("eth_getTransactionReceipt", [repPostTimeoutHash]));
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/Transaction replaced/).waitFor();
  await recoveryPage
    .locator("article code", { hasText: postTimeoutOrigHash })
    .waitFor();
  await recoveryPage
    .locator("article code", { hasText: repPostTimeoutHash })
    .waitFor();
  assert.equal(
    await recoveryPage.getByText(/Confirmed publication:/).count(),
    0,
  );
  assert.equal(
    await recoveryPage.getByText(/Publication reverted:/).count(),
    0,
  );
  assert(await publishBtn.isDisabled());
  assert.equal(await checkReceiptBtn.count(), 0);
  assert(!(await checkWalletBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Competing nonce tx during wallet dialog: app must not blame competing tx B on A, then tracks and confirms A.
  await anvilRpc("evm_mine", []);
  const competingBlock = parseInt(await anvilRpc("eth_blockNumber", []), 16);
  await recoveryPage.evaluate((origAcc) => {
    window.walletState.activeAccount = origAcc;
    window.walletState.mode = "ok";
    window.walletState.receiptMode = "ok";
    window.walletState.txLookupMode = "ok";
    window.walletState.sendCount = 0;
  }, attester);
  await recoveryPage.getByRole("button", { name: "Scan contract" }).click();
  await recoveryPage.getByText("Block " + competingBlock).waitFor();
  await check(recoveryPage, "ok", /Authorized local attester/);
  await recoveryPage.evaluate(() => {
    window.walletState.holdSend = true;
    window.walletState.receiptMode = "ok";
    window.walletState.txLookupMode = "null";
    window.walletState.sendCount = 0;
  });
  await publishBtn.click();
  await recoveryPage.waitForFunction(
    () => window.walletState.sendPending === true,
  );
  const usedNonceHex = await anvilRpc("eth_getTransactionCount", [
    attester,
    "latest",
  ]);
  const competingHashB = await anvilRpc("eth_sendTransaction", [
    {
      from: attester,
      to: attester,
      value: "0x0",
      nonce: usedNonceHex,
      gas: "0x5208",
    },
  ]);
  assert(await anvilRpc("eth_getTransactionReceipt", [competingHashB]));
  await anvilRpc("evm_setAutomine", [false]);
  await recoveryPage.evaluate(() => {
    const origSetTimeout = window.setTimeout.bind(window);
    window.__origSetTimeout = origSetTimeout;
    window.setTimeout = (fn, delay, ...args) =>
      origSetTimeout(fn, delay === 60000 ? 150 : delay, ...args);
    window.releaseSend();
  });
  await recoveryPage.getByText(/Receipt timed out/).waitFor();
  await recoveryPage.evaluate(() => {
    if (window.__origSetTimeout) {
      window.setTimeout = window.__origSetTimeout;
      delete window.__origSetTimeout;
    }
  });
  const competingOrigHash = await recoveryPage.evaluate(
    () => window.walletState.lastTxHash,
  );
  assert.match(competingOrigHash, /^0x[0-9a-f]{64}$/);
  assert.notEqual(
    competingOrigHash.toLowerCase(),
    competingHashB.toLowerCase(),
  );
  const competingHashCode = recoveryPage.locator("article code", {
    hasText: competingOrigHash,
  });
  await competingHashCode.waitFor();
  await checkReceiptBtn.click();
  await recoveryPage
    .getByText(/Original transaction details are not available yet/)
    .waitFor();
  assert.equal(await recoveryPage.getByText(/Transaction replaced/).count(), 0);
  await competingHashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Once the node reveals exact A (with the higher nonce) pending, Check receipt tracks A without blaming B.
  await recoveryPage.evaluate(() => {
    window.walletState.txLookupMode = "ok";
  });
  await checkReceiptBtn.click();
  await recoveryPage.getByText(/still pending/).waitFor();
  assert.equal(await recoveryPage.getByText(/Transaction replaced/).count(), 0);
  await competingHashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert(!(await checkReceiptBtn.isDisabled()));
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  // Mining A confirms it on Check receipt without resubmitting.
  await anvilRpc("evm_mine", []);
  await anvilRpc("evm_setAutomine", [true]);
  await checkReceiptBtn.click();
  await recoveryPage
    .getByText("Confirmed publication: " + competingOrigHash)
    .waitFor();
  await competingHashCode.waitFor();
  assert(await publishBtn.isDisabled());
  assert.equal(
    await recoveryPage.evaluate(() => window.walletState.sendCount),
    1,
  );

  console.log(
    "Browser passed: score 35, export, network/snapshot/rejection guards, confirmed receipt, receipt recovery, wallet events, mid-read chain round-trip, reverted/unverified/replaced/post-timeout-replaced/missing-hash/mismatched-hash/competing-nonce receipts, clean lookup, import races, replay, current state and pruned history.",
  );
} catch (error) {
  console.error((await activePage?.locator("body").innerText())?.slice(-2500));
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await closed;
  proxy.closeAllConnections();
  proxy.close();
}
