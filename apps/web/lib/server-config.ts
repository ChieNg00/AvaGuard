import { addressSchema } from "@avaguard/analyzer";
import { getAddress, type Address } from "viem";
import {
  isLoopbackHostname,
  networkLabelForMode,
  type AvaguardMode,
  type PublicPublicationConfig,
} from "./publication-config";

export type ServerConfig = {
  mode: AvaguardMode | "invalid";
  rpc: { ok: true; url: URL } | { ok: false; error: string };
  registry: { ok: true; address: Address } | { ok: false; error: string };
  publication: PublicPublicationConfig;
  headerPill: string;
};

function parseRpcUrl(
  raw: string,
  mode: AvaguardMode | "invalid",
): { ok: true; url: URL } | { ok: false; error: string } {
  if (!raw) {
    return { ok: false, error: "Read RPC is unconfigured." };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Read RPC URL is invalid." };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      error: "Read RPC URL must not embed basic-auth credentials.",
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Read RPC URL must use http or https." };
  }
  if (
    mode === "local" &&
    (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
  ) {
    return {
      ok: false,
      error: "Local mode requires a loopback http://127.0.0.1 RPC URL.",
    };
  }
  if (
    mode === "fuji" &&
    (url.protocol !== "https:" || isLoopbackHostname(url.hostname))
  ) {
    return {
      ok: false,
      error: "Fuji mode requires a non-loopback https:// RPC URL.",
    };
  }
  return { ok: true, url };
}

function parseRegistryAddress(
  raw: string,
): { ok: true; address: Address } | { ok: false; error: string } {
  if (!raw) {
    return { ok: false, error: "Registry is unconfigured." };
  }
  const parsed = addressSchema.safeParse(raw.toLowerCase());
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Configured REGISTRY_ADDRESS must be a 0x-prefixed address with 40 hexadecimal characters.",
    };
  }
  return { ok: true, address: getAddress(parsed.data) };
}

function parseAllowedOrigin(
  raw: string,
): { ok: true; origin: string | null } | { ok: false; error: string } {
  if (!raw) {
    return { ok: true, origin: null };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Configured AVAGUARD_APP_ORIGIN is invalid." };
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    return {
      ok: false,
      error:
        "AVAGUARD_APP_ORIGIN must be a bare origin without path, query, or credentials.",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      error: "AVAGUARD_APP_ORIGIN must use https:// or http://.",
    };
  }
  if (
    url.protocol === "http:" &&
    !isLoopbackHostname(url.hostname) &&
    !url.hostname.toLowerCase().endsWith(".test")
  ) {
    return {
      ok: false,
      error: "AVAGUARD_APP_ORIGIN must use https:// for non-local origins.",
    };
  }
  return { ok: true, origin: url.origin };
}

export function getServerConfig(): ServerConfig {
  const rawMode = process.env.AVAGUARD_ENV?.trim() ?? "";
  const mode: AvaguardMode | "invalid" =
    rawMode === "local" || rawMode === "fuji" ? rawMode : "invalid";
  const modeError =
    rawMode === ""
      ? 'Publication disabled: AVAGUARD_ENV must be set to "local" or "fuji".'
      : `Publication disabled: invalid AVAGUARD_ENV "${rawMode}". Expected "local" or "fuji".`;

  const rpc = parseRpcUrl(process.env.FUJI_RPC_URL?.trim() ?? "", mode);
  const registry = parseRegistryAddress(
    process.env.REGISTRY_ADDRESS?.trim() ?? "",
  );
  const origin =
    mode === "fuji"
      ? parseAllowedOrigin(process.env.AVAGUARD_APP_ORIGIN?.trim() ?? "")
      : ({ ok: true, origin: null } as const);

  let publication: PublicPublicationConfig;
  if (mode === "invalid") {
    publication = {
      enabled: false,
      mode: "unconfigured",
      chainId: 43113,
      networkLabel: networkLabelForMode("unconfigured"),
      allowedOrigin: null,
      reason: modeError,
    };
  } else if (!rpc.ok) {
    publication = {
      enabled: false,
      mode,
      chainId: 43113,
      networkLabel: networkLabelForMode(mode),
      allowedOrigin: null,
      reason: `Publication disabled: ${rpc.error}`,
    };
  } else if (!registry.ok) {
    publication = {
      enabled: false,
      mode,
      chainId: 43113,
      networkLabel: networkLabelForMode(mode),
      allowedOrigin: null,
      reason: `Publication disabled: ${registry.error}`,
    };
  } else if (!origin.ok) {
    publication = {
      enabled: false,
      mode,
      chainId: 43113,
      networkLabel: networkLabelForMode(mode),
      allowedOrigin: null,
      reason: `Publication disabled: ${origin.error}`,
    };
  } else {
    publication = {
      enabled: true,
      mode,
      chainId: 43113,
      networkLabel: networkLabelForMode(mode),
      allowedOrigin: origin.origin,
    };
  }

  let headerPill: string;
  if (mode === "local") {
    headerPill = publication.enabled
      ? "Local Anvil · 43113"
      : "Local Anvil · 43113 (read-only)";
  } else if (mode === "fuji") {
    headerPill = publication.enabled
      ? "Avalanche Fuji · 43113"
      : "Fuji reader · 43113 (read-only)";
  } else {
    headerPill = "Fuji reader · 43113 (read-only)";
  }

  return {
    mode,
    rpc,
    registry,
    publication,
    headerPill,
  };
}
