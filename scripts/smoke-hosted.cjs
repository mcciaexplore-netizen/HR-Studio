const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { join, resolve, dirname, basename } = require("node:path");
const { tmpdir } = require("node:os");
const assert = require("node:assert/strict");

(async () => {
  const directory = mkdtempSync(join(tmpdir(), "hrstudio-hosted-smoke-"));
  const port = Number(process.env.HOSTED_SMOKE_PORT || 3110);
  const base = `http://127.0.0.1:${port}`;
  // Simulates TLS termination at the host: backend transport is HTTP,
  // browser Origin is HTTPS and the response cookie must still be Secure.
  const origin = "https://hr-smoke.example.test";
  let child,
    output = "",
    cookie = "";
  async function start() {
    output = "";
    child = spawn(process.execPath, ["scripts/start-hosted.cjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: "",
        DATABASE_URL_UNPOOLED: "",
        SUPABASE_DB_URL: "",
        DATABASE_PATH: join(directory, "qa.sqlite"),
        PORT: String(port),
        HOST: "127.0.0.1",
        APP_URL: origin,
        COOKIE_SECURE: "true",
        REGISTRATION_OPEN: "false",
        DEMO_LOGIN_ENABLED: "true",
        DEMO_BOOTSTRAP: "true",
        SMTP_HOST: "",
        GEMINI_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    await new Promise((ready, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Startup timed out: ${output}`)),
        20000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("HR Studio:")) {
          clearTimeout(timeout);
          ready();
        }
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
    });
  }
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((done) => child.once("exit", done));
      child.kill();
      await exited;
    }
  }
  async function request(
    path,
    method = "GET",
    body,
    status = 200,
    requestOrigin = origin,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-HRStudio-Request": "1",
        Origin: requestOrigin,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${path}: ${text.slice(0, 300)}`);
    if (response.headers.has("set-cookie")) {
      const session = response.headers.get("set-cookie");
      assert.match(session, /; Secure/i);
      assert.match(session, /; HttpOnly/i);
      cookie = session.split(";")[0];
    }
    return text;
  }
  try {
    await start();
    assert.match(output, /created fictional workspace/);
    assert.match(await request("/"), /\/assets\//);
    assert.equal(JSON.parse(await request("/api/health")).status, "ok");
    const options = JSON.parse(await request("/api/auth/options"));
    assert.equal(options.registrationOpen, false);
    assert.deepEqual(options.demoRoles.sort(), ["employee", "hr", "owner"]);
    await request("/api/auth/register", "POST", {}, 403);
    await request(
      "/api/auth/demo",
      "POST",
      { role: "owner" },
      403,
      "https://other.example.test",
    );
    for (const role of ["employee", "hr", "owner"]) {
      const login = JSON.parse(
        await request("/api/auth/demo", "POST", { role }),
      );
      assert.equal(login.user.accessRole, role);
      const state = JSON.parse(await request("/api/state"));
      assert.equal(state.employees.length, role === "employee" ? 1 : 8);
    }
    const asset = JSON.parse(
      await request(
        "/api/records/assets",
        "POST",
        {
          name: "Restart persistence check",
          serialNumber: "SMOKE-RESTART-001",
          category: "Other",
          status: "Available",
          purchaseDate: "2026-01-01",
        },
        201,
      ),
    );
    await request("/dist/server.cjs", "GET", undefined, 404);
    await request("/hosted-demo.cjs", "GET", undefined, 404);
    await request("/var/data/hrstudio.sqlite", "GET", undefined, 404);
    await stop();
    await start();
    assert.match(output, /already provisioned/);
    // Reuse the pre-restart session: sessions and records share the durable DB.
    const state = JSON.parse(await request("/api/state"));
    assert.equal(state.assets.find((a) => a.id === asset.id)?.name, asset.name);
    assert.equal(state.employees.length, 8);
    console.log(
      "Hosted smoke passed: HTTPS origin, secure sessions, closed registration, all demo roles, private files, saved record and session after restart.",
    );
  } finally {
    await stop();
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("hrstudio-hosted-smoke-"));
    rmSync(target, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
