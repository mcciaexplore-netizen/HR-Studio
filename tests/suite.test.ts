import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { Store, type Actor } from "../server/store";
import { createApp } from "../server/app";
import { digest, SESSION_COOKIE } from "../server/auth";
import { validateRecord } from "../server/validation";
import { config, leaveBalance } from "../server/suite-domain";
import { calculateLine, statutory } from "../server/payroll";
import { parseCSV, workbookBuffer } from "../server/import-export";
import { attendanceSummary } from "../server/attendance-summary";

const cleanup: Array<() => Promise<void>> = [];
after(async () => {
  for (const close of cleanup) await close();
});
const employee = (email = "employee@example.test") => ({
  name: "Example Employee",
  email,
  avatar: "",
  department: "Operations",
  role: "Associate",
  status: "Active",
  contact: "9990001111",
  hireDate: "2026-01-01",
  salary: { basic: 20000, hra: 8000, allowances: 1000, deductions: 0 },
});
async function fixture() {
  const store = new Store(":memory:");
  const orgId = randomUUID();
  store.db
    .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
    .run(
      orgId,
      orgId,
      JSON.stringify({
        name: "Test Company",
        departments: ["Operations", "HR"],
        leaveTypes: ["Casual", "Sick", "Unpaid"],
        currency: "INR",
        timezone: "Asia/Kolkata",
      }),
    );
  const actor: Actor = {
    id: randomUUID(),
    orgId,
    name: "Owner",
    email: "owner@example.test",
    accessRole: "owner",
    employeeId: null,
    mustChangePassword: false,
  };
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => {
          store.close();
          error ? reject(error) : resolve();
        }),
      ),
  );
  function client(user: Actor) {
    const token = randomUUID();
    store.db
      .prepare(
        "INSERT INTO users(id,org_id,name,email,password_hash,role,employee_id) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        user.id,
        user.orgId,
        user.name,
        user.email,
        "test-only",
        user.accessRole,
        user.employeeId,
      );
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(token), user.id, Date.now() + 3600000);
    return async (
      path: string,
      method = "GET",
      body?: any,
      status = 200,
      headers: Record<string, string> = {},
    ) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-HRStudio-Request": "1",
          Cookie: `${SESSION_COOKIE}=${token}`,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const bytes = Buffer.from(await response.arrayBuffer()),
        raw = bytes.toString();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
      assert.equal(
        response.status,
        status,
        `${method} ${path}: ${raw.slice(0, 1000)}`,
      );
      return { data, bytes, response };
    };
  }
  const owner = client(actor);
  const addEmployee = (email?: string) =>
    store.save(
      actor,
      "employees",
      validateRecord(store, actor, "employees", employee(email)),
    );
  function user(emp: any, role: Actor["accessRole"] = "employee") {
    const who: Actor = {
      ...actor,
      id: randomUUID(),
      name: emp.name,
      email: emp.email,
      employeeId: emp.id,
      accessRole: role,
    };
    return { actor: who, request: client(who) };
  }
  const settings = (patch: any) => {
    const company = store.company(orgId);
    store.db
      .prepare(
        "UPDATE organizations SET settings=?,version=version+1 WHERE id=?",
      )
      .run(
        JSON.stringify({
          ...company,
          suite: { ...config(store, orgId), ...patch },
        }),
        orgId,
      );
  };
  return { store, actor, orgId, owner, addEmployee, user, settings };
}

test("custom fields, branch and manager references and company settings preserve configuration", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    manager = f.addEmployee("manager@example.test");
  const branch = (
    await f.owner(
      "/suite/records/branches",
      "POST",
      { code: "PUN", name: "Pune", location: "Pune, Maharashtra" },
      201,
    )
  ).data;
  await f.owner(`/records/employees/${emp.id}`, "PATCH", {
    version: emp.version,
    branchId: branch.id,
    managerId: manager.id,
  });
  await f.owner(
    `/records/employees/${manager.id}`,
    "PATCH",
    { version: manager.version, managerId: emp.id },
    400,
  );
  let company = f.store.company(f.orgId);
  await f.owner("/suite/config", "PATCH", {
    version: company.version,
    settings: {
      customFields: [
        {
          key: "uniform_size",
          label: "Uniform size",
          type: "select",
          options: ["S", "M", "L"],
          required: true,
        },
      ],
    },
  });
  await f.owner(
    "/records/employees",
    "POST",
    employee("new@example.test"),
    400,
  );
  await f.owner(
    "/records/employees",
    "POST",
    { ...employee("new@example.test"), customFields: { uniform_size: "M" } },
    201,
  );
  company = f.store.company(f.orgId);
  await f.owner("/company", "PATCH", { ...company, name: "Updated Company" });
  assert.equal(
    (await f.owner("/suite")).data.settings.customFields[0].key,
    "uniform_size",
  );
  await f.owner("/suite/config", "PATCH", { version: 1, settings: {} }, 409);
});

