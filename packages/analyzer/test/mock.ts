import { encodeFunctionResult, toHex, type Hex } from "viem";
import { probeAbi, probeData, type ReadMethod, type ReadTransport } from "../src/index";

export const TARGET = ("0x" + "1".repeat(40)) as Hex;
export const IMPL = ("0x" + "2".repeat(40)) as Hex;
export const BEACON = ("0x" + "3".repeat(40)) as Hex;
export const OWNER = ("0x" + "4".repeat(40)) as Hex;
export const HASH = ("0x" + "a".repeat(64)) as Hex;
export const ZERO_WORD = toHex(0n, { size: 32 });
type Handler = (method: ReadMethod, params: readonly unknown[]) => unknown;
export function mock(override?: Handler) {
  const calls: { method: ReadMethod; params: readonly unknown[] }[] = [];
  const transport: ReadTransport = { async request(method, params) {
    calls.push({ method, params });
    const changed = override?.(method, params);
    if (changed !== undefined) return changed;
    if (method === "eth_chainId") return "0xa869";
    if (method === "eth_getBlockByNumber") return { number: "0x20", hash: HASH };
    if (method === "eth_getCode") return params[0] === OWNER ? "0x" : "0x6000";
    if (method === "eth_getStorageAt") return ZERO_WORD;
    const call = params[0] as { data: Hex };
    const name = (["totalSupply", "balanceOf", "owner", "name", "symbol", "decimals", "implementation"] as const).find(n => probeData(n) === call.data)!;
    const result = name === "owner" ? OWNER : name === "implementation" ? IMPL : name === "name" ? "Mock" : name === "symbol" ? "MOCK" : name === "decimals" ? 18 : 1000n;
    return encodeFunctionResult({ abi: probeAbi, functionName: name, result });
  } };
  return { calls, transport };
}
