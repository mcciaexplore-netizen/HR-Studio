import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import type { AsyncDatabase } from "./database";

export interface PostgresExecutor {
  query(
    sql: string,
    parameters?: any[],
  ): Promise<{ rows: any[]; count: number }>;
  transaction<T>(fn: (transaction: PostgresExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Translate only the small, fixed SQL dialect used by the shared store.
// Values are always sent as bound parameters, never interpolated into SQL.
export function postgresSQL(source: string) {
  let index = 0;
  const placeholders = source.replace(
    /'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,
    (token) => (token === "?" ? `$${++index}` : token),
  );
  return placeholders
    .replace(
      /json_extract\(([\w.]+),'\$\.active'\)/g,
      "(CASE WHEN $1::jsonb->>'active'='true' THEN 1 ELSE 0 END)",
    )
    .replace(
      /json_extract\(([\w.]+),'\$\.([A-Za-z]+)'\)/g,
      "($1::jsonb->>'$2')",
    )
    .replace(
      /\b(FROM|JOIN|UPDATE|INTO)\s+(organizations|records|users|sessions|audit|integration_events|payroll_expenses|demo_access)\b/gi,
      "$1 hrstudio.$2",
    )
    .replace(/\bAS\s+([a-z]+[A-Z]\w*)\b/g, 'AS "$1"');
}

export class PostgresDatabase implements AsyncDatabase {
  private context = new AsyncLocalStorage<PostgresExecutor>();
  constructor(private executor: PostgresExecutor) {}
  private current() {
    return this.context.getStore() || this.executor;
  }
  prepare(source: string) {
    const sql = postgresSQL(source);
    return {
      get: async (...parameters: any[]) =>
        (await this.current().query(sql, parameters)).rows[0],
      all: async (...parameters: any[]) =>
        (await this.current().query(sql, parameters)).rows,
      run: async (...parameters: any[]) => ({
        changes: (await this.current().query(sql, parameters)).count,
      }),
    };
  }
  async exec(sql: string) {
    await this.current().query(sql);
  }
  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.current().transaction((transaction) =>
      this.context.run(transaction, async () => fn()),
    );
  }
  async close() {
    await this.executor.close();
  }
}

function executorFor(sql: any, nested = false): PostgresExecutor {
  return {
    async query(query, parameters = []) {
      const result = await sql.unsafe(query, parameters);
      return { rows: [...result], count: result.count ?? 0 };
    },
    transaction: (fn) =>
      nested
        ? sql.savepoint((transaction: any) =>
            fn(executorFor(transaction, true)),
          )
        : sql.begin("isolation level serializable", (transaction: any) =>
            fn(executorFor(transaction, true)),
          ),
    close: () => (nested ? Promise.resolve() : sql.end({ timeout: 5 })),
  };
}

export function postgresConnection(env: NodeJS.ProcessEnv = process.env) {
  // DATABASE_URL is the standard Neon/Vercel integration setting. Keep the
  // previous Supabase setting as a fallback for existing installations only.
  const primary = env.DATABASE_URL?.trim();
  const raw = primary || env.SUPABASE_DB_URL?.trim();
  if (!raw)
    throw new Error(
      "Set DATABASE_URL to the Neon pooled PostgreSQL connection string.",
    );
  let url: URL;
  let username: string;
  let password: string;
  let database: string;
  try {
    url = new URL(raw);
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !username ||
    !password ||
    !database ||
    !/\.(neon\.tech|supabase\.com|supabase\.co)$/.test(url.hostname) ||
    url.hash ||
    (url.port && Number(url.port) < 1)
  )
    throw new Error(
      "Use the PostgreSQL connection string from Neon or Supabase's Connect panel.",
    );
  const ca = env.DATABASE_CA || (!primary ? env.SUPABASE_DB_CA : undefined);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username,
    password,
    database,
    // Never let URL parameters disable certificate or hostname verification.
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}),
    },
    prepare: false,
    max: 1,
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 300,
    onnotice: () => {},
  };
}

export function connectPostgresDatabase(env: NodeJS.ProcessEnv = process.env) {
  return new PostgresDatabase(executorFor(postgres(postgresConnection(env))));
}