test("manager then HR approvals enforce stage order, no self approval and private employee state", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    manager = f.addEmployee("manager@example.test"),
    employeeUser = f.user(emp),
    managerUser = f.user(manager);
  await f.owner(`/records/employees/${emp.id}`, "PATCH", {
    version: emp.version,
    managerId: manager.id,
  });
  f.settings({
    approvalChains: {
      ...config(f.store, f.orgId).approvalChains,
      expenses: ["manager", "hr"],
    },
  });
  let expense = (
    await employeeUser.request(
      "/suite/records/expenses",
      "POST",
      {
        employeeId: manager.id,
        spentOn: "2026-08-01",
        category: "Travel",
        amount: 300,
        purpose: "Client visit",
        status: "Approved",
      },
      201,
    )
  ).data;
  assert.equal(expense.employeeId, emp.id);
  assert.equal(expense.status, "Pending");
  await f.owner(
    `/suite/decisions/expenses/${expense.id}`,
    "POST",
    { version: 1, status: "Approved" },
    403,
  );
  await employeeUser.request(
    `/suite/decisions/expenses/${expense.id}`,
    "POST",
    { version: 1, status: "Approved" },
    403,
  );
  const managerState = (await managerUser.request("/suite")).data;
  assert.equal(managerState.approvals.length, 1);
  assert.equal(managerState.people.length, 1);
  assert.ok(!managerState.directory[0].salary);
  expense = (
    await managerUser.request(
      `/suite/decisions/expenses/${expense.id}`,
      "POST",
      { version: 1, status: "Approved" },
    )
  ).data;
  assert.equal(expense.status, "Pending");
  expense = (
    await f.owner(`/suite/decisions/expenses/${expense.id}`, "POST", {
      version: 2,
      status: "Approved",
    })
  ).data;
  assert.equal(expense.status, "Approved");
  await managerUser.request(
    `/suite/expenses/${expense.id}/reimburse`,
    "POST",
    { version: 3, reference: "bank" },
    403,
  );
  await f.owner(`/suite/expenses/${expense.id}/reimburse`, "POST", {
    version: 3,
    reference: "bank-001",
  });
  await f.owner(
    `/suite/expenses/${expense.id}/reimburse`,
    "POST",
    { version: 4, reference: "bank-002" },
    409,
  );
});

test("leave policies exclude weekends and holidays, reserve balance, cancel and carry forward", async () => {
  const f = await fixture(),
    emp = f.addEmployee();
  f.settings({
    leavePolicies: [
      {
        leaveType: "Casual",
        annualDays: 12,
        accrual: "Annual",
        carryForward: 3,
        paid: true,
        excludeNonWorking: true,
      },
    ],
  });
  await f.owner(
    "/suite/records/holidays",
    "POST",
    { name: "Company holiday", date: "2026-08-03" },
    201,
  );
  const leave = (
    await f.owner(
      "/records/leaves",
      "POST",
      {
        employeeId: emp.id,
        leaveType: "Casual",
        startDate: "2026-08-01",
        endDate: "2026-08-04",
        reason: "Family",
      },
      201,
    )
  ).data;
  assert.deepEqual(leave.chargeDates, ["2026-08-04"]);
  assert.equal(leave.days, 1);
  assert.equal(
    leaveBalance(f.store, f.orgId, emp, "Casual", "2026-08-31").available,
    11,
  );
  await f.owner(
    "/records/leaves",
    "POST",
    {
      employeeId: emp.id,
      leaveType: "Casual",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      reason: "Trip",
    },
    409,
  );
  await f.owner(`/suite/cancel/leaves/${leave.id}`, "POST", { version: 1 });
  assert.equal(
    leaveBalance(f.store, f.orgId, emp, "Casual", "2026-08-31").available,
    12,
  );
  assert.equal(
    leaveBalance(f.store, f.orgId, emp, "Casual", "2027-01-01").carried,
    3,
  );
  f.settings({
    leavePolicies: [
      {
        leaveType: "Casual",
        annualDays: 12,
        accrual: "Monthly",
        carryForward: 0,
        paid: true,
        excludeNonWorking: true,
      },
    ],
  });
  assert.equal(
    leaveBalance(f.store, f.orgId, emp, "Casual", "2026-03-31").allowance,
    3,
  );
});

