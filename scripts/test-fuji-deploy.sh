#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/fuji-deploy.sh"
ARTIFACT_PATH="$ROOT_DIR/packages/contracts/out/RiskRegistry.sol/RiskRegistry.json"
WEB_PKG_PATH="$ROOT_DIR/apps/web/package.json"

die() {
  echo "TEST ERROR: $*" >&2
  exit 1
}

PASS_COUNT=0
FAIL_COUNT=0

assert_ok() {
  local label="$1"
  shift
  local out
  if out="$("$@" 2>&1)"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "[PASS] $label"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[FAIL] $label (expected exit 0, got nonzero)" >&2
    echo "$out" | sed 's/^/  | /' >&2
  fi
}

assert_fails_matching() {
  local label="$1"
  local pattern="$2"
  shift 2
  local out rc
  set +e
  out="$("$@" 2>&1)"
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]] && { [[ -z "$pattern" ]] || grep -qiE -- "$pattern" <<<"$out"; }; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "[PASS] $label"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[FAIL] $label (expected nonzero exit matching /$pattern/, got rc=$rc)" >&2
    echo "$out" | sed 's/^/  | /' >&2
  fi
}

if ! command -v python3 >/dev/null 2>&1; then
  die "python3 is required to run the local mock RPC test server"
fi

if [[ ! -f "$ARTIFACT_PATH" ]]; then
  die "Missing $ARTIFACT_PATH; run 'cd packages/contracts && forge build --build-info' first"
fi

FORGE_BIN=""
if command -v forge >/dev/null 2>&1; then
  FORGE_BIN="$(command -v forge)"
elif [[ -x "$HOME/.foundry/bin/forge" ]]; then
  FORGE_BIN="$HOME/.foundry/bin/forge"
else
  die "forge not found on PATH or at \$HOME/.foundry/bin/forge"
fi

CAST_BIN=""
if command -v cast >/dev/null 2>&1; then
  CAST_BIN="$(command -v cast)"
elif [[ -x "$HOME/.foundry/bin/cast" ]]; then
  CAST_BIN="$HOME/.foundry/bin/cast"
else
  die "cast not found on PATH or at \$HOME/.foundry/bin/cast"
fi

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif command -v node.exe >/dev/null 2>&1; then
  NODE_BIN="$(command -v node.exe)"
else
  die "node or node.exe not found on PATH"
fi

TMP_DIR="$(mktemp -d)"
MOCK_PID=""
cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" >/dev/null 2>&1 || true
    wait "$MOCK_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

OWNER_ADDR="0x1111111111111111111111111111111111111111"
ATTESTER_ADDR="0x2222222222222222222222222222222222222222"
OTHER_HOLDER="0x3333333333333333333333333333333333333333"
WRONG_ADDR="0x9999999999999999999999999999999999999999"

REGISTRY_ADDR="0xa100000000000000000000000000000000000001"
BASELINE_ADDR="0xa200000000000000000000000000000000000002"
MINT_PAUSE_ADDR="0xa300000000000000000000000000000000000003"
IMPL_ADDR="0xa400000000000000000000000000000000000004"
PROXY_ADDR="0xa500000000000000000000000000000000000005"
DECOY_ADDR="0xa600000000000000000000000000000000000006"

STATE_FILE="$TMP_DIR/mock-state.json"
LOG_FILE="$TMP_DIR/rpc-requests.jsonl"
PORT_FILE="$TMP_DIR/mock-port"
MOCK_PY="$TMP_DIR/mock_rpc.py"

SEL_OWNER="$("$CAST_BIN" sig "owner()")"
SEL_ATTESTERS="$("$CAST_BIN" sig "attesters(address)")"
SEL_TOTAL_SUPPLY="$("$CAST_BIN" sig "totalSupply()")"
SEL_BALANCE_OF="$("$CAST_BIN" sig "balanceOf(address)")"
SEL_PAUSED="$("$CAST_BIN" sig "paused()")"

cat >"$MOCK_PY" <<PY
import http.server
import json
import os
import sys
import threading

artifact_path, state_path, log_path, port_path = sys.argv[1:5]
with open(artifact_path, "r", encoding="utf-8") as f:
    REG_BYTECODE = json.load(f)["deployedBytecode"]["object"]

