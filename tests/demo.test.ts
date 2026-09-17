import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store";
import { checkPassword } from "../server/auth";
import { createDemoWorkspace, DEMO_SLUG } from "../server/demo";
test("demo creates a hashed owner login and sample workflows without changing existing workspaces", async () => {
  const store = new Store(":memory:");
  try {
    await store.db
      .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
      .run("existing", "existing", '{"name":"Existing company"}');
    const account = await createDemoWorkspace(store);
    const user = (await store.db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(account.email))!;
    const orgId = String(user.org_id);
    assert.equal(account.workspace, DEMO_SLUG);
    assert.equal(user.role, "owner");
    assert.notEqual(user.password_hash, account.password);
    assert.equal(
      await checkPassword(account.password, String(user.password_hash)),
      true,
    );
    assert.equal((await store.company(orgId)).timezone, "Asia/Kolkata");
    assert.equal(
      (await store.get(orgId, "employees", String(user.employee_id))).email,
      account.email,
    );
    assert.equal((await store.list(orgId, "employees")).length, 8);
    assert.equal((await store.list(orgId, "attendance")).length, 40);
    assert.equal(
      (await store.list(orgId, "leaves")).filter((r) => r.status === "Pending")
        .length,
      1,
    );
    assert.equal(
      (await store.list(orgId, "expenses")).filter(
        (r) => r.status === "Approved",
      ).length,
      1,
    );
    assert.equal((await store.list(orgId, "candidates")).length, 4);
    assert.equal((await store.list(orgId, "documents")).length, 1);
    assert.equal((await store.list(orgId, "payroll"))[0]?.status, "Draft");
    assert.equal((await store.company("existing")).name, "Existing company");
    assert.equal((await store.list("existing", "employees")).length, 0);
    await assert.rejects(createDemoWorkspace(store), /already exists/);
    assert.equal((await store.list(orgId, "employees")).length, 8);
    assert.equal(
      (await store.db
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .get(user.id))!.password_hash,
      user.password_hash,
    );
  } finally {
    await store.close();
  }
});
test("a failed demo setup rolls back both the account and all sample records", async () => {
  const store = new Store(":memory:");
  try {
    await store.db.exec(
      "CREATE TRIGGER reject_demo_jobs BEFORE INSERT ON records WHEN NEW.kind='jobs' BEGIN SELECT RAISE(ABORT, 'Simulated setup failure'); END;",
    );
    await assert.rejects(createDemoWorkspace(store), /Simulated setup failure/);
    for (const table of ["organizations", "users", "records", "audit"])
      assert.equal(
        (await store.db
          .prepare(`SELECT count(*) AS count FROM ${table}`)
          .get())!.count,
        0,
      );
  } finally {
    await store.close();
  }
});
