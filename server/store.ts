import { DatabaseSync } from "node:sqlite";
import { SQLiteDatabase, type AsyncDatabase } from "./database";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
export type AccessRole = "owner" | "hr" | "employee";
export interface Actor {
  id: string;
  orgId: string;
  name: string;
  email: string;
  accessRole: AccessRole;
  employeeId: string | null;
  mustChangePassword: boolean;
  demo?: boolean;
}
export type Kind =
  | "employees"
  | "leaves"
  | "attendance"
  | "documents"
  | "jobs"
  | "candidates"
  | "assets"
  | "appraisals"
  | "emailLogs"
  | "branches"
  | "holidays"
  | "shifts"
  | "shiftAssignments"
  | "leaveAdjustments"
  | "expenses"
  | "lifecycle"
  | "employeeHistory"
  | "employmentChanges"
  | "profileRequests"
  | "tickets"
  | "policies"
  | "acknowledgements"
  | "payroll"
  | "imports"
  | "integrationKeys"
  | "attendanceCorrections";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Both local SQLite and cloud PostgreSQL use the same asynchronous store API. */
export class Store {
  db: AsyncDatabase;
  constructor(filename: string | AsyncDatabase) {
    if (typeof filename !== "string") {
      this.db = filename;
      return;
    }
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename);
    try {
      db.exec(
        "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
      );
      const version = Number(
        db.prepare("PRAGMA user_version").get()!.user_version,
      );
      if (version > 3)
        throw new Error(
          "Database was created by a newer version of HR Studio.",
        );
      if (version < 1)
        db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE organizations(id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, settings TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE records(
          org_id TEXT NOT NULL REFERENCES organizations(id), id TEXT NOT NULL, kind TEXT NOT NULL,
          data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1,
          employee_id TEXT, job_id TEXT, created_at TEXT NOT NULL,
          PRIMARY KEY(org_id,id), FOREIGN KEY(org_id,employee_id) REFERENCES records(org_id,id),
          FOREIGN KEY(org_id,job_id) REFERENCES records(org_id,id)
        );
        CREATE INDEX records_kind ON records(org_id,kind,created_at);
        CREATE UNIQUE INDEX employee_email ON records(org_id,lower(json_extract(data,'$.email'))) WHERE kind='employees';
        CREATE UNIQUE INDEX asset_serial ON records(org_id,lower(json_extract(data,'$.serialNumber'))) WHERE kind='assets';
        CREATE TABLE users(
          id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, email TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','hr','employee')),
          employee_id TEXT, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0,
          UNIQUE(org_id,email), UNIQUE(org_id,employee_id), FOREIGN KEY(org_id,employee_id) REFERENCES records(org_id,id)
        );
        CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
        CREATE INDEX session_expiry ON sessions(expires_at);
        CREATE TABLE audit(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL,
          actor_name TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, at TEXT NOT NULL);
        CREATE INDEX audit_org ON audit(org_id,at);
        PRAGMA user_version=1;
      COMMIT;`);
      if (version < 2)
        db.exec(`BEGIN IMMEDIATE;
        CREATE UNIQUE INDEX one_payroll_month ON records(org_id,json_extract(data,'$.month')) WHERE kind='payroll';
        CREATE UNIQUE INDEX one_acknowledgement ON records(org_id,json_extract(data,'$.employeeId'),json_extract(data,'$.policyId'),json_extract(data,'$.policyVersion')) WHERE kind='acknowledgements';
        CREATE UNIQUE INDEX unique_branch_code ON records(org_id,lower(json_extract(data,'$.code'))) WHERE kind='branches';
        CREATE TABLE integration_events(org_id TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(org_id,external_id));
        CREATE TABLE payroll_expenses(org_id TEXT NOT NULL, expense_id TEXT NOT NULL, payroll_id TEXT NOT NULL, PRIMARY KEY(org_id,expense_id), FOREIGN KEY(org_id,expense_id) REFERENCES records(org_id,id), FOREIGN KEY(org_id,payroll_id) REFERENCES records(org_id,id));
        PRAGMA user_version=2;
      COMMIT;`);
      if (version < 3)
        db.exec(`BEGIN IMMEDIATE;
          CREATE TABLE demo_access(
            org_id TEXT NOT NULL REFERENCES organizations(id),
            role TEXT NOT NULL CHECK(role IN ('owner','hr','employee')),
            user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
            PRIMARY KEY(org_id,role)
          );
          PRAGMA user_version=3;
        COMMIT;`);
      this.db = new SQLiteDatabase(db);
    } catch (error) {
      db.close();
      throw error;
    }
  }
  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    return await this.db.transaction(fn);
  }
  async company(orgId: string) {
    const row = (await this.db
      .prepare("SELECT * FROM organizations WHERE id=?")
      .get(orgId))!;
    return {
      ...JSON.parse(String(row.settings)),
      id: orgId,
      slug: row.slug,
      version: row.version,
    };
  }
  async list(orgId: string, kind: Kind): Promise<any[]> {
    return (
      await this.db
        .prepare(
          "SELECT * FROM records WHERE org_id=? AND kind=? ORDER BY created_at DESC,id",
        )
        .all(orgId, kind)
    ).map((row) => ({
      ...JSON.parse(String(row.data)),
      id: row.id,
      version: row.version,
    }));
  }
  async get(orgId: string, kind: Kind, id: string): Promise<any> {
    const row = await this.db
      .prepare("SELECT * FROM records WHERE org_id=? AND kind=? AND id=?")
      .get(orgId, kind, id);
    if (!row) throw new HttpError(404, "Record not found.");
    return {
      ...JSON.parse(String(row.data)),
      id: row.id,
      version: row.version,
    };
  }
  async save(
    actor: Actor,
    kind: Kind,
    data: any,
    id?: string,
    version?: number,
  ) {
    return await this.transaction(async () => {
      const recordId = id || randomUUID();
      const before = id ? await this.get(actor.orgId, kind, id) : null;
      const effectiveDate =
        data._effectiveDate ||
        new Date().toLocaleDateString("en-CA", {
          timeZone: (await this.company(actor.orgId)).timezone,
        });
      const {
        id: ignoredId,
        version: ignoredVersion,
        _effectiveDate,
        ...clean
      } = data;
      data = clean;
      if (id) {
        const existing = await this.get(actor.orgId, kind, id);
        if (version !== existing.version)
          throw new HttpError(
            409,
            "This record changed. Refresh and try again.",
          );
        await this.db
          .prepare(
            "UPDATE records SET data=?,version=version+1,employee_id=?,job_id=? WHERE org_id=? AND id=?",
          )
          .run(
            JSON.stringify(data),
            data.employeeId || data.assignedToId || null,
            data.jobId || null,
            actor.orgId,
            id,
          );
      } else {
        await this.db
          .prepare(
            "INSERT INTO records(org_id,id,kind,data,employee_id,job_id,created_at) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            actor.orgId,
            recordId,
            kind,
            JSON.stringify(data),
            data.employeeId || data.assignedToId || null,
            data.jobId || null,
            new Date().toISOString(),
          );
      }
      await this.audit(
        actor,
        `${id ? "Updated" : "Created"} ${kind}`,
        recordId,
      );
      if (kind === "employees") {
        await this.save(actor, "employeeHistory", {
          employeeId: recordId,
          employeeName: data.name,
          effectiveDate: id ? effectiveDate : data.hireDate,
          action: id ? "Profile updated" : "Employee created",
          before,
          after: { ...data, id: recordId },
          changedAt: new Date().toISOString(),
          employeeVersion: (before?.version || 0) + 1,
          changedBy: actor.name,
        });
      }
      return await this.get(actor.orgId, kind, recordId);
    });
  }
  async remove(actor: Actor, kind: Kind, id: string, version: number) {
    await this.transaction(async () => {
      const record = await this.get(actor.orgId, kind, id);
      if (record.version !== version)
        throw new HttpError(409, "This record changed. Refresh and try again.");
      await this.db
        .prepare("DELETE FROM records WHERE org_id=? AND kind=? AND id=?")
        .run(actor.orgId, kind, id);
      await this.audit(actor, `Deleted ${kind}`, id);
    });
  }
  async audit(actor: Actor, action: string, entityId: string) {
    await this.db
      .prepare("INSERT INTO audit VALUES(?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        actor.orgId,
        actor.id,
        actor.name,
        action,
        entityId,
        new Date().toISOString(),
      );
  }
  async close() {
    await this.db.close();
  }
}
