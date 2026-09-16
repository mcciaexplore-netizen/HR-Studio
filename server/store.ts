import { DatabaseSync } from "node:sqlite";
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

/** A single connection owns short synchronous transactions. No transaction spans an await. */
export class Store {
  db: DatabaseSync;
  private transactionDepth = 0;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const version = Number(
      this.db.prepare("PRAGMA user_version").get()!.user_version,
    );
    if (version > 3)
      throw new Error("Database was created by a newer version of HR Studio.");
    if (version < 1)
      this.transaction(() => {
        this.db.exec(`
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
      `);
      });
    if (version < 2)
      this.transaction(() => {
        this.db.exec(`
        CREATE UNIQUE INDEX one_payroll_month ON records(org_id,json_extract(data,'$.month')) WHERE kind='payroll';
        CREATE UNIQUE INDEX one_acknowledgement ON records(org_id,json_extract(data,'$.employeeId'),json_extract(data,'$.policyId'),json_extract(data,'$.policyVersion')) WHERE kind='acknowledgements';
        CREATE UNIQUE INDEX unique_branch_code ON records(org_id,lower(json_extract(data,'$.code'))) WHERE kind='branches';
        CREATE TABLE integration_events(org_id TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(org_id,external_id));
        CREATE TABLE payroll_expenses(org_id TEXT NOT NULL, expense_id TEXT NOT NULL, payroll_id TEXT NOT NULL, PRIMARY KEY(org_id,expense_id), FOREIGN KEY(org_id,expense_id) REFERENCES records(org_id,id), FOREIGN KEY(org_id,payroll_id) REFERENCES records(org_id,id));
        PRAGMA user_version=2;
      `);
      });
    if (version < 3)
      this.transaction(() => {
        this.db.exec(`
          CREATE TABLE demo_access(
            org_id TEXT NOT NULL REFERENCES organizations(id),
            role TEXT NOT NULL CHECK(role IN ('owner','hr','employee')),
            user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
            PRIMARY KEY(org_id,role)
          );
          PRAGMA user_version=3;
        `);
      });
  }
  transaction<T>(fn: () => T): T {
    const depth = this.transactionDepth,
      savepoint = `nested_${depth}`;
    this.db.exec(depth ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = fn();
      this.db.exec(depth ? `RELEASE ${savepoint}` : "COMMIT");
      return result;
    } catch (error) {
      this.db.exec(depth ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
      if (depth) this.db.exec(`RELEASE ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }
  company(orgId: string) {
    const row = this.db
      .prepare("SELECT * FROM organizations WHERE id=?")
      .get(orgId)!;
    return {
      ...JSON.parse(String(row.settings)),
      id: orgId,
      slug: row.slug,
      version: row.version,
    };
  }
  list(orgId: string, kind: Kind): any[] {
    return this.db
      .prepare(
        "SELECT * FROM records WHERE org_id=? AND kind=? ORDER BY created_at DESC,id",
      )
      .all(orgId, kind)
      .map((row) => ({
        ...JSON.parse(String(row.data)),
        id: row.id,
        version: row.version,
      }));
  }
  get(orgId: string, kind: Kind, id: string): any {
    const row = this.db
      .prepare("SELECT * FROM records WHERE org_id=? AND kind=? AND id=?")
      .get(orgId, kind, id);
    if (!row) throw new HttpError(404, "Record not found.");
    return {
      ...JSON.parse(String(row.data)),
      id: row.id,
      version: row.version,
    };
  }
  save(actor: Actor, kind: Kind, data: any, id?: string, version?: number) {
    return this.transaction(() => {
      const recordId = id || randomUUID();
      const before = id ? this.get(actor.orgId, kind, id) : null;
      const effectiveDate =
        data._effectiveDate ||
        new Date().toLocaleDateString("en-CA", {
          timeZone: this.company(actor.orgId).timezone,
        });
      const {
        id: ignoredId,
        version: ignoredVersion,
        _effectiveDate,
        ...clean
      } = data;
      data = clean;
      if (id) {
        const existing = this.get(actor.orgId, kind, id);
        if (version !== existing.version)
          throw new HttpError(
            409,
            "This record changed. Refresh and try again.",
          );
        this.db
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
        this.db
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
      this.audit(actor, `${id ? "Updated" : "Created"} ${kind}`, recordId);
      if (kind === "employees") {
        this.save(actor, "employeeHistory", {
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
      return this.get(actor.orgId, kind, recordId);
    });
  }
  remove(actor: Actor, kind: Kind, id: string, version: number) {
    this.transaction(() => {
      const record = this.get(actor.orgId, kind, id);
      if (record.version !== version)
        throw new HttpError(409, "This record changed. Refresh and try again.");
      this.db
        .prepare("DELETE FROM records WHERE org_id=? AND kind=? AND id=?")
        .run(actor.orgId, kind, id);
      this.audit(actor, `Deleted ${kind}`, id);
    });
  }
  audit(actor: Actor, action: string, entityId: string) {
    this.db
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
  close() {
    this.db.close();
  }
}
