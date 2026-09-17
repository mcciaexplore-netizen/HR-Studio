import dotenv from "dotenv";
import Libsql from "libsql";
import { tursoCredentials } from "../server/turso";
import { initializeTursoDemo } from "../server/turso-setup";
import type { DatabaseConnection } from "../server/store";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
let db: DatabaseConnection | undefined;
try {
  const { url, authToken } = tursoCredentials();
  const options = { authToken, timeout: 5000 };
  db = new Libsql(url, options) as DatabaseConnection;
  console.log(await initializeTursoDemo(db));
} catch {
  // Driver error messages can contain connection details. Keep console output generic.
  console.error(
    "Turso setup failed. Check the server-only URL/token, connectivity and that the target is an empty demo database or an existing HR Studio v3 database.",
  );
  process.exitCode = 1;
} finally {
  db?.close();
}
