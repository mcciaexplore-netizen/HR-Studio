import dotenv from "dotenv";
import { resolve } from "node:path";
import { Store } from "./server/store";
import { createApp } from "./server/app";
import { configuredMailer } from "./server/integrations";
import { serveClient } from "./server/client";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const production = process.env.NODE_ENV === "production";
const store = new Store(
  resolve(process.env.DATABASE_PATH || "var/hrstudio.sqlite"),
);
const app = createApp(store, {
  secureCookies: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : production,
  appUrl:
    process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL")
      ? process.env.APP_URL
      : undefined,
  mailer: configuredMailer(),
  registrationOpen: process.env.REGISTRATION_OPEN !== "false",
  demoLoginEnabled: process.env.DEMO_LOGIN_ENABLED === "true",
});
async function start() {
  if (!production) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    serveClient(app, resolve("dist/public"));
  }
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  const server = app.listen(port, host, () =>
    console.log(`HR Studio: http://${host}:${port}`),
  );
  const stop = () =>
    server.close(() => {
      store.close();
      process.exit(0);
    });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
start().catch((error) => {
  console.error(error.message);
  store.close();
  process.exitCode = 1;
});
