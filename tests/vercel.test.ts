import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Libsql from "libsql";
import { Store, type DatabaseConnection } from "../server/store";
import { tursoCredentials } from "../server/turso";
import { initializeTursoDemo } from "../server/turso-setup";
import { createVercelHandler, vercelOrigin } from "../server/vercel";
import { demoAccounts } from "../server/demo-access";

test("Vercel requires remote credentials and an explicit HTTPS origin", () => {
  assert.throws(() => tursoCredentials({}), /TURSO_DATABASE_URL/);
  for (const url of [
    "file:local.db",
    ":memory:",
    "http://db.example.test",
    "https://user:password@db.example.test",
  ])
    assert.throws(
      () =>
        tursoCredentials({
          TURSO_DATABASE_URL: url,
          TURSO_AUTH_TOKEN: "fixture",
        }),
      /secure Turso URL/,
    );
  assert.equal(
    tursoCredentials({
      TURSO_DATABASE_URL: "libsql://db.example.test",
      TURSO_AUTH_TOKEN: "fixture",
    }).url,
    "libsql://db.example.test",
  );
  assert.equal(
    vercelOrigin({ VERCEL_URL: "hr.example.vercel.app" }),
    "https://hr.example.vercel.app",
  );
  assert.equal(
    vercelOrigin({
      APP_URL: "https://hr.example.test/",
      VERCEL_URL: "ignored.vercel.app",
    }),
    "https://hr.example.test",
  );
  assert.throws(() => vercelOrigin({ APP_URL: "http://localhost" }), /HTTPS/);
  assert.throws(
    () => new Store(":memory:", { driver: "libsql", migrate: false }),
    /setup:turso/,
  );
});

test("Turso bulk initialization preserves sample relationships and never resets an existing company", async () => {
  const db = new Libsql(":memory:") as DatabaseConnection;
  try {
    assert.match(await initializeTursoDemo(db), /initialized/);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 3);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("SELECT count(*) n FROM records WHERE kind='employees'").get()
        .n,
      8,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM demo_access").get().n, 3);
    db.prepare("UPDATE users SET active=0 WHERE role='hr'").run();
    const before = db.prepare("SELECT * FROM records ORDER BY id").all();
    assert.match(await initializeTursoDemo(db), /preserved/);
    assert.deepEqual(
      db.prepare("SELECT * FROM records ORDER BY id").all(),
      before,
    );
    assert.equal(
      db.prepare("SELECT active FROM users WHERE role='hr'").get().active,
      0,
    );
    assert.throws(
      () => db.prepare("DELETE FROM records WHERE kind='employees'").run(),
      /FOREIGN KEY/,
    );
  } finally {
    db.close();
  }
});

test("Turso setup refuses foreign schemas and rolls back failed provisioning", async () => {
  const unrelated = new Libsql(":memory:") as DatabaseConnection;
  try {
    unrelated.exec(
      "CREATE TABLE unrelated(id TEXT); INSERT INTO unrelated VALUES('keep');",
    );
    await assert.rejects(
      initializeTursoDemo(unrelated),
      /another application's tables/,
    );
    assert.equal(
      unrelated.prepare("SELECT id FROM unrelated").get().id,
      "keep",
    );
    assert.equal(
      unrelated.prepare("PRAGMA user_version").get().user_version,
      0,
    );
  } finally {
    unrelated.close();
  }
  const store = new Store(":memory:", { driver: "libsql" });
  try {
    store.db.exec(
      "CREATE TRIGGER reject_seed BEFORE INSERT ON records WHEN NEW.kind='jobs' BEGIN SELECT RAISE(ABORT,'seed rejected'); END;",
    );
    await assert.rejects(initializeTursoDemo(store.db), /seed rejected/);
    for (const table of [
      "organizations",
      "records",
      "users",
      "audit",
      "demo_access",
    ])
      assert.equal(
        store.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,
        0,
      );
  } finally {
    store.close();
  }
});

test("Vercel handler routes API requests, protects origins, closes registration and keeps demo sessions", async () => {
  const store = new Store(":memory:", { driver: "libsql" });
  await initializeTursoDemo(store.db);
  let opens = 0;
  const server = createServer(
    createVercelHandler(
      { APP_URL: "https://demo.example.test", DEMO_LOGIN_ENABLED: "true" },
      () => {
        opens++;
        return store;
      },
    ),
  );
  server.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  async function request(
    path: string,
    body?: unknown,
    origin = "https://demo.example.test",
  ) {
    return fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HRStudio-Request": "1",
        Origin: origin,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    assert.equal((await request("/api/health")).status, 200);
    assert.equal((await request("/api/auth/register", {})).status, 403);
    assert.equal(
      (
        await request(
          "/api/auth/demo",
          { role: "owner" },
          "https://evil.example",
        )
      ).status,
      403,
    );
    for (const role of ["owner", "hr", "employee"]) {
      const login = await request("/api/auth/demo", { role });
      assert.equal(login.status, 200);
      assert.match(login.headers.get("set-cookie")!, /; Secure/);
      cookie = login.headers.get("set-cookie")!.split(";")[0];
      const state = await (await request("/api/state")).json();
      assert.equal(state.employees.length, role === "employee" ? 1 : 8);
    }
    assert.equal(opens, 1);
    assert.equal(demoAccounts(store).length, 3);
    assert.equal((await request("/api/unknown")).status, 404);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    store.close();
  }
});

test("Vercel returns a safe retryable response when the database is unavailable", async () => {
  let attempts = 0;
  const server = createServer(
    createVercelHandler({ APP_URL: "https://demo.example.test" }, () => {
      attempts++;
      throw new Error("private token and URL");
    }),
  );
  server.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  try {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as any).port}/api/health`,
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.doesNotMatch(await response.text(), /private token/);
    }
    assert.equal(attempts, 2);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
