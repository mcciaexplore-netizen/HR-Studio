const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { join, resolve, dirname, basename } = require("node:path");
const { tmpdir } = require("node:os");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

// This check owns only its temporary database and child process, never the user's records.
(async () => {
  const directory = mkdtempSync(join(tmpdir(), "hrstudio-smoke-"));
  const port = Number(process.env.SMOKE_PORT || 3109),
    base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["scripts/start.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      SUPABASE_DB_URL: "",
      DATABASE_PATH: join(directory, "qa.sqlite"),
      PORT: String(port),
      HOST: "127.0.0.1",
      APP_URL: base,
      COOKIE_SECURE: "false",
      REGISTRATION_OPEN: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "",
    cookie = "";
  try {
    await new Promise((resolveReady, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server startup timed out: ${output}`)),
        15000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("HR Studio:")) {
          clearTimeout(timeout);
          resolveReady();
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
    async function request(path, method = "GET", body, status = 200) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-HRStudio-Request": "1",
          Cookie: cookie,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.has("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.status,
        status,
        `${path}: ${buffer.toString().slice(0, 300)}`,
      );
      return { buffer, response, json: () => JSON.parse(buffer.toString()) };
    }
    const page = await request("/");
    assert.match(
      page.response.headers.get("content-security-policy"),
      /script-src 'self'/,
    );
    assert.match(page.buffer.toString(), /\/assets\//);
    await request("/api/health");
    await request("/api/state", "GET", undefined, 401);
    await request(
      "/api/auth/register",
      "POST",
      {
        slug: "production-qa",
        companyName: "Temporary QA Company",
        name: "QA Owner",
        email: "qa@example.test",
        password: "Temporary test password 2026",
      },
      201,
    );
    const state = (await request("/api/suite")).json();
    assert.equal(state.settings.defaultLanguage, "en");
    const template = await request("/api/suite/export/template");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template.buffer);
    workbook.worksheets[0].addRow([
      "QA Employee",
      "employee@example.test",
      "Associate",
      "Operations",
      "9990001111",
      "2026-01-01",
      "Active",
      20000,
      8000,
      1000,
      0,
      "",
      "Permanent",
      "",
      "",
      "Monthly",
      0,
      "",
      "",
    ]);
    const preview = (
      await request(
        "/api/suite/imports/preview",
        "POST",
        {
          name: "qa.xlsx",
          contentBase64: Buffer.from(
            await workbook.xlsx.writeBuffer(),
          ).toString("base64"),
        },
        201,
      )
    ).json();
    assert.equal(preview.valid, true);
    await request(`/api/suite/imports/${preview.id}/commit`, "POST", {
      version: preview.version,
    });
    assert.equal((await request("/api/state")).json().employees.length, 1);
    await request("/api/suite/payroll", "POST", { month: "2026-08" }, 201);
    const exported = await request("/api/suite/export/employees");
    assert.match(
      exported.response.headers.get("content-type"),
      /spreadsheetml/,
    );
    const report = new ExcelJS.Workbook();
    await report.xlsx.load(exported.buffer);
    assert.equal(report.worksheets[0].getCell("A2").value, "QA Employee");
    await request("/dist/server.cjs", "GET", undefined, 404);
    await request("/excel-worker.cjs", "GET", undefined, 404);
    console.log(
      "Production smoke passed: static assets, authentication, suite routes, Excel worker/import/export, payroll creation and private server files.",
    );
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolveExit) =>
        child.once("exit", resolveExit),
      );
      child.kill();
      await exited;
    }
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("hrstudio-smoke-"));
    rmSync(target, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
