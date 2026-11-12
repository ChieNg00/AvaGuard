"use server";
import {
  addressSchema,
  buildReport,
  collectEvidence,
  createHttpTransport,
  decimalSchema,
  hashSchema,
  replayReport,
  parseReportBody,
} from "@avaguard/analyzer";
import { createPublicClient, getAddress, http, keccak256 } from "viem";
import { registryAbi as abi, registryRuntimeHash } from "../lib/registry-abi";

class DisplayError extends Error {}
async function safely<T>(action: () => Promise<T>) {
  try {
    return { ok: true, data: await action() } as const;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof DisplayError
          ? e.message
          : "Read unavailable. Check the configured RPC and registry.",
    } as const;
  }
}
function endpoint() {
  const value = process.env.FUJI_RPC_URL;
  if (!value) throw new DisplayError("Read RPC is unconfigured.");
  return new URL(value);
}
function address(value: string) {
  const result = addressSchema.safeParse(value.toLowerCase());
  if (!result.success)
    throw new DisplayError(
      "Enter a 0x-prefixed address with 40 hexadecimal characters.",
    );
  return getAddress(result.data);
}
async function registry() {
  if (!process.env.REGISTRY_ADDRESS)
    throw new DisplayError("Registry is unconfigured.");
  const target = address(process.env.REGISTRY_ADDRESS);
  const client = createPublicClient({
    transport: http(endpoint().href, {
      timeout: 5000,
      retryCount: 0,
      fetchOptions: { cache: "no-store", redirect: "error" },
    }),
  });
  if ((await client.getChainId()) !== 43113)
    throw new DisplayError("Reader is on the wrong network.");
  return { client, config: { address: target, abi } };
}
export async function scan(target: string) {
  return safely(async () => {
    const result = buildReport(
      await collectEvidence(createHttpTransport(endpoint().href), {
        address: address(target).toLowerCase(),
      }),
    );
    if (result.status === "complete")
      return {
        status: result.status,
        band: result.band,
        body: result.body,
      } as const;
    return result;
  });
}
export async function replay(input: unknown, hash: string) {
  return safely(async () =>
    replayReport(
      createHttpTransport(endpoint().href),
      parseReportBody(input),
      hashSchema.parse(hash),
    ),
  );
}
export async function walletContext(block: string, hash: string) {
  return safely(async () => {
    const url = endpoint();
    if (
      process.env.AVAGUARD_ENV !== "local" ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1"
    )
      throw new DisplayError(
        "Publication requires a configured loopback Anvil environment.",
      );
    const { client, config } = await registry();
    const [snapshot, code, version] = await Promise.all([
      client.getBlock({ blockNumber: BigInt(decimalSchema.parse(block)) }),
      client.getCode({ address: config.address }),
      client.request({ method: "web3_clientVersion" }),
    ]);
    if (
      !/anvil/i.test(version) ||
      !code ||
      keccak256(code) !== registryRuntimeHash ||
      snapshot.hash !== hashSchema.parse(hash)
    )
      throw new DisplayError("Reader registry or snapshot mismatch.");
    return { address: config.address, codehash: keccak256(code) };
  });
}
export async function lookup(value: string, index?: string) {
  return safely(async () => {
    const target = address(value);
    const { client, config } = await registry();
    const blockNumber = await client.getBlockNumber();
    const read = { ...config, blockNumber };
    const count = await client.readContract({
      ...read,
      functionName: "reportCount",
      args: [target],
    });
    if (count === 0n) return null;
    const i =
      index === undefined ? undefined : BigInt(decimalSchema.parse(index));
    if (i !== undefined && i >= count)
      throw new DisplayError("History index is outside the publication range.");
    const item =
      i === undefined
        ? await client.readContract({
            ...read,
            functionName: "latestReport",
            args: [target],
          })
        : await client.readContract({
            ...read,
            functionName: "getReport",
            args: [
              await client.readContract({
                ...read,
                functionName: "reportHashAt",
                args: [target, i],
              }),
            ],
          });
    const stale = await client.readContract({
      ...read,
      functionName: "isCodeStale",
      args: [item.report.reportHash],
    });
    return {
      report: {
        ...item.report,
        blockNumber: item.report.blockNumber.toString(),
      },
      attester: item.attester,
      publishedAt: item.publishedAt.toString(),
      count: count.toString(),
      stale,
    };
  });
}
