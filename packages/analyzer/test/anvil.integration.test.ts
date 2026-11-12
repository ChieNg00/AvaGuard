import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { decodeFunctionResult, encodeAbiParameters, encodeDeployData, encodeFunctionData, keccak256, toHex, zeroAddress, type Hex } from "viem";
import { BEACON_SLOT, IMPLEMENTATION_SLOT, buildReport, collectEvidence, createHttpTransport,
  canonicalReportJson, probeAbi, replayReport, verifyCommitment, type ReadMethod, type ReadTransport } from "../src/index";

// Explicit opt-in script; starts a loopback-only Anvil with no generated keys. M4 uses local impersonation.
const endpoint = "http://127.0.0.1:18545";
const target = ("0x" + "1".repeat(40)) as Hex;
const holder = ("0x" + "2".repeat(40)) as Hex;
const useWsl = process.platform === "win32";
const args = ["--accounts", "0", "--silent", "--chain-id", "43113", "--hardfork", "cancun", "--host", "127.0.0.1", "--port", "18545"];
let anvilProcess: ChildProcess | undefined;
let anvilClosed: Promise<void> | undefined;
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
  // Refuse an existing listener: no accidental writes to somebody else's local node.
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(18545, "127.0.0.1", () => server.close(error => error ? reject(error) : resolve()));
  });
  anvilProcess = useWsl
    ? spawn("wsl.exe", ["-d", "Ubuntu", "--exec", "bash", "-c",
      'echo $$; exec ~/.foundry/bin/anvil "$@"', "anvil", ...args], { windowsHide: true })
    : spawn("anvil", args);
  anvilClosed = new Promise(resolve => anvilProcess!.once("close", () => resolve()));
  if (useWsl) {
    let output = "";
    anvilProcess.stdout!.on("data", chunk => {
      output += String(chunk);
      anvilPid = /^([0-9]+)\r?\n/.exec(output)?.[1];
    });
  }
  let stderr = "";
  anvilProcess.stderr!.on("data", chunk => { stderr += String(chunk); });
  let startupError: Error | undefined;
  anvilProcess.on("error", error => { startupError = error; });
  const deadline = Date.now() + 30000;
  let ready = false;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (anvilProcess.exitCode !== null || anvilProcess.signalCode !== null) {
      await anvilClosed;
      throw new Error(`Anvil exited during startup (${anvilProcess.signalCode ?? anvilProcess.exitCode}): ${stderr.trim()}`);
    }
    try {
      const chainId = await rpc("eth_chainId", []);
      if (chainId !== "0xa869") throw new Error(`Unexpected eth_chainId: ${chainId}`);
      if (!useWsl || anvilPid) { ready = true; break; }
      lastError = new Error("Waiting for Anvil PID from wsl.exe");
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Anvil readiness timed out at " + endpoint, { cause: lastError });
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
  if (!anvilProcess) return;
  try {
    if (useWsl && anvilPid && anvilProcess.exitCode === null && anvilProcess.signalCode === null) {
      await promisify(execFile)("wsl.exe", ["-d", "Ubuntu", "--exec", "kill", "-TERM", anvilPid], { windowsHide: true });
    }
  } finally {
    if (anvilProcess.pid && anvilProcess.exitCode === null && anvilProcess.signalCode === null) anvilProcess.kill();
    await anvilClosed;
  }
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

it("publishes an analyzer snapshot and verifies the body against its retrieved commitment", async () => {
  const vector = await readFile("fixtures/canonical-report-v1.json", "utf8");
  const vectorHash = "0x9c8945f6c116ecd46025d73b24a000490919db79635485ef2c3da9e1bbcba5cd";
  expect(keccak256(toHex(vector))).toBe(vectorHash);
  expect(verifyCommitment(vector, vectorHash).status).toBe("commitment-matches");

  const report = buildReport(await collectEvidence(createHttpTransport(endpoint), { address: target }));
  if (report.status !== "complete") throw new Error(report.reason);
  const { body } = report;
  const publication = {
    target: body.address, score: body.signalScore, codehash: body.codehash,
    implementation: body.proxy.implementation ?? zeroAddress, reportHash: report.reportHash,
    rulesetVersion: body.rulesetVersion, blockNumber: BigInt(body.blockNumber), blockHash: body.blockHash,
  };

  const artifact = JSON.parse(await readFile("packages/contracts/out/RiskRegistry.sol/RiskRegistry.json", "utf8"));
  const owner = toHex(7500, { size: 20 });
  const attester = toHex(7501, { size: 20 });
  for (const account of [owner, attester]) {
    await rpc("anvil_impersonateAccount", [account]);
    await rpc("anvil_setBalance", [account, toHex(10n ** 18n)]);
  }
  async function send(from: Hex, data: Hex, to?: Hex) {
    const hash = await rpc("eth_sendTransaction", [{ from, to, data, gas: toHex(4_000_000) }]);
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    expect(receipt.status).toBe("0x1");
    return receipt;
  }
  const deployment = await send(owner, encodeDeployData({
    abi: artifact.abi, bytecode: artifact.bytecode.object, args: [owner],
  }));
  const registry = deployment.contractAddress as Hex;
  const call = (functionName: string, args: unknown[]) => encodeFunctionData({ abi: artifact.abi, functionName, args });
  await send(owner, call("setAttester", [attester, true]), registry);
  await send(attester, call("publish", [publication]), registry);
  async function read(functionName: string, args: unknown[]) {
    const data = await rpc("eth_call", [{ to: registry, data: call(functionName, args) }, "latest"]);
    return decodeFunctionResult({ abi: artifact.abi, functionName, data });
  }
  const hash = await read("reportHashAt", [target, 0n]);
  if (typeof hash !== "string") throw new Error("Expected a report hash from the registry");
  expect(hash).toBe(report.reportHash);
  const stored = await read("getReport", [hash]);
  expect(stored).toEqual(await read("latestReport", [target]));
  expect(stored).toMatchObject({ report: publication, attester: expect.stringMatching(new RegExp(attester, "i")) });
  expect(verifyCommitment(canonicalReportJson(body), hash).status).toBe("commitment-matches");
  expect(verifyCommitment(vector, hash).status).toBe("commitment-mismatch");
  expect(verifyCommitment(null, hash)).toEqual({ status: "report-body-unavailable", body: null });
}, 45000);
