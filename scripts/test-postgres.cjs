const { spawnSync } = require("node:child_process");
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-timeout=120000",
    "tests/api.test.ts",
    "tests/suite.test.ts",
    "tests/vercel.test.ts",
    "tests/postgres.test.ts",
  ],
  {
    env: { ...process.env, HRSTUDIO_TEST_DATABASE: "postgres" },
    stdio: "inherit",
    windowsHide: true,
  },
);
process.exitCode = result.status ?? 1;