test("policies retain revision-specific acknowledgement evidence and restrict employees to published policies", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    u = f.user(emp);
  let policy = (
    await f.owner(
      "/suite/records/policies",
      "POST",
      {
        title: "Safety",
        content: "Use protective equipment.",
        status: "Draft",
      },
      201,
    )
  ).data;
  assert.equal((await u.request("/suite")).data.policies.length, 0);
  await u.request(
    `/suite/policies/${policy.id}/acknowledge`,
    "POST",
    { version: 1, accepted: true },
    403,
  );
  policy = (
    await f.owner(`/suite/records/policies/${policy.id}`, "PATCH", {
      version: 1,
      status: "Published",
    })
  ).data;
  await u.request(
    `/suite/policies/${policy.id}/acknowledge`,
    "POST",
    { version: 2, accepted: false },
    400,
  );
  const ack = (
    await u.request(
      `/suite/policies/${policy.id}/acknowledge`,
      "POST",
      { version: 2, accepted: true },
      201,
    )
  ).data;
  await u.request(
    `/suite/policies/${policy.id}/acknowledge`,
    "POST",
    { version: 2, accepted: true },
    409,
  );
  await f.owner(`/suite/records/policies/${policy.id}`, "PATCH", {
    version: 2,
    content: "Updated safety procedure.",
  });
  await u.request(
    `/suite/policies/${policy.id}/acknowledge`,
    "POST",
    { version: 3, accepted: true },
    201,
  );
  assert.equal(
    f.store.get(f.orgId, "acknowledgements", ack.id).policyText,
    "Use protective equipment.",
  );
});

test("confidential grievances are invisible to unassigned HR and colleagues", async () => {
  const f = await fixture(),
    employeeUser = f.user(f.addEmployee()),
    other = f.user(f.addEmployee("other@example.test")),
    hr = f.user(f.addEmployee("hr@example.test"), "hr");
  const ticket = (
    await employeeUser.request(
      "/suite/records/tickets",
      "POST",
      {
        subject: "Private concern",
        category: "Grievance",
        body: "Sensitive report",
      },
      201,
    )
  ).data;
  assert.equal((await hr.request("/suite")).data.tickets.length, 0);
  assert.equal((await other.request("/suite")).data.tickets.length, 0);
  await hr.request(
    `/suite/tickets/${ticket.id}`,
    "POST",
    { version: 1, comment: "read" },
    404,
  );
  await f.owner(`/suite/tickets/${ticket.id}`, "POST", {
    version: 1,
    assignedTo: hr.actor.id,
  });
  assert.equal((await hr.request("/suite")).data.tickets.length, 1);
  await hr.request(`/suite/tickets/${ticket.id}`, "POST", {
    version: 2,
    comment: "Investigating",
    status: "In progress",
  });
  await employeeUser.request(`/suite/tickets/${ticket.id}`, "POST", {
    version: 3,
    comment: "Thank you",
  });
});

test("attendance correction approval writes a clock record and rejects overlapping or stale replacements", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    u = f.user(emp);
  const payload = {
    checkInAt: "2026-08-03T03:30:00Z",
    checkOutAt: "2026-08-03T12:00:00Z",
    reason: "Device missed punch",
  };
  const correction = (
    await u.request(
      "/suite/records/attendanceCorrections",
      "POST",
      payload,
      201,
    )
  ).data;
  assert.equal(f.store.list(f.orgId, "attendance").length, 0);
  await f.owner(
    `/suite/decisions/attendanceCorrections/${correction.id}`,
    "POST",
    { version: 1, status: "Approved" },
  );
  assert.equal(f.store.list(f.orgId, "attendance")[0].date, "2026-08-03");
  const duplicate = (
    await u.request(
      "/suite/records/attendanceCorrections",
      "POST",
      payload,
      201,
    )
  ).data;
  await f.owner(
    `/suite/decisions/attendanceCorrections/${duplicate.id}`,
    "POST",
    { version: 1, status: "Approved" },
    409,
  );
  assert.equal(
    f.store.get(f.orgId, "attendanceCorrections", duplicate.id).status,
    "Pending",
  );
});

