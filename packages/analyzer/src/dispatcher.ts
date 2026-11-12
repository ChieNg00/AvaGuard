import { toFunctionSelector, type Hex } from "viem";

export const dispatcherRules = [
  { id: "R-MINT", weight: 25, severity: "high", signatures: ["mint(address,uint256)", "mint(uint256)"] },
  { id: "R-BLACKLIST", weight: 20, severity: "high", signatures: ["blacklist(address)", "addToBlacklist(address)", "setBlacklist(address,bool)"] },
  { id: "R-FEE", weight: 15, severity: "medium", signatures: ["setFee(uint256)", "setTax(uint256)", "setTaxFee(uint256)", "setBuyFee(uint256)", "setSellFee(uint256)"] },
  { id: "R-PAUSE", weight: 10, severity: "medium", signatures: ["pause()"] },
] as const;
const signatures = new Map<string, string>(dispatcherRules.flatMap(rule =>
  rule.signatures.map(signature => [toFunctionSelector(signature), signature] as const)));

export function disassemble(code: Hex) {
  const instructions = [];
  for (let index = 2; index < code.length;) {
    const opcode = parseInt(code.slice(index, index + 2), 16);
    const size = opcode >= 0x60 && opcode <= 0x7f ? opcode - 0x5f : 0;
    const payload = code.slice(index + 2, index + 2 + size * 2);
    instructions.push({ offset: (index - 2) / 2, opcode, payload, truncated: payload.length !== size * 2 });
    index += 2 + size * 2;
  }
  return instructions;
}

// Only Cancun instructions that can fall through within a linear basic block.
// Undefined instructions halt exceptionally. JUMPDEST begins a new block.
function fallsThrough(op: number) {
  return (op >= 1 && op <= 0x0b) || (op >= 0x10 && op <= 0x1d) || op === 0x20 ||
    (op >= 0x30 && op <= 0x4a) || (op >= 0x50 && op <= 0x55) || (op >= 0x58 && op <= 0x5a) ||
    (op >= 0x5c && op <= 0xa4) || [0xf0, 0xf1, 0xf2, 0xf4, 0xf5, 0xfa].includes(op);
}

export function inspectRuntime(code: Hex) {
  const instructions = disassemble(code);
  const matches = new Map<string, { offset: string; eqOffset: string; selector: string }>();
  for (const [i, push] of instructions.entries()) {
    if (push.opcode !== 0x63 || push.truncated) continue;
    const selector = "0x" + push.payload;
    const signature = signatures.get(selector);
    if (!signature || matches.has(signature)) continue;
    for (const next of instructions.slice(i + 1, i + 3)) {
      if (!fallsThrough(next.opcode)) break;
      if (next.opcode === 0x14) {
        matches.set(signature, { offset: String(push.offset), eqOffset: String(next.offset), selector });
        break;
      }
    }
  }
  return { matches, delegatecall: instructions.find(i => i.opcode === 0xf4),
    truncated: instructions.find(i => i.truncated) };
}
