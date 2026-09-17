import { flatMapAsync, mapAsync } from "./async-utils";
import express, { type Express, type RequestHandler } from "express";
import { randomBytes, createHash } from "node:crypto";
import { Store, HttpError, type Actor, type Kind } from "./store";
import { choice, date, text, validateRecord } from "./validation";
import {
  config,
  decision,
  leaveBalance,
  mayApprove,
  requireModule,
  suiteKinds,
  templates,
  today,
  validateConfig,
} from "./suite-domain";
import {
  attendanceData,
  canReadTicket,
  lifecycleData,
  moduleFor,
  owner,
  staff,
  validateSuiteRecord,
} from "./suite-records";
import {
  createPayroll,
  editPayroll,
  payrollAction,
  statutorySources,
} from "./payroll";
import {
  commitImport,
  employeeColumns,
  previewImport,
  workbookBuffer,
} from "./import-export";
import { attendanceSummary } from "./attendance-summary";
const route =
  (fn: (...args: any[]) => any): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };
const editable: Kind[] = [
  "branches",
  "holidays",
  "shifts",
  "shiftAssignments",
  "policies",
];
const requestKinds: Kind[] = [
  "leaves",
  "expenses",
  "profileRequests",
  "attendanceCorrections",
];
const checkVersion = (record: any, body: any) => {
  if (record.version !== body.version)
    throw new HttpError(409, "This record changed. Refresh and try again.");
};
const metadata = (record: any) => {
  const { contentBase64, ...rest } = record;
  return rest;
};
const safeExpense = (r: any) => ({
  ...r,
  receipt: r.receipt ? metadata(r.receipt) : null,
});
export async function applyEmploymentChange(
  store: Store,
  actor: Actor,
  record: any,
  version: number,
) {
  staff(actor);
  checkVersion(record, { version });
  if (
    record.status !== "Scheduled" ||
    record.effectiveDate > (await today(store, actor.orgId))
  )
    throw new HttpError(
      409,
      "Only a scheduled change that is due can be applied.",
    );
  const emp = await store.get(actor.orgId, "employees", record.employeeId);
  if (emp.version !== record.employeeVersion)
    throw new HttpError(
      409,
      "The employee profile changed after scheduling. Cancel this change and schedule it again after reviewing the latest profile.",
    );
  return await store.transaction(async () => {
    const valid = await validateRecord(
      store,
      actor,
      "employees",
      { ...emp, ...record.changes },
      emp,
    );
    await store.save(
      actor,
      "employees",
      { ...valid, _effectiveDate: record.effectiveDate },
      emp.id,
      emp.version,
    );
    return await store.save(
      actor,
      "employmentChanges",
      {
        ...record,
        status: "Applied",
        appliedAt: new Date().toISOString(),
        appliedBy: actor.name,
      },
      record.id,
      version,
    );
  });
}
export function registerSuite(app: Express, store: Store) {
  const router = express.Router();
  router.get(
    "/integrations/guide",
    route(async (_req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "integrations");
      res
        .type("text/plain")
        .send(
          'HR Studio integration guide\n\nPOST /api/integrations/events\nHeaders: Authorization: Bearer <scoped key>, Content-Type: application/json, X-HRStudio-Request: 1\n\nAttendance JSON:\n{"eventId":"device-unique-event-id","employeeId":"employee-record-id","checkInAt":"2026-09-01T03:30:00Z","checkOutAt":"2026-09-01T12:00:00Z"}\n\nSignature JSON (signature-scoped key):\n{"eventId":"provider-unique-event-id","documentId":"uploaded-document-id","reference":"provider-envelope-reference","signedAt":"2026-09-01T12:00:00Z"}\n\nEmployee IDs are available in the Organization directory; document IDs are returned on upload. Events are scoped to the key company, validated and deduplicated per key and event ID. Reusing an event ID returns duplicate: true without creating a second record. Retrying a rejected request is safe after correcting it. Revoked keys return 401. Requests are limited to 120 per minute per source IP. Use HTTPS in production and keep keys on your server.\n\nSignature events record provider-reported completion; this app does not authenticate signers or provide an electronic signature service. Configure signing and its evidence retention with your provider.\n\nAccounting exports contain approved payroll amounts by employee, including employee and employer contributions. Map them to your accounting system accounts before posting. No funds are transferred and no statutory return is filed.',
        );
    }),
  );
  router.get(
    "/",
    route(async (_req, res) => {
      const actor: Actor = res.locals.actor,
        isStaff = actor.accessRole !== "employee",
        settings = await config(store, actor.orgId),
        employees = await store.list(actor.orgId, "employees");
      const state: any = {};
      for (const kind of suiteKinds) {
        const module = moduleFor[kind];
        let rows =
          module && !settings.enabledModules.includes(module)
            ? []
            : await store.list(actor.orgId, kind);
        if (kind === "tickets")
          rows = rows.filter((r) => canReadTicket(actor, r));
        else if (kind === "policies")
          rows = rows.filter(
            (r) =>
              isStaff ||
              (r.status === "Published" &&
                (!r.branchId ||
                  r.branchId ===
                    employees.find((e) => e.id === actor.employeeId)
                      ?.branchId)),
          );
        else if (kind === "payroll" && !isStaff)
          rows = rows
            .filter(
              (r) =>
                ["Approved", "Paid"].includes(r.status) &&
                r.lines.some((l: any) => l.employeeId === actor.employeeId),
            )
            .map((r) => ({
              id: r.id,
              version: r.version,
              month: r.month,
              status: r.status,
              companySnapshot: r.companySnapshot,
              ruleVersion: r.ruleVersion,
              lines: r.lines.filter(
                (l: any) => l.employeeId === actor.employeeId,
              ),
            }));
        else if (
          !isStaff &&
          !["branches", "holidays", "shifts", "tickets"].includes(kind)
        )
          rows = rows.filter((r) => r.employeeId === actor.employeeId);
        state[kind] = kind === "expenses" ? rows.map(safeExpense) : rows;
      }
      state.approvals = await flatMapAsync(requestKinds, async (kind) =>
        moduleFor[kind] && !settings.enabledModules.includes(moduleFor[kind])
          ? []
          : (await store.list(actor.orgId, kind))
              .filter((r) => r.status === "Pending" && mayApprove(actor, r))
              .map((r) => ({
                kind,
                ...(kind === "expenses" ? safeExpense(r) : r),
              })),
      );
      state.directory = employees.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        department: e.department,
        branchId: e.branchId,
        managerId: e.managerId,
      }));
      state.people = isStaff
        ? employees
        : employees.filter((e) => e.id === actor.employeeId);
      state.attendanceSummary = settings.enabledModules.includes("leaves")
        ? await flatMapAsync(state.people, async (emp: any) =>
            (await attendanceSummary(store, actor.orgId, emp.id)).map(
              (day) => ({
                ...day,
                employeeName: emp.name,
              }),
            ),
          )
        : [];
      state.accounts = isStaff
        ? await store.db
            .prepare(
              "SELECT id,name,role FROM users WHERE org_id=? AND active=1",
            )
            .all(actor.orgId)
        : [];
      state.balances = await flatMapAsync(
        state.people,
        async (emp: any) =>
          await mapAsync(settings.leavePolicies, async (p: any) => ({
            employeeId: emp.id,
            employeeName: emp.name,
            ...(await leaveBalance(
              store,
              actor.orgId,
              emp,
              p.leaveType,
              await today(store, actor.orgId),
            )),
          })),
      );
      const deadline = new Date(
        Date.parse(await today(store, actor.orgId)) + 30 * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      state.reminders = state.people.flatMap((emp: any) =>
        ["probationEnd", "endDate"]
          .filter((key) => emp[key] && emp[key] <= deadline)
          .map((key) => ({
            id: `${emp.id}-${key}`,
            employeeName: emp.name,
            title:
              key === "endDate"
                ? "Contract / employment ending"
                : "Probation review",
            date: emp[key],
          })),
      );
      if (settings.enabledModules.includes("documents"))
        state.reminders.push(
          ...(await store.list(actor.orgId, "documents"))
            .filter(
              (doc) =>
                (isStaff || doc.employeeId === actor.employeeId) &&
                doc.expiryDate &&
                doc.expiryDate <= deadline,
            )
            .map((doc) => ({
              id: doc.id,
              title: doc.name,
              date: doc.expiryDate,
              employeeName: employees.find((emp) => emp.id === doc.employeeId)
                ?.name,
            })),
        );
      state.integrationKeys =
        actor.accessRole === "owner"
          ? (await store.list(actor.orgId, "integrationKeys")).map(
              ({ tokenHash, ...r }) => r,
            )
          : [];
      res.json({
        ...state,
        settings,
        companyVersion: (await store.company(actor.orgId)).version,
        templates,
        statutorySources,
        today: await today(store, actor.orgId),
      });
    }),
  );
  router.patch(
    "/config",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      owner(actor);
      const company = await store.company(actor.orgId);
      checkVersion(company, req.body);
      const suite = await validateConfig(req.body.settings, store, actor),
        { id, slug, version, ...settings } = company;
      await store.transaction(async () => {
        await store.db
          .prepare(
            "UPDATE organizations SET settings=?,version=version+1 WHERE id=?",
          )
          .run(JSON.stringify({ ...settings, suite }), actor.orgId);
        await store.audit(actor, "Updated HR configuration", actor.orgId);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/records/:kind",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "record type", suiteKinds) as Kind;
      if (moduleFor[kind]) await requireModule(store, actor, moduleFor[kind]!);
      res
        .status(201)
        .json(
          await store.save(
            actor,
            kind,
            await validateSuiteRecord(store, actor, kind, req.body),
          ),
        );
    }),
  );
  router.patch(
    "/records/:kind/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "record type", editable) as Kind;
      staff(actor);
      if (moduleFor[kind]) await requireModule(store, actor, moduleFor[kind]!);
      const existing = await store.get(actor.orgId, kind, req.params.id);
      res.json(
        await store.save(
          actor,
          kind,
          await validateSuiteRecord(
            store,
            actor,
            kind,
            { ...existing, ...req.body },
            existing,
          ),
          existing.id,
          req.body.version,
        ),
      );
    }),
  );
  router.post(
    "/decisions/:kind/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "request type", requestKinds) as Kind;
      if (moduleFor[kind]) await requireModule(store, actor, moduleFor[kind]!);
      const record = await store.get(actor.orgId, kind, req.params.id);
      checkVersion(record, req.body);
      res.json(
        await store.transaction(async () => {
          const result =
            kind === "leaves"
              ? await validateRecord(store, actor, kind, req.body, record)
              : decision(actor, record, req.body.status, req.body.comment);
          if (result.status === "Approved" && kind === "profileRequests") {
            const emp = await store.get(
              actor.orgId,
              "employees",
              record.employeeId,
            );
            if (Object.keys(record.changes).length) {
              if (emp.version !== record.employeeVersion)
                throw new HttpError(
                  409,
                  "The employee profile changed. Reject this request and submit a new one with current details.",
                );
              await store.save(
                actor,
                "employees",
                await validateRecord(
                  store,
                  actor,
                  "employees",
                  { ...emp, ...record.changes },
                  emp,
                ),
                emp.id,
                emp.version,
              );
            }
            if (record.type === "Letter request")
              result.fulfilment = text(
                req.body.comment,
                "Letter download link or collection instructions",
                2000,
              );
            if (record.type === "Resignation") {
              if (
                (await store.list(actor.orgId, "lifecycle")).some(
                  (r) =>
                    r.employeeId === emp.id &&
                    r.type === "Offboarding" &&
                    r.status === "Open",
                )
              )
                throw new HttpError(
                  409,
                  "An offboarding checklist is already open.",
                );
              await store.save(
                actor,
                "lifecycle",
                await lifecycleData(
                  store,
                  actor,
                  emp,
                  "Offboarding",
                  record.lastWorkingDate,
                ),
              );
            }
          }
          if (
            result.status === "Approved" &&
            kind === "attendanceCorrections"
          ) {
            const log = await attendanceData(store, actor, record);
            await store.save(
              actor,
              "attendance",
              log,
              record.attendanceId || undefined,
              record.attendanceVersion,
            );
          }
          return await store.save(
            actor,
            kind,
            result,
            record.id,
            req.body.version,
          );
        }),
      );
    }),
  );
  router.post(
    "/cancel/:kind/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "request type", requestKinds) as Kind,
        record = await store.get(actor.orgId, kind, req.params.id);
      if (record.employeeId !== actor.employeeId) staff(actor);
      if (record.status !== "Pending")
        throw new HttpError(409, "Only pending requests can be cancelled.");
      res.json(
        await store.save(
          actor,
          kind,
          { ...record, status: "Cancelled" },
          record.id,
          req.body.version,
        ),
      );
    }),
  );
  router.post(
    "/expenses/:id/reimburse",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "expenses");
      const record = await store.get(actor.orgId, "expenses", req.params.id);
      if (
        record.status !== "Approved" ||
        (await store.db
          .prepare(
            "SELECT 1 FROM payroll_expenses WHERE org_id=? AND expense_id=?",
          )
          .get(actor.orgId, record.id))
      )
        throw new HttpError(
          409,
          "This claim is not available for a separate reimbursement.",
        );
      res.json(
        await store.save(
          actor,
          "expenses",
          {
            ...record,
            status: "Reimbursed",
            paymentReference: text(req.body.reference, "Payment reference"),
            paidAt: new Date().toISOString(),
          },
          record.id,
          req.body.version,
        ),
      );
    }),
  );
  router.get(
    "/expenses/:id/receipt",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        record = await store.get(actor.orgId, "expenses", req.params.id);
      await requireModule(store, actor, "expenses");
      if (
        actor.accessRole === "employee" &&
        record.employeeId !== actor.employeeId &&
        !mayApprove(actor, record)
      )
        throw new HttpError(404, "Receipt not found.");
      if (!record.receipt) throw new HttpError(404, "No receipt attached.");
      res
        .type(record.receipt.mimeType)
        .set(
          "Content-Disposition",
          `attachment; filename="receipt"; filename*=UTF-8''${encodeURIComponent(record.receipt.name)}`,
        )
        .send(Buffer.from(record.receipt.contentBase64, "base64"));
    }),
  );
  router.post(
    "/lifecycle/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "lifecycle");
      const record = await store.get(actor.orgId, "lifecycle", req.params.id);
      checkVersion(record, req.body);
      if (record.status !== "Open")
        throw new HttpError(409, "This checklist is closed.");
      res.json(
        await store.transaction(async () => {
          if (req.body.action === "Complete") {
            if (record.tasks.some((task: any) => !task.done))
              throw new HttpError(409, "Complete every checklist task first.");
            if (record.type === "Offboarding") {
              if (record.dueDate > (await today(store, actor.orgId)))
                throw new HttpError(
                  409,
                  "The last working date has not arrived.",
                );
              if (
                (await store.list(actor.orgId, "assets")).some(
                  (asset) => asset.assignedToId === record.employeeId,
                )
              )
                throw new HttpError(
                  409,
                  "Return all assigned assets before completing offboarding.",
                );
              if (
                await store.db
                  .prepare(
                    "SELECT 1 FROM users WHERE org_id=? AND employee_id=? AND role='owner'",
                  )
                  .get(actor.orgId, record.employeeId)
              )
                throw new HttpError(
                  409,
                  "The company owner cannot be offboarded.",
                );
              const emp = await store.get(
                actor.orgId,
                "employees",
                record.employeeId,
              );
              await store.save(
                actor,
                "employees",
                {
                  ...emp,
                  status: "Terminated",
                  endDate: record.dueDate,
                  _effectiveDate: record.dueDate,
                },
                emp.id,
                emp.version,
              );
              await store.db
                .prepare(
                  "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE org_id=? AND employee_id=?)",
                )
                .run(actor.orgId, emp.id);
              await store.db
                .prepare(
                  "UPDATE users SET active=0 WHERE org_id=? AND employee_id=?",
                )
                .run(actor.orgId, emp.id);
            }
            return await store.save(
              actor,
              "lifecycle",
              {
                ...record,
                status: "Completed",
                completedAt: new Date().toISOString(),
              },
              record.id,
              req.body.version,
            );
          }
          const task = record.tasks.find(
            (task: any) => task.id === req.body.taskId,
          );
          if (!task || typeof req.body.done !== "boolean")
            throw new HttpError(400, "Choose a checklist task.");
          return await store.save(
            actor,
            "lifecycle",
            {
              ...record,
              tasks: record.tasks.map((t: any) =>
                t.id === task.id
                  ? {
                      ...t,
                      done: req.body.done,
                      by: actor.name,
                      at: new Date().toISOString(),
                    }
                  : t,
              ),
            },
            record.id,
            req.body.version,
          );
        }),
      );
    }),
  );
  router.post(
    "/employmentChanges/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "lifecycle");
      const record = await store.get(
        actor.orgId,
        "employmentChanges",
        req.params.id,
      );
      if (req.body.action === "Cancel") {
        if (record.status !== "Scheduled")
          throw new HttpError(409, "Only scheduled changes can be cancelled.");
        res.json(
          await store.save(
            actor,
            "employmentChanges",
            { ...record, status: "Cancelled" },
            record.id,
            req.body.version,
          ),
        );
      } else
        res.json(
          await applyEmploymentChange(store, actor, record, req.body.version),
        );
    }),
  );
  router.post(
    "/tickets/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      await requireModule(store, actor, "helpdesk");
      const record = await store.get(actor.orgId, "tickets", req.params.id);
      if (!canReadTicket(actor, record))
        throw new HttpError(404, "Ticket not found.");
      const comment = text(req.body.comment, "Comment", 5000, true);
      let assignedTo = record.assignedTo,
        status = record.status;
      if (req.body.assignedTo !== undefined) {
        owner(actor);
        assignedTo = text(req.body.assignedTo, "Assignee", 200, true);
        if (
          assignedTo &&
          !(await store.db
            .prepare(
              "SELECT 1 FROM users WHERE id=? AND org_id=? AND active=1 AND role IN ('hr','owner')",
            )
            .get(assignedTo, actor.orgId))
        )
          throw new HttpError(400, "Assign an active HR or owner account.");
      }
      if (req.body.status)
        status = choice(
          req.body.status,
          "ticket status",
          actor.accessRole === "employee"
            ? ["Open", "Resolved"]
            : ["Open", "In progress", "Resolved"],
        );
      if (
        !comment &&
        status === record.status &&
        assignedTo === record.assignedTo
      )
        throw new HttpError(400, "Add a reply or change the ticket status.");
      res.json(
        await store.save(
          actor,
          "tickets",
          {
            ...record,
            assignedTo,
            status,
            comments: comment
              ? [
                  ...record.comments,
                  {
                    body: comment,
                    by: actor.name,
                    at: new Date().toISOString(),
                  },
                ]
              : record.comments,
          },
          record.id,
          req.body.version,
        ),
      );
    }),
  );
  router.post(
    "/policies/:id/acknowledge",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      await requireModule(store, actor, "policies");
      const record = await store.get(actor.orgId, "policies", req.params.id);
      checkVersion(record, req.body);
      const employee =
        actor.employeeId &&
        (await store.get(actor.orgId, "employees", actor.employeeId));
      if (
        !employee ||
        record.status !== "Published" ||
        (record.branchId && record.branchId !== employee.branchId)
      )
        throw new HttpError(
          403,
          "This policy is not assigned to your employee profile.",
        );
      if (req.body.accepted !== true)
        throw new HttpError(
          400,
          "Confirm that you have read and understood this policy.",
        );
      res.status(201).json(
        await store.save(actor, "acknowledgements", {
          employeeId: employee.id,
          employeeName: employee.name,
          policyId: record.id,
          policyVersion: record.revision,
          title: record.title,
          contentHash: createHash("sha256")
            .update(record.content)
            .digest("hex"),
          policyText: record.content,
          at: new Date().toISOString(),
          by: actor.id,
        }),
      );
    }),
  );
  router.patch(
    "/documents/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "documents");
      const doc = await store.get(actor.orgId, "documents", req.params.id);
      const expiryDate = req.body.expiryDate
        ? date(req.body.expiryDate, "Expiry date")
        : "";
      res.json(
        metadata(
          await store.save(
            actor,
            "documents",
            { ...doc, expiryDate },
            doc.id,
            req.body.version,
          ),
        ),
      );
    }),
  );
  router.post(
    "/payroll",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "payroll");
      res.status(201).json(await createPayroll(store, actor, req.body));
    }),
  );
  router.patch(
    "/payroll/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "payroll");
      res.json(
        await editPayroll(
          store,
          actor,
          await store.get(actor.orgId, "payroll", req.params.id),
          req.body,
        ),
      );
    }),
  );
  router.post(
    "/payroll/:id",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      await requireModule(store, actor, "payroll");
      res.json(
        await payrollAction(
          store,
          actor,
          await store.get(actor.orgId, "payroll", req.params.id),
          req.body,
        ),
      );
    }),
  );
  router.get(
    "/payroll/:id/payslip/:employeeId",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      await requireModule(store, actor, "payroll");
      const period = await store.get(actor.orgId, "payroll", req.params.id);
      if (
        !["Approved", "Paid"].includes(period.status) ||
        (actor.accessRole === "employee" &&
          actor.employeeId !== req.params.employeeId)
      )
        throw new HttpError(404, "Payslip not found.");
      const line = period.lines.find(
        (l: any) => l.employeeId === req.params.employeeId,
      );
      if (!line) throw new HttpError(404, "Payslip not found.");
      const escape = (v: any) =>
        String(v).replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c]!,
        );
      const rows = [
        ["Regular earnings", line.gross - line.overtime - line.input.bonus],
        ["Overtime", line.overtime],
        ["Bonus", line.input.bonus],
        ["Gross earnings", line.gross],
        ["PF", line.pfEmployee],
        ["ESI", line.esiEmployee],
        ["Professional tax", line.professionalTax],
        ["Labour welfare", line.lwfEmployee],
        ["TDS", line.tds],
        ["Other deductions", line.configuredDeduction + line.otherDeductions],
        ["Reimbursement", line.reimbursement],
        ["Net pay", line.net],
      ];
      res
        .set(
          "Content-Security-Policy",
          "default-src 'none'; style-src 'unsafe-inline'",
        )
        .type("html")
        .send(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Payslip ${escape(period.month)}</title><style>body{font:16px system-ui;max-width:750px;margin:48px auto;padding:24px;color:#172033}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:12px}td+td{text-align:right}small{color:#555}@media print{body{margin:0}}</style><h1>${escape(period.companySnapshot.name)}</h1><p>${escape(period.companySnapshot.location)} · Payslip for ${escape(period.month)}</p><h2>${escape(line.employeeName)}</h2><p>${escape(line.snapshot.designation)} · ${escape(line.snapshot.department)}</p><table>${rows.map(([name, value]) => `<tr><td>${escape(name)}</td><td>INR ${Number(value).toFixed(2)}</td></tr>`).join("")}</table><p>Payment status: ${escape(period.status)}${period.paymentReference ? " · " + escape(period.paymentReference) : ""}</p><small>Approved payroll snapshot. Use your browser’s Print menu to save a PDF. Approval does not confirm that funds have been transferred.</small></html>`,
        );
    }),
  );
  router.post(
    "/imports/preview",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      res.status(201).json(await previewImport(store, actor, req.body));
    }),
  );
  router.post(
    "/imports/:id/commit",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      res.json(
        await commitImport(store, actor, req.params.id, req.body.version),
      );
    }),
  );
  router.get(
    "/export/:type",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      staff(actor);
      const type = choice(req.params.type, "export", [
        "template",
        "employees",
        "attendance",
        "leaves",
        "expenses",
        "payroll",
        "accounting",
        "history",
        "policies",
      ]);
      if (!["template", "employees"].includes(type))
        await requireModule(store, actor, "reports");
      let columns: string[] = [],
        rows: any[] = [];
      if (["template", "employees"].includes(type)) {
        columns = [
          ...employeeColumns,
          ...(await config(store, actor.orgId)).customFields.map(
            (f: any) => `custom.${f.key}`,
          ),
        ];
        if (type === "employees")
          rows = await mapAsync(
            await store.list(actor.orgId, "employees"),
            async (e) => ({
              ...e,
              ...e.salary,
              branchCode:
                (await store.list(actor.orgId, "branches")).find(
                  (b) => b.id === e.branchId,
                )?.code || "",
              managerEmail:
                (await store.list(actor.orgId, "employees")).find(
                  (m) => m.id === e.managerId,
                )?.email || "",
              ...Object.fromEntries(
                Object.entries(e.customFields || {}).map(([k, v]) => [
                  `custom.${k}`,
                  v,
                ]),
              ),
            }),
          );
      } else if (["payroll", "accounting"].includes(type)) {
        await requireModule(store, actor, "payroll");
        const period = await store.get(
          actor.orgId,
          "payroll",
          text(req.query.period, "Payroll period"),
        );
        if (
          type === "accounting" &&
          !["Approved", "Paid"].includes(period.status)
        )
          throw new HttpError(
            409,
            "Approve payroll before exporting accounting entries.",
          );
        columns = [
          "employeeName",
          "gross",
          "pfEmployee",
          "pfEmployer",
          "eps",
          "esiEmployee",
          "esiEmployer",
          "professionalTax",
          "lwfEmployee",
          "lwfEmployer",
          "tds",
          "totalDeductions",
          "reimbursement",
          "net",
        ];
        rows = period.lines;
      } else {
        const kind =
          ({ history: "employeeHistory", policies: "acknowledgements" } as any)[
            type
          ] || type;
        if (moduleFor[kind as Kind])
          await requireModule(store, actor, moduleFor[kind as Kind]!);
        columns = (
          {
            attendance: [
              "employeeName",
              "date",
              "checkIn",
              "checkOut",
              "status",
            ],
            leaves: [
              "employeeName",
              "leaveType",
              "startDate",
              "endDate",
              "days",
              "status",
            ],
            expenses: [
              "employeeName",
              "spentOn",
              "category",
              "purpose",
              "amount",
              "status",
              "paymentReference",
            ],
            history: [
              "employeeName",
              "effectiveDate",
              "action",
              "changedBy",
              "changedAt",
            ],
            policies: ["employeeName", "title", "policyVersion", "at"],
          } as any
        )[type];
        rows = await store.list(actor.orgId, kind);
      }
      const bytes = await workbookBuffer(columns, rows, type);
      res
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .set("Content-Disposition", `attachment; filename="${type}.xlsx"`)
        .send(bytes);
    }),
  );
  router.post(
    "/integrations/keys",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      owner(actor);
      await requireModule(store, actor, "integrations");
      const token = randomBytes(32).toString("base64url");
      const key = await store.save(actor, "integrationKeys", {
        name: text(req.body.name, "Integration name"),
        scope: choice(req.body.scope, "scope", ["attendance", "signatures"]),
        tokenHash: createHash("sha256").update(token).digest("hex"),
        active: true,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({ id: key.id, token });
    }),
  );
  router.post(
    "/integrations/keys/:id/revoke",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      owner(actor);
      const key = await store.get(
        actor.orgId,
        "integrationKeys",
        req.params.id,
      );
      await store.save(
        actor,
        "integrationKeys",
        { ...key, active: false },
        key.id,
        req.body.version,
      );
      res.json({ ok: true });
    }),
  );
  app.use("/api/suite", router);
}
