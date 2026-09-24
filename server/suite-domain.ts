import { mapAsync, reduceAsync } from "./async-utils";
import { HttpError, Store, type Actor, type Kind } from "./store";
import { choice, date, number, stringList, text } from "./validation";
export const suiteKinds: Kind[] = [
  "branches",
  "holidays",
  "shifts",
  "shiftAssignments",
  "leaveAdjustments",
  "expenses",
  "lifecycle",
  "employeeHistory",
  "employmentChanges",
  "profileRequests",
  "tickets",
  "policies",
  "acknowledgements",
  "payroll",
  "attendanceCorrections",
];
export const moduleNames = [
  "leaves",
  "payroll",
  "documents",
  "recruitment",
  "performance",
  "assets",
  "emailhub",
  "expenses",
  "lifecycle",
  "helpdesk",
  "policies",
  "reports",
  "integrations",
];
export const workerTypes = [
  "Permanent",
  "Contractor",
  "Apprentice",
  "Temporary",
  "Daily wage",
  "Part-time",
];
export const templates = {
  General: {
    departments: ["Operations", "Sales", "Finance", "HR"],
    workerTypes: [...workerTypes],
    onboarding: [
      "Collect joining documents",
      "Confirm employment terms",
      "Assign equipment",
      "Complete induction",
    ],
    offboarding: [
      "Confirm last working date",
      "Return company assets",
      "Complete knowledge transfer",
      "Review final settlement",
    ],
  },
  Manufacturing: {
    departments: [
      "Production",
      "Quality",
      "Maintenance",
      "Stores",
      "Finance",
      "HR",
    ],
    workerTypes: [...workerTypes],
    onboarding: [
      "Collect joining documents",
      "Complete safety induction",
      "Assign supervisor and shift",
      "Issue protective equipment",
    ],
    offboarding: [
      "Return tools and protective equipment",
      "Complete production handover",
      "Review final settlement",
    ],
  },
  Retail: {
    departments: ["Store Operations", "Sales", "Warehouse", "Finance", "HR"],
    workerTypes: [...workerTypes],
    onboarding: [
      "Collect joining documents",
      "Assign store and supervisor",
      "Complete POS training",
      "Issue uniform",
    ],
    offboarding: [
      "Return store keys and equipment",
      "Complete cash and stock handover",
      "Review final settlement",
    ],
  },
  Services: {
    departments: ["Delivery", "Sales", "Support", "Finance", "HR"],
    workerTypes: [...workerTypes],
    onboarding: [
      "Collect joining documents",
      "Assign client team",
      "Issue equipment",
      "Complete information security induction",
    ],
    offboarding: [
      "Transfer client responsibilities",
      "Return equipment",
      "Review final settlement",
    ],
  },
};
export async function config(store: Store, orgId: string): Promise<any> {
  return {
    enabledModules: moduleNames,
    industry: "General",
    workerTypes,
    customFields: [],
    weekendDays: [0, 6],
    leavePolicies: [],
    approvalChains: {
      leaves: ["hr"],
      expenses: ["hr"],
      profileRequests: ["hr"],
      attendanceCorrections: ["hr"],
    },
    expenseCategories: ["Travel", "Meals", "Supplies", "Other"],
    expenseLimit: 50000,
    payrollTemplates: [
      {
        id: "std_default",
        name: "Standard Full-Time Payroll",
        description: "Default standard template with Basic, HRA, Medical & Transport Allowances, Gratuity, PF & ESI.",
        allowances: [
          { id: "a_basic", name: "Basic Salary", type: "percentage", value: 50, taxable: true },
          { id: "a_hra", name: "House Rent Allowance (HRA)", type: "percentage", value: 40, taxable: true },
          { id: "a_special", name: "Special Allowance", type: "fixed", value: 5000, taxable: true },
          { id: "a_medical", name: "Medical Allowance", type: "fixed", value: 1250, taxable: false },
        ],
        deductions: [
          { id: "d_pf", name: "Provident Fund (PF)", type: "percentage", value: 12, statutory: true },
          { id: "d_esi", name: "ESI Employee Contribution", type: "percentage", value: 0.75, statutory: true },
          { id: "d_pt", name: "Professional Tax", type: "fixed", value: 200, statutory: true },
        ],
        gratuity: {
          enabled: true,
          percentage: 4.81,
          eligibilityYears: 5,
          calculationFormula: "(Basic * 15 / 26) per year of service",
        },
      },
    ],
    onboarding: templates.General.onboarding,
    offboarding: templates.General.offboarding,
    defaultLanguage: "en",
    ...(await store.company(orgId)).suite,
  };
}
export const today = async (store: Store, orgId: string) =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: (await store.company(orgId)).timezone,
  });