test("employment changes preserve salary history, and offboarding requires asset return and revokes access", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    u = f.user(emp);
  const change = (
    await f.owner(
      "/suite/records/employmentChanges",
      "POST",
      {
        employeeId: emp.id,
        type: "Salary revision",
        effectiveDate: "2026-08-16",
        reason: "Annual review",
        changes: {
          salary: { basic: 30000, hra: 8000, allowances: 1000, deductions: 0 },
        },
      },
      201,
    )
  ).data;
  await f.owner(`/suite/employmentChanges/${change.id}`, "POST", {
    version: 1,
    action: "Apply",
  });
  assert.equal(f.store.get(f.orgId, "employees", emp.id).salary.basic, 30000);
  const period = (
    await f.owner("/suite/payroll", "POST", { month: "2026-08" }, 201)
  ).data;
  assert.equal(period.lines[0].gross, 34161.29);
  const asset = f.store.save(f.actor, "assets", {
    name: "Laptop",
    serialNumber: "A1",
    status: "Assigned",
    assignedToId: emp.id,
  });
  let checklist = (
    await f.owner(
      "/suite/records/lifecycle",
      "POST",
      { employeeId: emp.id, type: "Offboarding", dueDate: "2026-08-31" },
      201,
    )
  ).data;
  for (const task of checklist.tasks)
    checklist = (
      await f.owner(`/suite/lifecycle/${checklist.id}`, "POST", {
        version: checklist.version,
        taskId: task.id,
        done: true,
      })
    ).data;
  await f.owner(
    `/suite/lifecycle/${checklist.id}`,
    "POST",
    { version: checklist.version, action: "Complete" },
    409,
  );
  f.store.save(
    f.actor,
    "assets",
    { ...asset, status: "Available", assignedToId: null },
    asset.id,
    asset.version,
  );
  await f.owner(`/suite/lifecycle/${checklist.id}`, "POST", {
    version: checklist.version,
    action: "Complete",
  });
  assert.equal(f.store.get(f.orgId, "employees", emp.id).status, "Terminated");
  await u.request("/suite", "GET", undefined, 401);
});

