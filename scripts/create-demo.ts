import dotenv from "dotenv";
import { resolve } from "node:path";
import { Store } from "../server/store";
import { createDemoWorkspace } from "../server/demo";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const store = new Store(
  resolve(process.env.DATABASE_PATH || "var/hrstudio.sqlite"),
);
try {
  const account = await createDemoWorkspace(store);
  // The random password is displayed once, never saved to a file or the browser bundle.
  console.log(JSON.stringify(account, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Demo setup failed.");
  process.exitCode = 1;
} finally {
  store.close();
}
