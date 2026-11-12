import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { encodeAbiParameters, encodeFunctionData, keccak256, toHex, type Hex } from "viem";
import { BEACON_SLOT, IMPLEMENTATION_SLOT, buildReport, collectEvidence, createHttpTransport,
  probeAbi, replayReport, type ReadMethod, type ReadTransport } from "../src/index";

// Explicit opt-in script; starts only a local account-free Anvil, never deploys or signs.
const endpoint = "http://127.0.0.1:18545";
const target = ("0x" + "1".repeat(40)) as Hex;
const holder = ("0x" + "2".repeat(40)) as Hex;
let process: ChildProcess | undefined;
let anvilPid: string | undefined;
let rpcId = 0;
async function rpc(method: string, params: unknown[]) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }), signal: AbortSignal.timeout(1000) });
  const r = await response.json();
  if (r.error) throw new Error("Local Anvil setup RPC failed: " + method);
  return r.result;
}
beforeAll(async () => {
  if (globalThis.process.platform !== "win32") throw new Error("This integration runner expects Windows + Ubuntu WSL2");
  // Refuse an existing listener: no accidental writes to somebody else's local node.
  try { await fetch(endpoint, { signal: AbortSignal.timeout(300) }); throw new Error("Port 18545 is already in use"); }
  catch (error) { if (error instanceof Error && error.message === "Port 18545 is already in use") throw error; }
  process = spawn("wsl.exe", ["-d", "Ubuntu", "--exec", "bash", "-c",
    "echo $$; exec ~/.foundry/bin/anvil --accounts 0 --silent --chain-id 43113 --hardfork cancun --host 127.0.0.1 --port 18545"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  process.stdout!.on("data", chunk => {
    output += String(chunk);
    anvilPid = /^([0-9]+)\r?\n/.exec(output)?.[1];
  });
  let startupError = false;
  process.on("error", () => { startupError = true; });
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (startupError || process.exitCode !== null) throw new Error("Owned Anvil process exited during startup");
    try { if (await rpc("eth_chainId", []) === "0xa869" && anvilPid) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Owned Anvil did not become ready");
  const artifact = JSON.parse(await readFile("packages/contracts/out/ReadProbeFixture.sol/ReadProbeFixture.json", "utf8"));
  let runtime: string = artifact.deployedBytecode.object;
  const refs = Object.values(artifact.deployedBytecode.immutableReferences) as { start: number; length: number }[][];
  if (refs.length !== 1) throw new Error("Fixture immutable layout changed; inspect rather than guessing");
  for (const ref of refs[0]) {
    const offset = 2 + ref.start * 2;
    runtime = runtime.slice(0, offset) + toHex(1000n, { size: ref.length }).slice(2) + runtime.slice(offset + ref.length * 2);
  }
  await rpc("anvil_setCode", [target, runtime]);
  const mappingKey = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holder, 0n]));
  await rpc("anvil_setStorageAt", [target, mappingKey, toHex(1000n, { size: 32 })]);
  await rpc("evm_mine", []);
}, 45000);
afterAll(async () => {
  if (anvilPid) await promisify(execFile)("wsl.exe", ["-d", "Ubuntu", "--exec", "kill", "-TERM", anvilPid], { windowsHide: true });
  process?.kill();
});
it("collects compiled fixture code/storage/calls at B and replays the exact snapshot without a transaction", async () => {
  expect(await rpc("eth_accounts", [])).toEqual([]);
  const ledger: { method: ReadMethod; params: readonly unknown[] }[] = [];
  const http = createHttpTransport(endpoint);
  const transport: ReadTransport = { async request(method, params) { ledger.push({ method, params }); return http.request(method, params); } };
  const r = await collectEvidence(transport, { address: target });
  expect(r.status).toBe("collected");
  expect(r.publishable).toBe(false);
  expect(r.signalScore).toBeNull();
  expect(r.evidence.find(e => e.id === "total-supply")?.decoded).toBe("1000");
  expect(r.evidence.find(e => e.id === "balance-zero")?.decoded).toBe("0");
  expect(r.evidence.find(e => e.id === "owner")?.outcome).toBe("execution-revert");
  expect(r.evidence.find(e => e.id === "metadata-name")?.outcome).toBe("execution-revert");
  expect(ledger.filter(c => ["eth_getCode", "eth_getStorageAt", "eth_call"].includes(c.method))
    .every(c => c.params.at(-1) === toHex(BigInt(r.snapshot!.blockNumber)))).toBe(true);
  const holderBalance = await http.request("eth_call", [{ to: target,
    data: encodeFunctionData({ abi: probeAbi, functionName: "balanceOf", args: [holder] }) }, toHex(BigInt(r.snapshot!.blockNumber))]);
  expect(BigInt(holderBalance as Hex)).toBe(1000n);
  const replay = await collectEvidence(http, { address: target, historical: r.snapshot! });
  expect(replay).toEqual(r);
  const report = buildReport(r);
  expect(report.signalScore).toBe(0);
  if (report.status !== "complete") throw new Error(report.reason);
  expect(await replayReport(http, report.body, report.reportHash)).toEqual({ status: "replay-matches", reportHash: report.reportHash });
}, 45000);
it("returns not-analyzable for an empty local address, never a score", async () => {
  const r = await collectEvidence(createHttpTransport(endpoint), { address: "0x" + "9".repeat(40) });
  expect(r.status).toBe("not-analyzable");
  expect(r.signalScore).toBeNull();
  expect(buildReport(r)).toMatchObject({ status: "not-analyzable", signalScore: null, band: null });
}, 45000);

