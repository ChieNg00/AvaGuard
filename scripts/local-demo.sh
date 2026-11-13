#!/usr/bin/env bash
# Run from the repository root in Linux or Ubuntu WSL.
set -euo pipefail
attester=${1:?Pass the public disposable browser attester address}
owner=${2:?Pass the public deployer address}
keystore=${3:?Pass the local encrypted Foundry keystore file path}
[[ $attester =~ ^0x[[:xdigit:]]{40}$ && $owner =~ ^0x[[:xdigit:]]{40}$ ]]
[[ ${owner,,} != ${attester,,} && -f $keystore ]]
keystore=$(realpath "$keystore")
rpc=http://127.0.0.1:8545
[[ $(cast chain-id --rpc-url "$rpc") == 43113 ]]
[[ $(cast rpc --rpc-url "$rpc" web3_clientVersion) == *anvil* ]]
cd packages/contracts
forge build --build-info
for account in "$owner" "$attester"; do
  cast rpc --rpc-url "$rpc" anvil_setBalance "$account" 0xde0b6b3a7640000 >/dev/null
done
deploy() {
  forge create --broadcast --rpc-url "$rpc" --keystore "$keystore" --from "$owner" --json "$@" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["deployedTo"])'
}
registry=$(deploy src/RiskRegistry.sol:RiskRegistry --constructor-args "$owner")
fixture=$(deploy src/GoldenFixtures.sol:MintableToken)
cast rpc --rpc-url "$rpc" anvil_setStorageAt "$fixture" "$(cast to-uint256 0)" "$(cast to-uint256 "$owner")" >/dev/null
cast send --rpc-url "$rpc" --keystore "$keystore" --from "$owner" "$registry" 'setAttester(address,bool)' "$attester" true >/dev/null
cast call --rpc-url "$rpc" "$registry" 'attesters(address)(bool)' "$attester" | grep -qx true
printf 'REGISTRY_ADDRESS=%s\nScan target: %s\n' "$registry" "$fixture"
