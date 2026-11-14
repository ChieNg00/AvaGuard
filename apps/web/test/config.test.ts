import { parseReportBody } from "@avaguard/analyzer";
import { keccak256, zeroAddress, type Address, type Hex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import vector from "../../../fixtures/canonical-report-v1.json";
import { lookup, scan, walletContext } from "../app/actions";
import { publication } from "../lib/publication";
import {
  checkPublicationOrigin,
  networkLabelForMode,
} from "../lib/publication-config";
import {
  verifySubmissionReceipt,
  type ReceiptReader,
  type Submission,
} from "../lib/receipt";
import { getServerConfig } from "../lib/server-config";

const SAMPLE_REGISTRY = "0x1111111111111111111111111111111111111111" as Address;
const SAMPLE_ATTESTER = "0x2222222222222222222222222222222222222222" as Address;
const TX_HASH = ("0x" + "b".repeat(64)) as Hex;

const ORIGINAL_ENV = {
  AVAGUARD_ENV: process.env.AVAGUARD_ENV,
  FUJI_RPC_URL: process.env.FUJI_RPC_URL,
  REGISTRY_ADDRESS: process.env.REGISTRY_ADDRESS,
  AVAGUARD_APP_ORIGIN: process.env.AVAGUARD_APP_ORIGIN,
};

function setEnv(values: Partial<typeof ORIGINAL_ENV>) {
  for (const [key, val] of Object.entries(values)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

afterEach(() => {
  setEnv(ORIGINAL_ENV);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("../lib/registry-abi");
  vi.resetModules();
});

describe("server configuration and publication modes", () => {
  it("disables publication cleanly while keeping read-only scanning when AVAGUARD_ENV is unset", () => {
    setEnv({
      AVAGUARD_ENV: undefined,
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: undefined,
      AVAGUARD_APP_ORIGIN: undefined,
    });

    const config = getServerConfig();
    expect(config.mode).toBe("invalid");
    expect(config.rpc.ok).toBe(true);
    expect(config.publication.enabled).toBe(false);
    if (!config.publication.enabled) {
      expect(config.publication.reason).toContain("AVAGUARD_ENV");
    }
    expect(config.headerPill).toBe("Fuji reader · 43113 (read-only)");
  });

  it("rejects invalid AVAGUARD_ENV values without failing read-only RPC parsing", () => {
    setEnv({
      AVAGUARD_ENV: "staging",
      FUJI_RPC_URL: "http://127.0.0.1:8545",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });

    const config = getServerConfig();
    expect(config.mode).toBe("invalid");
    expect(config.rpc.ok).toBe(true);
    expect(config.publication.enabled).toBe(false);
    if (!config.publication.enabled) {
      expect(config.publication.reason).toContain("staging");
    }
  });

  it("enforces loopback RPC in local mode and non-loopback https RPC in fuji mode", () => {
    setEnv({
      AVAGUARD_ENV: "local",
      FUJI_RPC_URL: "http://127.0.0.1:8545",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });
    const localOk = getServerConfig();
    expect(localOk.publication).toEqual({
      enabled: true,
      mode: "local",
      chainId: 43113,
      networkLabel: "local Anvil (43113)",
      allowedOrigin: null,
    });

    setEnv({
      AVAGUARD_ENV: "local",
      FUJI_RPC_URL: "https://api.avax-test.network/ext/bc/C/rpc",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });
    const localHttps = getServerConfig();
    expect(localHttps.rpc.ok).toBe(false);
    expect(localHttps.publication.enabled).toBe(false);

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "http://127.0.0.1:8545",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });
    const fujiLoopback = getServerConfig();
    expect(fujiLoopback.rpc.ok).toBe(false);
    expect(fujiLoopback.publication.enabled).toBe(false);

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://localhost:8545",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });
    expect(getServerConfig().rpc.ok).toBe(false);

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://user:pass@fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });
    expect(getServerConfig().rpc.ok).toBe(false);

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: "not-an-address",
    });
    const fujiBadReg = getServerConfig();
    expect(fujiBadReg.registry.ok).toBe(false);
    expect(fujiBadReg.publication.enabled).toBe(false);

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
      AVAGUARD_APP_ORIGIN: "https://avaguard.example.com",
    });
    const fujiOk = getServerConfig();
    expect(fujiOk.publication).toEqual({
      enabled: true,
      mode: "fuji",
      chainId: 43113,
      networkLabel: "Avalanche Fuji (43113)",
      allowedOrigin: "https://avaguard.example.com",
    });
    expect(fujiOk.headerPill).toBe("Avalanche Fuji · 43113");
  });

  it("rejects invalid or non-HTTPS AVAGUARD_APP_ORIGIN except loopback and .test", () => {
    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
      AVAGUARD_APP_ORIGIN: "http://avaguard.example.com",
    });
    expect(getServerConfig().publication.enabled).toBe(false);

    setEnv({
      AVAGUARD_APP_ORIGIN: "https://avaguard.example.com/with-path",
    });
    expect(getServerConfig().publication.enabled).toBe(false);

    setEnv({
      AVAGUARD_APP_ORIGIN: "http://avaguard-fuji.test:31847",
    });
    const testOrigin = getServerConfig();
    expect(testOrigin.publication.enabled).toBe(true);
    if (testOrigin.publication.enabled) {
      expect(testOrigin.publication.allowedOrigin).toBe(
        "http://avaguard-fuji.test:31847",
      );
    }
  });

  it("enforces origin rules per mode in checkPublicationOrigin", () => {
    const localCfg = {
      enabled: true as const,
      mode: "local" as const,
      chainId: 43113 as const,
      networkLabel: networkLabelForMode("local"),
      allowedOrigin: null,
    };
    expect(
      checkPublicationOrigin(localCfg, {
        protocol: "http:",
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:3000",
      }),
    ).toEqual({ ok: true });
    expect(
      checkPublicationOrigin(localCfg, {
        protocol: "https:",
        hostname: "avaguard.example.com",
        origin: "https://avaguard.example.com",
      }).ok,
    ).toBe(false);

    const fujiWithOrigin = {
      enabled: true as const,
      mode: "fuji" as const,
      chainId: 43113 as const,
      networkLabel: networkLabelForMode("fuji"),
      allowedOrigin: "https://avaguard.example.com",
    };
    expect(
      checkPublicationOrigin(fujiWithOrigin, {
        protocol: "https:",
        hostname: "avaguard.example.com",
        origin: "https://avaguard.example.com",
      }),
    ).toEqual({ ok: true });
    expect(
      checkPublicationOrigin(fujiWithOrigin, {
        protocol: "http:",
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:3000",
      }).ok,
    ).toBe(false);

    const fujiHttpsOnly = {
      enabled: true as const,
      mode: "fuji" as const,
      chainId: 43113 as const,
      networkLabel: networkLabelForMode("fuji"),
      allowedOrigin: null,
    };
    expect(
      checkPublicationOrigin(fujiHttpsOnly, {
        protocol: "http:",
        hostname: "avaguard.example.com",
        origin: "http://avaguard.example.com",
      }).ok,
    ).toBe(false);
    expect(
      checkPublicationOrigin(fujiHttpsOnly, {
        protocol: "https:",
        hostname: "avaguard.example.com",
        origin: "https://avaguard.example.com",
      }),
    ).toEqual({ ok: true });
  });

  it("keeps network labels and mode checks aligned during receipt recovery", async () => {
    const body = parseReportBody(vector);
    const tuple = publication(body);
    const runtimeCode: Hex = "0x6001600055";
    const runtimeHash = keccak256(runtimeCode);
    const submission: Submission = {
      hash: TX_HASH,
      registry: SAMPLE_REGISTRY,
      registryCodehash: runtimeHash,
      attester: SAMPLE_ATTESTER,
      target: tuple.target,
      reportHash: tuple.reportHash,
      blockNumber: body.blockNumber,
      blockHash: tuple.blockHash,
      status: "pending",
      mode: "fuji",
      networkLabel: "Avalanche Fuji (43113)",
    };

    const reader: ReceiptReader = {
      getChainId: async () => 43113,
      getBlockNumber: async () => BigInt(body.blockNumber + 5),
      getBlock: async () => ({ hash: tuple.blockHash }),
      getCode: async () => runtimeCode,
      getTransaction: async () => ({
        hash: TX_HASH,
        from: SAMPLE_ATTESTER,
        nonce: 0,
        blockNumber: null,
      }),
      getTransactionReceipt: async () => {
        throw new Error("should not fetch receipt on mode mismatch");
      },
      waitForTransactionReceipt: async () => {
        throw new Error("should not wait on mode mismatch");
      },
    };

    const mismatch = await verifySubmissionReceipt({
      reader,
      checkContext: async () => ({
        ok: true,
        data: { address: SAMPLE_REGISTRY, codehash: runtimeHash, mode: "local" },
      }),
      submission,
      wait: false,
      getChainRevision: () => 0,
    });
    expect(mismatch.status).toBe("mismatch");
    if (mismatch.status === "mismatch") {
      expect(mismatch.message).toContain("Avalanche Fuji (43113)");
      expect(mismatch.message).toContain("Publication environment changed");
    }
  });
});

