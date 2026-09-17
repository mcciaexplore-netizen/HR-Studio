import { Store } from "./store";

export function tursoCredentials(env: NodeJS.ProcessEnv = process.env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken)
    throw new Error(
      "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in server environment settings.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TURSO_DATABASE_URL must be a secure Turso URL.");
  }
  if (
    !["libsql:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      "TURSO_DATABASE_URL must be a secure Turso URL without credentials or a path.",
    );
  return { url, authToken };
}

export function openTursoStore(env: NodeJS.ProcessEnv = process.env) {
  const { url, authToken } = tursoCredentials(env);
  return new Store(url, { driver: "libsql", authToken, migrate: false });
}
