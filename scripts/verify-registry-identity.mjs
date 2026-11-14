import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const requireFromWeb = createRequire(
  resolve(import.meta.dirname, "../apps/web/package.json"),
);
const { createPublicClient, getAddress, http, keccak256 } =
  requireFromWeb("viem");

const EXPECTED_COMPILER_PREFIX = "0.8.30+";
const EXPECTED_EVM = "cancun";
const EXPECTED_OPTIMIZER = { enabled: true, runs: 200 };

function parseRegistryTs(sourceText) {
  const abiMatch = sourceText.match(
    /export const registryAbi = (\[[\s\S]*?\]) as const;/,
  );
  if (!abiMatch) {
    throw new Error("Could not locate registryAbi in apps/web/lib/registry-abi.ts");
  }
  const hashMatch = sourceText.match(
    /export const registryRuntimeHash =\s*"(0x[0-9a-fA-F]{64})" as const;/,
  );
  if (!hashMatch) {
    throw new Error(
      "Could not locate registryRuntimeHash in apps/web/lib/registry-abi.ts",
    );
  }
  const abi = runInNewContext(`(${abiMatch[1]})`, Object.create(null));
  const runtimeHash = hashMatch[1].toLowerCase();
  return { abi, runtimeHash };
}

function normalizeAbi(abi) {
  return JSON.stringify(abi);
}

export async function verifyLocalRegistryArtifact(rootDir = process.cwd()) {
  const artifactPath = resolve(
    rootDir,
    "packages/contracts/out/RiskRegistry.sol/RiskRegistry.json",
  );
  const tsPath = resolve(rootDir, "apps/web/lib/registry-abi.ts");

  const [artifactRaw, tsRaw] = await Promise.all([
    readFile(artifactPath, "utf8"),
    readFile(tsPath, "utf8"),
  ]);

  const artifact = JSON.parse(artifactRaw);
  const { abi: tsAbi, runtimeHash: tsRuntimeHash } = parseRegistryTs(tsRaw);

  const compilerVersion = String(artifact?.metadata?.compiler?.version ?? "");
  const evmVersion = String(artifact?.metadata?.settings?.evmVersion ?? "");
  const optimizer = artifact?.metadata?.settings?.optimizer;

  if (!compilerVersion.startsWith(EXPECTED_COMPILER_PREFIX)) {
    throw new Error(
      `Unexpected RiskRegistry compiler version "${compilerVersion}"; expected prefix "${EXPECTED_COMPILER_PREFIX}".`,
    );
  }
  if (evmVersion !== EXPECTED_EVM) {
    throw new Error(
      `Unexpected RiskRegistry EVM version "${evmVersion}"; expected "${EXPECTED_EVM}".`,
    );
  }
  if (
    optimizer?.enabled !== EXPECTED_OPTIMIZER.enabled ||
    optimizer?.runs !== EXPECTED_OPTIMIZER.runs
  ) {
    throw new Error(
      `Unexpected RiskRegistry optimizer settings: ${JSON.stringify(optimizer)}.`,
    );
  }

  const deployedObject = artifact?.deployedBytecode?.object;
  if (typeof deployedObject !== "string" || !deployedObject.startsWith("0x")) {
    throw new Error("RiskRegistry artifact is missing deployedBytecode.object.");
  }

  const artifactRuntimeHash = keccak256(deployedObject).toLowerCase();
  if (artifactRuntimeHash !== tsRuntimeHash) {
    throw new Error(
      `RiskRegistry runtime hash mismatch: artifact=${artifactRuntimeHash}, apps/web/lib/registry-abi.ts=${tsRuntimeHash}.`,
    );
  }

  if (normalizeAbi(artifact.abi) !== normalizeAbi(tsAbi)) {
    throw new Error(
      "RiskRegistry ABI mismatch between Forge artifact and apps/web/lib/registry-abi.ts.",
    );
  }

  return {
    compilerVersion,
    evmVersion,
    optimizer,
    runtimeHash: artifactRuntimeHash,
    abiEntries: artifact.abi.length,
  };
}

export async function verifyOnChainRegistry(
  rpcUrl,
  registryAddress,
  expectedRuntimeHash,
) {
  const client = createPublicClient({
    transport: http(rpcUrl, {
      timeout: 5000,
      retryCount: 0,
      fetchOptions: { cache: "no-store", redirect: "error" },
    }),
  });
  const address = getAddress(registryAddress);
  const [chainId, code] = await Promise.all([
    client.getChainId(),
    client.getCode({ address }),
  ]);
  if (chainId !== 43113) {
    throw new Error(`Expected chain ID 43113, got ${chainId}.`);
  }
  if (!code || code === "0x") {
    throw new Error(`No bytecode deployed at ${address}.`);
  }
  const onChainHash = keccak256(code).toLowerCase();
  if (onChainHash !== expectedRuntimeHash.toLowerCase()) {
    throw new Error(
      `On-chain runtime hash ${onChainHash} does not match pinned RiskRegistry ${expectedRuntimeHash}.`,
    );
  }
  return { chainId, address, onChainHash };
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--rpc-url" || key === "--registry") {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${key}`);
      args[key.slice(2)] = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
  const opts = parseCliArgs(process.argv.slice(2));
  const local = await verifyLocalRegistryArtifact();
  console.log(
    `Local RiskRegistry artifact verified: solc=${local.compilerVersion}, evm=${local.evmVersion}, optimizer=${JSON.stringify(local.optimizer)}, abiEntries=${local.abiEntries}, runtimeHash=${local.runtimeHash}`,
  );
  if (opts["rpc-url"] || opts.registry) {
    if (!opts["rpc-url"] || !opts.registry) {
      throw new Error("Pass both --rpc-url and --registry for on-chain checks.");
    }
    const chain = await verifyOnChainRegistry(
      opts["rpc-url"],
      opts.registry,
      local.runtimeHash,
    );
    console.log(
      `On-chain RiskRegistry verified: chainId=${chain.chainId}, address=${chain.address}, runtimeHash=${chain.onChainHash}`,
    );
  }
}
