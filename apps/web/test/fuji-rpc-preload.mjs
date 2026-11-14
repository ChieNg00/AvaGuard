// Test-only Node preload used by apps/web/test/browser.mjs to route the
// synthetic non-loopback HTTPS URL https://fuji-rpc.test/ext/bc/C/rpc to the
// local Anvil proxy while keeping production server-config validation strict.
const TEST_FUJI_RPC = "https://fuji-rpc.test/ext/bc/C/rpc";
const localRpc = process.env.AVAGUARD_TEST_LOCAL_RPC;

if (localRpc) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === TEST_FUJI_RPC) {
      if (input instanceof Request) {
        const body = await input.clone().text();
        return originalFetch(localRpc, {
          method: input.method,
          headers: input.headers,
          body: body || undefined,
        });
      }
      return originalFetch(localRpc, init);
    }
    return originalFetch(input, init);
  };
}
