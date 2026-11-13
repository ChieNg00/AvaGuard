import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "packages/analyzer/test/anvil.integration.test.ts",
    "-t",
    "publishes an analyzer snapshot",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, AVAGUARD_BROWSER: "1" },
  },
);
process.exitCode = result.status ?? 1;
