import dotenv from "dotenv";
import { connectSupabaseDatabase } from "../server/postgres";
import { initializeSupabaseDemo } from "../server/supabase-setup";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
let db: ReturnType<typeof connectSupabaseDatabase> | undefined;
try {
  db = connectSupabaseDatabase();
  console.log(await initializeSupabaseDemo(db));
} catch {
  console.error(
    "Supabase setup failed. Check SUPABASE_DB_URL, the database password, TLS certificate and project status. No credentials were printed.",
  );
  process.exitCode = 1;
} finally {
  await db?.close();
}
