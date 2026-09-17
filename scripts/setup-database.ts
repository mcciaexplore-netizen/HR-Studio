import dotenv from "dotenv";
import { connectPostgresDatabase } from "../server/postgres";
import { initializeCloudDemo } from "../server/cloud-setup";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
let db: ReturnType<typeof connectPostgresDatabase> | undefined;
try {
  if (
    process.argv.includes("--demo-deployment") &&
    process.env.DEMO_LOGIN_ENABLED !== "true"
  )
    throw new Error("Demo deployment setup requires DEMO_LOGIN_ENABLED=true.");
  db = connectPostgresDatabase({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL,
  });
  console.log(await initializeCloudDemo(db));
} catch {
  console.error(
    "Database setup failed. Check DATABASE_URL (or DATABASE_URL_UNPOOLED for setup), the database password, TLS certificate and project status. No credentials were printed.",
  );
  process.exitCode = 1;
} finally {
  await db?.close();
}
