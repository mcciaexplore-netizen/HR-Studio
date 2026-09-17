import { Store } from "./store";
import { connectSupabaseDatabase } from "./postgres";

export async function openSupabaseStore(env: NodeJS.ProcessEnv = process.env) {
  const db = connectSupabaseDatabase(env);
  try {
    const row = await db
      .prepare("SELECT version FROM hrstudio.schema_version WHERE id=1")
      .get();
    if (Number(row?.version) !== 1)
      throw new Error(
        "Run npm run setup:supabase to initialize the HR Studio database.",
      );
    return new Store(db);
  } catch (error) {
    await db.close();
    throw error;
  }
}
