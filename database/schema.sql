-- HR Studio private backend schema. Only the server database connection can access it.
CREATE SCHEMA IF NOT EXISTS hrstudio;
REVOKE ALL ON SCHEMA hrstudio FROM PUBLIC;
DO $$
BEGIN
  IF to_regclass('hrstudio.schema_version') IS NULL THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='hrstudio') THEN
      RAISE EXCEPTION 'The hrstudio schema contains unrelated tables. Choose another database without an unrelated hrstudio schema.';
    END IF;
  ELSIF (SELECT version FROM hrstudio.schema_version WHERE id=1) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Unsupported HR Studio schema version.';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS hrstudio.organizations (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
  settings TEXT NOT NULL CHECK(jsonb_typeof(settings::jsonb)='object'), version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS hrstudio.records (
  org_id TEXT NOT NULL REFERENCES hrstudio.organizations(id), id TEXT NOT NULL, kind TEXT NOT NULL,
  data TEXT NOT NULL CHECK(jsonb_typeof(data::jsonb)='object'), version INTEGER NOT NULL DEFAULT 1,
  employee_id TEXT, job_id TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,employee_id) REFERENCES hrstudio.records(org_id,id),
  FOREIGN KEY(org_id,job_id) REFERENCES hrstudio.records(org_id,id)
);
CREATE INDEX IF NOT EXISTS records_kind ON hrstudio.records(org_id,kind,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS employee_email ON hrstudio.records(org_id,lower(data::jsonb->>'email')) WHERE kind='employees';
CREATE UNIQUE INDEX IF NOT EXISTS asset_serial ON hrstudio.records(org_id,lower(data::jsonb->>'serialNumber')) WHERE kind='assets';
CREATE UNIQUE INDEX IF NOT EXISTS one_payroll_month ON hrstudio.records(org_id,(data::jsonb->>'month')) WHERE kind='payroll';
CREATE UNIQUE INDEX IF NOT EXISTS one_acknowledgement ON hrstudio.records(org_id,(data::jsonb->>'employeeId'),(data::jsonb->>'policyId'),(data::jsonb->>'policyVersion')) WHERE kind='acknowledgements';
CREATE UNIQUE INDEX IF NOT EXISTS unique_branch_code ON hrstudio.records(org_id,lower(data::jsonb->>'code')) WHERE kind='branches';
CREATE TABLE IF NOT EXISTS hrstudio.users (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES hrstudio.organizations(id), name TEXT NOT NULL, email TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','hr','employee')),
  employee_id TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  must_change INTEGER NOT NULL DEFAULT 0 CHECK(must_change IN (0,1)),
  UNIQUE(org_id,email), UNIQUE(org_id,employee_id),
  FOREIGN KEY(org_id,employee_id) REFERENCES hrstudio.records(org_id,id)
);
CREATE TABLE IF NOT EXISTS hrstudio.sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES hrstudio.users(id), expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON hrstudio.sessions(expires_at);
CREATE TABLE IF NOT EXISTS hrstudio.audit (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES hrstudio.organizations(id), actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_org ON hrstudio.audit(org_id,at);
CREATE TABLE IF NOT EXISTS hrstudio.integration_events (
  org_id TEXT NOT NULL REFERENCES hrstudio.organizations(id), external_id TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(org_id,external_id)
);
CREATE TABLE IF NOT EXISTS hrstudio.payroll_expenses (
  org_id TEXT NOT NULL, expense_id TEXT NOT NULL, payroll_id TEXT NOT NULL, PRIMARY KEY(org_id,expense_id),
  FOREIGN KEY(org_id,expense_id) REFERENCES hrstudio.records(org_id,id),
  FOREIGN KEY(org_id,payroll_id) REFERENCES hrstudio.records(org_id,id)
);
CREATE TABLE IF NOT EXISTS hrstudio.demo_access (
  org_id TEXT NOT NULL REFERENCES hrstudio.organizations(id), role TEXT NOT NULL CHECK(role IN ('owner','hr','employee')),
  user_id TEXT NOT NULL UNIQUE REFERENCES hrstudio.users(id), PRIMARY KEY(org_id,role)
);
CREATE TABLE IF NOT EXISTS hrstudio.schema_version (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO hrstudio.schema_version VALUES(1,1) ON CONFLICT(id) DO NOTHING;
-- The browser uses Express authentication; these tables are never exposed through the public Data API.
DO $$
DECLARE table_name TEXT; role_name TEXT;
BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='hrstudio' LOOP
    EXECUTE format('ALTER TABLE hrstudio.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON hrstudio.%I FROM PUBLIC', table_name);
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA hrstudio FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA hrstudio FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
