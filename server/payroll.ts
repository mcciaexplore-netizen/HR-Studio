import { HttpError, Store, type Actor } from "./store";
import { choice, date, number, text } from "./validation";
import { today } from "./suite-domain";
import { attendanceSummary } from "./attendance-summary";

export const payrollRuleVersion = "IN-MH-2026-09-16";
export const statutorySources = [
  {
    name: "EPFO contribution rates",
    url: "https://www.epfindia.gov.in/site_docs/PDFs/MiscPDFs/ContributionRate.pdf",
  },
  {
    name: "ESIC contribution and coverage",
    url: "https://esic.gov.in/attachments/esistatedirectoratefile/ef84365f31f15306ddb397902d675858.pdf",
  },
  {
    name: "Maharashtra professional tax schedules",
    url: "https://www.mahagst.gov.in/en/profession-tax-and-other-rate-schedule",
  },
  {
    name: "Maharashtra Labour Welfare Board",
    url: "https://public.mlwb.in/public",
  },
  {
    name: "Labour Ministry wage definition clarification",
    url: "https://www.labour.gov.in/static/uploads/2026/03/a4ccf4c6d97c4f1f36a6d83f8c64213d.pdf",
  },
];
const paise = (value: number) => Math.round(value * 100);
const money = (value: number) => Math.round(value) / 100;
export function monthBounds(value: unknown) {
  const month = text(value, "Payroll month", 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new HttpError(400, "Use a valid YYYY-MM payroll month.");
  const start = date(`${month}-01`, "Period start"),
    days = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    ).getUTCDate();
  return { month, start, end: `${month}-${days}`, days };
}
/** Eligibility and assessable wages are explicit reviewed inputs, never inferred from job titles. */
export function statutory(month: string, gross: number, input: any) {
  const ptCategory = choice(
    input.ptCategory || "Unconfirmed",
    "professional tax category",
    ["Unconfirmed", "Standard", "Women", "Exempt"],
  );
  const pfWages = number(input.pfWages || 0, "PF assessable wages"),
    esiWages = number(input.esiWages || 0, "ESI assessable wages");
  const pfRate = Number(input.pfRate ?? 12);
  if (![10, 12].includes(pfRate))
    throw new HttpError(
      400,
      "PF rate must be 10% or 12%, according to establishment eligibility.",
    );
  const pfBase = input.pfUncapped ? pfWages : Math.min(pfWages, 15000);
  const pfEmployee = input.pfApplicable
    ? Math.round((pfBase * pfRate) / 100)
    : 0;
  const pfEmployerTotal = pfEmployee;
  const eps =
    input.pfApplicable && input.epsEligible
      ? Math.min(
          Math.round(Math.min(pfWages, 15000) * 0.0833),
          1250,
          pfEmployerTotal,
        )
      : 0;
  const averageDailyWage = number(
    input.esiAverageDailyWage || 0,
    "ESI average daily wages",
  );
  if (input.esiApplicable && esiWages > 0 && averageDailyWage <= 0)
    throw new HttpError(400, "Enter average daily wages for ESI assessment.");
  const esiEmployee =
    input.esiApplicable && averageDailyWage > 176
      ? Math.ceil(esiWages * 0.0075)
      : 0;
  const esiEmployer = input.esiApplicable ? Math.ceil(esiWages * 0.0325) : 0;
  const highRate = month.endsWith("-02") ? 300 : 200;
  const professionalTax =
    ptCategory === "Women"
      ? gross > 25000
        ? highRate
        : 0
      : ptCategory === "Standard"
        ? gross > 10000
          ? highRate
          : gross > 7500
            ? 175
            : 0
        : 0;
  const lwfDue = !!input.lwfApplicable && ["06", "12"].includes(month.slice(5));
  return {
    pfEmployee,
    pfEmployer: pfEmployerTotal - eps,
    eps,
    esiEmployee,
    esiEmployer,
    professionalTax,
    lwfEmployee: lwfDue ? 25 : 0,
    lwfEmployer: lwfDue ? 75 : 0,
    tds: number(input.tds || 0, "TDS"),
    ruleVersion: payrollRuleVersion,
  };
}
export function calculateLine(
  month: string,
  snapshot: any,
  input: any,
  reimbursement = 0,
) {
  const bounds = monthBounds(month),
    eligibleDays = number(snapshot.eligibleDays, "Eligible days", bounds.days);
  const unpaidDays = number(input.unpaidDays || 0, "Unpaid days", eligibleDays);
  const units = number(
    input.units ?? snapshot.units ?? 0,
    "Payable units",
    snapshot.payBasis === "Hourly" ? bounds.days * 24 : bounds.days,
  );
  const overtimeHours = number(
      input.overtimeHours || 0,
      "Overtime hours",
      bounds.days * 24,
    ),
    overtimeRate = number(input.overtimeRate || 0, "Overtime rate");
  const earningsFactor = eligibleDays
    ? (eligibleDays - unpaidDays) / eligibleDays
    : 0;
  const components: any = {};
  for (const key of ["basic", "hra", "allowances"])
    components[key] = money(
      paise(snapshot.monthlyComponents[key] || 0) * earningsFactor,
    );
  const regular =
    snapshot.payBasis === "Monthly"
      ? paise(components.basic) +
        paise(components.hra) +
        paise(components.allowances)
      : units === snapshot.units && snapshot.unitEarnings !== undefined
        ? paise(snapshot.unitEarnings)
        : paise(snapshot.payRate) * units;
  const overtime = paise(overtimeRate) * overtimeHours,
    bonus = paise(number(input.bonus || 0, "Bonus"));
  const gross = money(regular + overtime + bonus),
    contributions = statutory(month, gross, input);
  const configuredDeduction = money(
      paise(snapshot.deductions || 0) * earningsFactor,
    ),
    otherDeductions = number(input.otherDeductions || 0, "Other deductions");
  const totalDeductions = money(
    paise(configuredDeduction) +
      paise(otherDeductions) +
      [
        "pfEmployee",
        "esiEmployee",
        "professionalTax",
        "lwfEmployee",
        "tds",
      ].reduce((sum, key) => sum + paise(contributions[key]), 0),
  );
  const net = money(
    paise(gross) + paise(reimbursement) - paise(totalDeductions),
  );
  if (net < 0)
    throw new HttpError(400, "Deductions exceed earnings and reimbursements.");
  return {
    employeeId: snapshot.employeeId,
    employeeName: snapshot.employeeName,
    snapshot,
    input: {
      unpaidDays,
      units,
      overtimeHours,
      overtimeRate,
      bonus: number(input.bonus || 0, "Bonus"),
      otherDeductions,
      pfApplicable: !!input.pfApplicable,
      pfRate: Number(input.pfRate ?? 12),
      pfWages: number(input.pfWages || 0, "PF wages"),
      pfUncapped: !!input.pfUncapped,
      epsEligible: !!input.epsEligible,
      esiApplicable: !!input.esiApplicable,
      esiWages: number(input.esiWages || 0, "ESI wages"),
      esiAverageDailyWage: number(
        input.esiAverageDailyWage || 0,
        "ESI average daily wages",
      ),
      ptCategory: input.ptCategory || "Unconfirmed",
      lwfApplicable: !!input.lwfApplicable,
      tds: contributions.tds,
      reviewed: !!input.reviewed,
      reviewNote: text(input.reviewNote, "Review note", 2000, true),
    },
    components,
    gross,
    overtime: money(overtime),
    reimbursement,
    configuredDeduction,
    otherDeductions,
    ...contributions,
    totalDeductions,
    net,
  };
}
function payrollData(store: Store, actor: Actor, body: any) {
  const bounds = monthBounds(body.month),
    currentMonth = today(store, actor.orgId).slice(0, 7);
  if (bounds.month > currentMonth)
    throw new HttpError(400, "Future payroll periods cannot be processed.");
  if (bounds.month < "2026-01")
    throw new HttpError(
      400,
      "This statutory rule version supports periods from January 2026.",
    );
  const history = store.list(actor.orgId, "employeeHistory");
  const employees = store
    .list(actor.orgId, "employees")
    .filter(
      (employee) =>
        employee.hireDate <= bounds.end &&
        (employee.status !== "Terminated" || employee.endDate) &&
        (!employee.endDate || employee.endDate >= bounds.start),
    );
  if (!employees.length)
    throw new HttpError(400, "No employees are eligible for this period.");
  const lines = employees.map((employee) => {
    const employeeHistory = history
      .filter((event) => event.employeeId === employee.id)
      .sort(
        (a, b) =>
          a.effectiveDate.localeCompare(b.effectiveDate) ||
          (a.employeeVersion || 0) - (b.employeeVersion || 0) ||
          a.changedAt.localeCompare(b.changedAt),
      );
    const historicalOn = (date: string) =>
      employeeHistory.filter((event) => event.effectiveDate <= date).at(-1)
        ?.after ||
      employeeHistory[0]?.before ||
      employee;
    const periodEndEmployee = historicalOn(
      employee.endDate && employee.endDate < bounds.end
        ? employee.endDate
        : bounds.end,
    );
    const payBasis = periodEndEmployee.payBasis || "Monthly";
    const sums: any = { basic: 0, hra: 0, allowances: 0, deductions: 0 };
    let eligibleDays = 0;
    for (let day = 1; day <= bounds.days; day++) {
      const date = `${bounds.month}-${String(day).padStart(2, "0")}`;
      if (
        date < employee.hireDate ||
        (employee.endDate && date > employee.endDate)
      )
        continue;
      eligibleDays++;
      const historical = historicalOn(date);
      if ((historical.payBasis || "Monthly") !== payBasis)
        throw new HttpError(
          400,
          `${employee.name}: pay-basis changes within a month need a separate reviewed adjustment. Schedule changes between monthly, daily and hourly pay on the first day of a period.`,
        );
      for (const key of Object.keys(sums))
        sums[key] += paise(historical.salary[key] || 0) / bounds.days;
    }
    const attendanceDays = attendanceSummary(
      store,
      actor.orgId,
      employee.id,
      bounds.month,
    ).filter(
      (day) =>
        day.date >= employee.hireDate &&
        (!employee.endDate || day.date <= employee.endDate),
    );
    const suggestedOvertime = attendanceDays.reduce(
      (sum, day) => sum + day.overtimeHours,
      0,
    );
    const units =
      payBasis === "Hourly"
        ? attendanceDays.reduce(
            (sum, day) => sum + day.paidHours - day.overtimeHours,
            0,
          )
        : attendanceDays.length;
    const unitEarnings = attendanceDays.reduce(
      (sum, day) =>
        sum +
        paise(historicalOn(day.date).payRate || 0) *
          (payBasis === "Hourly" ? day.paidHours - day.overtimeHours : 1),
      0,
    );
    const snapshot = {
      employeeId: employee.id,
      employeeName: employee.name,
      email: employee.email,
      designation: periodEndEmployee.role,
      department: periodEndEmployee.department,
      branchId: periodEndEmployee.branchId,
      workerType: periodEndEmployee.workerType,
      eligibleDays,
      payBasis,
      payRate: units
        ? Math.round(unitEarnings / units) / 100
        : periodEndEmployee.payRate || 0,
      unitEarnings: money(unitEarnings),
      units: Math.round(units * 100) / 100,
      suggestedOvertime: Math.round(suggestedOvertime * 100) / 100,
      monthlyComponents: {
        basic: money(sums.basic),
        hra: money(sums.hra),
        allowances: money(sums.allowances),
      },
      deductions: money(sums.deductions),
      salaryHistoryIds: employeeHistory.map((event) => event.id),
      historyWarning:
        employeeHistory.length === 0
          ? "No dated salary history exists for this employee; verify the period earnings against prior payroll records."
          : "",
    };
    const unpaid = store
      .list(actor.orgId, "leaves")
      .filter(
        (leave) =>
          leave.employeeId === employee.id &&
          leave.status === "Approved" &&
          leave.paid === false,
      )
      .flatMap((leave) => leave.chargeDates || [])
      .filter((day: string) => day.startsWith(bounds.month)).length;
    return calculateLine(bounds.month, snapshot, {
      unpaidDays: Math.min(unpaid, eligibleDays),
      overtimeHours: snapshot.suggestedOvertime,
      ptCategory: "Unconfirmed",
    });
  });
  return {
    month: bounds.month,
    status: "Draft",
    createdBy: actor.id,
    createdAt: new Date().toISOString(),
    companySnapshot: {
      name: store.company(actor.orgId).name,
      location: "Pune, Maharashtra",
      currency: "INR",
    },
    ruleVersion: payrollRuleVersion,
    lines,
    expenseIds: [],
    history: [],
  };
}
export function createPayroll(store: Store, actor: Actor, body: any) {
  return store.save(actor, "payroll", payrollData(store, actor, body));
}
export function editPayroll(
  store: Store,
  actor: Actor,
  period: any,
  body: any,
) {
  if (period.status !== "Draft")
    throw new HttpError(
      409,
      "Only draft payroll can be edited. Return it for correction first.",
    );
  const line = period.lines.find(
    (line: any) => line.employeeId === body.employeeId,
  );
  if (!line) throw new HttpError(404, "Payroll employee not found.");
  const recalculated = calculateLine(
    period.month,
    line.snapshot,
    body.input,
    line.reimbursement,
  );
  return store.save(
    actor,
    "payroll",
    {
      ...period,
      lines: period.lines.map((entry: any) =>
        entry.employeeId === body.employeeId ? recalculated : entry,
      ),
    },
    period.id,
    body.version,
  );
}
export function payrollAction(
  store: Store,
  actor: Actor,
  period: any,
  body: any,
) {
  const action = choice(body.action, "payroll action", [
    "Submit",
    "Approve",
    "Return",
    "Record payment",
    "Include expenses",
    "Refresh earnings",
  ]);
  const now = new Date().toISOString();
  return store.transaction(() => {
    if (action === "Refresh earnings") {
      if (period.status !== "Draft")
        throw new HttpError(409, "Only draft earnings can be refreshed.");
      return store.save(
        actor,
        "payroll",
        {
          ...period,
          ...payrollData(store, actor, { month: period.month }),
          createdBy: period.createdBy,
          createdAt: period.createdAt,
          history: [...period.history, { action, by: actor.name, at: now }],
        },
        period.id,
        body.version,
      );
    }
    if (action === "Include expenses") {
      if (period.status !== "Draft")
        throw new HttpError(
          409,
          "Expenses can only be added to draft payroll.",
        );
      const eligible = new Set(
        period.lines.map((line: any) => line.employeeId),
      );
      const expenses = store
        .list(actor.orgId, "expenses")
        .filter(
          (expense) =>
            expense.status === "Approved" &&
            eligible.has(expense.employeeId) &&
            !store.db
              .prepare(
                "SELECT 1 FROM payroll_expenses WHERE org_id=? AND expense_id=?",
              )
              .get(actor.orgId, expense.id),
        );
      return store.save(
        actor,
        "payroll",
        {
          ...period,
          expenseIds: expenses.map((expense) => expense.id),
          lines: period.lines.map((line: any) =>
            calculateLine(
              period.month,
              line.snapshot,
              line.input,
              expenses
                .filter((expense) => expense.employeeId === line.employeeId)
                .reduce((sum, expense) => sum + expense.amount, 0),
            ),
          ),
        },
        period.id,
        body.version,
      );
    }
    if (action === "Submit") {
      if (period.status !== "Draft")
        throw new HttpError(409, "Only draft payroll can be submitted.");
      if (
        period.lines.some(
          (line: any) =>
            !line.input.reviewed || line.input.ptCategory === "Unconfirmed",
        )
      )
        throw new HttpError(
          400,
          "Review statutory eligibility, assessable wages, TDS and attendance inputs for every employee before submitting.",
        );
      if (
        period.lines.some(
          (line: any) =>
            line.input.overtimeHours > 0 && line.input.overtimeRate <= 0,
        )
      )
        throw new HttpError(
          400,
          "Enter an approved rate for payable overtime, or correct the overtime hours before submission.",
        );
      period = { ...period, status: "Submitted", submittedBy: actor.id };
    } else if (action === "Approve") {
      if (actor.accessRole !== "owner")
        throw new HttpError(403, "The company owner must approve payroll.");
      if (period.status !== "Submitted" || period.submittedBy === actor.id)
        throw new HttpError(
          409,
          "Payroll needs a different reviewer from the person who submitted it.",
        );
      for (const id of period.expenseIds) {
        const expense = store.get(actor.orgId, "expenses", id);
        if (expense.status !== "Approved")
          throw new HttpError(
            409,
            "An included expense is no longer approved. Return and refresh the draft.",
          );
        if (
          store.db
            .prepare(
              "SELECT 1 FROM payroll_expenses WHERE org_id=? AND expense_id=?",
            )
            .get(actor.orgId, id)
        )
          throw new HttpError(
            409,
            "An expense was already included in another approved period.",
          );
        store.db
          .prepare("INSERT INTO payroll_expenses VALUES(?,?,?)")
          .run(actor.orgId, id, period.id);
      }
      period = {
        ...period,
        status: "Approved",
        approvedBy: actor.id,
        approvedAt: now,
      };
    } else if (action === "Return") {
      if (period.status !== "Submitted")
        throw new HttpError(409, "Only submitted payroll can be returned.");
      period = { ...period, status: "Draft" };
    } else {
      if (period.status !== "Approved")
        throw new HttpError(
          409,
          "Approve payroll before recording an external payment.",
        );
      period = {
        ...period,
        status: "Paid",
        paymentReference: text(body.reference, "Bank/payment reference", 200),
        paidAt: now,
      };
      for (const id of period.expenseIds) {
        const expense = store.get(actor.orgId, "expenses", id);
        store.save(
          actor,
          "expenses",
          {
            ...expense,
            status: "Reimbursed",
            paymentReference: period.paymentReference,
            paidAt: now,
          },
          id,
          expense.version,
        );
      }
    }
    period.history = [
      ...period.history,
      {
        action,
        by: actor.name,
        at: now,
        note: text(body.note, "Note", 2000, true),
      },
    ];
    return store.save(actor, "payroll", period, period.id, body.version);
  });
}
