# M2 evidence collection

Implemented 2026-11-12. SCANNER_SPEC.md remains normative; M3 rule interpretation and report hashing are not implemented.

## Public API and boundaries

The analyzer exports collectEvidence(transport, { address, historical? }) and createHttpTransport(configuredUrl). Input addresses are canonical lowercase hex. historical requires the original decimal block number and lowercase block hash. Invalid caller input fails validation before IO. No network/provider URL is accepted by the browser form; no server route was added in M2.

CollectionResult uses stage=evidence-collection, publishable=false, null signalScore/band, and status collected/inconclusive/not-analyzable. collected means the bounded read workflow finished, not that ERC-20 compliance, safety, scoring or publication eligibility was established. No findings are generated. Execution reverts/malformed read returns can be collected observations, to be interpreted in M3. Unavailable required workflow reads make the entire result inconclusive; partial evidence remains diagnostic only.

Before a valid snapshot exists, snapshot is null. chainId is null until actually read, and records an observed wrong chain without fabricating Fuji. An initial historical header/hash mismatch does not establish the requested snapshot. All established evidence has a single observed Fuji chain ID, block number/hash and stable ID. Schema validation rejects mixed snapshots, duplicate/dangling evidence references and pre-snapshot state observations.

## Probe configuration v1

- Expected chain ID: 43113.
- eth_call sender: zero address, never a connected wallet.
- eth_call gas: 3000000; value: 0; no fee fields or state overrides.
- At most 3 attempts for transport/rate-limit failures, with 100ms/200ms delays. Other errors are not retried as if transient.
- Each request is bounded to 5 seconds, the overall collection deadline is 30 seconds, and HTTP responses to 262144 bytes. Code/evidence hex is bounded to 65536 bytes; ABI returns to 4096 bytes and decoded metadata to 256 characters.
- Probe set: totalSupply(), balanceOf(address(0)), owner(), name(), symbol(), decimals(). owner code is read if a valid nonzero owner is observed. These two required ERC-20 read probes do not prove full compliance.
- Probes/selectors use viem ABI encoding. Returned ABI must round-trip canonically; malformed, oversized and noncanonical data remain distinct from an execution revert.
- Error diagnostics retain a typed kind and optional numeric RPC code, not provider URLs, arbitrary error messages or credentials. HTTP accepts read-only methods and validates JSON-RPC version, response ID and result/error exclusivity.

New scans select one latest header, then use its explicit B for every code/storage/call request and final header recheck. Historical requests use the supplied B from the start; there is no latest fallback or cache-based assumption. Recheck header number/hash and network before returning collected or not-analyzable.

Confidence belongs to each finding/evidence, not to the result as an aggregate requirement. Slot reads use slot-read, ABI calls use call-result. Raw code reads have null inference confidence and an exact codehash; exact ERC-1167 parser derivations have bytecode-pattern confidence with a validated source-evidence link; dispatcher/bytecode-pattern inference is not claimed for a plain code read.

## Proxy dependency collection

Read computed ERC-1967 implementation slot first; if empty, read the beacon slot and a beacon implementation() call. For either supported path, collect dependency code and keccak256 hashes at B. When standard slots do not resolve, recognize only the exact standard ERC-1167 runtime. All ERC-20/owner state probes still target the original target address.

Resolution follows at most one hop. Detect self/beacon loops, empty dependencies, invalid padded-address slots, and supported nested layouts (implementation's standard slots/exact clone runtime), marking unsupported coverage instead of successful resolution. Custom bytecode/control flow is not analyzed; empty slots never establish absence of a proxy. ERC-1167 coverage is parser-only, not a claim of clone integration. No R-PROXY or other finding/score is emitted.

Always declare limits for source verification, privileged access, tokenomics, custom dispatch, unsupported proxies, clone integration and unimplemented rules. checked means an attempted read completed as specified, including confirmed execution failure, not passed.

## Reproducible checks

From the repository root on Windows:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/LENOVO/Documents/Codex/AvaGuard/packages/contracts && ~/.foundry/bin/forge fmt --check && ~/.foundry/bin/forge build --build-info && ~/.foundry/bin/forge test -vv'
```

pnpm test runs unit/mock tests; integration is a separate mandatory command for M2 acceptance, not silently skipped. The integration runner expects Windows, Ubuntu WSL2, Foundry at ~/.foundry/bin and a compiled ReadProbeFixture artifact. Port 18545 must be free. It starts its own loopback Anvil with --accounts 0 --silent --chain-id 43113 --hardfork cancun and terminates its captured process ID in teardown.

Integration does not deploy, create a wallet, sign or send a transaction. It loads the existing compiled fixture runtime via anvil_setCode, patches the compiler-recorded immutable totalSupply offsets, and initializes its holder mapping using local dev-only anvil_setStorageAt before mining a local block. It asserts an empty account list, code/storage/probe results at B, optional-method reverts, exact replay and no-code handling. It does not test constructor execution (existing Forge tests do) or clone/proxy integration. No new Solidity fixture was needed.

## Remaining work

No dispatcher analysis, M3 findings/signal calculation, canonical reportHash, importer, registry, AI or deployment. The old M1 scored envelope remains only a non-publication skeleton for regression; collection results are a separate type. The Scan/Lookup UI remains local input validation and explicitly unavailable for full scan, lookup, replay or publication. M2 is a backend library, not an end-to-end scanner.

No live Fuji probe or archive guarantee was added. A provider can still return internally consistent false data; header checks are consistency checks, not a trustless proof. Historical state is checked on every collection request.

Sources consulted: [viem encodeFunctionData](https://viem.sh/docs/contract/encodeFunctionData), [Anvil CLI reference](https://www.getfoundry.sh/reference/anvil/anvil), and official npm registry metadata for viem 2.57.18. Some direct viem decode/keccak documentation requests returned unsupported Markdown content-type; actual typecheck, ABI tests and local integration validate the used APIs. Existing Avalanche/compiler guidance and golden scores were preserved.