export async function requireModule(
  store: Store,
  actor: Actor,
  module: string,
) {
  if (!(await config(store, actor.orgId)).enabledModules.includes(module))
    throw new HttpError(403, "This module is disabled for your company.");
}
export async function validateConfig(body: any, store: Store, actor: Actor) {
  const current = await config(store, actor.orgId),
    next = { ...current, ...body };
  const enabledModules = Array.isArray(next.enabledModules)
    ? [
        ...new Set(
          next.enabledModules.map((v: any) => choice(v, "module", moduleNames)),
        ),
      ]
    : current.enabledModules;
  const fields = next.customFields;
  if (!Array.isArray(fields) || fields.length > 30)
    throw new HttpError(400, "Use at most 30 custom fields.");
  const customFields = fields.map((field: any) => {
    const key = text(field.key, "Field key", 40);
    if (
      !/^[a-z][a-z0-9_]*$/.test(key) ||
      ["__proto__", "constructor", "prototype"].includes(key)
    )
      throw new HttpError(
        400,
        "Field keys must use lowercase letters, numbers and underscores.",
      );
    return {
      key,
      label: text(field.label, "Field label", 80),
      type: choice(field.type, "field type", [
        "text",
        "number",
        "date",
        "select",
      ]),
      required: !!field.required,
      options:
        field.type === "select" ? stringList(field.options, "Options") : [],
    };
  });
  if (new Set(customFields.map((f: any) => f.key)).size !== customFields.length)
    throw new HttpError(400, "Custom field keys must be unique.");
  const weekendDays = next.weekendDays;
  if (
    !Array.isArray(weekendDays) ||
    weekendDays.length > 6 ||
    weekendDays.some((n: any) => !Number.isInteger(n) || n < 0 || n > 6)
  )
    throw new HttpError(400, "Choose up to six weekly days off.");
  if (!Array.isArray(next.leavePolicies) || next.leavePolicies.length > 30)
    throw new HttpError(400, "Use at most 30 leave policies.");
  const leavePolicies = await mapAsync(next.leavePolicies, async (p: any) => ({
    leaveType: choice(
      p.leaveType,
      "leave type",
      (await store.company(actor.orgId)).leaveTypes,
    ),
    annualDays: number(p.annualDays, "Annual allowance", 366),
    accrual: choice(p.accrual, "accrual", ["Annual", "Monthly"]),
    excludeNonWorking: !!p.excludeNonWorking,
    paid: p.paid !== false,
    carryForward: number(p.carryForward || 0, "Carry-forward cap", 366),
  }));
  if (
    new Set(leavePolicies.map((p: any) => p.leaveType)).size !==
    leavePolicies.length
  )
    throw new HttpError(400, "Use one policy per leave type.");
  const approvalChains: any = {};
  for (const kind of [
    "leaves",
    "expenses",
    "profileRequests",
    "attendanceCorrections",
  ]) {
    const stages = next.approvalChains?.[kind];
    if (!Array.isArray(stages) || stages.length < 1 || stages.length > 5)
      throw new HttpError(400, "Each approval chain needs one to five stages.");
    approvalChains[kind] = await mapAsync(stages, async (stage: any) => {
      if (["hr", "owner", "manager"].includes(stage)) return stage;
      const row = await store.db
        .prepare("SELECT id FROM users WHERE id=? AND org_id=? AND active=1")
        .get(text(stage, "Approver"), actor.orgId);
      if (!row)
        throw new HttpError(
          400,
          "Choose an active company account as approver.",
        );
      return stage;
    });
  }
  const newWorkers = stringList(next.workerTypes, "Worker categories");
  for (const employee of await store.list(actor.orgId, "employees"))
    if (employee.workerType && !newWorkers.includes(employee.workerType))
      throw new HttpError(409, "A worker category is still used by employees.");
  return {
    enabledModules,
    industry: choice(next.industry, "industry", Object.keys(templates)),
    workerTypes: newWorkers,
    customFields,
    weekendDays: [...new Set(weekendDays)],
    leavePolicies,
    approvalChains,
    expenseCategories: stringList(next.expenseCategories, "Expense categories"),
    expenseLimit: number(next.expenseLimit, "Expense limit", 10000000),
    payrollTemplates: Array.isArray(next.payrollTemplates)
      ? next.payrollTemplates.map((t: any, idx: number) => ({
          id: text(t.id || `tpl_${idx}`, "Template ID", 40),
          name: text(t.name || "Custom Template", "Template Name", 100),
          description: text(t.description || "", "Description", 250, true),
          allowances: Array.isArray(t.allowances)
            ? t.allowances.map((a: any, aIdx: number) => ({
                id: text(a.id || `alw_${aIdx}`, "Allowance ID", 40),
                name: text(a.name || "Allowance", "Allowance Name", 100),
                type: choice(a.type || "percentage", "Allowance type", ["percentage", "fixed"]),
                value: number(a.value || 0, "Allowance value", 10000000),
                taxable: !!a.taxable,
              }))
            : [],
          deductions: Array.isArray(t.deductions)
            ? t.deductions.map((d: any, dIdx: number) => ({
                id: text(d.id || `ded_${dIdx}`, "Deduction ID", 40),
                name: text(d.name || "Deduction", "Deduction Name", 100),
                type: choice(d.type || "percentage", "Deduction type", ["percentage", "fixed"]),
                value: number(d.value || 0, "Deduction value", 10000000),
                statutory: !!d.statutory,
              }))
            : [],
          gratuity: {
            enabled: !!t.gratuity?.enabled,
            percentage: number(t.gratuity?.percentage || 4.81, "Gratuity Percentage", 100),
            eligibilityYears: number(t.gratuity?.eligibilityYears || 5, "Eligibility Years", 50),
            calculationFormula: text(t.gratuity?.calculationFormula || "(Basic * 15 / 26) per year", "Formula", 150, true),
          },
        }))
      : current.payrollTemplates || [],
    onboarding: stringList(next.onboarding, "Onboarding tasks"),
    offboarding: stringList(next.offboarding, "Offboarding tasks"),
    defaultLanguage: choice(next.defaultLanguage, "language", [
      "en",
      "hi",
      "mr",
    ]),
  };
}
export async function employeeExtras(
  store: Store,
  actor: Actor,
  body: any,
  existing?: any,
) {
  const settings = await config(store, actor.orgId),
    branchId = text(body.branchId, "Branch", 200, true),
    managerId = text(body.managerId, "Manager", 200, true);
  if (branchId) await store.get(actor.orgId, "branches", branchId);
  if (managerId) {
    let cursor = managerId;
    const visited = new Set<string>(existing ? [existing.id] : []);
    while (cursor) {
      if (visited.has(cursor))
        throw new HttpError(400, "Reporting managers cannot form a cycle.");
      visited.add(cursor);
      cursor = (await store.get(actor.orgId, "employees", cursor)).managerId;
    }
  }
  const customFields: Record<string, any> = {};
  for (const field of settings.customFields) {
    const value = body.customFields?.[field.key];
    if (value === undefined || value === null || value === "") {
      if (field.required)
        throw new HttpError(400, `${field.label} is required.`);
      continue;
    }
    customFields[field.key] =
      field.type === "number"
        ? number(value, field.label)
        : field.type === "date"
          ? date(value, field.label)
          : field.type === "select"
            ? choice(value, field.label, field.options)
            : text(value, field.label, 1000);
  }
  const endDate = body.endDate ? date(body.endDate, "Last working date") : "";
  if (endDate && endDate < body.hireDate)
    throw new HttpError(400, "Last working date cannot precede joining.");
  let bankDetails = body.bankDetails;
  if (bankDetails) {
    const accountNumber = text(bankDetails.accountNumber, "Account number", 25),
      ifsc = text(bankDetails.ifsc, "IFSC", 11).toUpperCase();
    if (
      !/^\d{6,25}$/.test(accountNumber) ||
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)
    )
      throw new HttpError(400, "Enter a valid account number and IFSC.");
    bankDetails = {
      accountName: text(bankDetails.accountName, "Account holder"),
      bankName: text(bankDetails.bankName, "Bank name"),
      accountNumber,
      ifsc,
    };
  }
  if (body.status === "Terminated" && !endDate)
    throw new HttpError(
      400,
      "Enter the last working date before ending employment.",
    );
  return {
    branchId,
    managerId,
    bankDetails,
    costCentre: text(body.costCentre, "Cost centre", 100, true),
    workerType: choice(
      body.workerType || settings.workerTypes[0],
      "worker category",
      settings.workerTypes,
    ),
    payBasis: choice(body.payBasis || "Monthly", "pay basis", [
      "Monthly",
      "Daily",
      "Hourly",
    ]),
    payRate: number(body.payRate || 0, "Daily/hourly rate"),
    endDate,
    probationEnd: body.probationEnd
      ? date(body.probationEnd, "Probation date")
      : "",
    customFields,
  };
}
export async function approvalFor(
  store: Store,
  actor: Actor,
  kind: string,
  employee: any,
) {
  const stages = (await config(store, actor.orgId)).approvalChains[kind] || [
    "hr",
  ];
  return {
    approvalStages: await mapAsync(stages, async (stage: string) => {
      if (stage !== "manager") return stage;
      const manager =
        employee.managerId &&
        (await store.db
          .prepare(
            "SELECT id FROM users WHERE org_id=? AND employee_id=? AND active=1",
          )
          .get(actor.orgId, employee.managerId));
      if (!manager)
        throw new HttpError(
          400,
          "This approval chain requires a reporting manager with an active account.",
        );
      return String(manager.id);
    }),
    approvalStep: 0,
    decisions: [],
  };
}
export function mayApprove(actor: Actor, record: any): boolean {
  if (actor.employeeId && record.employeeId === actor.employeeId) return false;
  const stage = (record.approvalStages || ["hr"])[record.approvalStep || 0];
  return (
    stage === actor.id ||
    (stage === "owner" && actor.accessRole === "owner") ||
    (stage === "hr" && actor.accessRole !== "employee")
  );
}
export function decision(actor: Actor, record: any, action: any, comment: any) {
  if (record.status !== "Pending")
    throw new HttpError(409, "This request has already been decided.");
  if (!mayApprove(actor, record))
    throw new HttpError(
      403,
      "You are not the current approver, or this is your own request.",
    );
  const outcome = choice(action, "decision", ["Approved", "Rejected"]);
  const step = (record.approvalStep || 0) + 1;
  return {
    ...record,
    approvalStep: step,
    status:
      outcome === "Rejected"
        ? "Rejected"
        : step >= (record.approvalStages || ["hr"]).length
          ? "Approved"
          : "Pending",
    decisions: [
      ...(record.decisions || []),
      {
        by: actor.id,
        name: actor.name,
        action: outcome,
        comment: text(comment, "Decision note", 2000, true),
        at: new Date().toISOString(),
      },
    ],
  };
}
export async function workingDates(
  store: Store,
  orgId: string,
  employee: any,
  start: string,
  end: string,
  exclude: boolean,
): Promise<string[]> {
  const weekends = (await config(store, orgId)).weekendDays,
    holidays = await store.list(orgId, "holidays");
  const result: string[] = [];
  for (let day = Date.parse(start); day <= Date.parse(end); day += 86400000) {
    const value = new Date(day).toISOString().slice(0, 10);
    if (
      !exclude ||
      (!weekends.includes(new Date(day).getUTCDay()) &&
        !holidays.some(
          (h) =>
            h.date === value &&
            (!h.branchId || h.branchId === employee.branchId),
        ))
    )
      result.push(value);
  }
  return result;
}
export async function leaveBalance(
  store: Store,
  orgId: string,
  employee: any,
  type: string,
  asOf: string,
  ignoreId?: string,
  depth = 0,
): Promise<any> {
  const policy = (await config(store, orgId)).leavePolicies.find(
    (p: any) => p.leaveType === type,
  );
  if (!policy) return { leaveType: type, configured: false };
  const year = Number(asOf.slice(0, 4)),
    start = `${year}-01-01`,
    end = `${year}-12-31`;
  const employedStart = employee.hireDate > start ? employee.hireDate : start;
  const months =
    employedStart > asOf
      ? 0
      : Math.max(
          0,
          Number(asOf.slice(5, 7)) - Number(employedStart.slice(5, 7)) + 1,
        );
  const allowance =
    policy.accrual === "Annual"
      ? employedStart > asOf
        ? 0
        : policy.annualDays
      : Math.floor(((policy.annualDays * months) / 12) * 100) / 100;
  const carried =
    depth < 10 &&
    year > Number(employee.hireDate.slice(0, 4)) &&
    policy.carryForward
      ? Math.min(
          policy.carryForward,
          Math.max(
            0,
            (
              await leaveBalance(
                store,
                orgId,
                employee,
                type,
                `${year - 1}-12-31`,
                undefined,
                depth + 1,
              )
            ).available || 0,
          ),
        )
      : 0;
  const adjustments = (await store.list(orgId, "leaveAdjustments"))
    .filter(
      (a) =>
        a.employeeId === employee.id && a.leaveType === type && a.year === year,
    )
    .reduce((sum, a) => sum + a.days, 0);
  const leaves = (await store.list(orgId, "leaves")).filter(
    (l) =>
      l.id !== ignoreId &&
      l.employeeId === employee.id &&
      l.leaveType === type &&
      ["Pending", "Approved"].includes(l.status),
  );
  const used = async (status: string) =>
    await reduceAsync(
      leaves.filter((l) => l.status === status),
      async (sum, l) =>
        sum +
        (
          l.chargeDates ||
          (await workingDates(
            store,
            orgId,
            employee,
            l.startDate,
            l.endDate,
            policy.excludeNonWorking,
          ))
        ).filter((d: string) => d >= start && d <= end).length,
      0,
    );
  const approved = await used("Approved"),
    pending = await used("Pending");
  return {
    leaveType: type,
    configured: true,
    year,
    allowance,
    carried,
    adjustments,
    approved,
    pending,
    available:
      Math.round(
        (allowance + carried + adjustments - approved - pending) * 100,
      ) / 100,
  };
}
export async function leaveDetails(
  store: Store,
  actor: Actor,
  employee: any,
  type: string,
  start: string,
  end: string,
  ignoreId?: string,
) {
  const policy = (await config(store, actor.orgId)).leavePolicies.find(
    (p: any) => p.leaveType === type,
  );
  const dates = await workingDates(
    store,
    actor.orgId,
    employee,
    start,
    end,
    !!policy?.excludeNonWorking,
  );
  if (!dates.length)
    throw new HttpError(400, "This request contains no chargeable leave days.");
  if (policy?.paid)
    for (const year of [...new Set(dates.map((d) => d.slice(0, 4)))]) {
      const lastDate = dates.filter((d) => d.startsWith(year)).at(-1)!;
      const balance = await leaveBalance(
        store,
        actor.orgId,
        employee,
        type,
        lastDate,
        ignoreId,
      );
      if (dates.filter((d) => d.startsWith(year)).length > balance.available)
        throw new HttpError(409, `Insufficient ${type} balance for ${year}.`);
    }
  return {
    days: dates.length,
    chargeDates: dates,
    paid: policy?.paid !== false,
    policySnapshot: policy || null,
  };
}
