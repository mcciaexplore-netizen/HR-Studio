const { isAbsolute, resolve, relative, sep } = require("node:path");

// Validate before opening the database. The hosting provider must mount the disk.
function prepareHostedEnvironment(env) {
  if (!env.DATABASE_PATH || !isAbsolute(env.DATABASE_PATH))
    throw new Error(
      "DATABASE_PATH must be an absolute file path on a persistent disk.",
    );
  const databasePath = resolve(env.DATABASE_PATH);
  for (const publicRoot of ["public", "dist/public"]) {
    const child = relative(resolve(publicRoot), databasePath);
    const outside =
      child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child);
    if (!outside)
      throw new Error(
        "DATABASE_PATH must be outside the public asset directories.",
      );
  }
  let url;
  try {
    url = new URL(env.APP_URL || env.RENDER_EXTERNAL_URL);
  } catch {
    throw new Error(
      "Set APP_URL to the public HTTPS origin (Render supplies RENDER_EXTERNAL_URL automatically).",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "APP_URL must be an HTTPS origin with no credentials, path, query or fragment.",
    );
  if (env.COOKIE_SECURE && env.COOKIE_SECURE !== "true")
    throw new Error("Hosted startup requires COOKIE_SECURE=true.");
  for (const key of [
    "REGISTRATION_OPEN",
    "DEMO_LOGIN_ENABLED",
    "DEMO_BOOTSTRAP",
  ])
    if (env[key] && !["true", "false"].includes(env[key]))
      throw new Error(`${key} must be true or false.`);
  if (env.DEMO_BOOTSTRAP === "true" && env.DEMO_LOGIN_ENABLED !== "true")
    throw new Error("DEMO_BOOTSTRAP requires DEMO_LOGIN_ENABLED=true.");
  return {
    DATABASE_PATH: databasePath,
    APP_URL: url.origin,
    HOST: env.HOST || "0.0.0.0",
    NODE_ENV: "production",
    COOKIE_SECURE: "true",
    REGISTRATION_OPEN: env.REGISTRATION_OPEN || "false",
    DEMO_LOGIN_ENABLED: env.DEMO_LOGIN_ENABLED || "false",
    DEMO_BOOTSTRAP: env.DEMO_BOOTSTRAP || "false",
  };
}

async function start() {
  require("dotenv").config({ path: [".env.local", ".env"], quiet: true });
  Object.assign(process.env, prepareHostedEnvironment(process.env));
  if (process.env.DEMO_BOOTSTRAP === "true") {
    const { provisionHostedDemo } = require("../dist/hosted-demo.cjs");
    const result = await provisionHostedDemo(process.env.DATABASE_PATH);
    console.log(`Hosted demo: ${result}.`);
  }
  require("./start.cjs");
}

module.exports = { prepareHostedEnvironment };
if (require.main === module)
  start().catch((error) => {
    console.error(`Hosted startup failed: ${error.message}`);
    process.exitCode = 1;
  });
