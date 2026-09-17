import { setImmediate } from "node:timers/promises";

export async function releaseNativeStatements() {
  // libsql's native statements are finalized by GC. Windows keeps their file
  // handles locked until then, even after closing the connection explicitly.
  if (process.platform === "win32" && process.env.SQLITE_DRIVER === "libsql") {
    if (!globalThis.gc)
      throw new Error("Run libsql file tests with node --expose-gc.");
    globalThis.gc();
    await setImmediate();
    globalThis.gc();
    await setImmediate();
  }
}
