import { openTestStore } from "./database-fixture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createDemoWorkspace } from "../server/demo";
import { populateDemoSamples } from "../server/demo-samples";
import { createVercelHandler } from "../server/vercel";
import { demoAccounts } from "../server/demo-access";
test("Vercel handler routes API requests, protects origins, closes registration and keeps demo sessions", async () => {
  const store = await openTestStore(":memory:");
  await createDemoWorkspace(store);
  await populateDemoSamples(store);
  let opens = 0;
  const server = createServer(
    createVercelHandler(
      { APP_URL: "https://demo.example.test", DEMO_LOGIN_ENABLED: "true" },
      async () => {
        opens++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return store;
      },
    ),
  );
  server.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  async function request(
    path: string,
    body?: unknown,
    origin = "https://demo.example.test",
  ) {
    return fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HRStudio-Request": "1",
        Origin: origin,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    const coldStart = await Promise.all([
      request("/api/health"),
      request("/api/auth/options"),
      request("/api/auth/me"),
    ]);
    assert.deepEqual(
      coldStart.map((response) => response.status),
      [200, 200, 401],
    );
    assert.equal(opens, 1);
    assert.equal((await request("/api/auth/register", {})).status, 403);
    assert.equal(
      (
        await request(
          "/api/auth/demo",
          { role: "owner" },
          "https://evil.example",
        )
      ).status,
      403,
    );
    for (const role of ["owner", "hr", "employee"]) {
      const login = await request("/api/auth/demo", { role });
      assert.equal(login.status, 200);
      assert.match(login.headers.get("set-cookie")!, /; Secure/);
      cookie = login.headers.get("set-cookie")!.split(";")[0];
      const state = await (await request("/api/state")).json();
      assert.equal(state.employees.length, role === "employee" ? 1 : 8);
    }
    assert.equal(opens, 1);
    assert.equal((await demoAccounts(store)).length, 3);
    assert.equal((await request("/api/unknown")).status, 404);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    await store.close();
  }
});
test("Vercel returns a safe retryable response when the database is unavailable", async () => {
  let attempts = 0;
  const server = createServer(
    createVercelHandler({ APP_URL: "https://demo.example.test" }, () => {
      attempts++;
      throw new Error("private token and URL");
    }),
  );
  server.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  try {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as any).port}/api/health`,
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.doesNotMatch(await response.text(), /private token/);
    }
    assert.equal(attempts, 2);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
