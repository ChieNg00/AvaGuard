"""Read-only, keyless Fuji historical-state probe. No transactions or installations."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

RPC = "https://api.avax-test.network/ext/bc/C/rpc"
TARGET = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"


def batch(items):
    request = urllib.request.Request(
        RPC, data=json.dumps(items).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "AvaGuard-readonly-probe/1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.load(response)
        if not isinstance(result, list):
            return None, {"kind": "invalid_batch_response", "response": result}
        return {item["id"]: item for item in result}, None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        return None, {"kind": "transport_or_protocol_error", "message": str(exc)}


def call_item(identifier, method, params):
    return {"jsonrpc": "2.0", "id": identifier, "method": method, "params": params}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--review-date", default="2026-11-06", help="Vietnam review date; set explicitly for later probes")
    args = parser.parse_args()
    report = {"reviewDateVietnam": args.review_date, "rpc": RPC, "target": TARGET,
              "targetSource": "https://github.com/ava-labs/wrapped-assets",
              "purpose": "sampled historical state availability, not an archive service guarantee"}
    initial, error = batch([call_item(1, "eth_chainId", []),
                            call_item(2, "eth_getBlockByNumber", ["latest", False])])
    if error:
        report["status"] = "inconclusive"
        report["error"] = error
    elif initial.get(1, {}).get("result") != hex(43113) or not initial.get(2, {}).get("result"):
        report["status"] = "inconclusive"
        report["initialResponses"] = initial
    else:
        latest = initial[2]["result"]
        number = int(latest["number"], 16)
        report["chainId"] = 43113
        report["anchor"] = {k: latest[k] for k in ["number", "hash", "timestamp"]}
        report["samples"] = []
        for label, block in [("anchor", number), ("minus_10000", max(0, number-10000)),
                             ("minus_1000000", max(0, number-1000000)),
                             ("block_10000000", 10000000)]:
            tag = hex(block)
            responses, error = batch([
                call_item(1, "eth_getBlockByNumber", [tag, False]),
                call_item(2, "eth_getCode", [TARGET, tag]),
                call_item(3, "eth_call", [{"to": TARGET, "data": "0x18160ddd"}, tag]),
                call_item(4, "eth_getStorageAt", [TARGET, "0x0", tag]),
            ])
            sample = {"label": label, "blockNumber": block, "blockTag": tag}
            if error:
                sample["error"] = error
            else:
                for identifier, method in [(1, "block"), (2, "eth_getCode"),
                                           (3, "eth_call_totalSupply"), (4, "eth_getStorageAt_slot0")]:
                    response = responses.get(identifier, {"error": {"message": "missing response"}})
                    if "error" in response:
                        sample[method] = {"error": response["error"]}
                    elif method == "block":
                        b = response.get("result")
                        sample[method] = {k: b[k] for k in ["number", "hash", "timestamp"]} if b else None
                    elif method == "eth_getCode":
                        code = response.get("result", "")
                        sample[method] = {"byteLength": max(0, (len(code)-2)//2),
                                          "sha256OfHexText": hashlib.sha256(code.encode()).hexdigest()}
                    else:
                        sample[method] = {"result": response.get("result")}
                recheck, recheck_error = batch([call_item(1, "eth_getBlockByNumber", [tag, False])])
                sample["headerRecheck"] = recheck_error or {
                    "hashMatches": bool(sample.get("block") and recheck.get(1, {}).get("result")
                                        and sample["block"]["hash"] == recheck[1]["result"]["hash"])}
            report["samples"].append(sample)
        report["status"] = "probe_completed_review_samples"
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
