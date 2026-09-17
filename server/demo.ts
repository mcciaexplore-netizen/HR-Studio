import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "./auth";
import { Store, type Actor, type Kind } from "./store";
import { companySettings, validateRecord } from "./validation";
import { decision, today, validateConfig } from "./suite-domain";
import { attendanceData, validateSuiteRecord } from "./suite-records";
import { createPayroll } from "./payroll";
import { DEMO_SLUG, DEMO_EMAIL } from "./demo-access";
export { DEMO_SLUG, DEMO_EMAIL } from "./demo-access";
/** Explicit provisioning only: CLI or opt-in hosted initialization, never an HTTP route. */
export async function createDemoWorkspace(store: Store) {
  const password = `Demo!${randomBytes(18).toString("base64url")}`;
  const passwordHash = await hashPassword(password);
  return await store.transaction(async () => {
    if (
      await store.db
        .prepare("SELECT id FROM organizations WHERE slug=?")
        .get(DEMO_SLUG)
    )
      throw new Error(
        "The mccia-demo workspace already exists. No records or credentials were changed.",
      );
    const actor: Actor = {
      id: randomUUID(),
      orgId: randomUUID(),
      name: "Demo Administrator",
      email: DEMO_EMAIL,
      accessRole: "owner",
      employeeId: null,
      mustChangePassword: false,
    };
    const company = companySettings({
      name: "MCCIA Demo — Fictional Company",
      timezone: "Asia/Kolkata",
      departments: [
        "Management",
        "HR",
        "Operations",
        "Finance",
        "Member Services",
      ],
      leaveTypes: ["Casual", "Sick", "Earned", "Unpaid"],
    });
    await store.db
      .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
      .run(actor.orgId, DEMO_SLUG, JSON.stringify(company));
    const suite = await validateConfig(
      {
        industry: "Services",
        leavePolicies: company.leaveTypes.map((leaveType) => ({
          leaveType,
          annualDays:
            leaveType === "Earned" ? 18 : leaveType === "Unpaid" ? 365 : 12,
          accrual: "Annual",
          excludeNonWorking: true,
          paid: leaveType !== "Unpaid",
          carryForward: 0,
        })),
      },
      store,
      actor,
    );
    await store.db
      .prepare("UPDATE organizations SET settings=? WHERE id=?")
      .run(JSON.stringify({ ...company, suite }), actor.orgId);
    await store.db
      .prepare(
        "INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)",
      )
      .run(
        actor.id,
        actor.orgId,
        actor.name,
        actor.email,
        passwordHash,
        actor.accessRole,
      );
    const baseDate = await today(store, actor.orgId);
    const offsetDate = (offset: number) =>
      new Date(Date.parse(baseDate) + offset * 86400000)
        .toISOString()
        .slice(0, 10);
    const nextWeekday = (offset: number) => {
      while ([0, 6].includes(new Date(offsetDate(offset)).getUTCDay()))
        offset++;
      return offsetDate(offset);
    };
    const add = async (kind: Kind, body: any, suiteRecord = false) =>
      await store.save(
        actor,
        kind,
        suiteRecord
          ? await validateSuiteRecord(store, actor, kind, body)
          : await validateRecord(store, actor, kind, body),
      );
    const branches = [
      await add(
        "branches",
        {
          code: "DEMO-PUNE",
          name: "Pune Office (Demo)",
          location: "Pune, Maharashtra",
          costCentre: "DEMO-01",
        },
        true,
      ),
      await add(
        "branches",
        {
          code: "DEMO-PCMC",
          name: "Pimpri Office (Demo)",
          location: "Pimpri-Chinchwad, Maharashtra",
          costCentre: "DEMO-02",
        },
        true,
      ),
    ];
    const shift = await add(
      "shifts",
      {
        name: "General shift (Demo)",
        start: "09:00",
        end: "18:00",
        breakMinutes: 60,
        graceMinutes: 10,
      },
      true,
    );
    const profiles = [
      ["Arjun Deshmukh", "Management", "General Manager", 50000],
      ["Neha Kulkarni", "HR", "HR Executive", 26000],
      ["Rohan Shah", "Operations", "Operations Coordinator", 24000],
      ["Meera Joshi", "Finance", "Accounts Executive", 30000],
      ["Sameer Patil", "Member Services", "Member Relations Executive", 22000],
      ["Ananya Rao", "Operations", "Events Coordinator", 25000],
      ["Kavya More", "Member Services", "Training Associate", 20000],
      ["Ishaan Kale", "Operations", "Project Consultant", 32000],
    ] as const;
    const employees: any[] = [];
    for (const [index, [name, department, role, basic]] of profiles.entries()) {
      const employee = await add("employees", {
        name: `${name} (Demo)`,
        email: index ? `employee${index + 1}@mccia-demo.example` : DEMO_EMAIL,
        department,
        role,
        contact: "Fictional demo — no phone",
        hireDate: offsetDate(index === 7 ? -14 : -180),
        status: "Active",
        avatar: "",
        branchId: branches[index < 5 ? 0 : 1].id,
        managerId: index ? employees[0].id : "",
        costCentre: index < 5 ? "DEMO-01" : "DEMO-02",
        workerType: index === 7 ? "Contractor" : "Permanent",
        payBasis: "Monthly",
        salary: { basic, hra: basic * 0.4, allowances: 2000, deductions: 0 },
      });
      employees.push(employee);
      await add(
        "shiftAssignments",
        {
          employeeId: employee.id,
          shiftId: shift.id,
          startDate: employee.hireDate,
          endDate: offsetDate(365),
        },
        true,
      );
    }
    actor.employeeId = employees[0].id;
    await store.db
      .prepare("UPDATE users SET employee_id=? WHERE id=?")
      .run(actor.employeeId, actor.id);
    // Completed, fictional clock periods on the five most recent weekdays.
    const workDates: string[] = [];
    for (let offset = -1; workDates.length < 5; offset--) {
      const day = offsetDate(offset);
      if (![0, 6].includes(new Date(day).getUTCDay())) workDates.push(day);
    }
    for (const employee of employees)
      for (const day of workDates) {
        const data = await attendanceData(store, actor, {
          employeeId: employee.id,
          employeeName: employee.name,
          checkInAt: `${day}T09:00:00+05:30`,
          checkOutAt: `${day}T18:00:00+05:30`,
        });
        await store.save(actor, "attendance", {
          ...data,
          source: "Fictional demo import",
        });
      }
    await add(
      "holidays",
      { name: "Illustrative company holiday (Demo)", date: nextWeekday(30) },
      true,
    );
    for (const index of [1, 2]) {
      const leave = await add("leaves", {
        employeeId: employees[index].id,
        leaveType: "Casual",
        startDate: nextWeekday(7),
        endDate: nextWeekday(7),
        reason: "Fictional personal leave request for demonstration.",
      });
      if (index === 2)
        await store.save(
          actor,
          "leaves",
          await validateRecord(
            store,
            actor,
            "leaves",
            {
              status: "Approved",
              comment: "Sample approval for demo only.",
            },
            leave,
          ),
          leave.id,
          leave.version,
        );
    }
    for (const [index, amount] of [850, 1250, 420].entries()) {
      const expense = await add(
        "expenses",
        {
          employeeId: employees[index + 1].id,
          spentOn: workDates[0],
          amount,
          category: index === 2 ? "Supplies" : "Travel",
          purpose: "Fictional business expense — demonstration only.",
        },
        true,
      );
      if (index === 1)
        await store.save(
          actor,
          "expenses",
          decision(actor, expense, "Approved", "Demo approval; no money paid."),
          expense.id,
          expense.version,
        );
    }
    await add(
      "lifecycle",
      {
        employeeId: employees[7].id,
        type: "Onboarding",
        dueDate: nextWeekday(5),
      },
      true,
    );
    await add(
      "policies",
      {
        title: "Demo workspace guide",
        status: "Published",
        dueDate: nextWeekday(10),
        content:
          "All people, salary amounts, attendance, requests and records in this workspace are fictional. Explore employee management, approvals, recruitment and reports. Leave allowances are illustrative company settings. The draft payroll has unconfirmed eligibility and must be reviewed; no salary payments or statutory filings have been made.",
      },
      true,
    );
    await add(
      "tickets",
      {
        subject: "Demo: onboarding equipment request",
        category: "General",
        body: "Sample helpdesk request: arrange equipment and induction for the new project consultant.",
      },
      true,
    );
    for (const [index, title] of [
      "Member Relations Executive (Demo)",
      "Events Coordinator (Demo)",
    ].entries()) {
      const job = await add("jobs", {
        title,
        department: index ? "Operations" : "Member Services",
        location: "Pune, Maharashtra",
        type: "Full-time",
      });
      for (const n of [1, 2]) {
        const candidate = await add("candidates", {
          name: `Demo Candidate ${index * 2 + n}`,
          email: `candidate${index * 2 + n}@mccia-demo.example`,
          jobId: job.id,
          resumeText:
            "Fictional candidate profile. Demonstrates interview scheduling and hiring-stage management. No real CV or personal information.",
        });
        if (n === 2)
          await store.save(
            actor,
            "candidates",
            await validateRecord(
              store,
              actor,
              "candidates",
              { stage: "Interview" },
              candidate,
            ),
            candidate.id,
            candidate.version,
          );
      }
    }
    for (const index of [0, 1, 2])
      await add("assets", {
        name: `Demo laptop ${index + 1}`,
        serialNumber: `DEMO-LAPTOP-00${index + 1}`,
        category: "Laptop",
        status: index === 2 ? "Available" : "Assigned",
        assignedToId: employees[index].id,
        purchaseDate: offsetDate(-90),
      });
    await add("appraisals", {
      employeeId: employees[2].id,
      period: "Demo review",
      selfRating: 4,
      managerRating: 4,
      goalsSet:
        "Demonstration: coordinate two member events and document the event checklist.",
      feedback: "Fictional review for exploring the performance workflow.",
    });
    const guide = Buffer.from(
      "DEMO DOCUMENT\nThis is a fictional employee onboarding note for demonstration only. It is not an employment contract or an official MCCIA document.\n",
    );
    await store.save(actor, "documents", {
      employeeId: employees[7].id,
      name: "Demo-onboarding-note.txt",
      mimeType: "text/plain",
      contentBase64: guide.toString("base64"),
      category: "Other",
      uploadDate: baseDate,
      size: "1 KB",
    });
    if (baseDate >= "2026-01-01")
      await createPayroll(store, actor, { month: baseDate.slice(0, 7) });
    await store.audit(actor, "Created fictional demo workspace", actor.orgId);
    return {
      workspace: DEMO_SLUG,
      email: DEMO_EMAIL,
      password,
      role: actor.accessRole,
      employees: employees.length,
    };
  });
}
