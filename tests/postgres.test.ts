import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store";
import { supabaseConnection, postgresSQL } from "../server/postgres";
import { initializeSupabaseDemo } from "../server/supabase-setup";
import { postgresTestDatabase } from "./database-fixture";
import { demoAccounts } from "../server/demo-access";

test("Supabase config uses a private verified TLS connection and disables prepared statements for the pooler", () => {
  assert.throws(() => supabaseConnection({}), /SUPABASE_DB_URL/);
  for (const value of [
    "https://example.test",
    "postgres://user:pass@localhost/postgres",
    "postgres://user@db.example.supabase.co/postgres",
  ])
    assert.throws(() => supabaseConnection({ SUPABASE_DB_URL: value }));
  const config = supabaseConnection({
    SUPABASE_DB_URL:
      "postgresql://postgres.demo:p%40ss%3Aword@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=disable",
  });
  assert.equal(config.password, "p@ss:word");
  assert.equal(config.port, 6543);
  assert.equal(config.prepare, false);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.max, 1);
  assert.equal(
    postgresSQL(
      "SELECT '?' AS literal,actor_name AS actorName FROM audit WHERE org_id=?",
    ),
    "SELECT '?' AS literal,actor_name AS \"actorName\" FROM hrstudio.audit WHERE org_id=$1",
  );
});

test("Supabase schema, sample relationships and existing account changes survive repeat setup", async () => {
  const db = await postgresTestDatabase();
  const store = new Store(db);
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated");
    assert.match(await initializeSupabaseDemo(db), /initialized/);
    assert.equal(
      Number(
        (
          await db
            .prepare("SELECT count(*) n FROM records WHERE kind='employees'")
            .get()
        ).n,
      ),
      8,
    );
    assert.equal((await demoAccounts(store)).length, 3);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT has_schema_privilege('anon','hrstudio','USAGE') allowed",
          )
          .get()
      ).allowed,
      false,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT has_table_privilege('authenticated','hrstudio.users','SELECT') allowed",
          )
          .get()
      ).allowed,
      false,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT bool_and(relrowsecurity) enabled FROM pg_class WHERE relnamespace='hrstudio'::regnamespace AND relkind='r'",
          )
          .get()
      ).enabled,
      true,
    );
    const passwordHashes = await db
      .prepare("SELECT id,password_hash FROM users ORDER BY id")
      .all();
    await db.prepare("UPDATE users SET active=0 WHERE role='hr'").run();
    assert.match(await initializeSupabaseDemo(db), /preserved/);
    assert.deepEqual(
      await db.prepare("SELECT id,password_hash FROM users ORDER BY id").all(),
      passwordHashes,
    );
    assert.equal(
      (await db.prepare("SELECT active FROM users WHERE role='hr'").get())
        .active,
      0,
    );
    await assert.rejects(
      db.prepare("DELETE FROM records WHERE kind='employees'").run(),
      (error: any) => error.code === "23503",
    );
    await assert.rejects(
      db.transaction(async () => {
        await db.prepare("UPDATE users SET active=1 WHERE role='hr'").run();
        throw new Error("rollback requested");
      }),
      /rollback requested/,
    );
    assert.equal(
      (await db.prepare("SELECT active FROM users WHERE role='hr'").get())
        .active,
      0,
    );
  } finally {
    await store.close();
  }
});

test("SQLite queues unrelated requests while an asynchronous transaction is open", async () => {
  const store = new Store(":memory:");
  let continueTransaction!: () => void;
  const barrier = new Promise<void>((resolve) => {
    continueTransaction = resolve;
  });
  let transactionStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    transactionStarted = resolve;
  });
  try {
    const mutation = store.transaction(async () => {
      await store.db
        .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
        .run("rollback", "rollback", "{}");
      transactionStarted();
      await barrier;
      throw new Error("abort");
    });
    const rejected = assert.rejects(mutation, /abort/);
    await started;
    let readFinished = false;
    const read = store.db
      .prepare("SELECT id FROM organizations")
      .all()
      .then((rows) => {
        readFinished = true;
        return rows;
      });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(readFinished, false);
    continueTransaction();
    await rejected;
    assert.deepEqual(await read, []);
  } finally {
    continueTransaction?.();
    await store.close();
  }
});
