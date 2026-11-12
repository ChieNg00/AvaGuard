import { getAddress, zeroAddress, type Hex } from "viem";
import { reportHash, type ReportBody } from "@avaguard/analyzer";

export function publication(body: ReportBody) {
  return {
    target: getAddress(body.address),
    score: body.signalScore,
    codehash: body.codehash as Hex,
    implementation: getAddress(body.proxy.implementation ?? zeroAddress),
    reportHash: reportHash(body),
    rulesetVersion: body.rulesetVersion,
    blockNumber: BigInt(body.blockNumber),
    blockHash: body.blockHash as Hex,
  };
}
type Tuple = ReturnType<typeof publication>;
export type Summary = Omit<Tuple, "blockNumber" | "rulesetVersion"> & {
  blockNumber: string;
  rulesetVersion: number;
};
export function agrees(body: ReportBody, summary: Summary) {
  return Object.entries(publication(body)).every(
    ([key, value]) =>
      String(value).toLowerCase() ===
      String(summary[key as keyof Summary]).toLowerCase(),
  );
}
export function differences(before: ReportBody, after: ReportBody) {
  function fields(body: ReportBody) {
    const entries: [string, unknown][] = [
      ["Score", body.signalScore],
      ["Target runtime", body.codehash],
      ["Proxy", body.proxy],
    ];
    for (const finding of body.findings)
      entries.push(["Finding " + finding.id, finding]);
    for (const item of body.evidence) {
      const { snapshot, ...observation } = item;
      void snapshot;
      entries.push(["Evidence " + item.id, observation]);
    }
    for (const [group, items] of Object.entries(body.coverage))
      for (const item of items)
        entries.push(["Coverage " + item.id, [group, item.reason]]);
    return new Map(entries);
  }
  const a = fields(before),
    b = fields(after);
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .flatMap((key) =>
      JSON.stringify(a.get(key)) === JSON.stringify(b.get(key))
        ? []
        : [
            {
              field: key,
              before: a.get(key) ?? null,
              after: b.get(key) ?? null,
            },
          ],
    );
}
