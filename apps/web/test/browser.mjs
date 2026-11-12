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
  assert.equal(await page.getByRole("button", {name:"Publish",exact:true}).count(), 0);
  await page.getByLabel("Target contract address").fill(fixture);
  await page.getByRole("button", { name: "Scan contract" }).click();
  await page.getByText("35 / 100 · Some signals").waitFor();
  console.log("Rendered score 35");
  const download = page.waitForEvent("download");
  await page.getByText("Export canonical JSON").click();
  const json = await readFile(await (await download).path(), "utf8");
  console.log("Exported canonical body");
  await page.exposeFunction("testRpc", async ({ method, params }) => {
    const r = await (
      await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method,
          params: params ?? [],
        }),
      })
    ).json();
    if (r.error) throw Error(r.error.message);
    return r.result;
  });
  await page.evaluate((account) => {
    window.mode = "wrong";
    window.ethereum = {
      on() {},
      removeListener() {},
      async request(call) {
        if (["eth_accounts", "eth_requestAccounts"].includes(call.method))
          return [account];
        if (window.mode === "wrong" && call.method === "eth_chainId")
          return "0x1";
        if (window.mode === "reject" && call.method === "eth_sendTransaction")
          throw Object.assign(Error("Rejected"), { code: 4001 });
        const result = await window.testRpc(call);
        if (
          window.mode === "mismatch" &&
          call.method === "eth_getBlockByNumber"
        )
          result.hash = "0x" + "f".repeat(64);
        return result;
      },
    };
  }, attester);
  async function check(mode, label) {
    console.log("Wallet scenario", mode);
    await page.evaluate((m) => {
      window.mode = m;
    }, mode);
    await page.getByText("Check wallet", { exact: true }).click();
    await page.getByText(label).waitFor();
  }
  await check("wrong", /Wrong wallet network/);
  assert(
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .isDisabled(),
  );
  await check("mismatch", /registry or snapshot mismatch/);
  await check("reject", /Authorized local attester/);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText(/Wallet rejected/).waitFor();
  await check("ok", /Authorized local attester/);
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
  async function upload(text, expected) {
    await fresh
      .getByLabel("Import canonical JSON")
      .setInputFiles({
        name: "report.json",
        mimeType: "application/json",
        buffer: Buffer.from(text),
      });
    await fresh.getByText(expected).waitFor();
  }
  await upload("{", /Malformed JSON/);
  await upload("{}", /Invalid report schema/);
  const changed = JSON.parse(json);
  changed.findings[0].explanation += " altered";
  await upload(JSON.stringify(changed), /Hash mismatch/);
  await upload(json, /Hash and registry summary fields agree/);
  await fresh.getByText("Replay original block").click();
  await fresh.getByText(/Original-block replay: replay-matches/).waitFor();
  await fresh.getByText("Scan current state").click();
  await fresh.getByText(/No semantic changes/).waitFor();
  prune = true;
  await fresh.getByText("Replay original block").click();
  await fresh
    .getByText(/inconclusive · historical-state-unavailable/)
    .waitFor();
  console.log(
    "Browser passed: score 35, export, network/snapshot/rejection guards, confirmed receipt, clean lookup, import, replay, current state and pruned history.",
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
