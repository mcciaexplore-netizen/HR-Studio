import { mapAsync } from "./async-utils";
import express, { type RequestHandler } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { Store, HttpError, type Actor, type Kind } from "./store";
import {
  actorFrom,
  authenticate,
  checkPassword,
  cookieToken,
  createSession,
  digest,
  hashPassword,
  rateLimit,
  requireOwner,
  requireStaff,
  SESSION_COOKIE,
} from "./auth";
import {
  choice,
  companySettings,
  email,
  password,
  text,
  validateRecord,
} from "./validation";
import { evaluateResume, type Mail } from "./integrations";
import { registerSuite } from "./suite";
import { registerIntegrationEvents } from "./integration-events";
import { config, requireModule } from "./suite-domain";
import { moduleFor } from "./suite-records";
import { demoAccounts, demoRoles, isDemoWorkspace } from "./demo-access";
interface Options {
  secureCookies?: boolean;
  appUrl?: string;
  mailer?: (mail: Mail) => Promise<void>;
  registrationOpen?: boolean;
  demoLoginEnabled?: boolean;
}
const route =
  (fn: (...args: any[]) => any): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
const kinds: Kind[] = [
  "employees",
  "leaves",
  "attendance",
  "documents",
  "jobs",
  "candidates",
  "assets",
  "appraisals",
  "emailLogs",
];
const metadata = ({ contentBase64, ...doc }: any) => doc;
function loginPassword(value: unknown) {
  if (typeof value !== "string" || !value.length || value.length > 128)
    throw new HttpError(400, "Enter your password.");
  return value;
}
export function createApp(store: Store, options: Options = {}) {
  const app = express(),
    secure = !!options.secureCookies;
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-HRStudio-Request") !== "1")
        return next(
          new HttpError(403, "Invalid request. Reload and try again."),
        );
      const expected = options.appUrl
        ? new URL(options.appUrl).origin
        : `${req.protocol}://${req.get("host")}`;
      if (req.get("origin") && req.get("origin") !== expected)
        return next(new HttpError(403, "This origin is not allowed."));
    }
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  const authLimit = rateLimit(20, 15 * 60 * 1000);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get(
    "/api/auth/options",
    route(async (_req, res) =>
      res.json({
        registrationOpen: options.registrationOpen !== false,
        demoRoles: options.demoLoginEnabled
          ? (await demoAccounts(store)).map((row) => row.role)
          : [],
      }),
    ),
  );
  app.post(
    "/api/auth/demo",
    authLimit,
    route(async (req, res) => {
      if (!options.demoLoginEnabled)
        throw new HttpError(404, "Demo sign-in is unavailable.");
      const role = choice(req.body.role, "demo role", demoRoles);
      if (Object.keys(req.body).some((key) => key !== "role"))
        throw new HttpError(
          400,
          "Choose a demo role without account or workspace details.",
        );
      const row = (await demoAccounts(store)).find((row) => row.role === role);
      if (!row) throw new HttpError(404, "This demo account is unavailable.");
      const actor = { ...actorFrom(row), demo: true };
      await createSession(store, res, actor.id, secure);
      await store.audit(actor, "Opened demo workspace", actor.orgId);
      res.json({ user: actor, company: await store.company(actor.orgId) });
    }),
  );
  app.post(
    "/api/auth/register",
    authLimit,
    route(async (req, res) => {
      if (options.registrationOpen === false)
        throw new HttpError(403, "New company registration is disabled.");
      const slug = text(req.body.slug, "Workspace code", 50).toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        throw new HttpError(
          400,
          "Use lowercase letters, numbers and single hyphens for the workspace code.",
        );
      const name = text(req.body.name, "Your name"),
        companyName = text(req.body.companyName, "Company name", 120),
        address = email(req.body.email);
      const hash = await hashPassword(password(req.body.password));
      const actor: Actor = {
        id: randomUUID(),
        orgId: randomUUID(),
        name,
        email: address,
        accessRole: "owner",
        employeeId: null,
        mustChangePassword: false,
      };
      await store.transaction(async () => {
        await store.db
          .prepare("INSERT INTO organizations(id,slug,settings) VALUES(?,?,?)")
          .run(
            actor.orgId,
            slug,
            JSON.stringify({
              name: companyName,
              departments: ["Operations", "Sales", "Finance", "HR"],
              leaveTypes: ["Casual Leave", "Sick Leave", "Earned Leave"],
              timezone: "Asia/Kolkata",
              currency: "INR",
            }),
          );
        await store.db
          .prepare(
            "INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)",
          )
          .run(actor.id, actor.orgId, name, address, hash, "owner");
        await store.audit(actor, "Created company", actor.orgId);
      });
      await createSession(store, res, actor.id, secure);
      res
        .status(201)
        .json({ user: actor, company: await store.company(actor.orgId) });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    route(async (req, res) => {
      const slug = text(req.body.slug, "Workspace code", 50).toLowerCase(),
        address = email(req.body.email),
        value = loginPassword(req.body.password);
      const row = await store.db
        .prepare(
          "SELECT u.* FROM users u JOIN organizations o ON o.id=u.org_id WHERE o.slug=? AND u.email=? AND u.active=1",
        )
        .get(slug, address);
      const valid = await checkPassword(
        value,
        row
          ? String(row.password_hash)
          : `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`,
      );
      if (!row || !valid)
        throw new HttpError(401, "Workspace, email or password is incorrect.");
      const actor = actorFrom(row);
      await createSession(store, res, actor.id, secure);
      res.json({ user: actor, company: await store.company(actor.orgId) });
    }),
  );
  registerIntegrationEvents(app, store);
  app.use("/api", authenticate(store));
  app.use(
    "/api",
    route(async (req, res, next) => {
      const actor: Actor = res.locals.actor;
      actor.demo = await isDemoWorkspace(store, actor.orgId);
      const protectedAction =
        /^\/(auth\/password|users(?:\/|$)|account\/employee|email\/|ai\/|suite\/integrations\/keys)/.test(
          req.path,
        );
      if (
        actor.demo &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        protectedAction
      )
        return next(
          new HttpError(
            403,
            "Demo accounts use fictional data. Account security changes and external services are unavailable in the demo.",
          ),
        );
      next();
    }),
  );
  app.get(
    "/api/auth/me",
    route(async (_req, res) =>
      res.json({
        user: res.locals.actor,
        company: await store.company(res.locals.actor.orgId),
      }),
    ),
  );
  app.post(
    "/api/auth/logout",
    route(async (req, res) => {
      await store.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(cookieToken(req.headers.cookie)));
      res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/password",
    authLimit,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      const row = (await store.db
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .get(actor.id))!;
      if (
        !(await checkPassword(
          loginPassword(req.body.currentPassword),
          String(row.password_hash),
        ))
      )
        throw new HttpError(400, "Current password is incorrect.");
      const next = password(req.body.newPassword);
      if (next === req.body.currentPassword)
        throw new HttpError(400, "Choose a different password.");
      const hash = await hashPassword(next);
      await store.transaction(async () => {
        await store.db
          .prepare("UPDATE users SET password_hash=?,must_change=0 WHERE id=?")
          .run(hash, actor.id);
        await store.db
          .prepare("DELETE FROM sessions WHERE user_id=?")
          .run(actor.id);
        await store.audit(actor, "Changed password", actor.id);
      });
      await createSession(store, res, actor.id, secure);
      res.json({ ok: true });
    }),
  );
  app.use("/api", (_req, res, next) =>
    next(
      res.locals.actor.mustChangePassword
        ? new HttpError(
            403,
            "Change your temporary password before continuing.",
          )
        : undefined,
    ),
  );
  registerSuite(app, store);
  app.use(
    "/api",
    route(async (req, res, next) => {
      try {
        const kind = req.path.match(/^\/records\/([^/]+)/)?.[1] as Kind;
        const direct = req.path.startsWith("/attendance/")
          ? "leaves"
          : req.path.startsWith("/documents")
            ? "documents"
            : req.path.startsWith("/email/")
              ? "emailhub"
              : req.path.startsWith("/ai/")
                ? "recruitment"
                : undefined;
        const module = moduleFor[kind] || direct;
        if (module) await requireModule(store, res.locals.actor, module);
        next();
      } catch (error) {
        next(error);
      }
    }),
  );
  app.get(
    "/api/state",
    route(async (_req, res) => {
      const actor: Actor = res.locals.actor;
      const state: any = Object.fromEntries(
        await mapAsync(kinds, async (kind) => [
          kind,
          await store.list(actor.orgId, kind),
        ]),
      );
      const names = new Map(
        state.employees.map((emp: any) => [emp.id, emp.name]),
      );
      for (const kind of ["leaves", "attendance", "appraisals", "emailLogs"])
        state[kind] = state[kind].map((record: any) => ({
          ...record,
          employeeName: names.get(record.employeeId) || record.employeeName,
        }));
      state.assets = state.assets.map((asset: any) => ({
        ...asset,
        assignedToName: names.get(asset.assignedToId),
      }));
      state.jobs = state.jobs.map((job: any) => ({
        ...job,
        applicantsCount: state.candidates.filter((c: any) => c.jobId === job.id)
          .length,
      }));
      if (actor.accessRole === "employee")
        for (const kind of kinds) {
          state[kind] = state[kind].filter((record: any) =>
            kind === "employees"
              ? record.id === actor.employeeId
              : kind === "assets"
                ? record.assignedToId === actor.employeeId
                : ["leaves", "attendance", "documents", "appraisals"].includes(
                    kind,
                  ) && record.employeeId === actor.employeeId,
          );
        }
      state.documents = state.documents.map(metadata);
      const suite = await config(store, actor.orgId);
      for (const kind of kinds)
        if (moduleFor[kind] && !suite.enabledModules.includes(moduleFor[kind]))
          state[kind] = [];
      res.json({
        ...state,
        company: { ...(await store.company(actor.orgId)), suite },
        user: actor,
        mailConfigured: !!options.mailer,
      });
    }),
  );
  app.patch(
    "/api/company",
    requireOwner,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        current = await store.company(actor.orgId);
      if (current.version !== req.body.version)
        throw new HttpError(
          409,
          "Company settings changed. Refresh and try again.",
        );
      const settings = { ...companySettings(req.body), suite: current.suite };
      if (
        [
          ...(await store.list(actor.orgId, "employees")),
          ...(await store.list(actor.orgId, "jobs")),
        ].some((record) => !settings.departments.includes(record.department))
      )
        throw new HttpError(
          409,
          "A department in use cannot be removed. Update its employees and jobs first.",
        );
      await store.transaction(async () => {
        await store.db
          .prepare(
            "UPDATE organizations SET settings=?,version=version+1 WHERE id=?",
          )
          .run(JSON.stringify(settings), actor.orgId);
        await store.audit(actor, "Updated company settings", actor.orgId);
      });
      res.json(await store.company(actor.orgId));
    }),
  );
  app.get(
    "/api/users",
    requireOwner,
    route(async (_req, res) =>
      res.json(
        await store.db
          .prepare(
            "SELECT id,name,email,role AS accessRole,employee_id AS employeeId,active,must_change AS mustChangePassword FROM users WHERE org_id=? ORDER BY name",
          )
          .all(res.locals.actor.orgId),
      ),
    ),
  );
  app.post(
    "/api/users",
    requireOwner,
    authLimit,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        employee = await store.get(
          actor.orgId,
          "employees",
          text(req.body.employeeId, "Employee"),
        );
      if (employee.status !== "Active")
        throw new HttpError(400, "Choose an active employee.");
      const role = choice(req.body.accessRole, "access role", [
          "hr",
          "employee",
        ]),
        id = randomUUID();
      const temporaryPassword = randomBytes(18).toString("base64url"),
        hash = await hashPassword(temporaryPassword);
      await store.transaction(async () => {
        await store.db
          .prepare(
            "INSERT INTO users(id,org_id,name,email,password_hash,role,employee_id,must_change) VALUES(?,?,?,?,?,?,?,1)",
          )
          .run(
            id,
            actor.orgId,
            employee.name,
            employee.email,
            hash,
            role,
            employee.id,
          );
        await store.audit(actor, "Created account", id);
      });
      res.status(201).json({ id, email: employee.email, temporaryPassword });
    }),
  );
  app.patch(
    "/api/users/:id",
    requireOwner,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        row = await store.db
          .prepare("SELECT * FROM users WHERE id=? AND org_id=?")
          .get(req.params.id, actor.orgId);
      if (!row) throw new HttpError(404, "Account not found.");
      if (row.role === "owner" || typeof req.body.active !== "boolean")
        throw new HttpError(
          400,
          "Choose an employee or HR account and a valid account status.",
        );
      await store.transaction(async () => {
        await store.db
          .prepare("UPDATE users SET active=? WHERE id=?")
          .run(req.body.active ? 1 : 0, row.id);
        await store.db
          .prepare("DELETE FROM sessions WHERE user_id=?")
          .run(row.id);
        await store.audit(
          actor,
          req.body.active ? "Enabled account" : "Disabled account",
          String(row.id),
        );
      });
      res.json({ ok: true });
    }),
  );
  app.patch(
    "/api/account/employee",
    requireOwner,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        emp = await store.get(
          actor.orgId,
          "employees",
          text(req.body.employeeId, "Employee"),
        );
      await store.transaction(async () => {
        await store.db
          .prepare("UPDATE users SET employee_id=? WHERE id=?")
          .run(emp.id, actor.id);
        await store.audit(actor, "Linked owner profile", emp.id);
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/audit",
    requireStaff,
    route(async (_req, res) =>
      res.json(
        await store.db
          .prepare(
            "SELECT id,actor_name AS actorName,action,entity_id AS entityId,at FROM audit WHERE org_id=? ORDER BY at DESC,id DESC LIMIT 200",
          )
          .all(res.locals.actor.orgId),
      ),
    ),
  );
  app.post(
    "/api/attendance/clock",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor;
      if (!actor.employeeId)
        throw new HttpError(
          400,
          "Link your employee profile in Settings before clocking in.",
        );
      const emp = await store.get(actor.orgId, "employees", actor.employeeId);
      if (emp.status !== "Active")
        throw new HttpError(
          400,
          "Attendance requires an active employee profile.",
        );
      const action = choice(req.body.action, "clock action", ["in", "out"]);
      const open = (await store.list(actor.orgId, "attendance")).find(
        (log) => log.employeeId === emp.id && !log.checkOut,
      );
      if ((action === "in" && open) || (action === "out" && !open))
        throw new HttpError(
          409,
          "Your attendance changed. Refresh and try again.",
        );
      const now = new Date(),
        zone = (await store.company(actor.orgId)).timezone;
      const time = now.toLocaleTimeString("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      res.json(
        open
          ? await store.save(
              actor,
              "attendance",
              { ...open, checkOut: time, checkOutAt: now.toISOString() },
              open.id,
              open.version,
            )
          : await store.save(actor, "attendance", {
              employeeId: emp.id,
              employeeName: emp.name,
              date: now.toLocaleDateString("en-CA", { timeZone: zone }),
              checkIn: time,
              checkInAt: now.toISOString(),
              checkOut: null,
              status: "Present",
            }),
      );
    }),
  );
  app.post(
    "/api/documents",
    requireStaff,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        emp = await store.get(
          actor.orgId,
          "employees",
          text(req.body.employeeId, "Employee"),
        );
      const name = text(req.body.name, "Filename", 200).replace(
        /[\\/\r\n]/g,
        "_",
      );
      const mimeType = choice(req.body.mimeType, "file type", [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "text/plain",
      ]);
      const contentBase64 = text(req.body.contentBase64, "File", 2800000),
        bytes = Buffer.from(contentBase64, "base64");
      if (
        !bytes.length ||
        bytes.length > 2 * 1024 * 1024 ||
        bytes.toString("base64") !== contentBase64
      )
        throw new HttpError(400, "Choose a valid file up to 2 MB.");
      if (
        (mimeType === "application/pdf" &&
          bytes.subarray(0, 5).toString() !== "%PDF-") ||
        (mimeType === "image/png" &&
          bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") ||
        (mimeType === "image/jpeg" &&
          bytes.subarray(0, 3).toString("hex") !== "ffd8ff")
      )
        throw new HttpError(400, "The file content does not match its type.");
      const doc = await store.save(actor, "documents", {
        employeeId: emp.id,
        name,
        mimeType,
        contentBase64,
        category: choice(req.body.category, "category", [
          "Contract",
          "ID Proof",
          "Certificate",
          "Other",
        ]),
        uploadDate: new Date().toISOString().slice(0, 10),
        size: `${Math.ceil(bytes.length / 1024)} KB`,
      });
      res.status(201).json(metadata(doc));
    }),
  );
  app.get(
    "/api/documents/:id/download",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        doc = await store.get(actor.orgId, "documents", req.params.id);
      if (
        actor.accessRole === "employee" &&
        doc.employeeId !== actor.employeeId
      )
        throw new HttpError(404, "Document not found.");
      const extension: any = {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "text/plain": "txt",
      };
      res
        .set("Content-Type", doc.mimeType)
        .set(
          "Content-Disposition",
          `attachment; filename="document.${extension[doc.mimeType]}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        );
      res.send(Buffer.from(doc.contentBase64, "base64"));
    }),
  );
  app.post(
    "/api/email/send",
    requireStaff,
    rateLimit(10, 60000),
    route(async (req, res) => {
      if (!options.mailer)
        throw new HttpError(
          503,
          "Email delivery is not configured. You can still copy or open a draft.",
        );
      const actor: Actor = res.locals.actor,
        emp = await store.get(
          actor.orgId,
          "employees",
          text(req.body.employeeId, "Employee"),
        );
      const subject = text(req.body.subject, "Subject", 200),
        body = text(req.body.body, "Message", 12000);
      const campaignType = choice(req.body.campaignType, "message type", [
        "Birthday",
        "Work Anniversary",
        "Payslip",
        "General Notice",
      ]);
      const log = await store.save(actor, "emailLogs", {
        employeeId: emp.id,
        employeeName: emp.name,
        recipientEmail: emp.email,
        subject,
        body,
        campaignType,
        status: "Queued",
        timestamp: new Date().toISOString(),
      });
      try {
        await options.mailer({
          recipient: emp.email,
          subject,
          body,
          companyName: (await store.company(actor.orgId)).name,
        });
      } catch {
        await store.save(
          actor,
          "emailLogs",
          { ...log, status: "Failed" },
          log.id,
          log.version,
        );
        throw new HttpError(
          502,
          "The mail service did not confirm acceptance. Check your mail service before retrying.",
        );
      }
      res.json(
        await store.save(
          actor,
          "emailLogs",
          { ...log, status: "Accepted" },
          log.id,
          log.version,
        ),
      );
    }),
  );
  app.post(
    "/api/ai/evaluate",
    requireStaff,
    rateLimit(10, 60000),
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        candidate = await store.get(
          actor.orgId,
          "candidates",
          text(req.body.candidateId, "Candidate"),
        );
      if (!candidate.resumeText)
        throw new HttpError(
          400,
          "Add resume text before requesting an evaluation.",
        );
      const job = await store.get(actor.orgId, "jobs", candidate.jobId),
        result = await evaluateResume(job.title, candidate.resumeText);
      res.json(
        await store.save(
          actor,
          "candidates",
          {
            ...candidate,
            aiScore: result.score,
            aiEvaluation: result.evaluation,
          },
          candidate.id,
          candidate.version,
        ),
      );
    }),
  );
  app.post(
    "/api/records/:kind",
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "record type", kinds) as Kind;
      if (actor.accessRole === "employee" && kind !== "leaves")
        throw new HttpError(403, "HR access is required.");
      res
        .status(201)
        .json(
          await store.save(
            actor,
            kind,
            await validateRecord(store, actor, kind, req.body),
          ),
        );
    }),
  );
  app.patch(
    "/api/records/:kind/:id",
    requireStaff,
    route(async (req, res) => {
      const actor: Actor = res.locals.actor,
        kind = choice(req.params.kind, "record type", kinds) as Kind;
      const existing = await store.get(actor.orgId, kind, req.params.id);
      res.json(
        await store.save(
          actor,
          kind,
          await validateRecord(
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
  app.delete(
    "/api/records/:kind/:id",
    requireStaff,
    route(async (req, res) => {
      const kind = choice(req.params.kind, "record type", [
        "employees",
        "documents",
        "assets",
      ]) as Kind;
      await store.remove(
        res.locals.actor,
        kind,
        req.params.id,
        req.body.version,
      );
      res.json({ ok: true });
    }),
  );
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "API endpoint not found.")),
  );
  app.use((error: any, _req: any, res: any, _next: any) => {
    if (error instanceof HttpError)
      return res.status(error.status).json({ error: error.message });
    if (
      error.code === "23503" ||
      error.message?.includes("FOREIGN KEY constraint")
    )
      return res.status(409).json({
        error:
          "Other records or an account reference this item. Keep the record and change its status instead.",
      });
    if (error.code === "23505" || error.message?.includes("UNIQUE constraint"))
      return res.status(409).json({
        error:
          "A record with this unique value already exists (workspace, email, asset, branch, payroll month or acknowledgement). Refresh and check existing records.",
      });
    if (["40001", "40P01"].includes(error.code))
      return res
        .status(409)
        .json({
          error:
            "This record changed during another request. Refresh and try again.",
        });
    if (error.type === "entity.too.large")
      return res.status(413).json({
        error: "The request is too large. Files must be at most 2 MB.",
      });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON request." });
    console.error("Request failed:", error.name || "Error");
    res
      .status(500)
      .json({ error: "The request could not be completed. Please try again." });
  });
  return app;
}
