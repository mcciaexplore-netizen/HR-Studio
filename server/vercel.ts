import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";
import { configuredMailer } from "./integrations";
import { openTursoStore } from "./turso";
import type { Store } from "./store";

export function vercelOrigin(env: NodeJS.ProcessEnv) {
  const raw =
    env.APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Set APP_URL to the public HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("APP_URL must be an HTTPS origin.");
  return url.origin;
}

export function createVercelHandler(
  env: NodeJS.ProcessEnv = process.env,
  openStore: () => Store = () => openTursoStore(env),
) {
  let app: ReturnType<typeof createApp> | undefined;
  return (req: IncomingMessage, res: ServerResponse) => {
    if (!app) {
      let store: Store | undefined;
      try {
        const appUrl = vercelOrigin(env);
        store = openStore();
        app = createApp(store, {
          appUrl,
          secureCookies: true,
          registrationOpen: false,
          demoLoginEnabled: env.DEMO_LOGIN_ENABLED === "true",
          mailer: configuredMailer(),
        });
      } catch {
        store?.close();
        // Do not expose database URLs, tokens, driver errors or connection strings.
        console.error(
          "Vercel API initialization failed. Check database setup and server environment settings.",
        );
        res.statusCode = 503;
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            error:
              "The demo database is not connected yet. Complete the server setup and try again.",
          }),
        );
      }
    }
    return app(req, res);
  };
}
