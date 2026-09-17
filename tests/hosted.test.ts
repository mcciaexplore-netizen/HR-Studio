import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { prepareHostedEnvironment } from "../scripts/start-hosted.cjs";
import { provisionHostedDemo } from "../server/hosted-demo";
import { createDemoWorkspace } from "../server/demo";
import { demoAccounts } from "../server/demo-access";
import { Store } from "../server/store";
import { releaseNativeStatements } from "./native-cleanup";

test("hosted configuration uses the external HTTPS origin and secure defaults", () => {
  const env = prepareHostedEnvironment({
    DATABASE_PATH: resolve("var/hosted.sqlite"),
    RENDER_EXTERNAL_URL: "https://hr-test.onrender.com/",
  });
  assert.equal(env.APP_URL, "https://hr-test.onrender.com");
  assert.equal(env.HOST, "0.0.0.0");
  assert.equal(env.COOKIE_SECURE, "true");
  assert.equal(env.REGISTRATION_OPEN, "false");
  assert.equal(env.DEMO_BOOTSTRAP, "false");
  assert.equal(
    prepareHostedEnvironment({ ...env, APP_URL: "https://hr.example.test/" })
      .APP_URL,
    "https://hr.example.test",
  );
});

test("hosted configuration fails before opening an unsafe or ambiguous database", () => {
  const valid = {
    DATABASE_PATH: resolve("var/hosted.sqlite"),
    APP_URL: "https://hr.example.test",
  };
  for (const DATABASE_PATH of [
    "",
    "var/local.sqlite",
    ":memory:",
    resolve("public/db.sqlite"),
    resolve("public/..hidden.sqlite"),
    resolve("dist/public/db.sqlite"),
  ])
    assert.throws(
      () => prepareHostedEnvironment({ ...valid, DATABASE_PATH }),
      /DATABASE_PATH/,
    );
  for (const APP_URL of [
    "",
    "http://hr.example.test",
    "https://user:secret@hr.example.test",
    "https://hr.example.test/login",
    "https://hr.example.test/?x=1",
  ])
    assert.throws(
      () => prepareHostedEnvironment({ ...valid, APP_URL }),
      /HTTPS/,
    );
  assert.throws(
    () => prepareHostedEnvironment({ ...valid, COOKIE_SECURE: "false" }),
    /COOKIE_SECURE/,
  );
  assert.throws(
    () => prepareHostedEnvironment({ ...valid, DEMO_BOOTSTRAP: "true" }),
    /DEMO_LOGIN_ENABLED/,
  );
  assert.throws(
    () => prepareHostedEnvironment({ ...valid, REGISTRATION_OPEN: "yes" }),
    /true or false/,
  );
});

function temporaryDatabase(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "hrstudio-hosted-test-"));
  t.after(async () => {
    await releaseNativeStatements();
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("hrstudio-hosted-test-"));
    rmSync(target, { recursive: true, force: true });
  });
  return join(directory, "test.sqlite");
}

test("hosted demo is initialized once and preserves account changes after reopening", async (t) => {
  const filename = temporaryDatabase(t);
  assert.equal(
    await provisionHostedDemo(filename),
    "created fictional workspace",
  );
  let store = new Store(filename);
  let before;
  try {
    assert.deepEqual(
      demoAccounts(store)
        .map((a) => a.role)
        .sort(),
      ["employee", "hr", "owner"],
    );
    store.db.prepare("UPDATE users SET active=0 WHERE role='hr'").run();
    before = {
      users: store.db.prepare("SELECT * FROM users ORDER BY id").all(),
      records: store.db.prepare("SELECT * FROM records ORDER BY id").all(),
      audit: store.db.prepare("SELECT * FROM audit ORDER BY id").all(),
    };
  } finally {
    store.close();
  }
  assert.equal(await provisionHostedDemo(filename), "already provisioned");
  store = new Store(filename);
  try {
    assert.deepEqual(
      store.db.prepare("SELECT * FROM users ORDER BY id").all(),
      before.users,
    );
    assert.deepEqual(
      store.db.prepare("SELECT * FROM records ORDER BY id").all(),
      before.records,
    );
    assert.deepEqual(
      store.db.prepare("SELECT * FROM audit ORDER BY id").all(),
      before.audit,
    );
    assert.deepEqual(
      demoAccounts(store)
        .map((a) => a.role)
        .sort(),
      ["employee", "owner"],
    );
  } finally {
    store.close();
  }
});

test("hosted demo skips existing companies and refuses an ordinary company with the demo slug", async (t) => {
  const filename = temporaryDatabase(t);
  let store = new Store(filename);
  try {
    store.db
      .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
      .run("private", "private", '{"name":"Private company"}');
  } finally {
    store.close();
  }
  assert.equal(
    await provisionHostedDemo(filename),
    "skipped existing company database",
  );
  store = new Store(filename);
  try {
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM organizations").get()!.n,
      1,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM demo_access").get()!.n,
      0,
    );
    store.db
      .prepare("UPDATE organizations SET slug='mccia-demo' WHERE id='private'")
      .run();
  } finally {
    store.close();
  }
  await assert.rejects(provisionHostedDemo(filename), /Ordinary workspaces/);
  store = new Store(filename);
  try {
    assert.equal(store.company("private").name, "Private company");
    assert.equal(store.db.prepare("SELECT count(*) n FROM users").get()!.n, 0);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM demo_access").get()!.n,
      0,
    );
  } finally {
    store.close();
  }
});

test("hosted demo resumes when setup stopped after creating the fictional company", async (t) => {
  const filename = temporaryDatabase(t);
  const store = new Store(filename);
  try {
    await createDemoWorkspace(store);
  } finally {
    store.close();
  }
  assert.equal(
    await provisionHostedDemo(filename),
    "completed initial provisioning",
  );
  const reopened = new Store(filename);
  try {
    assert.equal(demoAccounts(reopened).length, 3);
  } finally {
    reopened.close();
  }
});
