import { decodeFunctionResult, encodeFunctionData, encodeFunctionResult, keccak256, parseAbi, stringToHex, toHex, type Hex } from "viem";
export const PROBE_CONFIGURATION = Object.freeze({
  version: 1, caller: "0x0000000000000000000000000000000000000000" as const,
  gas: "3000000" as const, value: "0" as const, attempts: 3, requestTimeoutMs: 5000, deadlineMs: 30000,
});
export const ZERO = PROBE_CONFIGURATION.caller;
export const IMPLEMENTATION_SLOT = toHex(BigInt(keccak256(stringToHex("eip1967.proxy.implementation"))) - 1n, { size: 32 });
export const BEACON_SLOT = toHex(BigInt(keccak256(stringToHex("eip1967.proxy.beacon"))) - 1n, { size: 32 });
export const probeAbi = parseAbi([
  "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)", "function name() view returns (string)",
  "function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function implementation() view returns (address)",
]);
export type Probe = "totalSupply" | "balanceOf" | "owner" | "name" | "symbol" | "decimals" | "implementation";
export function probeData(name: Probe): Hex {
  return name === "balanceOf" ? encodeFunctionData({ abi: probeAbi, functionName: name, args: [ZERO] })
    : encodeFunctionData({ abi: probeAbi, functionName: name });
}
export function decodeProbe(name: Probe, raw: Hex): string {
  if (raw.length > 8194) throw new Error("Oversized ABI return");
  const value = decodeFunctionResult({ abi: probeAbi, functionName: name, data: raw });
  // Require canonical ABI encoding: reject trailing bytes, invalid address padding, offsets, etc.
  if (encodeFunctionResult({ abi: probeAbi, functionName: name, result: value }).toLowerCase() !== raw) throw new Error("Noncanonical ABI");
  const text = String(value).toLowerCase();
  if (String(value).length > 256) throw new Error("Oversized metadata");
  return name === "owner" || name === "implementation" ? text : String(value);
}
export function slotAddress(raw: Hex): Hex | null {
  if (!/^0x0{24}[0-9a-f]{40}$/.test(raw)) throw new Error("Invalid address slot");
  const address = ("0x" + raw.slice(-40)) as Hex;
  return address === ZERO ? null : address;
}
// Exact standard runtime only. No variant/vanity/nested clone claims.
export function minimalImplementation(code: Hex): Hex | null {
  const match = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/.exec(code);
  return match ? ("0x" + match[1]) as Hex : null;
}
