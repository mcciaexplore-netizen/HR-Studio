import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store";
import { createApp } from "../server/app";
import { createDemoWorkspace } from "../server/demo";
import { populateDemoSamples } from "../server/demo-samples";
test("demo sample upgrade is repeatable, preserves passwords and provides an employee payslip", async () => {
  const store = new Store(":memory:");
  try {
    const original = await createDemoWorkspace(store);
    const before = (await store.db
      .prepare("SELECT password_hash FROM users WHERE email=?")
      .get(original.email))!.password_hash;
    const result = await populateDemoSamples(store);
    assert.deepEqual([...result.roles].sort(), ["employee", "hr", "owner"]);
    const rowCount = (await store.db
      .prepare("SELECT count(*) AS n FROM records")
      .get())!.n;
    assert.equal((await populateDemoSamples(store)).added, false);
    assert.equal(
      (await store.db.prepare("SELECT count(*) AS n FROM records").get())!.n,
      rowCount,
    );
    assert.equal(
      (await store.db
        .prepare("SELECT password_hash FROM users WHERE email=?")
        .get(original.email))!.password_hash,
      before,
    );
    const employee = (await store.db
      .prepare("SELECT * FROM users WHERE role='employee'")
      .get())!;
    const orgId = String(employee.org_id);
    assert.equal((await store.list(orgId, "employees")).length, 8);
    assert.equal((await store.list(orgId, "documents")).length, 3);
    assert.equal(
      (await store.list(orgId, "assets")).filter(
        (a) => a.assignedToId === employee.employee_id,
      ).length,
      1,
    );
    const approved = (await store.list(orgId, "payroll")).find(
      (p) => p.status === "Approved",
    );
    assert.ok(
      approved.lines.some(
        (line: any) => line.employeeId === employee.employee_id,
      ),
    );
    assert.notEqual(approved.submittedBy, approved.approvedBy);
    assert.equal(approved.paymentReference, undefined);
    assert.equal((await store.list(orgId, "profileRequests")).length, 1);
  } finally {
    await store.close();
  }
});
test("demo sign-in is opt-in, scoped to provisioned accounts and preserves employee permissions", async () => {
  const store = new Store(":memory:");
  const servers: ReturnType<ReturnType<typeof createApp>["listen"]>[] = [];
  let sent = 0;
  try {
    await createDemoWorkspace(store);
    await populateDemoSamples(store);
    await store.db
      .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
      .run("other", "other", '{"name":"Private company"}');
    async function start(enabled = false) {
      const app = createApp(store, {
        demoLoginEnabled: enabled,
        mailer: async () => {
          sent++;
        },
      });
      const server = app.listen(0, "127.0.0.1");
      servers.push(server);
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
      return async (
        path: string,
        body?: any,
        cookie?: string,
        headers: Record<string, string> = {},
      ) => {
        const response = await fetch(base + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-HRStudio-Request": "1",
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return {
          status: response.status,
          cookie: response.headers.get("set-cookie")?.split(";")[0],
          body: await response.json(),
        };
      };
    }
    const disabled = await start();
    assert.deepEqual((await disabled("/auth/options")).body.demoRoles, []);
    assert.equal((await disabled("/auth/demo", { role: "owner" })).status, 404);
    const request = await start(true);
    assert.deepEqual((await request("/auth/options")).body.demoRoles.sort(), [
      "employee",
      "hr",
      "owner",
    ]);
    assert.equal(
      (await request("/auth/demo", { role: "invalid" })).status,
      400,
    );
    assert.equal(
      (await request("/auth/demo", { role: "owner", orgId: "other" })).status,
      400,
    );
    assert.equal(
      (
        await request("/auth/demo", { role: "owner" }, undefined, {
          "X-HRStudio-Request": "",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/auth/demo", { role: "owner" }, undefined, {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    const sessions: Record<string, string> = {};
    for (const role of ["owner", "hr", "employee"]) {
      const response = await request("/auth/demo", { role });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.accessRole, role);
      assert.equal(response.body.user.demo, true);
      assert.equal(response.body.company.slug, "mccia-demo");
      assert.ok(response.cookie);
      assert.equal(
        JSON.stringify(response.body).includes("password_hash"),
        false,
      );
      sessions[role] = response.cookie!;
      const state = await request("/state", undefined, response.cookie);
      assert.equal(state.status, 200);
      assert.equal(state.body.employees.length, role === "employee" ? 1 : 8);
      assert.equal(state.body.company.slug, "mccia-demo");
    }
    const employeeState = (
      await request("/suite", undefined, sessions.employee)
    ).body;
    assert.equal(employeeState.payroll.length, 1);
    assert.equal(employeeState.payroll[0].lines.length, 1);
    assert.equal(employeeState.tickets.length, 1);
    assert.equal(
      (await request("/users", undefined, sessions.employee)).status,
      403,
    );
    for (const path of [
      "/auth/password",
      "/users",
      "/email/send",
      "/ai/evaluate",
      "/suite/integrations/keys",
    ])
      assert.equal((await request(path, {}, sessions.owner)).status, 403);
    assert.equal(sent, 0);
    assert.equal((await store.list("other", "employees")).length, 0);
    await store.db.prepare("UPDATE users SET active=0 WHERE role='hr'").run();
    assert.equal(
      (await request("/auth/options")).body.demoRoles.includes("hr"),
      false,
    );
    assert.equal((await request("/auth/demo", { role: "hr" })).status, 404);
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
    await store.close();
  }
});
test("ordinary accounts using the demo workspace name cannot opt into public demo access", async () => {
  const store = new Store(":memory:");
  try {
    await store.db
      .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
      .run("ordinary", "mccia-demo", "{}");
    await store.db
      .prepare(
        "INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)",
      )
      .run(
        "ordinary-owner",
        "ordinary",
        "Ordinary owner",
        "admin@mccia-demo.example",
        "unused",
        "owner",
      );
    await assert.rejects(
      populateDemoSamples(store),
      /Ordinary workspaces cannot/,
    );
    assert.equal(
      (await store.db.prepare("SELECT count(*) AS n FROM demo_access").get())!
        .n,
      0,
    );
    assert.equal(
      (await store.db.prepare("SELECT count(*) AS n FROM users").get())!.n,
      1,
    );
  } finally {
    await store.close();
  }
});
