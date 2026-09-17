import { Store, HttpError, type Actor, type Kind } from "./store";
import { choice, date, number, text, validateRecord } from "./validation";
import { approvalFor, config, today } from "./suite-domain";
export const moduleFor: Partial<Record<Kind, string>> = {
  leaves: "leaves",
  attendance: "leaves",
  holidays: "leaves",
  shifts: "leaves",
  shiftAssignments: "leaves",
  leaveAdjustments: "leaves",
  attendanceCorrections: "leaves",
  documents: "documents",
  jobs: "recruitment",
  candidates: "recruitment",
  assets: "assets",
  appraisals: "performance",
  emailLogs: "emailhub",
  expenses: "expenses",
  lifecycle: "lifecycle",
  employmentChanges: "lifecycle",
  tickets: "helpdesk",
  policies: "policies",
  acknowledgements: "policies",
  payroll: "payroll",
  integrationKeys: "integrations",
};
export function staff(actor: Actor) {
  if (actor.accessRole === "employee")
    throw new HttpError(403, "HR access is required.");
}
export function owner(actor: Actor) {
  if (actor.accessRole !== "owner")
    throw new HttpError(403, "Owner access is required.");
}
export async function subject(store: Store, actor: Actor, body: any) {
  const emp = await store.get(
    actor.orgId,
    "employees",
    text(
      actor.accessRole === "employee" ? actor.employeeId : body.employeeId,
      "Employee",
    ),
  );
  if (emp.status !== "Active")
    throw new HttpError(400, "Choose an active employee.");
  return emp;
}
function time(value: any) {
  const result = text(value, "Time", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result))
    throw new HttpError(400, "Enter time as HH:mm.");
  return result;
}
export function attachment(body: any) {
  if (!body?.contentBase64) return null;
  const contentBase64 = text(body.contentBase64, "File", 2800000),
    bytes = Buffer.from(contentBase64, "base64");
  const mimeType = choice(body.mimeType, "file type", [
    "application/pdf",
    "image/png",
    "image/jpeg",
  ]);
  if (
    !bytes.length ||
    bytes.length > 2 * 1024 * 1024 ||
    bytes.toString("base64") !== contentBase64
  )
    throw new HttpError(400, "Choose a valid receipt up to 2 MB.");
  if (
    (mimeType === "application/pdf" &&
      bytes.subarray(0, 5).toString() !== "%PDF-") ||
    (mimeType === "image/png" &&
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") ||
    (mimeType === "image/jpeg" &&
      bytes.subarray(0, 3).toString("hex") !== "ffd8ff")
  )
    throw new HttpError(400, "File content does not match its type.");
  return {
    name: text(body.name, "Filename", 200).replace(/[\\/\r\n]/g, "_"),
    mimeType,
    contentBase64,
  };
}
export async function lifecycleData(
  store: Store,
  actor: Actor,
  emp: any,
  type: string,
  dueDate: string,
) {
  const settings = await config(store, actor.orgId);
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    type,
    dueDate,
    status: "Open",
    tasks: settings[type === "Onboarding" ? "onboarding" : "offboarding"].map(
      (title: string, index: number) => ({
        id: String(index),
        title,
        done: false,
      }),
    ),
    createdAt: new Date().toISOString(),
  };
}
export async function validateSuiteRecord(
  store: Store,
  actor: Actor,
  kind: Kind,
  body: any,
  existing?: any,
): Promise<any> {
  const settings = await config(store, actor.orgId),
    list = async (kind: Kind) => await store.list(actor.orgId, kind);
  const employee = async () => await subject(store, actor, body);
  const branch = async () => {
    const id = text(body.branchId, "Branch", 200, true);
    if (id) await store.get(actor.orgId, "branches", id);
    return id;
  };
  switch (kind) {
    case "branches":
      staff(actor);
      return {
        code: text(body.code, "Branch code", 30).toUpperCase(),
        name: text(body.name, "Branch name"),
        location: text(body.location, "Location"),
        costCentre: text(body.costCentre, "Cost centre", 100, true),
      };
    case "holidays":
      staff(actor);
      return {
        name: text(body.name, "Holiday name"),
        date: date(body.date, "Holiday date"),
        branchId: await branch(),
      };
    case "shifts": {
      staff(actor);
      const start = time(body.start),
        end = time(body.end),
        breakMinutes = number(body.breakMinutes || 0, "Break minutes", 720);
      const minute = (v: string) =>
        Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
      const duration = (minute(end) - minute(start) + 1440) % 1440;
      if (!duration || breakMinutes >= duration)
        throw new HttpError(400, "Shift length must exceed its break.");
      return {
        name: text(body.name, "Shift name"),
        start,
        end,
        breakMinutes,
        graceMinutes: number(body.graceMinutes || 0, "Grace minutes", 120),
        hours: (duration - breakMinutes) / 60,
      };
    }
    case "shiftAssignments": {
      staff(actor);
      const emp = await employee(),
        shift = await store.get(
          actor.orgId,
          "shifts",
          text(body.shiftId, "Shift"),
        );
      const startDate = date(body.startDate, "Start date"),
        endDate = date(body.endDate, "End date");
      if (endDate < startDate)
        throw new HttpError(400, "End date must follow start date.");
      if (
        (await list(kind)).some(
          (r) =>
            r.id !== existing?.id &&
            r.employeeId === emp.id &&
            r.startDate <= endDate &&
            r.endDate >= startDate,
        )
      )
        throw new HttpError(
          409,
          "This employee already has a shift during these dates.",
        );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        shiftId: shift.id,
        shiftSnapshot: shift,
        startDate,
        endDate,
      };
    }
    case "leaveAdjustments": {
      staff(actor);
      const emp = await employee(),
        year = number(body.year, "Year", 2100),
        days = body.days;
      if (
        !Number.isInteger(year) ||
        year < 2000 ||
        typeof days !== "number" ||
        !Number.isFinite(days) ||
        !Number.isInteger(days) ||
        Math.abs(days) > 366 ||
        !days
      )
        throw new HttpError(
          400,
          "Enter a year and a non-zero whole-day adjustment between -366 and 366.",
        );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        year,
        days,
        leaveType: choice(
          body.leaveType,
          "leave type",
          (await store.company(actor.orgId)).leaveTypes,
        ),
        reason: text(body.reason, "Reason", 2000),
        by: actor.name,
        at: new Date().toISOString(),
      };
    }
    case "expenses": {
      const emp = await employee(),
        amount = number(body.amount, "Amount", settings.expenseLimit),
        spentOn = date(body.spentOn, "Expense date");
      if (amount <= 0 || spentOn > (await today(store, actor.orgId)))
        throw new HttpError(
          400,
          "Enter a positive expense amount and a date up to today.",
        );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        amount,
        spentOn,
        category: choice(body.category, "category", settings.expenseCategories),
        purpose: text(body.purpose, "Business purpose", 2000),
        receipt: attachment(body.receipt),
        currency: "INR",
        status: "Pending",
        ...(await approvalFor(store, actor, kind, emp)),
        createdAt: new Date().toISOString(),
      };
    }
    case "lifecycle": {
      staff(actor);
      const emp = await employee(),
        type = choice(body.type, "checklist type", [
          "Onboarding",
          "Offboarding",
        ]);
      if (
        (await list(kind)).some(
          (r) =>
            r.employeeId === emp.id && r.type === type && r.status === "Open",
        )
      )
        throw new HttpError(
          409,
          "This employee already has an open checklist of this type.",
        );
      const dueDate = date(body.dueDate, "Due date");
      if (dueDate < emp.hireDate)
        throw new HttpError(
          400,
          "The checklist due date cannot precede joining.",
        );
      return await lifecycleData(store, actor, emp, type, dueDate);
    }
    case "employmentChanges": {
      staff(actor);
      const emp = await employee(),
        type = choice(body.type, "change type", [
          "Promotion",
          "Transfer",
          "Salary revision",
          "Probation confirmation",
          "Contract renewal",
        ]),
        effectiveDate = date(body.effectiveDate, "Effective date");
      if (effectiveDate < emp.hireDate)
        throw new HttpError(400, "Effective date cannot precede joining.");
      const keys: any = {
        Promotion: ["role"],
        Transfer: ["department", "branchId", "managerId", "costCentre"],
        "Salary revision": ["salary", "payBasis", "payRate"],
        "Probation confirmation": ["probationEnd"],
        "Contract renewal": ["endDate"],
      };
      const changes = Object.fromEntries(
        keys[type]
          .filter((key: string) => body.changes?.[key] !== undefined)
          .map((key: string) => [key, body.changes[key]]),
      );
      if (!Object.keys(changes).length)
        throw new HttpError(400, "Enter the new employment details.");
      await validateRecord(
        store,
        actor,
        "employees",
        { ...emp, ...changes },
        emp,
      );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        type,
        effectiveDate,
        changes,
        employeeVersion: emp.version,
        status: "Scheduled",
        reason: text(body.reason, "Reason", 2000),
        createdBy: actor.name,
      };
    }
    case "profileRequests": {
      const emp = await employee(),
        type = choice(body.type, "request type", [
          "Profile correction",
          "Bank details",
          "Letter request",
          "Resignation",
        ]);
      const changes: any = {};
      if (type === "Profile correction") {
        for (const key of ["name", "contact", "email"])
          if (body.changes?.[key] !== undefined)
            changes[key] = body.changes[key];
        await validateRecord(
          store,
          actor,
          "employees",
          { ...emp, ...changes },
          emp,
        );
      }
      if (type === "Bank details")
        changes.bankDetails = validateBank(body.changes?.bankDetails);
      const lastWorkingDate =
        type === "Resignation"
          ? date(body.lastWorkingDate, "Last working date")
          : "";
      if (
        lastWorkingDate &&
        (lastWorkingDate < (await today(store, actor.orgId)) ||
          lastWorkingDate < emp.hireDate)
      )
        throw new HttpError(
          400,
          "Last working date cannot precede today or joining.",
        );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        type,
        changes,
        lastWorkingDate,
        reason: text(body.reason, "Request details", 3000),
        employeeVersion: emp.version,
        status: "Pending",
        ...(await approvalFor(store, actor, kind, emp)),
      };
    }
    case "attendanceCorrections": {
      const emp = await employee(),
        checkInAt = text(body.checkInAt, "Check-in timestamp", 30),
        checkOutAt = text(body.checkOutAt, "Check-out timestamp", 30),
        start = Date.parse(checkInAt),
        end = Date.parse(checkOutAt);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        end - start > 24 * 3600000 ||
        end > Date.now()
      )
        throw new HttpError(
          400,
          "Enter a completed attendance period of at most 24 hours.",
        );
      const attendanceId = text(
          body.attendanceId,
          "Attendance record",
          200,
          true,
        ),
        existing = attendanceId
          ? await store.get(actor.orgId, "attendance", attendanceId)
          : null;
      if (existing && existing.employeeId !== emp.id)
        throw new HttpError(404, "Attendance not found.");
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        attendanceId,
        attendanceVersion: existing?.version,
        checkInAt: new Date(start).toISOString(),
        checkOutAt: new Date(end).toISOString(),
        reason: text(body.reason, "Reason", 2000),
        status: "Pending",
        ...(await approvalFor(store, actor, kind, emp)),
      };
    }
    case "tickets": {
      const category = choice(body.category, "category", [
        "General",
        "Payroll",
        "Documents",
        "Grievance",
      ]);
      return {
        subject: text(body.subject, "Subject"),
        body: text(body.body, "Description", 5000),
        category,
        confidential: category === "Grievance" || !!body.confidential,
        createdBy: actor.id,
        requesterName: actor.name,
        employeeId: actor.employeeId || undefined,
        status: "Open",
        assignedTo: "",
        comments: [],
        createdAt: new Date().toISOString(),
      };
    }
    case "policies": {
      staff(actor);
      return {
        title: text(body.title, "Title"),
        content: text(body.content, "Policy text", 20000),
        branchId: await branch(),
        dueDate: body.dueDate
          ? date(body.dueDate, "Acknowledgement due date")
          : "",
        status: choice(body.status || "Draft", "status", [
          "Draft",
          "Published",
        ]),
        revision: (existing?.revision || 0) + 1,
        publishedBy: actor.name,
        publishedAt: new Date().toISOString(),
      };
    }
    default:
      throw new HttpError(405, "Use the dedicated workflow for this record.");
  }
}
export function validateBank(body: any) {
  const accountNumber = text(body?.accountNumber, "Account number", 25),
    ifsc = text(body?.ifsc, "IFSC", 11).toUpperCase();
  if (!/^\d{6,25}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
    throw new HttpError(400, "Enter a valid account number and IFSC.");
  return {
    accountName: text(body.accountName, "Account holder"),
    bankName: text(body.bankName, "Bank name"),
    accountNumber,
    ifsc,
  };
}
export function canReadTicket(actor: Actor, ticket: any) {
  return (
    ticket.createdBy === actor.id ||
    actor.accessRole === "owner" ||
    (actor.accessRole === "hr" &&
      (!ticket.confidential || ticket.assignedTo === actor.id))
  );
}
export async function attendanceData(store: Store, actor: Actor, record: any) {
  const zone = (await store.company(actor.orgId)).timezone,
    start = new Date(record.checkInAt),
    end = new Date(record.checkOutAt);
  const date = start.toLocaleDateString("en-CA", { timeZone: zone }),
    clock = (d: Date) =>
      d.toLocaleTimeString("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
  const logs = (await store.list(actor.orgId, "attendance")).filter(
    (log) =>
      log.employeeId === record.employeeId && log.id !== record.attendanceId,
  );
  if (
    logs.some(
      (log) =>
        log.checkInAt &&
        Date.parse(log.checkInAt) < end.getTime() &&
        (!log.checkOutAt || Date.parse(log.checkOutAt) > start.getTime()),
    )
  )
    throw new HttpError(409, "This period overlaps another attendance record.");
  return {
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    date,
    checkIn: clock(start),
    checkOut: clock(end),
    checkInAt: start.toISOString(),
    checkOutAt: end.toISOString(),
    status: "Present",
    source: "Approved correction",
  };
}
