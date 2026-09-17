import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

// Run with plain Node, without tsx or a development bundler, just like Vercel.
// Never connect to a real database, including when this runs during a cloud build.
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.SUPABASE_DB_URL;
process.env.APP_URL = "https://demo.example.test";

const { default: handler } = await import("../api/index.js");
assert.equal(typeof handler, "function");
const server = createServer(handler);
server.listen(0, "127.0.0.1");
await once(server, "listening");
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/api/health", "/api/auth/me", "/api/auth/options"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 503, `${path}: expected the setup response`);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error:
        "The cloud database is not connected yet. Complete the server database setup and try again.",
    });
  }
  console.log(
    "Vercel smoke passed: deployed entry loads in plain Node and auth routes return the controlled setup response.",
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
