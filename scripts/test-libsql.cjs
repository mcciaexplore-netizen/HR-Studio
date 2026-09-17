const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const { join } = require("node:path");

const tests = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => join("tests", name));
const result = spawnSync(
  process.execPath,
  [
    "--expose-gc",
    "--import",
    "tsx",
    "--test",
    "--test-timeout=30000",
    ...tests,
  ],
  {
    env: { ...process.env, SQLITE_DRIVER: "libsql" },
    stdio: "inherit",
    windowsHide: true,
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
