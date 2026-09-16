import dotenv from "dotenv";
import { resolve } from "node:path";
import { Store } from "../server/store";
import { populateDemoSamples } from "../server/demo-samples";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const store = new Store(
  resolve(process.env.DATABASE_PATH || "var/hrstudio.sqlite"),
);
try {
  console.log(JSON.stringify(await populateDemoSamples(store), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Demo setup failed.");
  process.exitCode = 1;
} finally {
  store.close();
}
