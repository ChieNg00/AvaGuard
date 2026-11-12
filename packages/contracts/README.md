# Local contracts

Install the root workspace with `pnpm install --frozen-lockfile`. In this directory run `forge fmt --check`, `forge build --build-info` and `forge test -vv`. Run `pnpm test:integration` from the workspace root after the build. Foundry uses Solidity 0.8.30, Cancun, optimizer 200, and the workspace-pinned OpenZeppelin Contracts 5.4.0.

## Publication

Deploy locally with an explicit initial owner. Ownership changes use OpenZeppelin Ownable2Step. Only the owner can call `setAttester(address,bool)`. The `attesters(address)` getter exposes the allowlist. Owner and pending owner each need a separate allowlist entry to publish.

An authorized caller submits one tuple to `publish(Publication)`. In ABI order the fields are:

| Field | Solidity type | Source |
| --- | --- | --- |
| target | address | Canonical body address |
| score | uint8 | Complete report signalScore |
| codehash | bytes32 | Target runtime hash at the snapshot |
| implementation | address | Body proxy implementation, zero for null |
| reportHash | bytes32 | M3 Keccak-256 of canonical UTF-8 JSON |
| rulesetVersion | uint32 | Body rulesetVersion |
| blockNumber | uint64 | Body blockNumber, parsed as an integer |
| blockHash | bytes32 | Body blockHash |

At execution the registry checks caller membership, score at most 100, deployed target code, equality with the live target codehash, snapshot number at most the current block, and global reportHash uniqueness. The registry records msg.sender and block.timestamp. ReportPublished indexes target, reportHash and attester and emits all remaining fields.

The attester vouches for the summary fields and their agreement with the body. The snapshot hash, implementation, findings and score remain attested. Chain ID and complete proxy/evidence data are bound in the body digest. Select the registry on the intended chain. Historical verification uses the analyzer and the original snapshot.

## Retrieval

Use `reportCount(target)` and zero-based `reportHashAt(target,index)` to enumerate hashes in publication order. `getReport(hash)` and `latestReport(target)` return the full commitment. An unknown hash or an empty latest lookup reverts with UnknownReport. An out-of-range index reverts.

A hash may be published once per registry, across all targets and publishers. Every accepted report remains retrievable. Latest uses the greatest attested snapshot block for that target. Among reports at the same height the last accepted publication wins. An older snapshot published later appends to history and preserves the latest pointer.

`isCodeStale(hash)` compares the recorded and live target runtime hashes. Changes in proxy implementation, owner or other storage require a separate current-state scan. Lookup obtains JSON separately. With no imported or available body, `verifyCommitment(null, hash)` returns `report-body-unavailable`. With a body it checks canonical hash equality. Independent replay remains a separate M3 operation.
