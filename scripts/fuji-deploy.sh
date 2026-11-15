#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"
CALLER_PWD="$PWD"

RPC_URL="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
OWNER_ADDRESS="${OWNER_ADDRESS:-}"
ATTESTER_ADDRESS="${ATTESTER_ADDRESS:-}"
INITIAL_HOLDER="${INITIAL_HOLDER:-}"
ACCOUNT="${FOUNDRY_ACCOUNT:-}"
KEYSTORE="${FOUNDRY_KEYSTORE:-}"

REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-}"
BASELINE_TOKEN_ADDRESS="${BASELINE_TOKEN_ADDRESS:-}"
MINT_PAUSE_TOKEN_ADDRESS="${MINT_PAUSE_TOKEN_ADDRESS:-}"
UPGRADEABLE_IMPL_ADDRESS="${UPGRADEABLE_IMPL_ADDRESS:-}"
UPGRADEABLE_PROXY_ADDRESS="${UPGRADEABLE_PROXY_ADDRESS:-}"
DECOY_TOKEN_ADDRESS="${DECOY_TOKEN_ADDRESS:-}"

BROADCAST=0
ALLOW_LOCAL=0
READBACK_MODE=""
ALLOW_POST_DEPLOY_STATE=0
SKIP_BUILD=0
ACCOUNT_SET_CLI=0
KEYSTORE_SET_CLI=0

EXPECTED_INITIAL_SUPPLY="1000000000000000000000000"
ERC1967_IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
ZERO_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"

