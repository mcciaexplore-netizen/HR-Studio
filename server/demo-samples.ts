import { randomBytes, randomUUID } from "node:crypto";
import { actorFrom, hashPassword } from "./auth";
import { DEMO_EMAIL, DEMO_SLUG, demoAccounts } from "./demo-access";
import { Store, type Actor, type Kind } from "./store";
import { validateRecord } from "./validation";
import { today } from "./suite-domain";
import { validateSuiteRecord } from "./suite-records";
import { createPayroll, editPayroll, payrollAction } from "./payroll";

const sampleVersion = "Expanded fictional demo samples v1";

/** Opt-in provisioning. Never promotes an ordinary company into a public demo. */
export async function populateDemoSamples(store: Store) {
  const hashes = await Promise.all(
    [0, 1].map(() => hashPassword(randomBytes(32).toString("base64url"))),
  );
  return store.transaction(() => {
    const ownerRow = store.db
      .prepare(
        `SELECT u.* FROM users u JOIN organizations o ON o.id=u.org_id
      WHERE o.slug=? AND u.email=? AND u.role='owner' AND u.active=1`,
      )
      .get(DEMO_SLUG, DEMO_EMAIL);
    if (
      !ownerRow ||
      !store.db
        .prepare(
          "SELECT 1 FROM audit WHERE org_id=? AND action='Created fictional demo workspace' AND actor_id=?",
        )
        .get(ownerRow.org_id, ownerRow.id)
    )
      throw new Error(
        "Create the fictional workspace with npm run demo:create first. Ordinary workspaces cannot enable demo access.",
      );
    const owner = actorFrom(ownerRow),
      orgId = owner.orgId;
    const employees = store.list(orgId, "employees");
    if (
      !store.db
        .prepare("SELECT 1 FROM demo_access WHERE org_id=?")
        .get(orgId) &&
      employees.some(
        (employee) =>
          !employee.email.endsWith("@mccia-demo.example") ||
          !employee.name.endsWith("(Demo)"),
      )
    )
      throw new Error(
        "The workspace contains non-sample employee details. Demo access was not enabled.",
      );

    const actors: Record<string, Actor> = { owner };
    for (const [index, role] of ["hr", "employee"].entries()) {
      const employee = employees.find(
        (employee) =>
          employee.email === `employee${index + 2}@mccia-demo.example`,
      );
      if (!employee || employee.status !== "Active")
        throw new Error("A required sample employee is missing or inactive.");
      let row = store.db
        .prepare(
          "SELECT * FROM users WHERE org_id=? AND (employee_id=? OR email=?)",
        )
        .get(orgId, employee.id, employee.email);
      if (!row) {
        const id = randomUUID();
        store.db
          .prepare(
            "INSERT INTO users(id,org_id,name,email,password_hash,role,employee_id) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            id,
            orgId,
            employee.name,
            employee.email,
            hashes[index],
            role,
            employee.id,
          );
        row = store.db.prepare("SELECT * FROM users WHERE id=?").get(id)!;
      }
      if (
        row.role !== role ||
        row.employee_id !== employee.id ||
        !row.active ||
        row.must_change
      )
        throw new Error(
          "An existing demo account was changed. No accounts or passwords were overwritten.",
        );
      actors[role] = actorFrom(row);
    }
    for (const actor of Object.values(actors)) {
      const mapping = store.db
        .prepare("SELECT user_id FROM demo_access WHERE org_id=? AND role=?")
        .get(orgId, actor.accessRole);
      if (mapping && mapping.user_id !== actor.id)
        throw new Error("Demo account mapping changed. Setup was stopped.");
      if (!mapping)
        store.db
          .prepare("INSERT INTO demo_access(org_id,role,user_id) VALUES(?,?,?)")
          .run(orgId, actor.accessRole, actor.id);
    }
    if (
      store.db
        .prepare("SELECT 1 FROM audit WHERE org_id=? AND action=?")
        .get(orgId, sampleVersion)
    )
      return {
        workspace: DEMO_SLUG,
        roles: demoAccounts(store).map((row) => row.role),
        added: false,
      };

    const baseDate = today(store, orgId);
    const nextDate = (offset: number) => {
      const day = new Date(Date.parse(baseDate) + offset * 86400000);
      while ([0, 6].includes(day.getUTCDay()))
        day.setUTCDate(day.getUTCDate() + 1);
      return day.toISOString().slice(0, 10);
    };
    const add = (actor: Actor, kind: Kind, body: any, suite = true) =>
      store.save(
        actor,
        kind,
        suite
          ? validateSuiteRecord(store, actor, kind, body)
          : validateRecord(store, actor, kind, body),
      );
    const employee = store.get(orgId, "employees", actors.employee.employeeId!);

    for (const actor of [actors.hr, actors.employee]) {
      const content = Buffer.from(
        `SAMPLE EMPLOYEE DOCUMENT\n\nPrepared for ${actor.name}.\nThis fictional joining guide demonstrates document downloads. It is not a contract or an official MCCIA document.\n`,
      );
      store.save(owner, "documents", {
        employeeId: actor.employeeId,
        name: "Sample-joining-guide.txt",
        mimeType: "text/plain",
        contentBase64: content.toString("base64"),
        category: "Other",
        uploadDate: baseDate,
        size: "1 KB",
      });
      add(actor, "tickets", {
        subject: "Demo: request an induction timetable",
        category: "General",
        body: "Fictional request: please share the timetable for this week's induction and training sessions.",
      });
    }
    add(
      owner,
      "assets",
      {
        name: "Demo employee laptop",
        serialNumber: "DEMO-EMPLOYEE-LAPTOP",
        category: "Laptop",
        status: "Assigned",
        assignedToId: employee.id,
        purchaseDate: employee.hireDate,
      },
      false,
    );
    add(
      actors.employee,
      "leaves",
      {
        employeeId: employee.id,
        leaveType: "Sick",
        startDate: nextDate(14),
        endDate: nextDate(14),
        reason:
          "Demo request for a planned medical appointment; no real health information.",
      },
      false,
    );
    add(actors.employee, "expenses", {
      employeeId: employee.id,
      spentOn: baseDate,
      amount: 680,
      category: "Travel",
      purpose: "Demo local travel to a fictional member event.",
    });
    add(actors.employee, "profileRequests", {
      employeeId: employee.id,
      type: "Letter request",
      reason: "Demo request for an employment confirmation letter.",
    });
    add(owner, "policies", {
      title: "Sample travel and expense policy",
      status: "Published",
      dueDate: nextDate(10),
      content:
        "DEMO POLICY ONLY. Submit the expense date, amount, category and business purpose. HR reviews the request before reimbursement. These instructions and limits are illustrative and are not an official MCCIA policy.",
    });
    const nextMonth = new Date(
      Date.UTC(Number(baseDate.slice(0, 4)), Number(baseDate.slice(5, 7)), 1),
    )
      .toISOString()
      .slice(0, 10);
    add(owner, "employmentChanges", {
      employeeId: employee.id,
      type: "Promotion",
      effectiveDate: nextMonth,
      changes: { role: "Senior Operations Coordinator (Demo)" },
      reason:
        "Fictional future promotion for demonstrating the review workflow.",
    });

    // Seed a reviewed example through the real two-person workflow. No payment is recorded.
    const previousMonth = new Date(
      Date.parse(`${baseDate.slice(0, 7)}-01`) - 86400000,
    )
      .toISOString()
      .slice(0, 7);
    if (
      previousMonth >= "2026-01" &&
      !store
        .list(orgId, "payroll")
        .some((period) => period.month === previousMonth)
    ) {
      let period = createPayroll(store, actors.hr, { month: previousMonth });
      for (const line of period.lines)
        period = editPayroll(store, actors.hr, period, {
          version: period.version,
          employeeId: line.employeeId,
          input: {
            ...line.input,
            reviewed: true,
            ptCategory: "Standard",
            pfApplicable: true,
            pfWages: line.snapshot.monthlyComponents.basic,
            epsEligible: true,
            esiApplicable: false,
            lwfApplicable: true,
            tds: 0,
            overtimeHours: 0,
          },
        });
      period = payrollAction(store, actors.hr, period, {
        action: "Submit",
        version: period.version,
        note: "Fictional sample inputs for demonstrating payslips; not an assessment of real employees.",
      });
      payrollAction(store, owner, period, {
        action: "Approve",
        version: period.version,
        note: "Demo approval only. No funds transferred and no statutory returns filed.",
      });
    }
    store.audit(owner, sampleVersion, orgId);
    return {
      workspace: DEMO_SLUG,
      roles: demoAccounts(store).map((row) => row.role),
      added: true,
    };
  });
}