STATE_LOCK = threading.Lock()
STATE = {}
BLOCK_CALLS = 0

BLOCK_NUM_HEX = "0x64"
ZERO_HASH = "0x" + "00" * 32
EMPTY_BLOOM = "0x" + "00" * 256

REGISTRY_ADDR = "${REGISTRY_ADDR,,}"
BASELINE_ADDR = "${BASELINE_ADDR,,}"
MINT_PAUSE_ADDR = "${MINT_PAUSE_ADDR,,}"
IMPL_ADDR = "${IMPL_ADDR,,}"
PROXY_ADDR = "${PROXY_ADDR,,}"
DECOY_ADDR = "${DECOY_ADDR,,}"
IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

SEL_OWNER = "${SEL_OWNER}"
SEL_ATTESTERS = "${SEL_ATTESTERS}"
SEL_TOTAL_SUPPLY = "${SEL_TOTAL_SUPPLY}"
SEL_BALANCE_OF = "${SEL_BALANCE_OF}"
SEL_PAUSED = "${SEL_PAUSED}"

def enc_addr(addr):
    return "0x" + addr.lower().replace("0x", "").rjust(64, "0")

def enc_uint(val):
    return "0x" + hex(int(val))[2:].rjust(64, "0")

def enc_bool(val):
    return enc_uint(1 if val else 0)

def make_block(block_hash):
    return {
        "number": BLOCK_NUM_HEX,
        "hash": block_hash,
        "parentHash": ZERO_HASH,
        "nonce": "0x0000000000000000",
        "sha3Uncles": ZERO_HASH,
        "logsBloom": EMPTY_BLOOM,
        "transactionsRoot": ZERO_HASH,
        "stateRoot": ZERO_HASH,
        "receiptsRoot": ZERO_HASH,
        "miner": "0x0000000000000000000000000000000000000000",
        "difficulty": "0x0",
        "totalDifficulty": "0x0",
        "extraData": "0x",
        "size": "0x200",
        "gasLimit": "0xe4e1c0",
        "gasUsed": "0x0",
        "timestamp": "0x60000000",
        "transactions": [],
        "uncles": [],
        "mixHash": ZERO_HASH,
        "baseFeePerGas": "0x5d21dba00",
    }

