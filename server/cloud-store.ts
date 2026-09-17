import { Store } from "./store";
import { connectPostgresDatabase } from "./postgres";

export async function openCloudStore(env: NodeJS.ProcessEnv = process.env) {
  const db = connectPostgresDatabase(env);
  try {
    const row = await db
      .prepare("SELECT version FROM hrstudio.schema_version WHERE id=1")
      .get();
    if (Number(row?.version) !== 1)
      throw new Error(
        "Run npm run setup:database to initialize the HR Studio database.",
      );
    return new Store(db);
  } catch (error) {
    await db.close();
    throw error;
  }
}
