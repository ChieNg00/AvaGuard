# Fuji historical state probe

Observed 2026-11-06, Vietnam time. This is a read-only infrastructure check, not execution of the application implementation milestones.

Endpoint: https://api.avax-test.network/ext/bc/C/rpc

Target: Fuji WAVAX 0xd00ae08403B9bbb9124bB305C09058E32C39A48c, listed by Ava Labs at https://github.com/ava-labs/wrapped-assets. No wallet, credentials, transaction, contract deployment or AI API was used.

The first restricted-environment attempt failed DNS resolution. A permitted external-network retry succeeded. Do not interpret the initial environment error as a chain/RPC execution revert.

## Observed results

Chain ID returned 43113. Latest anchor for the probe was block 60,627,346. Code, totalSupply eth_call, storage slot zero and block header recheck succeeded at all four sampled snapshots:

| Snapshot | Block | Code bytes | totalSupply result | Header consistent |
| --- | --- | --- | --- | --- |
| Anchor | 60,627,346 | 3249 | 32-byte uint256 | Yes |
| Anchor minus 10,000 | 60,617,346 | 3249 | 32-byte uint256 | Yes |
| Anchor minus 1,000,000 | 59,627,346 | 3249 | Different historical uint256 | Yes |
| Older explicit block | 10,000,000 | 3249 | Different historical uint256 | Yes |

Raw observed response values and snapshot hashes are saved in checks/fuji-history-2026-11-06.json. Code is summarized by byte length and SHA-256 of the returned hex TEXT for this probe only; this is not the application's keccak256 bytecode hash.

## Conclusion and limits

Sampled historical reads worked, including nonempty contract code and changing historical totalSupply, not just empty-account responses or block headers. This supports keeping Verify report as a capability-gated action without immediately purchasing another RPC service.

It does NOT establish archive-service retention, availability for every account/slot/block, response correctness, throughput, future availability, or complete proxy replay support. Check the actual report target/block on every replay. Missing historical state, unsupported methods or ambiguous provider failure must show replay unavailable/inconclusive. Never silently fall back to latest. A separate archive provider remains optional if actual required snapshots fail.

## Reproduction

Run scripts/probe_fuji_history.py with Python 3 and --output pointing to a NEW result filename. The script uses only the standard library and the fixed public Fuji endpoint. It performs eth_chainId, eth_getBlockByNumber, eth_getCode, eth_getStorageAt and read-only eth_call. Do not overwrite this historical evidence file when probing on another date. A successful process exit is not itself proof that samples worked: inspect each saved result/error.