class MockRpc(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        global STATE, BLOCK_CALLS
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        req = json.loads(raw)

        if self.path == "/__state":
            with STATE_LOCK:
                STATE = dict(req)
                BLOCK_CALLS = 0
                with open(log_path, "w", encoding="utf-8") as lf:
                    lf.write("")
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        with STATE_LOCK:
            st = dict(STATE)
            method = req.get("method", "")
            params = req.get("params", [])
            with open(log_path, "a", encoding="utf-8") as lf:
                lf.write(json.dumps({"method": method, "params": params}) + "\n")

            block_call_idx = None
            if method == "eth_getBlockByNumber":
                BLOCK_CALLS += 1
                block_call_idx = BLOCK_CALLS

        def respond(result=None, error=None, status=200):
            payload = {"jsonrpc": "2.0", "id": req.get("id", 1)}
            if error is not None:
                payload["error"] = error
            else:
                payload["result"] = result
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        if method == "eth_chainId":
            return respond(st.get("chainId", "0xa869"))

        if method == "eth_getBlockByNumber":
            bh = st.get("blockHash", "0x" + "aa" * 32)
            if st.get("reorg_after") and block_call_idx >= int(st["reorg_after"]):
                bh = st.get("reorgHash", "0x" + "bb" * 32)
            return respond(make_block(bh))

        if method == "eth_getCode":
            to = params[0].lower()
            if to in [x.lower() for x in st.get("emptyCodeTargets", [])]:
                return respond("0x")
            if to == REGISTRY_ADDR:
                return respond(REG_BYTECODE)
            if to in (BASELINE_ADDR, MINT_PAUSE_ADDR, IMPL_ADDR, PROXY_ADDR, DECOY_ADDR):
                return respond("0x6001600055")
            return respond("0x")

        if method == "eth_getStorageAt":
            to = params[0].lower()
            slot = params[1].lower()
            if to == PROXY_ADDR and slot == IMPL_SLOT:
                return respond(st.get("proxySlotWord", enc_addr(IMPL_ADDR)))
            return respond(ZERO_HASH)

        if method == "eth_call":
            tx = params[0]
            to = tx.get("to", "").lower()
            data = tx.get("data", "").lower()
            sel = data[:10]

            if st.get("failCall") == f"{to}:{sel}" or st.get("failCall") == sel:
                return respond(error={"code": -32000, "message": "injected RPC failure"})

            if to == REGISTRY_ADDR:
                if sel == SEL_OWNER:
                    return respond(enc_addr(st.get("registryOwner", "${OWNER_ADDR}")))
                if sel == SEL_ATTESTERS:
                    return respond(enc_bool(st.get("attesterAuthorized", True)))

            expected_holder = st.get("holder", "${OWNER_ADDR}").lower().replace("0x", "")
            expected_supply = int(st.get("supply", str(10**24)))

            if to == BASELINE_ADDR:
                if sel == SEL_TOTAL_SUPPLY:
                    return respond(enc_uint(st.get("baselineSupply", expected_supply)))
                if sel == SEL_BALANCE_OF:
                    arg_addr = data[10:74][-40:]
                    bal = expected_supply if arg_addr == expected_holder else 0
                    return respond(enc_uint(bal))

            if to == MINT_PAUSE_ADDR:
                if sel == SEL_OWNER:
                    return respond(enc_addr(st.get("mintPauseOwner", "${OWNER_ADDR}")))
                if sel == SEL_PAUSED:
                    return respond(enc_bool(st.get("paused", False)))
                if sel == SEL_TOTAL_SUPPLY:
                    return respond(enc_uint(st.get("mintPauseSupply", expected_supply)))
                if sel == SEL_BALANCE_OF:
                    arg_addr = data[10:74][-40:]
                    bal = expected_supply if arg_addr == expected_holder else 0
                    return respond(enc_uint(bal))

            if to == PROXY_ADDR:
                if sel == SEL_OWNER:
                    return respond(enc_addr(st.get("proxyOwner", "${OWNER_ADDR}")))
                if sel == SEL_TOTAL_SUPPLY:
                    return respond(enc_uint(st.get("proxySupply", expected_supply)))
                if sel == SEL_BALANCE_OF:
                    arg_addr = data[10:74][-40:]
                    bal = expected_supply if arg_addr == expected_holder else 0
                    return respond(enc_uint(bal))

            return respond(error={"code": -32000, "message": f"unexpected call {to} {sel}"})

        return respond(error={"code": -32601, "message": f"unsupported method {method}"})

    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), MockRpc)
with open(port_path, "w", encoding="utf-8") as pf:
    pf.write(str(server.server_address[1]))
server.serve_forever()
PY

python3 "$MOCK_PY" "$ARTIFACT_PATH" "$STATE_FILE" "$LOG_FILE" "$PORT_FILE" &
MOCK_PID=$!

for _ in $(seq 1 50); do
  if [[ -s "$PORT_FILE" ]]; then
    break
  fi
  sleep 0.1
done
[[ -s "$PORT_FILE" ]] || die "Mock RPC server failed to start"
RPC_URL="http://127.0.0.1:$(cat "$PORT_FILE")"

reset_state() {
  local json_body="${1-}"
  if [[ -z "$json_body" ]]; then
    json_body='{}'
  fi
  python3 - "$RPC_URL/__state" "$json_body" <<'PY'
import sys, urllib.request
req = urllib.request.Request(sys.argv[1], data=sys.argv[2].encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=5) as resp:
    assert resp.status == 200
PY
}

echo "=== R1: Input validation before RPC & pinned-block full read-back checks ==="

reset_state '{}'
assert_fails_matching \
  "R1: full --readback rejects missing required inputs before any RPC calls" \
  "OWNER_ADDRESS|ATTESTER_ADDRESS|required" \
  env -u OWNER_ADDRESS -u ATTESTER_ADDRESS -u INITIAL_HOLDER \
      -u BASELINE_TOKEN_ADDRESS -u MINT_PAUSE_TOKEN_ADDRESS \
      -u UPGRADEABLE_IMPL_ADDRESS -u UPGRADEABLE_PROXY_ADDRESS -u DECOY_TOKEN_ADDRESS \
  bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL" --registry "$REGISTRY_ADDR"

