import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "./store";
import type { AsyncDatabase } from "./database";
import { createDemoWorkspace } from "./demo";
import { populateDemoSamples } from "./demo-samples";

const tables = [
  "organizations",
  "records",
  "users",
  "sessions",
  "audit",
  "integration_events",
  "payroll_expenses",
  "demo_access",
];
export async function initializeCloudDemo(target: AsyncDatabase) {
  const sample = new Store(":memory:");
  const data: Array<{ table: string; rows: any[] }> = [];
  try {
    await createDemoWorkspace(sample);
    await populateDemoSamples(sample);
    for (const table of tables)
      data.push({
        table,
        rows: await sample.db.prepare(`SELECT * FROM ${table}`).all(),
      });
  } finally {
    await sample.close();
  }
  return target.transaction(async () => {
    // Serialize two first-time setup runs; ordinary app requests never create schema or seed data.
    await target.exec("SELECT pg_advisory_xact_lock(739214, 1)");
    await target.exec(readFileSync(resolve("database/schema.sql"), "utf8"));
    if (await target.prepare("SELECT 1 FROM organizations LIMIT 1").get())
      return "Existing workspace preserved; no accounts or demo records were reset.";
    for (const { table, rows } of data) {
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const tuples = rows
        .map(() => `(${columns.map(() => "?").join(",")})`)
        .join(",");
      await target
        .prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples}`)
        .run(...rows.flatMap((row) => columns.map((column) => row[column])));
    }
    return "Cloud database initialized with fictional samples and Admin, HR and Employee demo accounts.";
  });
}
