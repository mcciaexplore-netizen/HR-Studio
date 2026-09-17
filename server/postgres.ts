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

export function supabaseConnection(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.SUPABASE_DB_URL?.trim();
  if (!raw)
    throw new Error(
      "Set SUPABASE_DB_URL to the Supabase transaction pooler connection string.",
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SUPABASE_DB_URL must be a PostgreSQL connection string.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.pathname.slice(1) ||
    !/\.(supabase\.com|supabase\.co)$/.test(url.hostname) ||
    url.hash
  )
    throw new Error(
      "Use the PostgreSQL connection string from your Supabase project's Connect panel.",
    );
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: {
      rejectUnauthorized: true,
      ...(env.SUPABASE_DB_CA
        ? { ca: env.SUPABASE_DB_CA.replace(/\\n/g, "\n") }
        : {}),
    },
    prepare: false,
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
    onnotice: () => {},
  };
}

export function connectSupabaseDatabase(env: NodeJS.ProcessEnv = process.env) {
  return new PostgresDatabase(executorFor(postgres(supabaseConnection(env))));
}
