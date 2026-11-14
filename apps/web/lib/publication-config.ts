export type AvaguardMode = "local" | "fuji";

export type PublicPublicationConfig =
  | {
      enabled: true;
      mode: AvaguardMode;
      chainId: 43113;
      networkLabel: string;
      allowedOrigin: string | null;
    }
  | {
      enabled: false;
      mode: AvaguardMode | "unconfigured";
      chainId: 43113;
      networkLabel: string;
      allowedOrigin: null;
      reason: string;
    };

const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

export function networkLabelForMode(mode: AvaguardMode | "unconfigured"): string {
  if (mode === "local") return "local Anvil (43113)";
  return "Avalanche Fuji (43113)";
}

export function checkPublicationOrigin(
  config: PublicPublicationConfig,
  location: { protocol: string; hostname: string; origin: string },
): { ok: true } | { ok: false; error: string } {
  if (!config.enabled) {
    return { ok: false, error: config.reason };
  }

  if (config.mode === "local") {
    if (
      !isLoopbackHostname(location.hostname) ||
      (location.protocol !== "http:" && location.protocol !== "https:")
    ) {
      return {
        ok: false,
        error: "Open AvaGuard on loopback for local Anvil publication.",
      };
    }
    return { ok: true };
  }

  if (config.allowedOrigin) {
    if (location.origin !== config.allowedOrigin) {
      return {
        ok: false,
        error: `Fuji publication is restricted to the configured origin (${config.allowedOrigin}).`,
      };
    }
    return { ok: true };
  }

  if (
    location.protocol !== "https:" &&
    !isLoopbackHostname(location.hostname)
  ) {
    return {
      ok: false,
      error:
        "Fuji publication requires HTTPS (or loopback for local testing) unless AVAGUARD_APP_ORIGIN is configured.",
    };
  }
  return { ok: true };
}
