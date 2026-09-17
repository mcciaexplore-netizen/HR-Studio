import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "../server/store";
import { PostgresDatabase, type PostgresExecutor } from "../server/postgres";

export async function postgresTestDatabase(directory?: string) {
  const pg = new PGlite(directory);
  await pg.waitReady;
  let savepoint = 0;
  function executor(connection: any, nested = false): PostgresExecutor {
    return {
      async query(sql, parameters) {
        if (parameters === undefined) {
          await connection.exec(sql);
          return { rows: [], count: 0 };
        }
        const result = await connection.query(sql, parameters);
        return { rows: result.rows, count: result.affectedRows || 0 };
      },
      async transaction(fn) {
        if (!nested)
          return pg.transaction(async (transaction) => {
            await transaction.exec(
              "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",
            );
            return fn(executor(transaction, true));
          });
        const name = `nested_${++savepoint}`;
        await connection.exec(`SAVEPOINT ${name}`);
        try {
          const result = await fn(executor(connection, true));
          await connection.exec(`RELEASE SAVEPOINT ${name}`);
          return result;
        } catch (error) {
          await connection.exec(
            `ROLLBACK TO SAVEPOINT ${name}; RELEASE SAVEPOINT ${name}`,
          );
          throw error;
        }
      },
      async close() {
        if (!nested) await pg.close();
      },
    };
  }
  return new PostgresDatabase(executor(pg));
}

export async function openTestStore(filename = ":memory:") {
  if (process.env.HRSTUDIO_TEST_DATABASE !== "postgres")
    return new Store(filename);
  const db = await postgresTestDatabase(
    filename === ":memory:" ? undefined : filename + ".pg",
  );
  try {
    await db.exec(readFileSync(resolve("database/schema.sql"), "utf8"));
    return new Store(db);
  } catch (error) {
    await db.close();
    throw error;
  }
}
