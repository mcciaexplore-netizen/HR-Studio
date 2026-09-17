import { openTestStore } from "./database-fixture";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { Server } from "node:http";
import { Store } from "../server/store";
import { createApp } from "../server/app";
import { digest } from "../server/auth";
const fixtures: {
  close: () => Promise<void>;
}[] = [];
const pass = "A long test password 2026";
const employee = (email = "person@example.test") => ({
  name: "Test Employee",
  email,
  avatar: "",
  department: "Operations",
  role: "Supervisor",
  status: "Active",
  contact: "9990001111",
  hireDate: "2026-01-12",
  salary: { basic: 20000, hra: 8000, allowances: 1000, deductions: 500 },
});
const leave = (employeeId: string) => ({
  employeeId,
  leaveType: "Casual Leave",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  reason: "Family visit",
});
async function fixture(options: Parameters<typeof createApp>[1] = {}) {
  const directory = mkdtempSync(join(tmpdir(), "hrstudio-test-")),
    filename = join(directory, "test.sqlite");
  let store = await openTestStore(filename),
    server: Server,
    base = "";
  async function start() {
    server = createApp(store, options).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  }
  async function stop() {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await store.close();
  }
  await start();
  function client() {
    const c = {
      cookie: "",
      async request(
        path: string,
        method = "GET",
        body?: any,
        expected = 200,
        extraHeaders: Record<string, string> = {},
      ) {
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-HRStudio-Request": "1",
            ...(c.cookie ? { Cookie: c.cookie } : {}),
            ...extraHeaders,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.headers.has("set-cookie"))
          c.cookie = response.headers.get("set-cookie")!.split(";")[0];
        const raw = await response.text();
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        assert.equal(response.status, expected, `${method} ${path}: ${raw}`);
        return { data, response, raw };
      },
    };
    return c;
  }
  const f = {
    client,
    get store() {
      return store;
    },
    async restart() {
      await stop();
      store = await openTestStore(filename);
      await start();
    },
    async close() {
      await stop();
      const target = resolve(directory);
      assert.equal(dirname(target), resolve(tmpdir()));
      assert.ok(basename(target).startsWith("hrstudio-test-"));
      rmSync(target, { recursive: true, force: true });
    },
  };
  fixtures.push(f);
  return f;
}
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
async function owner(
  f: Awaited<ReturnType<typeof fixture>>,
  slug = "company-a",
) {
  const client = f.client();
  const result = await client.request(
    "/auth/register",
    "POST",
    {
      slug,
      companyName: "Test Company",
      name: "Owner",
      email: "owner@example.test",
      password: pass,
    },
    201,
  );
  return { client, ...result.data };
}
async function teamAccount(
  f: Awaited<ReturnType<typeof fixture>>,
  admin: any,
  emp: any,
  accessRole = "employee",
  slug = "company-a",
) {
  const { data: account } = await admin.request(
    "/users",
    "POST",
    { employeeId: emp.id, accessRole },
    201,
  );
  const client = f.client();
  await client.request("/auth/login", "POST", {
    slug,
    email: account.email,
    password: account.temporaryPassword,
  });
  await client.request("/state", "GET", undefined, 403);
  await client.request("/auth/password", "POST", {
    currentPassword: account.temporaryPassword,
    newPassword: pass,
  });
  return { client, account };
}
test("authentication, CSRF and credentials are enforced", async () => {
  const f = await fixture(),
    guest = f.client();
  await guest.request("/state", "GET", undefined, 401);
  await guest.request("/auth/login", "POST", {}, 403, {
    "X-HRStudio-Request": "",
  });
  await guest.request("/auth/register", "POST", {}, 403, {
    Origin: "https://other.example",
  });
  const { client, user } = await owner(f);
  const row = (await f.store.db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(user.id))!;
  assert.ok(String(row.password_hash).startsWith("scrypt:"));
  assert.ok(!String(row.password_hash).includes(pass));
  const session = (await f.store.db.prepare("SELECT * FROM sessions").get())!;
  assert.notEqual(session.token_hash, client.cookie.split("=")[1]);
  await guest.request(
    "/auth/login",
    "POST",
    { slug: "company-a", email: "owner@example.test", password: "wrong" },
    401,
  );
  const result = await guest.request("/auth/login", "POST", {
    slug: "company-a",
    email: "owner@example.test",
    password: pass,
  });
  assert.match(result.response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(result.response.headers.get("set-cookie")!, /SameSite=Lax/);
  await guest.request("/auth/logout", "POST");
  await guest.request("/state", "GET", undefined, 401);
});
test("company isolation applies to state, edits, file downloads and linked records", async () => {
  const f = await fixture(),
    a = await owner(f),
    b = await owner(f, "company-b");
  const emp = (
    await a.client.request("/records/employees", "POST", employee(), 201)
  ).data;
  await a.client.request("/records/employees", "POST", employee(), 409);
  await b.client.request("/records/employees", "POST", employee(), 201);
  assert.equal((await b.client.request("/state")).data.employees.length, 1);
  await b.client.request(
    `/records/employees/${emp.id}`,
    "PATCH",
    { name: "Hijacked", version: 1 },
    404,
  );
  await b.client.request("/records/leaves", "POST", leave(emp.id), 404);
  const doc = (
    await a.client.request(
      "/documents",
      "POST",
      {
        employeeId: emp.id,
        name: "contract.txt",
        category: "Contract",
        mimeType: "text/plain",
        contentBase64: Buffer.from("private contract").toString("base64"),
      },
      201,
    )
  ).data;
  await b.client.request(
    `/documents/${doc.id}/download`,
    "GET",
    undefined,
    404,
  );
  const audit = (await b.client.request("/audit")).data;
  assert.ok(!audit.some((entry: any) => entry.entityId === emp.id));
});
test("employee accounts see only their own records and cannot administer the company", async () => {
  const f = await fixture(),
    a = await owner(f);
  const own = (
    await a.client.request(
      "/records/employees",
      "POST",
      employee("own@example.test"),
      201,
    )
  ).data;
  const other = (
    await a.client.request(
      "/records/employees",
      "POST",
      employee("other@example.test"),
      201,
    )
  ).data;
  const { client } = await teamAccount(f, a.client, own);
  const state = (await client.request("/state")).data;
  assert.deepEqual(
    state.employees.map((e: any) => e.id),
    [own.id],
  );
  assert.equal(state.emailLogs.length, 0);
  for (const path of ["/users", "/audit"])
    await client.request(path, "GET", undefined, 403);
  await client.request("/company", "PATCH", {}, 403);
  await client.request(
    "/records/employees",
    "POST",
    employee("x@example.test"),
    403,
  );
  await client.request(
    `/records/employees/${other.id}`,
    "PATCH",
    { version: 1, name: "changed" },
    403,
  );
  const request = (
    await client.request(
      "/records/leaves",
      "POST",
      {
        ...leave(other.id),
        employeeName: "Spoofed",
        days: 99,
        status: "Approved",
      },
      201,
    )
  ).data;
  assert.equal(request.employeeId, own.id);
  assert.equal(request.status, "Pending");
  assert.equal(request.days, 3);
  await client.request(
    `/records/leaves/${request.id}`,
    "PATCH",
    { version: 1, status: "Approved" },
    403,
  );
  await a.client.request(`/records/leaves/${request.id}`, "PATCH", {
    version: 1,
    status: "Approved",
  });
  const doc = (
    await a.client.request(
      "/documents",
      "POST",
      {
        employeeId: other.id,
        name: "other.txt",
        category: "Other",
        mimeType: "text/plain",
        contentBase64: "aGk=",
      },
      201,
    )
  ).data;
  await client.request(`/documents/${doc.id}/download`, "GET", undefined, 404);
  await client.request("/email/send", "POST", {}, 403);
});
test("HR access allows record management but not account administration or self approval", async () => {
  const f = await fixture(),
    a = await owner(f),
    emp = (
      await a.client.request("/records/employees", "POST", employee(), 201)
    ).data;
  const { client } = await teamAccount(f, a.client, emp, "hr");
  await client.request(
    "/records/employees",
    "POST",
    employee("new@example.test"),
    201,
  );
  await client.request("/users", "POST", {}, 403);
  await client.request("/company", "PATCH", {}, 403);
  const request = (
    await client.request("/records/leaves", "POST", leave(emp.id), 201)
  ).data;
  await client.request(
    `/records/leaves/${request.id}`,
    "PATCH",
    { version: 1, status: "Approved" },
    403,
  );
  await client.request("/audit");
});
test("employee edits use versions; invalid salary, dates and references are rejected", async () => {
  const f = await fixture(),
    { client } = await owner(f);
  const emp = (
    await client.request("/records/employees", "POST", employee(), 201)
  ).data;
  await client.request(`/records/employees/${emp.id}`, "PATCH", {
    version: 1,
    name: "Updated",
  });
  await client.request(
    `/records/employees/${emp.id}`,
    "PATCH",
    { version: 1, name: "Lost update" },
    409,
  );
  assert.equal(
    (await client.request("/state")).data.employees[0].name,
    "Updated",
  );
  await client.request(
    "/records/employees",
    "POST",
    {
      ...employee("negative@example.test"),
      salary: { basic: -1, hra: 0, allowances: 0, deductions: 0 },
    },
    400,
  );
  await client.request(
    "/records/employees",
    "POST",
    { ...employee("bad-date@example.test"), hireDate: "2026-02-30" },
    400,
  );
  await client.request(
    "/records/employees",
    "POST",
    { ...employee("bad-dept@example.test"), department: "Unknown" },
    400,
  );
  await client.request(
    "/records/leaves",
    "POST",
    { ...leave(emp.id), endDate: "2026-09-01" },
    400,
  );
  const request = (
    await client.request("/records/leaves", "POST", leave(emp.id), 201)
  ).data;
  await client.request("/records/leaves", "POST", leave(emp.id), 409);
  await client.request(`/records/leaves/${request.id}`, "PATCH", {
    status: "Rejected",
    version: 1,
  });
  await client.request("/records/leaves", "POST", leave(emp.id), 201);
  await client.request(
    `/records/employees/${emp.id}`,
    "DELETE",
    { version: 2 },
    409,
  );
  await client.request(
    "/records/assets",
    "POST",
    {
      name: "Laptop",
      serialNumber: "SN1",
      category: "Laptop",
      status: "Assigned",
      assignedToId: "missing",
      purchaseDate: "2026-01-01",
    },
    404,
  );
});
test("clock events use the signed-in employee and server timestamps with duplicate protection", async () => {
  const f = await fixture(),
    a = await owner(f);
  await a.client.request("/attendance/clock", "POST", { action: "in" }, 400);
  const emp = (
    await a.client.request("/records/employees", "POST", employee(), 201)
  ).data;
  await a.client.request("/account/employee", "PATCH", { employeeId: emp.id });
  const log = (
    await a.client.request("/attendance/clock", "POST", {
      action: "in",
      employeeId: "another",
      checkInAt: "1900-01-01",
    })
  ).data;
  assert.equal(log.employeeId, emp.id);
  assert.ok(Math.abs(Date.now() - Date.parse(log.checkInAt)) < 10000);
  await a.client.request("/attendance/clock", "POST", { action: "in" }, 409);
  const ended = (
    await a.client.request("/attendance/clock", "POST", { action: "out" })
  ).data;
  assert.ok(ended.checkOutAt);
  assert.equal(ended.id, log.id);
  await a.client.request("/attendance/clock", "POST", { action: "out" }, 409);
});
test("company settings, documents, records and sessions survive closing and reopening the database", async () => {
  const f = await fixture(),
    a = await owner(f);
  await a.client.request("/company", "PATCH", {
    ...a.company,
    name: "Persistent Company",
    departments: ["Operations", "Workshop"],
  });
  const emp = (
    await a.client.request(
      "/records/employees",
      "POST",
      { ...employee(), department: "Workshop" },
      201,
    )
  ).data;
  const content = "Actual stored document — नमस्ते";
  const doc = (
    await a.client.request(
      "/documents",
      "POST",
      {
        employeeId: emp.id,
        name: "employment.txt",
        mimeType: "text/plain",
        category: "Contract",
        contentBase64: Buffer.from(content).toString("base64"),
      },
      201,
    )
  ).data;
  await f.restart();
  const state = (await a.client.request("/state")).data;
  assert.equal(state.company.name, "Persistent Company");
  assert.equal(state.employees[0].id, emp.id);
  assert.equal(state.documents[0].id, doc.id);
  assert.equal(state.documents[0].contentBase64, undefined);
  assert.equal(
    (await a.client.request(`/documents/${doc.id}/download`)).raw,
    content,
  );
  assert.ok((await a.client.request("/audit")).data.length >= 4);
});
test("uploads validate size and file type and download with attachment headers", async () => {
  const f = await fixture(),
    { client } = await owner(f),
    emp = (await client.request("/records/employees", "POST", employee(), 201))
      .data;
  const doc = {
    employeeId: emp.id,
    name: "file.pdf",
    category: "Other",
    mimeType: "application/pdf",
    contentBase64: Buffer.from("not a PDF").toString("base64"),
  };
  await client.request("/documents", "POST", doc, 400);
  await client.request(
    "/documents",
    "POST",
    { ...doc, mimeType: "text/html" },
    400,
  );
  await client.request(
    "/documents",
    "POST",
    {
      ...doc,
      mimeType: "text/plain",
      contentBase64: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
    },
    400,
  );
  const stored = (
    await client.request(
      "/documents",
      "POST",
      { ...doc, name: "नोट.txt", mimeType: "text/plain" },
      201,
    )
  ).data;
  const download = await client.request(`/documents/${stored.id}/download`);
  assert.match(
    download.response.headers.get("content-disposition")!,
    /^attachment;/,
  );
  assert.equal(
    download.response.headers.get("x-content-type-options"),
    "nosniff",
  );
});
test("recruitment, assets and appraisals keep relationships and changes", async () => {
  const f = await fixture(),
    { client } = await owner(f),
    emp = (await client.request("/records/employees", "POST", employee(), 201))
      .data;
  const job = (
    await client.request(
      "/records/jobs",
      "POST",
      {
        title: "Supervisor",
        department: "Operations",
        location: "Pune",
        type: "Full-time",
      },
      201,
    )
  ).data;
  const candidate = (
    await client.request(
      "/records/candidates",
      "POST",
      {
        name: "Applicant",
        email: "candidate@example.test",
        jobId: job.id,
        resumeText: "Experience leading a team.",
      },
      201,
    )
  ).data;
  await client.request(`/records/candidates/${candidate.id}`, "PATCH", {
    stage: "Interview",
    version: 1,
  });
  const asset = (
    await client.request(
      "/records/assets",
      "POST",
      {
        name: "Laptop",
        serialNumber: "SN-123",
        category: "Laptop",
        purchaseDate: "2026-01-01",
        status: "Assigned",
        assignedToId: emp.id,
      },
      201,
    )
  ).data;
  await client.request(`/records/assets/${asset.id}`, "PATCH", {
    status: "Available",
    version: 1,
  });
  const review = (
    await client.request(
      "/records/appraisals",
      "POST",
      {
        employeeId: emp.id,
        period: "H2 2026",
        goalsSet: "Train the team",
        feedback: "Good progress",
        selfRating: 3,
        managerRating: 4,
      },
      201,
    )
  ).data;
  await client.request(`/records/appraisals/${review.id}`, "PATCH", {
    status: "Approved",
    version: 1,
  });
  const state = (await client.request("/state")).data;
  assert.equal(state.jobs[0].applicantsCount, 1);
  assert.equal(state.candidates[0].stage, "Interview");
  assert.equal(state.assets[0].assignedToId, undefined);
  assert.equal(state.appraisals[0].status, "Approved");
});
test("mail is explicit, recipients are resolved on the server, and outcomes are truthful", async () => {
  const messages: any[] = [],
    f = await fixture({
      mailer: async (mail) => {
        messages.push(mail);
        if (mail.subject === "Fail") throw new Error("SMTP unavailable");
      },
    }),
    a = await owner(f);
  const emp = (
    await a.client.request("/records/employees", "POST", employee(), 201)
  ).data;
  const mail = {
    employeeId: emp.id,
    recipient: "attacker@example.test",
    subject: "Notice",
    body: "Hello team",
    campaignType: "General Notice",
  };
  assert.equal(messages.length, 0);
  const sent = (await a.client.request("/email/send", "POST", mail)).data;
  assert.equal(sent.status, "Accepted");
  assert.equal(messages[0].recipient, emp.email);
  await a.client.request(
    "/email/send",
    "POST",
    { ...mail, subject: "Fail" },
    502,
  );
  assert.ok(
    (await a.client.request("/state")).data.emailLogs.some(
      (log: any) => log.status === "Failed",
    ),
  );
  const f2 = await fixture(),
    b = await owner(f2);
  await b.client.request("/email/send", "POST", mail, 503);
  assert.equal((await b.client.request("/state")).data.emailLogs.length, 0);
});
test("account disable, expiry and password changes revoke sessions", async () => {
  const f = await fixture(),
    a = await owner(f),
    emp = (
      await a.client.request("/records/employees", "POST", employee(), 201)
    ).data;
  const { client, account } = await teamAccount(f, a.client, emp);
  await a.client.request(`/users/${account.id}`, "PATCH", { active: false });
  await client.request("/state", "GET", undefined, 401);
  await a.client.request(`/users/${account.id}`, "PATCH", { active: true });
  await client.request("/state", "GET", undefined, 401);
  await client.request("/auth/login", "POST", {
    slug: "company-a",
    email: emp.email,
    password: pass,
  });
  await f.store.db
    .prepare("UPDATE sessions SET expires_at=0 WHERE token_hash=?")
    .run(digest(client.cookie.split("=")[1]));
  await client.request("/state", "GET", undefined, 401);
  const other = f.client();
  await other.request("/auth/login", "POST", {
    slug: "company-a",
    email: "owner@example.test",
    password: pass,
  });
  await a.client.request("/auth/password", "POST", {
    currentPassword: pass,
    newPassword: "Another sufficiently long password",
  });
  await other.request("/state", "GET", undefined, 401);
  await a.client.request("/state");
});
test("registration can be closed and authentication attempts are rate limited", async () => {
  const closed = await fixture({
    registrationOpen: false,
    secureCookies: true,
  });
  await closed.client().request("/auth/register", "POST", {}, 403);
  const f = await fixture(),
    client = f.client();
  for (let i = 0; i < 20; i++)
    await client.request("/auth/login", "POST", {}, 400);
  const response = await client.request("/auth/login", "POST", {}, 429);
  assert.ok(response.response.headers.has("retry-after"));
});