if [[ -s "$LOG_FILE" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R1: RPC calls occurred despite invalid/missing readback inputs" >&2
else
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R1: zero RPC calls when readback inputs missing"
fi

run_full_readback() {
  env \
    OWNER_ADDRESS="$OWNER_ADDR" \
    ATTESTER_ADDRESS="$ATTESTER_ADDR" \
    REGISTRY_ADDRESS="$REGISTRY_ADDR" \
    BASELINE_TOKEN_ADDRESS="$BASELINE_ADDR" \
    MINT_PAUSE_TOKEN_ADDRESS="$MINT_PAUSE_ADDR" \
    UPGRADEABLE_IMPL_ADDRESS="$IMPL_ADDR" \
    UPGRADEABLE_PROXY_ADDRESS="$PROXY_ADDR" \
    DECOY_TOKEN_ADDRESS="$DECOY_ADDR" \
    "$@"
}

reset_state "{\"holder\":\"$OWNER_ADDR\"}"
assert_ok "R1: valid full --readback passes with defaulted INITIAL_HOLDER == OWNER_ADDRESS" \
  env -u INITIAL_HOLDER \
  bash -c 'OWNER_ADDRESS="'"$OWNER_ADDR"'" ATTESTER_ADDRESS="'"$ATTESTER_ADDR"'" REGISTRY_ADDRESS="'"$REGISTRY_ADDR"'" BASELINE_TOKEN_ADDRESS="'"$BASELINE_ADDR"'" MINT_PAUSE_TOKEN_ADDRESS="'"$MINT_PAUSE_ADDR"'" UPGRADEABLE_IMPL_ADDRESS="'"$IMPL_ADDR"'" UPGRADEABLE_PROXY_ADDRESS="'"$PROXY_ADDR"'" DECOY_TOKEN_ADDRESS="'"$DECOY_ADDR"'" bash "'"$SCRIPT_UNDER_TEST"'" --readback --allow-local --skip-build --rpc-url "'"$RPC_URL"'"'

# Check that every eth_call, eth_getStorageAt, and eth_getCode used pinned block 0x64 (100)
TAG_SUMMARY="$(python3 - "$LOG_FILE" <<'PY'
import json, sys
total_reads = 0
bad = []
with open(sys.argv[1], "r", encoding="utf-8") as f:
    for line in f:
        rec = json.loads(line)
        m = rec["method"]
        p = rec["params"]
        if m == "eth_call":
            total_reads += 1
            if len(p) < 2 or p[1] != "0x64":
                bad.append((m, p))
        elif m in ("eth_getCode", "eth_getStorageAt"):
            total_reads += 1
            block_param = p[-1] if p else None
            if block_param != "0x64":
                bad.append((m, p))
print(f"{total_reads}:{len(bad)}")
PY
)"
TOTAL_READS="${TAG_SUMMARY%%:*}"
BAD_TAGS="${TAG_SUMMARY##*:}"
if [[ "$TOTAL_READS" -gt 0 && "$BAD_TAGS" == "0" ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R1: all $TOTAL_READS eth_call/eth_getCode/eth_getStorageAt reads pinned to block 0x64"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R1: expected >0 pinned reads and 0 unpinned reads, got total=$TOTAL_READS bad=$BAD_TAGS" >&2
fi

reset_state "{\"holder\":\"$OTHER_HOLDER\"}"
assert_ok "R1: valid full --readback passes when INITIAL_HOLDER != OWNER_ADDRESS" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL" --initial-holder "$OTHER_HOLDER"

echo "=== R1: Negative read-back cases (must exit nonzero) ==="

reset_state "{\"registryOwner\":\"$WRONG_ADDR\",\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when RiskRegistry.owner() mismatches OWNER_ADDRESS" \
  "owner|mismatch" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"attesterAuthorized\":false,\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when RiskRegistry.attesters(ATTESTER_ADDRESS) is false" \
  "attester|not authorized|false" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"proxySlotWord\":\"0x000000000000000000000000${WRONG_ADDR#0x}\",\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when proxy ERC-1967 slot does not match UPGRADEABLE_IMPL_ADDRESS" \
  "implementation|slot|mismatch" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"emptyCodeTargets\":[\"$DECOY_ADDR\"],\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when target contract has empty runtime code" \
  "empty|bytecode|no code" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"failCall\":\"${BASELINE_ADDR,,}:${SEL_TOTAL_SUPPLY}\",\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when DemoBaselineToken.totalSupply() RPC call fails (old echo bug)" \
  "fail|error|rpc" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when INITIAL_HOLDER balance check disagrees with on-chain holder" \
  "balance" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL" --initial-holder "$OTHER_HOLDER"

reset_state "{\"paused\":true,\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails on initial readback when DemoMintPauseToken.paused() is true" \
  "paused" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"reorg_after\":3,\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails when block header hash changes mid-read (reorg)" \
  "block hash|reorg|changed|mismatch" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"chainId\":\"0x1\",\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: fails on wrong chain ID" \
  "43113|chain" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-local --skip-build --rpc-url "$RPC_URL"

echo "=== R1: Post-deploy state distinction & --readback-registry labeling ==="

reset_state "{\"paused\":true,\"baselineSupply\":\"2000000000000000000000000\",\"holder\":\"$OWNER_ADDR\"}"
assert_ok "R1: --readback --allow-post-deploy-state allows post-deploy balance/supply/pause drift when identity holds" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-post-deploy-state --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{\"attesterAuthorized\":false,\"paused\":true,\"holder\":\"$OWNER_ADDR\"}"
assert_fails_matching "R1: --readback --allow-post-deploy-state STILL fails on identity/attester violation" \
  "attester|false" \
  run_full_readback bash "$SCRIPT_UNDER_TEST" --readback --allow-post-deploy-state --allow-local --skip-build --rpc-url "$RPC_URL"

reset_state "{}"
REG_OUT="$(env -u BASELINE_TOKEN_ADDRESS -u MINT_PAUSE_TOKEN_ADDRESS -u UPGRADEABLE_IMPL_ADDRESS -u UPGRADEABLE_PROXY_ADDRESS -u DECOY_TOKEN_ADDRESS bash "$SCRIPT_UNDER_TEST" --readback-registry --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --registry "$REGISTRY_ADDR" 2>&1)" && REG_RC=0 || REG_RC=$?
if [[ "$REG_RC" -eq 0 ]] && grep -qi "registry-only" <<<"$REG_OUT" && grep -qi "not verified" <<<"$REG_OUT"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R1: --readback-registry passes and clearly warns demo tokens were not verified"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R1: --readback-registry missing expected registry-only warning or exited $REG_RC" >&2
  echo "$REG_OUT" | sed 's/^/  | /' >&2
fi

reset_state "{\"registryOwner\":\"$WRONG_ADDR\"}"
assert_fails_matching "R1: --readback-registry fails on wrong owner" \
  "owner|mismatch" \
  bash "$SCRIPT_UNDER_TEST" --readback-registry --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --registry "$REGISTRY_ADDR"

echo "=== R3: Signer forwarding (--account vs --keystore) & path resolution ==="

STUB_BIN="$TMP_DIR/stub-bin"
CALLER_CWD="$TMP_DIR/caller-cwd"
mkdir -p "$STUB_BIN" "$CALLER_CWD/rel-ks"
echo "{}" >"$CALLER_CWD/rel-ks/deployer.json"
STUB_ARGS_FILE="$TMP_DIR/forge-args.txt"
STUB_PWD_FILE="$TMP_DIR/forge-pwd.txt"

cat >"$STUB_BIN/forge" <<SH
#!/usr/bin/env bash
pwd >"$STUB_PWD_FILE"
printf '%s\n' "\$@" >"$STUB_ARGS_FILE"
exit 0
SH
cat >"$STUB_BIN/cast" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == "chain-id" ]]; then
  echo "43113"
  exit 0
fi
exit 1
SH
chmod +x "$STUB_BIN/forge" "$STUB_BIN/cast"

# 1. --account + --broadcast
: >"$STUB_ARGS_FILE"
assert_ok "R3: --account + --broadcast invokes forge script with --account" \
  env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT PATH="$STUB_BIN:$PATH" \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --account fuji-deployer --broadcast

if grep -qx -- "--account" "$STUB_ARGS_FILE" && grep -qx -- "fuji-deployer" "$STUB_ARGS_FILE" && ! grep -qx -- "--keystore" "$STUB_ARGS_FILE"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: stub forge received '--account fuji-deployer' without '--keystore'"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: unexpected forge args for --account mode:" >&2
  cat "$STUB_ARGS_FILE" | sed 's/^/  | /' >&2
fi

# 2. Relative --keystore resolved before cd packages/contracts
: >"$STUB_ARGS_FILE"
assert_ok "R3: relative --keystore path resolved before cd packages/contracts" \
  bash -c "cd '$CALLER_CWD' && PATH='$STUB_BIN:$PATH' env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT bash '$SCRIPT_UNDER_TEST' --allow-local --skip-build --rpc-url '$RPC_URL' --owner '$OWNER_ADDR' --attester '$ATTESTER_ADDR' --keystore './rel-ks/deployer.json' --broadcast"

EXPECTED_ABS_KS="$CALLER_CWD/rel-ks/deployer.json"
if grep -qx -- "$EXPECTED_ABS_KS" "$STUB_ARGS_FILE" && [[ "$(cat "$STUB_PWD_FILE")" == "$ROOT_DIR/packages/contracts" ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: stub forge ran in packages/contracts with resolved keystore path $EXPECTED_ABS_KS"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: expected resolved '$EXPECTED_ABS_KS' and cwd '$ROOT_DIR/packages/contracts'" >&2
  cat "$STUB_ARGS_FILE" | sed 's/^/  | /' >&2
fi

# 2b. Quoted ~/ path in --keystore resolves to $HOME/... (never $HOME/~/...)
FAKE_HOME="$TMP_DIR/fake-home"
mkdir -p "$FAKE_HOME/.foundry/keystores"
echo "{}" >"$FAKE_HOME/.foundry/keystores/fuji-deployer"
EXPECTED_TILDE_KS="$FAKE_HOME/.foundry/keystores/fuji-deployer"

: >"$STUB_ARGS_FILE"
assert_ok "R3: quoted ~/ path in --keystore expands relative to HOME" \
  env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT HOME="$FAKE_HOME" PATH="$STUB_BIN:$PATH" \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --keystore '~/.foundry/keystores/fuji-deployer' --broadcast

if grep -qx -- "$EXPECTED_TILDE_KS" "$STUB_ARGS_FILE" && ! grep -q '~' "$STUB_ARGS_FILE"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: stub forge received expanded HOME keystore path $EXPECTED_TILDE_KS"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: expected '$EXPECTED_TILDE_KS' in forge args, got:" >&2
  cat "$STUB_ARGS_FILE" | sed 's/^/  | /' >&2
fi

# 2c. ~/ path in FOUNDRY_KEYSTORE env var expands cleanly
: >"$STUB_ARGS_FILE"
assert_ok "R3: ~/ path in FOUNDRY_KEYSTORE env var expands relative to HOME" \
  env -u FOUNDRY_ACCOUNT HOME="$FAKE_HOME" PATH="$STUB_BIN:$PATH" FOUNDRY_KEYSTORE='~/.foundry/keystores/fuji-deployer' \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --broadcast

if grep -qx -- "$EXPECTED_TILDE_KS" "$STUB_ARGS_FILE" && ! grep -q '~' "$STUB_ARGS_FILE"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: FOUNDRY_KEYSTORE='~/...' forwarded expanded path $EXPECTED_TILDE_KS"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: expected '$EXPECTED_TILDE_KS' from FOUNDRY_KEYSTORE, got:" >&2
  cat "$STUB_ARGS_FILE" | sed 's/^/  | /' >&2
fi

# 2d. Missing ~/ keystore fails nonzero with clean HOME-expanded path (no $HOME/~/...)
set +e
MISSING_TILDE_OUT="$(
  env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT HOME="$FAKE_HOME" PATH="$STUB_BIN:$PATH" \
    bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --keystore '~/.foundry/keystores/missing.json' --broadcast 2>&1
)"
MISSING_TILDE_RC=$?
set -e
if [[ "$MISSING_TILDE_RC" -ne 0 ]] && grep -Fq "$FAKE_HOME/.foundry/keystores/missing.json" <<<"$MISSING_TILDE_OUT" && ! grep -Fq '/~/' <<<"$MISSING_TILDE_OUT"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: missing ~/ keystore fails nonzero with clean expanded HOME path"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: unexpected missing ~/ keystore result (rc=$MISSING_TILDE_RC): $MISSING_TILDE_OUT" >&2
fi

# 3. Conflict: both --account and --keystore rejected
assert_fails_matching "R3: rejects passing both --account and --keystore" \
  "both|--account.*--keystore|conflict" \
  env PATH="$STUB_BIN:$PATH" \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --account foo --keystore "$EXPECTED_ABS_KS" --broadcast

# 4. --broadcast without either --account or --keystore rejected
assert_fails_matching "R3: rejects --broadcast when neither --account nor --keystore is provided" \
  "--account|--keystore|required" \
  env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT PATH="$STUB_BIN:$PATH" \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR" --broadcast

# 5. Passing bare keystore name to --keystore fails clearly
assert_fails_matching "R3: rejects nonexistent bare name passed to --keystore" \
  "not found|--account" \
  env -u FOUNDRY_KEYSTORE -u FOUNDRY_ACCOUNT PATH="$STUB_BIN:$PATH" \
  bash -c "cd '$CALLER_CWD' && bash '$SCRIPT_UNDER_TEST' --allow-local --skip-build --rpc-url '$RPC_URL' --owner '$OWNER_ADDR' --attester '$ATTESTER_ADDR' --keystore 'fuji-deployer' --broadcast"

# 6. Default dry-run omits --broadcast, --account, and --keystore even if env vars set
: >"$STUB_ARGS_FILE"
assert_ok "R3: dry-run executes cleanly without --broadcast or signer args" \
  env PATH="$STUB_BIN:$PATH" FOUNDRY_ACCOUNT="fuji-deployer" FOUNDRY_KEYSTORE="" \
  bash "$SCRIPT_UNDER_TEST" --allow-local --skip-build --rpc-url "$RPC_URL" --owner "$OWNER_ADDR" --attester "$ATTESTER_ADDR"

if ! grep -qxE -- "--broadcast|--account|--keystore" "$STUB_ARGS_FILE"; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R3: dry-run did not forward --broadcast, --account, or --keystore"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R3: dry-run leaked signer or broadcast flag:" >&2
  cat "$STUB_ARGS_FILE" | sed 's/^/  | /' >&2
fi

echo "=== R4: Git executable mode 100755 & Linux clean-extract execution ==="

STAGE_LINE="$(git -C "$ROOT_DIR" ls-files --stage -- scripts/fuji-deploy.sh)"
if [[ "$STAGE_LINE" == 100755* ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R4: git ls-files --stage shows 100755 for scripts/fuji-deploy.sh"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R4: expected Git mode 100755 for scripts/fuji-deploy.sh, got: $STAGE_LINE" >&2
fi

TEST_STAGE_LINE="$(git -C "$ROOT_DIR" ls-files --stage -- scripts/test-fuji-deploy.sh)"
if [[ "$TEST_STAGE_LINE" == 100755* ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] R4: git ls-files --stage shows 100755 for scripts/test-fuji-deploy.sh"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] R4: expected Git mode 100755 for scripts/test-fuji-deploy.sh, got: $TEST_STAGE_LINE" >&2
fi

# Simulate clean Linux extraction using exact staged Git mode on native Linux /tmp
LINUX_EXTRACT="$TMP_DIR/clean-linux-extract"
mkdir -p "$LINUX_EXTRACT/scripts"
cp "$SCRIPT_UNDER_TEST" "$LINUX_EXTRACT/scripts/fuji-deploy.sh"
if [[ "$STAGE_LINE" == 100755* ]]; then
  chmod 0755 "$LINUX_EXTRACT/scripts/fuji-deploy.sh"
else
  chmod 0644 "$LINUX_EXTRACT/scripts/fuji-deploy.sh"
fi

assert_ok "R4: direct ./scripts/fuji-deploy.sh --help works with staged Linux mode" \
  bash -c "cd '$LINUX_EXTRACT' && ./scripts/fuji-deploy.sh --help"

assert_ok "R4: bash scripts/fuji-deploy.sh --help works" \
  bash -c "cd '$LINUX_EXTRACT' && bash scripts/fuji-deploy.sh --help"

echo "=== R5: Constructor argument encoding (owner == holder vs owner != holder) ==="

WEB_PKG_ARG="$WEB_PKG_PATH"
OUT_DIR_ARG="$ROOT_DIR/packages/contracts/out/DemoTokens.sol"
if [[ "$NODE_BIN" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
  WEB_PKG_ARG="$(wslpath -w "$WEB_PKG_PATH")"
  OUT_DIR_ARG="$(wslpath -w "$OUT_DIR_ARG")"
fi

for CASE_HOLDER in "$OWNER_ADDR" "$OTHER_HOLDER"; do
  BASE_ENC="$("$CAST_BIN" abi-encode "constructor(string,string,address,uint256)" "AvaGuard Demo Baseline" "AGBASE" "$CASE_HOLDER" "1000000000000000000000000")"
  MP_ENC="$("$CAST_BIN" abi-encode "constructor(string,string,address,address,uint256)" "AvaGuard Demo MintPause" "AGMP" "$OWNER_ADDR" "$CASE_HOLDER" "1000000000000000000000000")"
  PROXY_INIT_DATA="$("$CAST_BIN" calldata "initialize(string,string,address,address,uint256)" "AvaGuard Demo Upgradeable" "AGUP" "$OWNER_ADDR" "$CASE_HOLDER" "1000000000000000000000000")"
  PROXY_ENC="$("$CAST_BIN" abi-encode "constructor(address,bytes)" "$IMPL_ADDR" "$PROXY_INIT_DATA")"

  VERIFY_ENC="$("$NODE_BIN" -e "
    const { readFileSync } = require('node:fs');
    const { createRequire } = require('node:module');
    const path = require('node:path');
    const req = createRequire(process.argv[1]);
    const { decodeAbiParameters, decodeFunctionData } = req('viem');
    const [outDir, baseHex, mpHex, proxyHex, implAddr, ownerAddr, holderAddr] = process.argv.slice(2);
    const loadAbi = (name) => JSON.parse(readFileSync(path.join(outDir, name + '.json'), 'utf8')).abi;
    const ctorInputs = (abi) => abi.find((x) => x.type === 'constructor').inputs;

    const [bName, bSym, bHolder, bSupply] = decodeAbiParameters(ctorInputs(loadAbi('DemoBaselineToken')), baseHex);
    if (bName !== 'AvaGuard Demo Baseline' || bSym !== 'AGBASE' || bHolder.toLowerCase() !== holderAddr.toLowerCase() || bSupply !== 1000000000000000000000000n) {
      throw new Error('Baseline args mismatch: ' + JSON.stringify([bName, bSym, bHolder, bSupply.toString()]));
    }
    const [mName, mSym, mOwner, mHolder, mSupply] = decodeAbiParameters(ctorInputs(loadAbi('DemoMintPauseToken')), mpHex);
    if (mName !== 'AvaGuard Demo MintPause' || mSym !== 'AGMP' || mOwner.toLowerCase() !== ownerAddr.toLowerCase() || mHolder.toLowerCase() !== holderAddr.toLowerCase() || mSupply !== 1000000000000000000000000n) {
      throw new Error('MintPause args mismatch');
    }
    const [pImpl, pInitData] = decodeAbiParameters(ctorInputs(loadAbi('DemoTokenProxy')), proxyHex);
    if (pImpl.toLowerCase() !== implAddr.toLowerCase()) throw new Error('Proxy impl mismatch');
    const decoded = decodeFunctionData({ abi: loadAbi('DemoUpgradeableToken'), data: pInitData });
    if (decoded.functionName !== 'initialize' || decoded.args[2].toLowerCase() !== ownerAddr.toLowerCase() || decoded.args[3].toLowerCase() !== holderAddr.toLowerCase() || decoded.args[4] !== 1000000000000000000000000n) {
      throw new Error('Proxy initialize args mismatch');
    }
    console.log('OK');
  " "$WEB_PKG_ARG" "$OUT_DIR_ARG" "$BASE_ENC" "$MP_ENC" "$PROXY_ENC" "$IMPL_ADDR" "$OWNER_ADDR" "$CASE_HOLDER" 2>&1)" || true

  if [[ "$VERIFY_ENC" == *"OK"* ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "[PASS] R5: encoded constructor args match compiled ABIs for holder=$CASE_HOLDER (owner=$OWNER_ADDR)"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[FAIL] R5: encoded constructor args verification failed for holder=$CASE_HOLDER: $VERIFY_ENC" >&2
  fi
done

echo ""
echo "Summary: passed=$PASS_COUNT failed=$FAIL_COUNT"
[[ "$FAIL_COUNT" -eq 0 ]]
