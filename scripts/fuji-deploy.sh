#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"

RPC_URL="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
OWNER_ADDRESS="${OWNER_ADDRESS:-}"
ATTESTER_ADDRESS="${ATTESTER_ADDRESS:-}"
INITIAL_HOLDER="${INITIAL_HOLDER:-}"
KEYSTORE="${FOUNDRY_KEYSTORE:-}"
REGISTRY_ADDRESS="${REGISTRY_ADDRESS:-}"
BASELINE_ADDRESS="${BASELINE_TOKEN_ADDRESS:-}"
MINT_PAUSE_ADDRESS="${MINT_PAUSE_TOKEN_ADDRESS:-}"
UPGRADEABLE_PROXY_ADDRESS="${UPGRADEABLE_PROXY_ADDRESS:-}"
DECOY_ADDRESS="${DECOY_TOKEN_ADDRESS:-}"

BROADCAST=0
ALLOW_LOCAL=0
READBACK_ONLY=0
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage: scripts/fuji-deploy.sh [options]

Default mode runs a dry-run simulation of packages/contracts/script/DeployDemo.s.sol
against chain ID 43113 without --broadcast and without requiring a keystore.

Options:
  --rpc-url <url>             Fuji RPC URL (default: $FUJI_RPC_URL or public Fuji RPC)
  --owner <address>           Registry/token owner & broadcaster (default: $OWNER_ADDRESS)
  --attester <address>        Separate authorized attester address (default: $ATTESTER_ADDRESS)
  --initial-holder <address>  Initial token holder (default: $INITIAL_HOLDER or owner)
  --keystore <name-or-path>   Foundry keystore required with --broadcast
  --broadcast                 Broadcast deployment transactions (prompts for keystore password)
  --readback                  Run on-chain read-back verification instead of simulation/deploy
  --registry <address>        Registry address for --readback (default: $REGISTRY_ADDRESS)
  --allow-local               Allow local/loopback RPC URL (for local chainId=43113 Anvil tests)
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
    --keystore)
      [[ $# -ge 2 ]] || die "--keystore requires a value"
      KEYSTORE="$2"
      shift 2
      ;;
    --registry)
      [[ $# -ge 2 ]] || die "--registry requires a value"
      REGISTRY_ADDRESS="$2"
      shift 2
      ;;
    --broadcast)
      BROADCAST=1
      shift
      ;;
    --readback)
      READBACK_ONLY=1
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

if [[ "$READBACK_ONLY" -eq 1 ]]; then
  [[ -n "$REGISTRY_ADDRESS" ]] || die "--registry or REGISTRY_ADDRESS is required for --readback"
  is_valid_address "$REGISTRY_ADDRESS" || die "Invalid --registry address: $REGISTRY_ADDRESS"
  ! is_zero_address "$REGISTRY_ADDRESS" || die "--registry cannot be the zero address"
else
  [[ -n "$OWNER_ADDRESS" ]] || die "OWNER_ADDRESS (or --owner) is required"
  [[ -n "$ATTESTER_ADDRESS" ]] || die "ATTESTER_ADDRESS (or --attester) is required"
  is_valid_address "$OWNER_ADDRESS" || die "Invalid OWNER_ADDRESS: $OWNER_ADDRESS"
  is_valid_address "$ATTESTER_ADDRESS" || die "Invalid ATTESTER_ADDRESS: $ATTESTER_ADDRESS"
  ! is_zero_address "$OWNER_ADDRESS" || die "OWNER_ADDRESS cannot be the zero address"
  ! is_zero_address "$ATTESTER_ADDRESS" || die "ATTESTER_ADDRESS cannot be the zero address"
  [[ "${OWNER_ADDRESS,,}" != "${ATTESTER_ADDRESS,,}" ]] || die "OWNER_ADDRESS and ATTESTER_ADDRESS must be distinct"

  if [[ -z "$INITIAL_HOLDER" ]]; then
    INITIAL_HOLDER="$OWNER_ADDRESS"
  fi
  is_valid_address "$INITIAL_HOLDER" || die "Invalid INITIAL_HOLDER: $INITIAL_HOLDER"
  ! is_zero_address "$INITIAL_HOLDER" || die "INITIAL_HOLDER cannot be the zero address"

  if [[ "$BROADCAST" -eq 1 ]]; then
    [[ -n "$KEYSTORE" ]] || die "--keystore (or FOUNDRY_KEYSTORE) is required with --broadcast"
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
[[ "$CHAIN_ID" == "43113" ]] || die "RPC chain-id is $CHAIN_ID, expected 43113 (Avalanche Fuji)"

if [[ "$READBACK_ONLY" -eq 1 ]]; then
  "$NODE_BIN" "$VERIFY_SCRIPT" --rpc-url "$RPC_URL" --registry "$REGISTRY_ADDRESS"

  REG_OWNER="$("$CAST_BIN" call "$REGISTRY_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
  echo "RiskRegistry.owner(): $REG_OWNER"

  if [[ -n "$ATTESTER_ADDRESS" ]]; then
    is_valid_address "$ATTESTER_ADDRESS" || die "Invalid ATTESTER_ADDRESS: $ATTESTER_ADDRESS"
    ATTESTER_OK="$("$CAST_BIN" call "$REGISTRY_ADDRESS" "attesters(address)(bool)" "$ATTESTER_ADDRESS" --rpc-url "$RPC_URL")"
    echo "RiskRegistry.attesters($ATTESTER_ADDRESS): $ATTESTER_OK"
  fi

  if [[ -n "$BASELINE_ADDRESS" ]]; then
    echo "DemoBaselineToken.totalSupply(): $("$CAST_BIN" call "$BASELINE_ADDRESS" "totalSupply()(uint256)" --rpc-url "$RPC_URL")"
  fi
  if [[ -n "$MINT_PAUSE_ADDRESS" ]]; then
    echo "DemoMintPauseToken.owner(): $("$CAST_BIN" call "$MINT_PAUSE_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
    echo "DemoMintPauseToken.paused(): $("$CAST_BIN" call "$MINT_PAUSE_ADDRESS" "paused()(bool)" --rpc-url "$RPC_URL")"
  fi
  if [[ -n "$UPGRADEABLE_PROXY_ADDRESS" ]]; then
    IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    echo "DemoTokenProxy ERC-1967 implementation slot: $("$CAST_BIN" storage "$UPGRADEABLE_PROXY_ADDRESS" "$IMPL_SLOT" --rpc-url "$RPC_URL")"
    echo "DemoTokenProxy.owner(): $("$CAST_BIN" call "$UPGRADEABLE_PROXY_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
  fi
  if [[ -n "$DECOY_ADDRESS" ]]; then
    echo "DecoyConstantToken code bytes: $(("$("$CAST_BIN" code "$DECOY_ADDRESS" --rpc-url "$RPC_URL" | wc -c)" / 2 - 1))"
  fi
  exit 0
fi

if [[ "$BROADCAST" -eq 1 ]]; then
  echo "Broadcasting DeployDemoScript to chain ID 43113 via keystore '$KEYSTORE'..."
  (
    cd "$CONTRACTS_DIR"
    "$FORGE_BIN" script script/DeployDemo.s.sol:DeployDemoScript \
      --rpc-url "$RPC_URL" \
      --keystore "$KEYSTORE" \
      --sender "$OWNER_ADDRESS" \
      --broadcast
  )
else
  echo "Running dry-run simulation (no --broadcast, no keystore used)..."
  (
    cd "$CONTRACTS_DIR"
    "$FORGE_BIN" script script/DeployDemo.s.sol:DeployDemoScript \
      --rpc-url "$RPC_URL" \
      --sender "$OWNER_ADDRESS"
  )
fi