const golden = [
  ["CleanToken", 0, "Few signals", []],
  ["MintableToken", 35, "Some signals", ["R-MINT", "R-OWNER-EOA"]],
  ["DecoyConstantToken", 0, "Few signals", []],
  ["BlacklistFeeToken", 45, "Some signals", ["R-BLACKLIST", "R-FEE", "R-OWNER-EOA"]],
  ["UpgradeableToken", 60, "Many signals", ["R-MINT", "R-OWNER-EOA", "R-PROXY"]],
  ["BeaconProxyToken", 60, "Many signals", ["R-MINT", "R-OWNER-EOA", "R-PROXY"]],
  ["NoMetadataToken", 0, "Few signals", ["R-METADATA-ABSENT"]],
  ["NotErc20Contract", 10, "Few signals", ["R-METADATA-ABSENT", "R-NONSTANDARD"]],
  ["RenouncedMintToken", 25, "Some signals", ["R-MINT", "R-OWNER-RENOUNCED"]],
  ["ContractOwnerToken", 25, "Some signals", ["R-MINT", "R-OWNER-CONTRACT"]],
] as const;

async function installRuntime(name: string, address: Hex) {
  const artifact = JSON.parse(await readFile("packages/contracts/out/GoldenFixtures.sol/" + name + ".json", "utf8"));
  await rpc("anvil_setCode", [address, artifact.deployedBytecode.object]);
}
const goldenRefs: Record<string, string[]> = {
  "R-MINT": ["dispatch-mint(address,uint256)"], "R-BLACKLIST": ["dispatch-blacklist(address)"],
  "R-FEE": ["dispatch-setFee(uint256)"], "R-OWNER-EOA": ["owner", "owner-code"],
  "R-OWNER-CONTRACT": ["owner", "owner-code"], "R-OWNER-RENOUNCED": ["owner"],
  "R-METADATA-ABSENT": ["metadata-decimals", "metadata-name", "metadata-symbol"],
  "R-NONSTANDARD": ["balance-zero", "total-supply"], "R-SOURCE-UNKNOWN": ["source-scope"],
};
for (const [i, [name, score, band, rules]] of golden.entries()) {
  it(name + " scores " + score + " from compiled runtime and target state", async () => {
    const address = toHex(4096 + i, { size: 20 });
    const impl = toHex(8192, { size: 20 });
    const beacon = toHex(8193, { size: 20 });
    const slot0 = toHex(0, { size: 32 });
    const setAddress = (account: Hex, slot: Hex, value: Hex) =>
      rpc("anvil_setStorageAt", [account, slot, toHex(BigInt(value), { size: 32 })]);
    await installRuntime(name, address);
    if (name === "UpgradeableToken" || name === "BeaconProxyToken") {
      await installRuntime("MintableToken", impl);
      if (name === "UpgradeableToken") await setAddress(address, IMPLEMENTATION_SLOT, impl);
      else {
        await installRuntime("FixtureBeacon", beacon);
        await setAddress(beacon, slot0, impl);
        await setAddress(address, BEACON_SLOT, beacon);
      }
    }
    if (rules.some(id => id === "R-OWNER-EOA")) await setAddress(address, slot0, holder);
    if (name === "ContractOwnerToken") await setAddress(address, slot0, target);
    await rpc("evm_mine", []);
    const r = buildReport(await collectEvidence(createHttpTransport(endpoint), { address }));
    expect(r.status).toBe("complete");
    if (r.status !== "complete") throw new Error(r.reason);
    expect(r.signalScore).toBe(score);
    expect(r.band).toBe(band);
    expect(r.findings.map(f => f.id)).toEqual([...rules, "R-SOURCE-UNKNOWN"].sort());
    for (const f of r.findings) {
      const proxyRefs = ["target-code", "proxy-implementation-slot", "implementation-code",
        "implementation-nested-slot", "implementation-nested-beacon"];
      if (name === "BeaconProxyToken") proxyRefs.push("proxy-beacon-slot", "beacon-code", "beacon-implementation");
      expect(f.evidenceIds).toEqual(f.id === "R-PROXY" ? proxyRefs.sort() : goldenRefs[f.id]);
      for (const id of f.evidenceIds) {
        const evidence = r.evidence.find(e => e.id === id);
        expect(evidence).toBeDefined();
        if (id.startsWith("dispatch-")) expect(evidence?.sourceEvidenceId).toBe(r.proxy.status === "resolved" ? "implementation-code" : "target-code");
      }
    }
    expect(r.coverage.checked.map(c => c.id)).toEqual(expect.arrayContaining(["dispatcher", "rules"]));
    expect(r.coverage.notChecked.map(c => c.id)).toEqual(expect.arrayContaining([
      "source-verification", "privileged-access", "custom-dispatch", "unsupported-proxies", "tokenomics", "clone-integration"]));
  }, 45000);
}