test("payroll requires reviewed inputs and different approver, freezes payslips and prevents double reimbursement", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    hrEmp = f.addEmployee("hr@example.test"),
    hr = f.user(hrEmp, "hr"),
    u = f.user(emp);
  let expense = (
    await u.request(
      "/suite/records/expenses",
      "POST",
      {
        spentOn: "2026-08-01",
        category: "Travel",
        amount: 300,
        purpose: "Client visit",
      },
      201,
    )
  ).data;
  expense = (
    await f.owner(`/suite/decisions/expenses/${expense.id}`, "POST", {
      version: 1,
      status: "Approved",
    })
  ).data;
  let period = (
    await hr.request("/suite/payroll", "POST", { month: "2026-08" }, 201)
  ).data;
  await hr.request("/suite/payroll", "POST", { month: "2026-08" }, 409);
  await hr.request(
    `/suite/payroll/${period.id}`,
    "POST",
    { version: 1, action: "Submit" },
    400,
  );
  for (const line of period.lines)
    period = (
      await hr.request(`/suite/payroll/${period.id}`, "PATCH", {
        version: period.version,
        employeeId: line.employeeId,
        input: {
          ptCategory: "Standard",
          reviewed: true,
          pfApplicable: true,
          pfWages: 20000,
          epsEligible: true,
          esiApplicable: false,
          lwfApplicable: true,
        },
      })
    ).data;
  period = (
    await hr.request(`/suite/payroll/${period.id}`, "POST", {
      version: period.version,
      action: "Include expenses",
    })
  ).data;
  assert.equal(
    period.lines.find((l: any) => l.employeeId === emp.id).reimbursement,
    300,
  );
  period = (
    await hr.request(`/suite/payroll/${period.id}`, "POST", {
      version: period.version,
      action: "Submit",
    })
  ).data;
  await hr.request(
    `/suite/payroll/${period.id}`,
    "POST",
    { version: period.version, action: "Approve" },
    403,
  );
  period = (
    await f.owner(`/suite/payroll/${period.id}`, "POST", {
      version: period.version,
      action: "Approve",
    })
  ).data;
  await f.owner(
    `/suite/expenses/${expense.id}/reimburse`,
    "POST",
    { version: expense.version, reference: "duplicate" },
    409,
  );
  await hr.request(
    `/suite/payroll/${period.id}`,
    "PATCH",
    { version: period.version, employeeId: emp.id, input: {} },
    409,
  );
  const slip = (
    await u.request(`/suite/payroll/${period.id}/payslip/${emp.id}`)
  ).data;
  assert.match(slip, /INR 27300.00/);
  await u.request(
    `/suite/payroll/${period.id}/payslip/${hrEmp.id}`,
    "GET",
    undefined,
    404,
  );
  const payrollState = (await u.request("/suite")).data.payroll[0];
  assert.equal(payrollState.lines.length, 1);
  assert.ok(!payrollState.expenseIds);
  const snapshot = period.lines[0].net;
  const current = f.store.get(f.orgId, "employees", emp.id);
  f.store.save(
    f.actor,
    "employees",
    { ...current, salary: { ...current.salary, basic: 99999 } },
    emp.id,
    current.version,
  );
  assert.equal(
    f.store.get(f.orgId, "payroll", period.id).lines[0].net,
    snapshot,
  );
  await f.owner(`/suite/payroll/${period.id}`, "POST", {
    version: period.version,
    action: "Record payment",
    reference: "bank-batch-1",
  });
  assert.equal(
    f.store.get(f.orgId, "expenses", expense.id).status,
    "Reimbursed",
  );
});

test("Maharashtra statutory boundaries, February tax, welfare months, PF and ESI rounding", () => {
  assert.equal(
    statutory("2026-02", 10000, { ptCategory: "Standard" }).professionalTax,
    175,
  );
  assert.equal(
    statutory("2026-02", 10001, { ptCategory: "Standard" }).professionalTax,
    300,
  );
  assert.equal(
    statutory("2026-08", 7500, { ptCategory: "Standard" }).professionalTax,
    0,
  );
  assert.equal(
    statutory("2026-08", 25000, { ptCategory: "Women" }).professionalTax,
    0,
  );
  assert.equal(
    statutory("2026-08", 25001, { ptCategory: "Women" }).professionalTax,
    200,
  );
  const result = statutory("2026-06", 21000, {
    pfApplicable: true,
    pfWages: 21000,
    epsEligible: true,
    esiApplicable: true,
    esiWages: 21000,
    esiAverageDailyWage: 700,
    lwfApplicable: true,
  });
  assert.equal(result.pfEmployee, 1800);
  assert.equal(result.eps, 1250);
  assert.equal(result.pfEmployer, 550);
  assert.equal(result.esiEmployee, 158);
  assert.equal(result.esiEmployer, 683);
  assert.equal(result.lwfEmployee, 25);
  assert.equal(result.lwfEmployer, 75);
  assert.equal(
    statutory("2026-09", 5280, {
      esiApplicable: true,
      esiWages: 5280,
      esiAverageDailyWage: 176,
      lwfApplicable: true,
    }).esiEmployee,
    0,
  );
  const line = calculateLine(
    "2026-08",
    {
      eligibleDays: 31,
      payBasis: "Daily",
      payRate: 500,
      monthlyComponents: {},
      deductions: 0,
    },
    { units: 20, overtimeHours: 2, overtimeRate: 100, ptCategory: "Exempt" },
  );
  assert.equal(line.net, 10200);
});

