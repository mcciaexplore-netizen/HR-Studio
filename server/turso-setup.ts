import { Store, type DatabaseConnection } from "./store";
import { createDemoWorkspace } from "./demo";
import { populateDemoSamples } from "./demo-samples";

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint")
    return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error("Unsupported seed value.");
}

// Prepare fictional records locally so password hashing and hundreds of seed
// statements do not incur network round trips inside a short remote transaction.
export async function initializeTursoDemo(target: DatabaseConnection) {
  const sample = new Store(":memory:", { driver: "node" });
  let schema: string, data: string;
  try {
    await createDemoWorkspace(sample);
    await populateDemoSamples(sample);
    const objects = sample.db
      .prepare(
        "SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
      )
      .all();
    schema = objects.map((row) => `${row.sql};`).join("\n");
    data = objects
      .filter((row) => row.type === "table")
      .flatMap((table) => {
        // Names come only from this application's internally created schema.
        if (!/^[a-z_]+$/.test(table.name))
          throw new Error("Unexpected seed table.");
        return sample.db
          .prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`)
          .all()
          .map(
            (row) =>
              `INSERT INTO "${table.name}" VALUES(${Object.values(row).map(sqlValue).join(",")});`,
          );
      })
      .join("\n");
  } finally {
    sample.close();
  }

  target.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
  try {
    const version = Number(
      target.prepare("PRAGMA user_version").get().user_version,
    );
    if (version !== 0 && version !== 3)
      throw new Error(
        "This database has another schema version. Use a new empty demo database.",
      );
    if (
      version === 3 &&
      target.prepare("SELECT 1 FROM organizations LIMIT 1").get()
    ) {
      target.exec("ROLLBACK");
      return "Existing workspace preserved; no demo records were changed.";
    }
    if (
      version === 0 &&
      target
        .prepare(
          "SELECT 1 FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
        )
        .get()
    )
      throw new Error(
        "The database contains another application's tables. Use a new empty database.",
      );
    target.exec(
      `${version === 0 ? schema : ""}\n${data}\nPRAGMA user_version=3; COMMIT;`,
    );
    return "Fictional demo initialized with Admin, HR and Employee access.";
  } catch (error) {
    try {
      target.exec("ROLLBACK");
    } catch {
      /* A failed batch may already have rolled back. */
    }
    throw error;
  }
}
