// Invoked only by the ephemeral Anvil integration suite.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  encodeFunctionData,
  getAddress,
  keccak256,
  parseAbi,
  stringToHex,
  zeroAddress,
} from "viem";

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
      switchCount: 0,
      addCount: 0,
      lastAddedChain: null,
      simulateChainMissing4902: false,
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
        if (call.method === "wallet_switchEthereumChain") {
          s.switchCount++;
          if (s.simulateChainMissing4902) {
            throw Object.assign(Error("Unrecognized chain ID"), { code: 4902 });
          }
          if (call.params?.[0]?.chainId?.toLowerCase() === "0xa869") {
            s.mode = "ok";
            window.emitWallet("chainChanged", "0xa869");
          }
          return null;
        }
        if (call.method === "wallet_addEthereumChain") {
          s.addCount++;
          s.lastAddedChain = call.params?.[0] ?? null;
          s.simulateChainMissing4902 = false;
          s.mode = "ok";
          window.emitWallet("chainChanged", "0xa869");
          return null;
        }
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
  await page.locator(".explain-panel").getByText("Template explanation").waitFor();
  await page.locator(".explain-panel").getByText(/no-bytecode/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Publish", exact: true }).count(),
    0,
  );
  await page.getByLabel("Target contract address").fill(fixture);
  await page.getByRole("button", { name: "Scan contract" }).click();
  await page.getByText("35 / 100 · Some signals").waitFor();
  await page.locator(".explain-panel").getByText("Template explanation").waitFor();
  await page.locator(".explain-panel h4", { hasText: "R-MINT · high · +25" }).waitFor();
  await page.locator(".explain-panel code", { hasText: "dispatch-mint(address,uint256)" }).waitFor();
  await page.locator(".explain-panel h4", { hasText: "R-OWNER-EOA · medium · +10" }).waitFor();
  await page.locator(".explain-panel code", { hasText: "owner-code" }).waitFor();
  await page.locator(".explain-panel").getByText(/Suggested read-only checks/).first().waitFor();
  console.log("Rendered score 35 and template explanation");
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
  await fresh.getByText(/insufficient evidence for an explanation/).waitFor();
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

  // M6 review fix: Lookup handles a canonical body whose finding ID cannot use the optional template.
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, sortKeys(v)]),
      );
    }
    return value;
  };
  const unknownObj = JSON.parse(json);
  unknownObj.findings = [
    ...unknownObj.findings,
    {
      id: "R-FUTURE-SIGNAL",
      severity: "info",
      weight: 0,
      confidence: "call-result",
      evidenceIds: ["owner"],
      explanation: "Attested custom rule text must not be rendered as template.",
    },
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const unknownJson = JSON.stringify(sortKeys(unknownObj));
  const unknownReportHash = keccak256(stringToHex(unknownJson));
  const publishAbi = parseAbi([
    "function publish((address target,uint8 score,bytes32 codehash,address implementation,bytes32 reportHash,uint32 rulesetVersion,uint64 blockNumber,bytes32 blockHash) p)",
  ]);
  const publishData = encodeFunctionData({
    abi: publishAbi,
    functionName: "publish",
    args: [
      {
        target: getAddress(unknownObj.address),
        score: unknownObj.signalScore,
        codehash: unknownObj.codehash,
        implementation: getAddress(unknownObj.proxy.implementation ?? zeroAddress),
        reportHash: unknownReportHash,
        rulesetVersion: unknownObj.rulesetVersion,
        blockNumber: BigInt(unknownObj.blockNumber),
        blockHash: unknownObj.blockHash,
      },
    ],
  });
  const unknownTxHash = await anvilRpc("eth_sendTransaction", [
    { from: attester, to: registry, data: publishData, gas: "0x7a120" },
  ]);
  let unknownReceipt = null;
  for (let i = 0; i < 40 && !unknownReceipt; i++) {
    unknownReceipt = await anvilRpc("eth_getTransactionReceipt", [unknownTxHash]);
    if (!unknownReceipt) await delay(100);
  }
  assert.equal(unknownReceipt?.status, "0x1");

  await fresh.getByText("Find latest").click();
  await fresh.getByText("Report body unavailable.", { exact: true }).waitFor();
  await uploadNamed(
    "unknown-rule.json",
    unknownJson,
    /Hash and registry summary fields agree/,
  );
  await fresh
    .locator(".explain-panel .provenance-badge")
    .getByText("Explanation unavailable", { exact: true })
    .waitFor();
  await fresh
    .locator(".explain-panel")
    .getByText(/Optional template explanation unavailable: this report contains a finding rule/)
    .waitFor();
  assert.equal(
    await fresh
      .locator(".explain-panel")
      .getByText(/Attested custom rule text/)
      .count(),
    0,
  );
  assert(!(await replayBtn.isDisabled()));
  await replayBtn.click();
  await fresh.getByText(/Original-block replay: replay-mismatch/).waitFor();
  await scanBtn.click();
  await fresh.locator('pre[role="status"]').getByText(/Finding R-FUTURE-SIGNAL/).waitFor();

  // Switch back to the supported record at history index 0 and verify normal template returns.
  await fresh.getByLabel(/History index/).fill("0");
  await fresh.getByText("Read history entry").click();
  await fresh.getByText("Report body unavailable.", { exact: true }).waitFor();
  await uploadNamed(
    "supported.json",
    json,
    /Hash and registry summary fields agree/,
  );
  await fresh
    .locator(".explain-panel .provenance-badge")
    .getByText("Template explanation", { exact: true })
    .waitFor();
  await fresh.locator(".explain-panel").getByText(/35 \/ 100/).waitFor();

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
  await recoveryPage.getByText("Chain 43113 · Block " + recoveryBlock).waitFor();

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
  await recoveryPage.getByText("Chain 43113 · Block " + replacedRevertedBlock).waitFor();
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
  await recoveryPage.getByText("Chain 43113 · Block " + replacedSuccessBlock).waitFor();
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
  await recoveryPage.getByText("Chain 43113 · Block " + revertedBlock).waitFor();
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
  await recoveryPage.getByText("Chain 43113 · Block " + noEventBlock).waitFor();
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
  await recoveryPage.getByText("Chain 43113 · Block " + postTimeoutBlock).waitFor();
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
  await recoveryPage.getByText("Chain 43113 · Block " + competingBlock).waitFor();
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

  // M6: Controlled delayed-response and fallback browser checks with a loopback mock explain server.
  const heldRequests = [];
  let explainMode = "hold-first";
  let explainRequestCount = 0;
  let markFirstExplainSeen;
  const firstExplainSeen = new Promise((resolve) => {
    markFirstExplainSeen = resolve;
  });
  const explainMock = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const input = body.input;
    explainRequestCount++;
    const currentReqIndex = explainRequestCount;
    if (currentReqIndex === 1) markFirstExplainSeen();
    const makePayload = (mintCheckId) => ({
      items: input.findings.map((f) => ({
        findingId: f.id,
        citedEvidenceIds: [...f.evidenceIds],
        ...(f.id === "R-MINT"
          ? { suggestedCheckIds: [mintCheckId] }
          : f.allowedCheckIds.length > 0
            ? { suggestedCheckIds: [f.allowedCheckIds[0]] }
            : {}),
      })),
    });

    if (explainMode === "hold-first" && currentReqIndex === 1) {
      await new Promise((resolve) => {
        heldRequests.push(() => {
          if (!res.writableEnded && !res.headersSent) {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(makePayload("mint-authority")));
          }
          resolve();
        });
      });
      return;
    }
    if (explainMode === "unsafe-claim") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ...makePayload("mint-events"),
          overview: "This contract is safe and audited with zero risk.",
        }),
      );
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(makePayload("mint-events")));
  });
  explainMock.listen(0, "127.0.0.1");
  await once(explainMock, "listening");

  const explainServer = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      "31846",
    ],
    {
      cwd: "apps/web",
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        AVAGUARD_ENV: "local",
        AVAGUARD_AI_ENABLED: "1",
        AVAGUARD_LOCAL_EXPLAIN_URL:
          "http://127.0.0.1:" + explainMock.address().port,
        REGISTRY_ADDRESS: registry,
        FUJI_RPC_URL: "http://127.0.0.1:" + proxy.address().port,
      },
    },
  );
  const explainClosed = once(explainServer, "exit");
  try {
    const explainUrl = "http://127.0.0.1:31846";
    for (let i = 0; i < 120; i++) {
      if (explainServer.exitCode !== null)
        throw Error("Explain Next server exited");
      if (
        await fetch(explainUrl)
          .then((r) => r.ok)
          .catch(() => false)
      )
        break;
      await delay(250);
    }

    const explainPage = await browser.newPage();
    activePage = explainPage;
    explainPage.setDefaultTimeout(12000);
    await explainPage.goto(explainUrl);
    await explainPage.getByLabel("Target contract address").fill(fixture);
    await explainPage.getByRole("button", { name: "Scan contract" }).click();

    await explainPage.getByText("35 / 100 · Some signals").waitFor();
    await explainPage
      .locator(".explain-panel .provenance-badge")
      .getByText("Template explanation", { exact: true })
      .waitFor();
    await explainPage
      .getByText(/Requesting AI-assisted explanation/)
      .waitFor();
    // Export remains usable while AI explanation is still pending
    const dlPending = explainPage.waitForEvent("download");
    await explainPage.getByText("Export canonical JSON").click();
    assert((await readFile(await (await dlPending).path(), "utf8")).length > 0);

    await firstExplainSeen;
    // Mine a new block and rescan the same fixture address before Scan #1 explanation resolves
    await anvilRpc("evm_mine", []);
    const block2 = parseInt(await anvilRpc("eth_blockNumber", []), 16);
    await explainPage.getByRole("button", { name: "Scan contract" }).click();
    await explainPage.getByText("Chain 43113 · Block " + block2).waitFor();
    await explainPage
      .locator(".explain-panel .provenance-badge")
      .getByText("AI-assisted explanation", { exact: true })
      .waitFor();
    await explainPage.locator(".explain-panel").getByText("Prompt v2").waitFor();
    await explainPage
      .locator(".explain-panel")
      .getByText(new RegExp(`at block ${block2}`))
      .first()
      .waitFor();
    await explainPage
      .locator(".explain-panel")
      .getByText(/Review historical Transfer events from the zero address/)
      .waitFor();
    assert.equal(
      await explainPage
        .locator(".explain-panel")
        .getByText(/Inspect verified source or contract ABI outside AvaGuard/)
        .count(),
      0,
    );

    // Release delayed Scan #1 AI response (mint-authority) and confirm it is discarded
    while (heldRequests.length) heldRequests.shift()();
    await delay(200);
    assert.equal(
      await explainPage
        .locator(".explain-panel")
        .getByText(/Inspect verified source or contract ABI outside AvaGuard/)
        .count(),
      0,
    );
    await explainPage
      .locator(".explain-panel")
      .getByText(new RegExp(`at block ${block2}`))
      .first()
      .waitFor();
    await explainPage
      .locator(".explain-panel")
      .getByText(/Review historical Transfer events from the zero address/)
      .waitFor();

    // Rejected free-form claim falls back to labeled template and hides rejected text
    explainMode = "unsafe-claim";
    await anvilRpc("evm_mine", []);
    const block3 = parseInt(await anvilRpc("eth_blockNumber", []), 16);
    await explainPage.getByRole("button", { name: "Scan contract" }).click();
    await explainPage.getByText("Chain 43113 · Block " + block3).waitFor();
    await explainPage
      .locator(".explain-panel .provenance-badge")
      .getByText("Template explanation", { exact: true })
      .waitFor();
    await explainPage
      .locator(".explain-panel")
      .getByText(/failed evidence or schema validation/)
      .waitFor();
    assert.equal(
      await explainPage.getByText(/This contract is safe and audited/).count(),
      0,
    );
  } finally {
    while (heldRequests.length) heldRequests.shift()();
    explainServer.kill();
    await explainClosed;
    explainMock.closeAllConnections();
    explainMock.close();
  }

  // Simulated non-loopback Fuji mode browser regression (routes https://fuji-rpc.test via test preload to Anvil).
  const preloadUrl = pathToFileURL(
    resolve("apps/web/test/fuji-rpc-preload.mjs"),
  ).href;
  const fujiServer = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      "31847",
    ],
    {
      cwd: "apps/web",
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        AVAGUARD_ENV: "fuji",
        FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
        REGISTRY_ADDRESS: registry,
        AVAGUARD_APP_ORIGIN: "http://avaguard-fuji.test:31847",
        AVAGUARD_TEST_LOCAL_RPC: "http://127.0.0.1:" + proxy.address().port,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preloadUrl}`]
          .filter(Boolean)
          .join(" "),
      },
    },
  );
  const fujiClosed = once(fujiServer, "exit");
  let fujiBrowser;
  try {
    const fujiProbeUrl = "http://127.0.0.1:31847";
    const fujiOriginUrl = "http://avaguard-fuji.test:31847";
    for (let i = 0; i < 120; i++) {
      if (fujiServer.exitCode !== null)
        throw Error("Simulated Fuji Next server exited");
      if (
        await fetch(fujiProbeUrl)
          .then((r) => r.ok)
          .catch(() => false)
      )
        break;
      await delay(250);
    }

    fujiBrowser = await chromium.launch({
      args: ["--host-resolver-rules=MAP avaguard-fuji.test 127.0.0.1"],
    });
    const fujiPage = await fujiBrowser.newPage();
    activePage = fujiPage;
    fujiPage.setDefaultTimeout(12000);

    // 1. Mismatched origin (127.0.0.1) still allows read-only scan, while origin guard blocks Fuji publication.
    await fujiPage.goto(fujiProbeUrl);
    await fujiPage.getByText("Avalanche Fuji · 43113").waitFor();
    await fujiPage.getByLabel("Target contract address").fill(fixture);
    await fujiPage.getByRole("button", { name: "Scan contract" }).click();
    await fujiPage.getByText("35 / 100 · Some signals").waitFor();
    await fujiPage
      .getByText(/Fuji publication is restricted to the configured origin/)
      .waitFor();

    // 2. Intended non-loopback test origin enables explicit Fuji wallet checks, network switch, publish, and replay.
    await anvilRpc("evm_mine", []);
    const fujiBlock = parseInt(await anvilRpc("eth_blockNumber", []), 16);
    await fujiPage.goto(fujiOriginUrl);
    await fujiPage.getByText("Avalanche Fuji · 43113").waitFor();
    await fujiPage.getByLabel("Target contract address").fill(fixture);
    await fujiPage.getByRole("button", { name: "Scan contract" }).click();
    await fujiPage.getByText("35 / 100 · Some signals").waitFor();
    await fujiPage.getByText("Chain 43113 · Block " + fujiBlock).waitFor();

    const fujiDl = fujiPage.waitForEvent("download");
    await fujiPage.getByText("Export canonical JSON").click();
    const fujiJson = await readFile(await (await fujiDl).path(), "utf8");

    await installProvider(fujiPage, attester);
    await fujiPage.evaluate(() => {
      window.walletState.mode = "wrong";
      window.walletState.simulateChainMissing4902 = true;
    });

    await fujiPage.getByRole("button", { name: "Check wallet", exact: true }).click();
    await fujiPage.getByText(/Wrong wallet network/).waitFor();
    assert.equal(
      await fujiPage.evaluate(() => window.walletState.switchCount),
      0,
    );

    const switchBtn = fujiPage.getByRole("button", {
      name: "Switch wallet to 43113",
      exact: true,
    });
    await switchBtn.waitFor();
    await switchBtn.click();
    await fujiPage
      .getByText(/Avalanche Fuji \(43113\) added to wallet/)
      .waitFor();
    const switchStats = await fujiPage.evaluate(() => ({
      switchCount: window.walletState.switchCount,
      addCount: window.walletState.addCount,
      addedRpc: window.walletState.lastAddedChain?.rpcUrls?.[0] ?? null,
    }));
    assert.deepEqual(switchStats, {
      switchCount: 1,
      addCount: 1,
      addedRpc: "https://api.avax-test.network/ext/bc/C/rpc",
    });

    // Unauthorized attester account fails closed.
    await fujiPage.evaluate(() => {
      window.walletState.activeAccount =
        "0x0000000000000000000000000000000000007500";
    });
    await fujiPage.getByRole("button", { name: "Check wallet", exact: true }).click();
    await fujiPage.getByText(/Account lacks live attester permission/).waitFor();
    assert(
      await fujiPage
        .getByRole("button", { name: "Publish", exact: true })
        .isDisabled(),
    );

    // Switch back to authorized attester and exercise initial unavailable -> pending Check receipt -> confirmed recovery.
    await fujiPage.evaluate((acc) => {
      window.walletState.activeAccount = acc;
      window.walletState.receiptMode = "unavailable";
    }, attester);
    await fujiPage.getByRole("button", { name: "Check wallet", exact: true }).click();
    await fujiPage.getByText(/Authorized Fuji attester/).waitFor();
    await fujiPage.getByRole("button", { name: "Publish", exact: true }).click();
    await fujiPage
      .getByText(/Receipt unavailable\. Use Check receipt/)
      .waitFor();

    await fujiPage.evaluate(() => {
      window.walletState.receiptMode = "null";
    });
    await fujiPage.getByRole("button", { name: "Check receipt", exact: true }).click();
    await fujiPage.getByText(/still pending/).waitFor();
    await fujiPage.locator("article code", { hasText: /^0x[0-9a-f]{64}$/ }).waitFor();

    await fujiPage.evaluate(() => {
      window.walletState.receiptMode = "ok";
    });
    await fujiPage.getByRole("button", { name: "Check receipt", exact: true }).click();
    await fujiPage
      .getByText(/Confirmed publication: 0x[0-9a-f]{64}/)
      .waitFor();

    // Lookup, canonical import, and original-block replay on the simulated Fuji origin.
    await fujiPage.goto(fujiOriginUrl + "/lookup");
    await fujiPage.getByLabel("Target contract address").fill(fixture);
    await fujiPage.getByRole("button", { name: "Find latest", exact: true }).click();
    await fujiPage.getByText("Report body unavailable.", { exact: true }).waitFor();
    await fujiPage.getByLabel("Import canonical JSON").setInputFiles({
      name: "fuji-report.json",
      mimeType: "application/json",
      buffer: Buffer.from(fujiJson),
    });
    await fujiPage.getByText(/Hash and registry summary fields agree/).waitFor();
    await fujiPage
      .getByRole("button", { name: "Replay original block", exact: true })
      .click();
    await fujiPage.getByText(/Original-block replay: replay-matches/).waitFor();
  } catch (err) {
    console.error("FUJI_BROWSER_ERROR:", err);
    console.error(
      (await activePage?.locator("body").innerText().catch(() => ""))?.slice(-2500),
    );
    activePage = null;
    throw err;
  } finally {
    await fujiBrowser?.close();
    fujiServer.kill();
    await fujiClosed;
  }

  console.log(
    "Browser passed (local Anvil + simulated non-loopback Fuji config): score 35, template explanation, delayed stale-response discard, AI validation fallback, export, origin & network switch guards, unauthorized attester check, pending receipt recovery, confirmed receipt, lookup, import, replay, current state and pruned history.",
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