test("CSV and Excel imports validate rows, commit atomically and reject replay and formulas", async () => {
  const f = await fixture();
  assert.deepEqual(parseCSV('a,b\n"hello, world","say ""hi"""'), [
    ["a", "b"],
    ["hello, world", 'say "hi"'],
  ]);
  const source =
    "name,email,role,department,contact,hireDate,basic\nAlice,alice@example.test,Sales,Operations,9990001111,2026-01-01,10000\nBob,bob@example.test,Sales,Operations,9990002222,2026-01-01,15000";
  let preview = (
    await f.owner(
      "/suite/imports/preview",
      "POST",
      {
        name: "people.csv",
        contentBase64: Buffer.from(source).toString("base64"),
      },
      201,
    )
  ).data;
  assert.ok(preview.valid);
  f.addEmployee("bob@example.test");
  await f.owner(
    `/suite/imports/${preview.id}/commit`,
    "POST",
    { version: 1 },
    409,
  );
  assert.equal(f.store.list(f.orgId, "employees").length, 1);
  preview = (
    await f.owner(
      "/suite/imports/preview",
      "POST",
      {
        name: "people.csv",
        contentBase64: Buffer.from(
          source.split("\n").slice(0, 2).join("\n"),
        ).toString("base64"),
      },
      201,
    )
  ).data;
  await f.owner(`/suite/imports/${preview.id}/commit`, "POST", { version: 1 });
  await f.owner(
    `/suite/imports/${preview.id}/commit`,
    "POST",
    { version: 1 },
    409,
  );
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("Employees");
  sheet.addRow(["name", "email", "role", "department", "contact", "hireDate"]);
  sheet.addRow([
    "Carol",
    "carol@example.test",
    "Sales",
    "Operations",
    "9990001111",
    "2026-01-01",
  ]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const xlsx = (
    await f.owner(
      "/suite/imports/preview",
      "POST",
      { name: "people.xlsx", contentBase64: bytes.toString("base64") },
      201,
    )
  ).data;
  assert.ok(xlsx.valid);
  sheet.getCell("A2").value = { formula: "1+1", result: 2 };
  await f.owner(
    "/suite/imports/preview",
    "POST",
    {
      name: "formula.xlsx",
      contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString(
        "base64",
      ),
    },
    400,
  );
  const exported = await workbookBuffer(
    ["name"],
    [{ name: '=HYPERLINK("evil")' }],
  );
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(exported as any);
  assert.equal(
    restored.worksheets[0].getCell("A2").type,
    ExcelJS.ValueType.String,
  );
  assert.match(String(restored.worksheets[0].getCell("A2").value), /^'/);
});

test("integration tokens enforce scope, tenant, idempotency, overlap protection and revocation", async () => {
  const f = await fixture(),
    emp = f.addEmployee();
  const key = (
    await f.owner(
      "/suite/integrations/keys",
      "POST",
      { name: "Clock terminal", scope: "attendance" },
      201,
    )
  ).data;
  const body = {
      eventId: "event-1",
      employeeId: emp.id,
      checkInAt: "2026-08-02T03:30:00Z",
      checkOutAt: "2026-08-02T12:00:00Z",
    },
    headers = { Authorization: `Bearer ${key.token}` };
  await f.owner("/integrations/events", "POST", body, 401);
  await f.owner("/integrations/events", "POST", body, 201, headers);
  assert.equal(
    (await f.owner("/integrations/events", "POST", body, 200, headers)).data
      .duplicate,
    true,
  );
  await f.owner(
    "/integrations/events",
    "POST",
    { ...body, eventId: "event-2" },
    409,
    headers,
  );
  await f.owner(
    "/integrations/events",
    "POST",
    { ...body, eventId: "event-3", employeeId: "other-company-id" },
    404,
    headers,
  );
  assert.equal(f.store.list(f.orgId, "attendance").length, 1);
  assert.ok(!(await f.owner("/suite")).data.integrationKeys[0].tokenHash);
  await f.owner(`/suite/integrations/keys/${key.id}/revoke`, "POST", {
    version: 1,
  });
  await f.owner("/integrations/events", "POST", body, 401, headers);
});

test("module switches block old and new APIs without deleting stored records", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    user = f.user(emp);
  f.settings({ enabledModules: ["reports"] });
  await f.owner("/suite/payroll", "POST", { month: "2026-08" }, 403);
  await user.request("/attendance/clock", "POST", { action: "in" }, 403);
  await user.request("/records/leaves", "POST", {}, 403);
  await f.owner("/documents", "POST", {}, 403);
  assert.equal((await f.owner("/suite")).data.payroll.length, 0);
  assert.equal(f.store.list(f.orgId, "employees").length, 1);
});

test("shift breaks apply once per date, overtime needs a reviewed rate and historical hourly rates are used", async () => {
  const f = await fixture();
  const emp = f.store.save(
    f.actor,
    "employees",
    validateRecord(f.store, f.actor, "employees", {
      ...employee(),
      payBasis: "Hourly",
      payRate: 100,
      salary: { basic: 0, hra: 0, allowances: 0, deductions: 0 },
    }),
  );
  const shift = (
    await f.owner(
      "/suite/records/shifts",
      "POST",
      {
        name: "Day",
        start: "09:00",
        end: "17:00",
        breakMinutes: 60,
        graceMinutes: 10,
      },
      201,
    )
  ).data;
  await f.owner(
    "/suite/records/shiftAssignments",
    "POST",
    {
      employeeId: emp.id,
      shiftId: shift.id,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    },
    201,
  );
  await f.owner(
    "/suite/records/shiftAssignments",
    "POST",
    {
      employeeId: emp.id,
      shiftId: shift.id,
      startDate: "2026-08-05",
      endDate: "2026-08-10",
    },
    409,
  );
  for (const [start, end] of [
    ["2026-08-03T03:30:00Z", "2026-08-03T07:30:00Z"],
    ["2026-08-03T08:30:00Z", "2026-08-03T13:30:00Z"],
  ])
    f.store.save(f.actor, "attendance", {
      employeeId: emp.id,
      employeeName: emp.name,
      date: "2026-08-03",
      checkInAt: start,
      checkOutAt: end,
    });
  const summary = attendanceSummary(f.store, f.orgId, emp.id, "2026-08")[0];
  assert.equal(summary.paidHours, 8);
  assert.equal(summary.overtimeHours, 1);
  const changed = f.store.save(
    f.actor,
    "employees",
    { ...emp, payRate: 200, _effectiveDate: "2026-09-01" },
    emp.id,
    1,
  );
  let period = (
    await f.owner("/suite/payroll", "POST", { month: "2026-08" }, 201)
  ).data;
  assert.equal(period.lines[0].snapshot.payRate, 100);
  assert.equal(period.lines[0].gross, 700);
  period = (
    await f.owner(`/suite/payroll/${period.id}`, "PATCH", {
      version: 1,
      employeeId: emp.id,
      input: { ...period.lines[0].input, ptCategory: "Exempt", reviewed: true },
    })
  ).data;
  await f.owner(
    `/suite/payroll/${period.id}`,
    "POST",
    { version: period.version, action: "Submit" },
    400,
  );
  period = (
    await f.owner(`/suite/payroll/${period.id}`, "PATCH", {
      version: period.version,
      employeeId: emp.id,
      input: { ...period.lines[0].input, overtimeRate: 200 },
    })
  ).data;
  assert.equal(period.lines[0].net, 900);
  period = (
    await f.owner(`/suite/payroll/${period.id}`, "POST", {
      version: period.version,
      action: "Refresh earnings",
    })
  ).data;
  assert.equal(period.lines[0].input.reviewed, false);
  assert.equal(period.lines[0].gross, 700);
});

test("bank updates require approval and are not exposed in the employee directory", async () => {
  const f = await fixture(),
    emp = f.addEmployee(),
    u = f.user(emp),
    other = f.user(f.addEmployee("other@example.test"));
  const bank = {
    accountName: emp.name,
    bankName: "Test Bank",
    accountNumber: "1234567890",
    ifsc: "TEST0123456",
  };
  let request = (
    await u.request(
      "/suite/records/profileRequests",
      "POST",
      {
        type: "Bank details",
        changes: { bankDetails: bank },
        reason: "Salary account updated",
      },
      201,
    )
  ).data;
  assert.ok(!f.store.get(f.orgId, "employees", emp.id).bankDetails);
  await f.owner(`/suite/decisions/profileRequests/${request.id}`, "POST", {
    version: 1,
    status: "Approved",
  });
  assert.equal(
    f.store.get(f.orgId, "employees", emp.id).bankDetails.accountNumber,
    "1234567890",
  );
  const state = (await other.request("/suite")).data;
  assert.ok(state.directory.every((r: any) => !r.bankDetails));
  assert.ok(!state.profileRequests.length);
});