describe("server actions with fuji and unconfigured modes", () => {
  it("supports fuji walletContext without web3_clientVersion and enforces chainId and runtime hash", async () => {
    const body = parseReportBody(vector);
    const matchingCode: Hex = "0x6001600055";
    const matchingHash = keccak256(matchingCode);
    const methods: string[] = [];

    let chainIdHex = "0xa869";
    let codeHex: Hex = matchingCode;

    vi.stubGlobal("fetch", async (_url: unknown, init?: { body?: string }) => {
      const payload = JSON.parse(init?.body ?? "{}") as {
        id: number;
        method: string;
      };
      methods.push(payload.method);
      let result: unknown = null;
      if (payload.method === "eth_chainId") {
        result = chainIdHex;
      } else if (payload.method === "eth_getCode") {
        result = codeHex;
      } else if (payload.method === "eth_getBlockByNumber") {
        result = {
          number: "0x" + BigInt(body.blockNumber).toString(16),
          hash: body.blockHash,
          timestamp: "0x66000000",
          parentHash: zeroAddress + "0".repeat(24),
        };
      }
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    setEnv({
      AVAGUARD_ENV: "fuji",
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: SAMPLE_REGISTRY,
    });

    // Wrong chain and runtime hash fail closed against real actions.
    chainIdHex = "0x1";
    const wrongChain = await walletContext(
      String(body.blockNumber),
      body.blockHash,
    );
    expect(wrongChain).toEqual({
      ok: false,
      error: "Reader is on the wrong network.",
    });

    chainIdHex = "0xa869";
    codeHex = matchingCode;
    const wrongCode = await walletContext(
      String(body.blockNumber),
      body.blockHash,
    );
    expect(wrongCode).toEqual({
      ok: false,
      error: "Configured registry runtime mismatch.",
    });

    // When on-chain bytecode matches pinned runtime hash, fuji context succeeds without web3_clientVersion.
    methods.length = 0;
    vi.resetModules();
    vi.doMock("../lib/registry-abi", async () => {
      const actual = await vi.importActual<typeof import("../lib/registry-abi")>(
        "../lib/registry-abi",
      );
      return {
        ...actual,
        registryRuntimeHash: matchingHash,
      };
    });
    const mockedActions = await import("../app/actions");
    const ctx = await mockedActions.walletContext(
      String(body.blockNumber),
      body.blockHash,
    );
    expect(ctx).toEqual({
      ok: true,
      data: {
        address: SAMPLE_REGISTRY,
        codehash: matchingHash,
        mode: "fuji",
      },
    });
    expect(methods).not.toContain("web3_clientVersion");
  });

  it("allows read-only scanning when registry and AVAGUARD_ENV are unconfigured while blocking lookup", async () => {
    vi.stubGlobal("fetch", async (_url: unknown, init?: { body?: string }) => {
      const payload = JSON.parse(init?.body ?? "{}") as {
        id: number;
        method: string;
      };
      let result: unknown = null;
      if (payload.method === "eth_chainId") {
        result = "0xa869";
      } else if (payload.method === "eth_getBlockByNumber") {
        result = {
          number: "0x10",
          hash: ("0x" + "1".repeat(64)) as Hex,
          timestamp: "0x66000000",
        };
      } else if (payload.method === "eth_getCode") {
        result = "0x";
      }
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    setEnv({
      AVAGUARD_ENV: undefined,
      FUJI_RPC_URL: "https://fuji-rpc.test/ext/bc/C/rpc",
      REGISTRY_ADDRESS: undefined,
    });

    const scanRes = await scan(SAMPLE_REGISTRY);
    expect(scanRes.ok).toBe(true);
    if (scanRes.ok) {
      expect(scanRes.data.status).toBe("not-analyzable");
      expect(scanRes.data.publication.enabled).toBe(false);
    }

    const lookupRes = await lookup(SAMPLE_REGISTRY);
    expect(lookupRes).toEqual({
      ok: false,
      error: "Registry is unconfigured.",
    });
  });
});