usage() {
  cat <<'EOF'
Usage: bash scripts/fuji-deploy.sh [options]

Default mode runs a dry-run simulation of packages/contracts/script/DeployDemo.s.sol
against chain ID 43113 without --broadcast and without unlocking a signer.

Options:
  --rpc-url <url>             Fuji RPC URL (default: $FUJI_RPC_URL or public Fuji RPC)
  --owner <address>           Registry/token owner & broadcaster (default: $OWNER_ADDRESS)
  --attester <address>        Separate authorized attester address (default: $ATTESTER_ADDRESS)
  --initial-holder <address>  Initial token holder (default: $INITIAL_HOLDER or owner)
  --account <name>            Named Foundry keystore in ~/.foundry/keystores (required with --broadcast unless --keystore is set)
  --keystore <path>           Keystore file or directory path (resolved from caller CWD; alternative to --account with --broadcast)
  --broadcast                 Broadcast deployment transactions (prompts for keystore password)
  --readback                  Verify full deployed suite at one pinned snapshot block (identity, roles, proxy impl, code, supply/holder)
  --readback-registry         Verify RiskRegistry only (identity, owner, attester) at one pinned snapshot block; NOT a full-suite pass
  --allow-post-deploy-state   With --readback only: allow supply/balance/paused drift after deploy while strictly verifying identity, roles, code, and proxy impl
  --registry <address>        RiskRegistry address (default: $REGISTRY_ADDRESS)
  --baseline <address>        DemoBaselineToken address (default: $BASELINE_TOKEN_ADDRESS)
  --mint-pause <address>      DemoMintPauseToken address (default: $MINT_PAUSE_TOKEN_ADDRESS)
  --upgradeable-impl <addr>   DemoUpgradeableToken implementation address (default: $UPGRADEABLE_IMPL_ADDRESS)
  --upgradeable-proxy <addr>  DemoTokenProxy address (default: $UPGRADEABLE_PROXY_ADDRESS)
  --decoy <address>           DecoyConstantToken address (default: $DECOY_TOKEN_ADDRESS)
  --allow-local               Allow local/loopback HTTP RPC URL (for local chainId=43113 Anvil/mock tests)
  --skip-build                Skip forge build and local artifact identity check
  -h, --help                  Show this help text
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

is_valid_address() {
  [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]
}

is_zero_address() {
  [[ "${1,,}" == "0x0000000000000000000000000000000000000000" ]]
}

is_loopback_url() {
  local lower="${1,,}"
  [[ "$lower" =~ ^https?://(127\.0\.0\.1|localhost|\[::1\])([:/]|$) ]]
}

require_valid_non_zero_address() {
  local label="$1"
  local value="$2"
  [[ -n "$value" ]] || die "$label is required"
  is_valid_address "$value" || die "Invalid $label address: $value"
  ! is_zero_address "$value" || die "$label cannot be the zero address"
}

require_distinct_addresses() {
  local label_a="$1"
  local addr_a="$2"
  local label_b="$3"
  local addr_b="$4"
  [[ "${addr_a,,}" != "${addr_b,,}" ]] || die "$label_a and $label_b must be distinct"
}

resolve_forge() {
  if command -v forge >/dev/null 2>&1; then
    command -v forge
  elif [[ -x "$HOME/.foundry/bin/forge" ]]; then
    echo "$HOME/.foundry/bin/forge"
  else
    die "forge not found on PATH or at \$HOME/.foundry/bin/forge"
  fi
}

resolve_cast() {
  if command -v cast >/dev/null 2>&1; then
    command -v cast
  elif [[ -x "$HOME/.foundry/bin/cast" ]]; then
    echo "$HOME/.foundry/bin/cast"
  else
    die "cast not found on PATH or at \$HOME/.foundry/bin/cast"
  fi
}

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
  elif command -v node.exe >/dev/null 2>&1; then
    command -v node.exe
  else
    die "node or node.exe not found on PATH"
  fi
}

verify_script_path() {
  local node_bin="$1"
  local rel="$2"
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$ROOT_DIR/$rel"
  else
    echo "$ROOT_DIR/$rel"
  fi
}

resolve_keystore_path() {
  local raw="$1"
  local expanded="$raw"
  if [[ "$expanded" == "~" ]]; then
    [[ -n "${HOME:-}" ]] || die "HOME must be set to expand '~' keystore path"
    expanded="$HOME"
  elif [[ "$expanded" == "~/"* ]]; then
    [[ -n "${HOME:-}" ]] || die "HOME must be set to expand '~/...' keystore path"
    if [[ "$HOME" == "/" ]]; then
      expanded="/${expanded:2}"
    else
      expanded="${HOME%/}/${expanded:2}"
    fi
  fi
  local abs="$expanded"
  if [[ "$abs" != /* ]]; then
    abs="$CALLER_PWD/$abs"
  fi
  local dir_part base_part normalized
  dir_part="$(dirname "$abs")"
  base_part="$(basename "$abs")"
  if [[ -d "$dir_part" ]]; then
    normalized="$(cd "$dir_part" && pwd)/$base_part"
  else
    normalized="$abs"
  fi
  if [[ ! -e "$normalized" ]]; then
    if [[ "$raw" != */* && "$raw" != ~* && "$raw" != .* ]]; then
      die "Keystore path not found: '$normalized' (from '$raw'). If '$raw' is a named keystore in ~/.foundry/keystores, pass --account '$raw' instead of --keystore."
    fi
    die "Keystore path not found: '$normalized' (from '$raw')."
  fi
  echo "$normalized"
}

parse_uint256() {
  local raw="$1"
  local label="$2"
  local stripped="${raw%% *}"
  stripped="${stripped//$'\r'/}"
  [[ "$stripped" =~ ^[0-9]+$ ]] || die "$label returned non-numeric uint256: '$raw'"
  echo "$stripped"
}

parse_bool() {
  local raw="${1//$'\r'/}"
  raw="${raw,,}"
  [[ "$raw" == "true" || "$raw" == "false" ]] || die "Expected boolean RPC result, got: '$raw'"
  echo "$raw"
}

parse_erc1967_slot_address() {
  local raw="${1//$'\r'/}"
  local lower="${raw,,}"
  [[ "$lower" =~ ^0x[0-9a-f]{64}$ ]] || die "ERC-1967 implementation slot returned malformed 32-byte value: '$raw'"
  local upper="${lower:2:24}"
  [[ "$upper" == "000000000000000000000000" ]] || die "ERC-1967 implementation slot has non-zero upper bits: '$raw'"
  echo "0x${lower:26:40}"
}

require_nonempty_code() {
  local label="$1"
  local address="$2"
  local block_num="$3"
  local code
  code="$("$CAST_BIN" code "$address" -B "$block_num" --rpc-url "$RPC_URL")"
  code="${code//$'\r'/}"
  [[ "$code" =~ ^0x[0-9a-fA-F]*$ ]] || die "$label eth_getCode returned malformed bytecode: '$code'"
  if [[ "${#code}" -le 2 ]]; then
    die "$label at $address has empty runtime bytecode at block $block_num"
  fi
  echo $(( (${#code} - 2) / 2 ))
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url)
      [[ $# -ge 2 ]] || die "--rpc-url requires a value"
      RPC_URL="$2"
      shift 2
      ;;
    --owner)
      [[ $# -ge 2 ]] || die "--owner requires a value"
      OWNER_ADDRESS="$2"
      shift 2
      ;;
    --attester)
      [[ $# -ge 2 ]] || die "--attester requires a value"
      ATTESTER_ADDRESS="$2"
      shift 2
      ;;
    --initial-holder)
      [[ $# -ge 2 ]] || die "--initial-holder requires a value"
      INITIAL_HOLDER="$2"
      shift 2
      ;;
    --account)
      [[ $# -ge 2 ]] || die "--account requires a value"
      ACCOUNT="$2"
      ACCOUNT_SET_CLI=1
      shift 2
      ;;
    --keystore)
      [[ $# -ge 2 ]] || die "--keystore requires a value"
      KEYSTORE="$2"
      KEYSTORE_SET_CLI=1
      shift 2
      ;;
    --registry)
      [[ $# -ge 2 ]] || die "--registry requires a value"
      REGISTRY_ADDRESS="$2"
      shift 2
      ;;
    --baseline)
      [[ $# -ge 2 ]] || die "--baseline requires a value"
      BASELINE_TOKEN_ADDRESS="$2"
      shift 2
      ;;
    --mint-pause)
      [[ $# -ge 2 ]] || die "--mint-pause requires a value"
      MINT_PAUSE_TOKEN_ADDRESS="$2"
      shift 2
      ;;
    --upgradeable-impl)
      [[ $# -ge 2 ]] || die "--upgradeable-impl requires a value"
      UPGRADEABLE_IMPL_ADDRESS="$2"
      shift 2
      ;;
    --upgradeable-proxy)
      [[ $# -ge 2 ]] || die "--upgradeable-proxy requires a value"
      UPGRADEABLE_PROXY_ADDRESS="$2"
      shift 2
      ;;
    --decoy)
      [[ $# -ge 2 ]] || die "--decoy requires a value"
      DECOY_TOKEN_ADDRESS="$2"
      shift 2
      ;;
    --broadcast)
      BROADCAST=1
      shift
      ;;
    --readback)
      [[ -z "$READBACK_MODE" || "$READBACK_MODE" == "full" ]] || die "Cannot combine --readback and --readback-registry"
      READBACK_MODE="full"
      shift
      ;;
    --readback-registry)
      [[ -z "$READBACK_MODE" || "$READBACK_MODE" == "registry" ]] || die "Cannot combine --readback and --readback-registry"
      READBACK_MODE="registry"
      shift
      ;;
    --allow-post-deploy-state)
      ALLOW_POST_DEPLOY_STATE=1
      shift
      ;;
    --allow-local)
      ALLOW_LOCAL=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (run with --help for usage)"
      ;;
  esac
done

[[ -n "$RPC_URL" ]] || die "FUJI_RPC_URL is empty"
if [[ "$ALLOW_LOCAL" -ne 1 ]]; then
  [[ "${RPC_URL,,}" == https://* ]] || die "FUJI_RPC_URL must use https:// (got: $RPC_URL)"
  if is_loopback_url "$RPC_URL"; then
    die "FUJI_RPC_URL cannot point to loopback in Fuji mode without --allow-local"
  fi
fi

if [[ -n "$READBACK_MODE" && "$BROADCAST" -eq 1 ]]; then
  die "Cannot combine --broadcast with --readback or --readback-registry"
fi

if [[ "$ALLOW_POST_DEPLOY_STATE" -eq 1 && "$READBACK_MODE" != "full" ]]; then
  die "--allow-post-deploy-state can only be used with --readback"
fi

if [[ "$ACCOUNT_SET_CLI" -eq 1 && "$KEYSTORE_SET_CLI" -eq 1 ]]; then
  die "Pass either --account or --keystore, not both"
fi

if [[ "$ACCOUNT_SET_CLI" -eq 1 || "$KEYSTORE_SET_CLI" -eq 1 ]] && [[ "$BROADCAST" -ne 1 ]]; then
  die "--account and --keystore require --broadcast (default mode is read-only dry-run)"
fi

if [[ "$READBACK_MODE" == "registry" ]]; then
  require_valid_non_zero_address "OWNER_ADDRESS (--owner)" "$OWNER_ADDRESS"
  require_valid_non_zero_address "ATTESTER_ADDRESS (--attester)" "$ATTESTER_ADDRESS"
  require_distinct_addresses "OWNER_ADDRESS" "$OWNER_ADDRESS" "ATTESTER_ADDRESS" "$ATTESTER_ADDRESS"
  require_valid_non_zero_address "REGISTRY_ADDRESS (--registry)" "$REGISTRY_ADDRESS"
elif [[ "$READBACK_MODE" == "full" ]]; then
  require_valid_non_zero_address "OWNER_ADDRESS (--owner)" "$OWNER_ADDRESS"
  require_valid_non_zero_address "ATTESTER_ADDRESS (--attester)" "$ATTESTER_ADDRESS"
  require_distinct_addresses "OWNER_ADDRESS" "$OWNER_ADDRESS" "ATTESTER_ADDRESS" "$ATTESTER_ADDRESS"

  if [[ -z "$INITIAL_HOLDER" ]]; then
    INITIAL_HOLDER="$OWNER_ADDRESS"
  fi
  require_valid_non_zero_address "INITIAL_HOLDER (--initial-holder)" "$INITIAL_HOLDER"

  require_valid_non_zero_address "REGISTRY_ADDRESS (--registry)" "$REGISTRY_ADDRESS"
  require_valid_non_zero_address "BASELINE_TOKEN_ADDRESS (--baseline)" "$BASELINE_TOKEN_ADDRESS"
  require_valid_non_zero_address "MINT_PAUSE_TOKEN_ADDRESS (--mint-pause)" "$MINT_PAUSE_TOKEN_ADDRESS"
  require_valid_non_zero_address "UPGRADEABLE_IMPL_ADDRESS (--upgradeable-impl)" "$UPGRADEABLE_IMPL_ADDRESS"
  require_valid_non_zero_address "UPGRADEABLE_PROXY_ADDRESS (--upgradeable-proxy)" "$UPGRADEABLE_PROXY_ADDRESS"
  require_valid_non_zero_address "DECOY_TOKEN_ADDRESS (--decoy)" "$DECOY_TOKEN_ADDRESS"

  CONTRACT_ADDRS=(
    "${REGISTRY_ADDRESS,,}"
    "${BASELINE_TOKEN_ADDRESS,,}"
    "${MINT_PAUSE_TOKEN_ADDRESS,,}"
    "${UPGRADEABLE_IMPL_ADDRESS,,}"
    "${UPGRADEABLE_PROXY_ADDRESS,,}"
    "${DECOY_TOKEN_ADDRESS,,}"
  )
  for ((i = 0; i < ${#CONTRACT_ADDRS[@]}; i++)); do
    for ((j = i + 1; j < ${#CONTRACT_ADDRS[@]}; j++)); do
      if [[ "${CONTRACT_ADDRS[i]}" == "${CONTRACT_ADDRS[j]}" ]]; then
        die "Deployed contract addresses for full --readback must be distinct (duplicate: ${CONTRACT_ADDRS[i]})"
      fi
    done
  done
else
  require_valid_non_zero_address "OWNER_ADDRESS (--owner)" "$OWNER_ADDRESS"
  require_valid_non_zero_address "ATTESTER_ADDRESS (--attester)" "$ATTESTER_ADDRESS"
  require_distinct_addresses "OWNER_ADDRESS" "$OWNER_ADDRESS" "ATTESTER_ADDRESS" "$ATTESTER_ADDRESS"

  if [[ -z "$INITIAL_HOLDER" ]]; then
    INITIAL_HOLDER="$OWNER_ADDRESS"
  fi
  require_valid_non_zero_address "INITIAL_HOLDER (--initial-holder)" "$INITIAL_HOLDER"

  if [[ "$BROADCAST" -eq 1 ]]; then
    if [[ -n "$ACCOUNT" && -n "$KEYSTORE" ]]; then
      die "Cannot use both --account/FOUNDRY_ACCOUNT and --keystore/FOUNDRY_KEYSTORE together"
    fi
    if [[ -z "$ACCOUNT" && -z "$KEYSTORE" ]]; then
      die "--broadcast requires --account <name> (or FOUNDRY_ACCOUNT) or --keystore <path> (or FOUNDRY_KEYSTORE)"
    fi
    if [[ -n "$KEYSTORE" ]]; then
      KEYSTORE="$(resolve_keystore_path "$KEYSTORE")"
    fi
  fi
  export OWNER_ADDRESS ATTESTER_ADDRESS INITIAL_HOLDER
fi

FORGE_BIN="$(resolve_forge)"
CAST_BIN="$(resolve_cast)"
NODE_BIN="$(resolve_node)"
VERIFY_SCRIPT="$(verify_script_path "$NODE_BIN" "scripts/verify-registry-identity.mjs")"

if [[ "$SKIP_BUILD" -ne 1 ]]; then
  echo "Building contracts with pinned compiler profile (--build-info)..."
  (cd "$CONTRACTS_DIR" && "$FORGE_BIN" build --build-info)
  echo "Verifying local RiskRegistry ABI and runtime bytecode hash..."
  "$NODE_BIN" "$VERIFY_SCRIPT"
fi

echo "Checking target RPC chain ID (expecting 43113)..."
CHAIN_ID="$("$CAST_BIN" chain-id --rpc-url "$RPC_URL")"
CHAIN_ID="${CHAIN_ID//$'\r'/}"
[[ "$CHAIN_ID" == "43113" ]] || die "RPC chain-id is '$CHAIN_ID', expected 43113 (Avalanche Fuji)"

if [[ -n "$READBACK_MODE" ]]; then
  SNAPSHOT_BLOCK="$("$CAST_BIN" block latest --field number --rpc-url "$RPC_URL")"
  SNAPSHOT_BLOCK="${SNAPSHOT_BLOCK//$'\r'/}"
  [[ "$SNAPSHOT_BLOCK" =~ ^[0-9]+$ ]] || die "Failed to obtain valid snapshot block number (got: '$SNAPSHOT_BLOCK')"

  SNAPSHOT_HASH="$("$CAST_BIN" block "$SNAPSHOT_BLOCK" --field hash --rpc-url "$RPC_URL")"
  SNAPSHOT_HASH="${SNAPSHOT_HASH//$'\r'/}"
  [[ "$SNAPSHOT_HASH" =~ ^0x[0-9a-fA-F]{64}$ ]] || die "Failed to obtain valid snapshot block hash (got: '$SNAPSHOT_HASH')"
  [[ "${SNAPSHOT_HASH,,}" != "$ZERO_HASH" ]] || die "RPC returned zero block hash for block $SNAPSHOT_BLOCK"

  echo "Pinned snapshot block: $SNAPSHOT_BLOCK ($SNAPSHOT_HASH)"

  "$NODE_BIN" "$VERIFY_SCRIPT" \
    --rpc-url "$RPC_URL" \
    --registry "$REGISTRY_ADDRESS" \
    --block "$SNAPSHOT_BLOCK" \
    --expected-block-hash "$SNAPSHOT_HASH"

  REG_OWNER="$("$CAST_BIN" call "$REGISTRY_ADDRESS" "owner()(address)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
  REG_OWNER="${REG_OWNER//$'\r'/}"
  is_valid_address "$REG_OWNER" || die "RiskRegistry.owner() returned invalid address: '$REG_OWNER'"
  [[ "${REG_OWNER,,}" == "${OWNER_ADDRESS,,}" ]] || die "RiskRegistry.owner() mismatch: on-chain=$REG_OWNER expected=$OWNER_ADDRESS"
  echo "RiskRegistry.owner() == $REG_OWNER (matches OWNER_ADDRESS)"

  ATTESTER_OK_RAW="$("$CAST_BIN" call "$REGISTRY_ADDRESS" "attesters(address)(bool)" "$ATTESTER_ADDRESS" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
  ATTESTER_OK="$(parse_bool "$ATTESTER_OK_RAW")"
  [[ "$ATTESTER_OK" == "true" ]] || die "RiskRegistry.attesters($ATTESTER_ADDRESS) is '$ATTESTER_OK', expected 'true'"
  echo "RiskRegistry.attesters($ATTESTER_ADDRESS) == true"

  if [[ "$READBACK_MODE" == "full" ]]; then
    BASE_BYTES="$(require_nonempty_code "DemoBaselineToken" "$BASELINE_TOKEN_ADDRESS" "$SNAPSHOT_BLOCK")"
    MP_BYTES="$(require_nonempty_code "DemoMintPauseToken" "$MINT_PAUSE_TOKEN_ADDRESS" "$SNAPSHOT_BLOCK")"
    IMPL_BYTES="$(require_nonempty_code "DemoUpgradeableToken" "$UPGRADEABLE_IMPL_ADDRESS" "$SNAPSHOT_BLOCK")"
    PROXY_BYTES="$(require_nonempty_code "DemoTokenProxy" "$UPGRADEABLE_PROXY_ADDRESS" "$SNAPSHOT_BLOCK")"
    DECOY_BYTES="$(require_nonempty_code "DecoyConstantToken" "$DECOY_TOKEN_ADDRESS" "$SNAPSHOT_BLOCK")"
    echo "Nonempty bytecode verified: Baseline=${BASE_BYTES}B MintPause=${MP_BYTES}B Impl=${IMPL_BYTES}B Proxy=${PROXY_BYTES}B Decoy=${DECOY_BYTES}B"

    BASE_SUPPLY_RAW="$("$CAST_BIN" call "$BASELINE_TOKEN_ADDRESS" "totalSupply()(uint256)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    BASE_SUPPLY="$(parse_uint256 "$BASE_SUPPLY_RAW" "DemoBaselineToken.totalSupply()")"
    BASE_BAL_RAW="$("$CAST_BIN" call "$BASELINE_TOKEN_ADDRESS" "balanceOf(address)(uint256)" "$INITIAL_HOLDER" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    BASE_BAL="$(parse_uint256 "$BASE_BAL_RAW" "DemoBaselineToken.balanceOf($INITIAL_HOLDER)")"
    if [[ "$ALLOW_POST_DEPLOY_STATE" -ne 1 ]]; then
      [[ "$BASE_SUPPLY" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoBaselineToken.totalSupply() mismatch: got=$BASE_SUPPLY expected=$EXPECTED_INITIAL_SUPPLY"
      [[ "$BASE_BAL" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoBaselineToken.balanceOf($INITIAL_HOLDER) mismatch: got=$BASE_BAL expected=$EXPECTED_INITIAL_SUPPLY"
    else
      [[ "$BASE_SUPPLY" != "0" ]] || die "DemoBaselineToken.totalSupply() unexpectedly zero in post-deploy check"
    fi
    echo "DemoBaselineToken verified: totalSupply=$BASE_SUPPLY balanceOf($INITIAL_HOLDER)=$BASE_BAL"

    MP_OWNER="$("$CAST_BIN" call "$MINT_PAUSE_TOKEN_ADDRESS" "owner()(address)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    MP_OWNER="${MP_OWNER//$'\r'/}"
    is_valid_address "$MP_OWNER" || die "DemoMintPauseToken.owner() returned invalid address: '$MP_OWNER'"
    [[ "${MP_OWNER,,}" == "${OWNER_ADDRESS,,}" ]] || die "DemoMintPauseToken.owner() mismatch: on-chain=$MP_OWNER expected=$OWNER_ADDRESS"
    MP_PAUSED_RAW="$("$CAST_BIN" call "$MINT_PAUSE_TOKEN_ADDRESS" "paused()(bool)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    MP_PAUSED="$(parse_bool "$MP_PAUSED_RAW")"
    MP_SUPPLY_RAW="$("$CAST_BIN" call "$MINT_PAUSE_TOKEN_ADDRESS" "totalSupply()(uint256)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    MP_SUPPLY="$(parse_uint256 "$MP_SUPPLY_RAW" "DemoMintPauseToken.totalSupply()")"
    MP_BAL_RAW="$("$CAST_BIN" call "$MINT_PAUSE_TOKEN_ADDRESS" "balanceOf(address)(uint256)" "$INITIAL_HOLDER" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    MP_BAL="$(parse_uint256 "$MP_BAL_RAW" "DemoMintPauseToken.balanceOf($INITIAL_HOLDER)")"
    if [[ "$ALLOW_POST_DEPLOY_STATE" -ne 1 ]]; then
      [[ "$MP_PAUSED" == "false" ]] || die "DemoMintPauseToken.paused() expected false on initial deployment, got true"
      [[ "$MP_SUPPLY" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoMintPauseToken.totalSupply() mismatch: got=$MP_SUPPLY expected=$EXPECTED_INITIAL_SUPPLY"
      [[ "$MP_BAL" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoMintPauseToken.balanceOf($INITIAL_HOLDER) mismatch: got=$MP_BAL expected=$EXPECTED_INITIAL_SUPPLY"
    else
      [[ "$MP_SUPPLY" != "0" ]] || die "DemoMintPauseToken.totalSupply() unexpectedly zero in post-deploy check"
    fi
    echo "DemoMintPauseToken verified: owner=$MP_OWNER paused=$MP_PAUSED totalSupply=$MP_SUPPLY balanceOf($INITIAL_HOLDER)=$MP_BAL"

    PROXY_SLOT_RAW="$("$CAST_BIN" storage "$UPGRADEABLE_PROXY_ADDRESS" "$ERC1967_IMPL_SLOT" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    PROXY_IMPL="$(parse_erc1967_slot_address "$PROXY_SLOT_RAW")"
    [[ "${PROXY_IMPL,,}" == "${UPGRADEABLE_IMPL_ADDRESS,,}" ]] || die "DemoTokenProxy ERC-1967 implementation mismatch: on-chain=$PROXY_IMPL expected=$UPGRADEABLE_IMPL_ADDRESS"
    PROXY_OWNER="$("$CAST_BIN" call "$UPGRADEABLE_PROXY_ADDRESS" "owner()(address)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    PROXY_OWNER="${PROXY_OWNER//$'\r'/}"
    is_valid_address "$PROXY_OWNER" || die "DemoTokenProxy.owner() returned invalid address: '$PROXY_OWNER'"
    [[ "${PROXY_OWNER,,}" == "${OWNER_ADDRESS,,}" ]] || die "DemoTokenProxy.owner() mismatch: on-chain=$PROXY_OWNER expected=$OWNER_ADDRESS"
    PROXY_SUPPLY_RAW="$("$CAST_BIN" call "$UPGRADEABLE_PROXY_ADDRESS" "totalSupply()(uint256)" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    PROXY_SUPPLY="$(parse_uint256 "$PROXY_SUPPLY_RAW" "DemoTokenProxy.totalSupply()")"
    PROXY_BAL_RAW="$("$CAST_BIN" call "$UPGRADEABLE_PROXY_ADDRESS" "balanceOf(address)(uint256)" "$INITIAL_HOLDER" -b "$SNAPSHOT_BLOCK" --rpc-url "$RPC_URL")"
    PROXY_BAL="$(parse_uint256 "$PROXY_BAL_RAW" "DemoTokenProxy.balanceOf($INITIAL_HOLDER)")"
    if [[ "$ALLOW_POST_DEPLOY_STATE" -ne 1 ]]; then
      [[ "$PROXY_SUPPLY" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoTokenProxy.totalSupply() mismatch: got=$PROXY_SUPPLY expected=$EXPECTED_INITIAL_SUPPLY"
      [[ "$PROXY_BAL" == "$EXPECTED_INITIAL_SUPPLY" ]] || die "DemoTokenProxy.balanceOf($INITIAL_HOLDER) mismatch: got=$PROXY_BAL expected=$EXPECTED_INITIAL_SUPPLY"
    else
      [[ "$PROXY_SUPPLY" != "0" ]] || die "DemoTokenProxy.totalSupply() unexpectedly zero in post-deploy check"
    fi
    echo "DemoTokenProxy verified: impl=$PROXY_IMPL owner=$PROXY_OWNER totalSupply=$PROXY_SUPPLY balanceOf($INITIAL_HOLDER)=$PROXY_BAL"
  fi

  CONFIRM_HASH="$("$CAST_BIN" block "$SNAPSHOT_BLOCK" --field hash --rpc-url "$RPC_URL")"
  CONFIRM_HASH="${CONFIRM_HASH//$'\r'/}"
  [[ "$CONFIRM_HASH" =~ ^0x[0-9a-fA-F]{64}$ ]] || die "Post-read block header hash malformed: '$CONFIRM_HASH'"
  [[ "${CONFIRM_HASH,,}" == "${SNAPSHOT_HASH,,}" ]] || die "Snapshot block header hash changed mid-read ($SNAPSHOT_HASH -> $CONFIRM_HASH); possible reorg or inconsistent RPC"

  if [[ "$READBACK_MODE" == "registry" ]]; then
    echo "Registry-only read-back PASSED at block $SNAPSHOT_BLOCK ($SNAPSHOT_HASH)."
    echo "WARNING: Demo tokens, proxy, and decoy were NOT verified; do NOT treat --readback-registry as a full-suite verification pass."
  elif [[ "$ALLOW_POST_DEPLOY_STATE" -eq 1 ]]; then
    echo "Full read-back PASSED at block $SNAPSHOT_BLOCK ($SNAPSHOT_HASH) with --allow-post-deploy-state (identity, roles, nonempty code, and proxy implementation verified; initial supply/balance/unpaused equality skipped)."
  else
    echo "Full initial-deployment read-back PASSED at block $SNAPSHOT_BLOCK ($SNAPSHOT_HASH)."
  fi
  exit 0
fi

if [[ "$BROADCAST" -eq 1 ]]; then
  if [[ -n "$ACCOUNT" ]]; then
    echo "Broadcasting DeployDemoScript to chain ID 43113 via named account '$ACCOUNT'..."
    (
      cd "$CONTRACTS_DIR"
      "$FORGE_BIN" script script/DeployDemo.s.sol:DeployDemoScript \
        --rpc-url "$RPC_URL" \
        --account "$ACCOUNT" \
        --sender "$OWNER_ADDRESS" \
        --broadcast
    )
  else
    echo "Broadcasting DeployDemoScript to chain ID 43113 via keystore '$KEYSTORE'..."
    (
      cd "$CONTRACTS_DIR"
      "$FORGE_BIN" script script/DeployDemo.s.sol:DeployDemoScript \
        --rpc-url "$RPC_URL" \
        --keystore "$KEYSTORE" \
        --sender "$OWNER_ADDRESS" \
        --broadcast
    )
  fi
else
  echo "Running dry-run simulation (no --broadcast, no signer unlocked)..."
  (
    cd "$CONTRACTS_DIR"
    "$FORGE_BIN" script script/DeployDemo.s.sol:DeployDemoScript \
      --rpc-url "$RPC_URL" \
      --sender "$OWNER_ADDRESS"
  )
fi
