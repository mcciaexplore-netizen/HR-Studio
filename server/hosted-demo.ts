import { Store } from "./store";
import { createDemoWorkspace } from "./demo";
import { DEMO_SLUG } from "./demo-access";
import { populateDemoSamples } from "./demo-samples";

/** Runtime-only initialization: no database is created during a build. */
export async function provisionHostedDemo(filename: string) {
  const store = new Store(filename);
  try {
    const demo = store.db
      .prepare("SELECT id FROM organizations WHERE slug=?")
      .get(DEMO_SLUG);
    if (demo) {
      // A restart must never restore sample edits, roles or disabled accounts.
      if (
        store.db
          .prepare("SELECT 1 FROM demo_access WHERE org_id=? LIMIT 1")
          .get(demo.id)
      )
        return "already provisioned";
      // Recover an interrupted initial setup. The sample provisioner verifies
      // its creation audit and refuses ordinary companies or non-sample records.
      await populateDemoSamples(store);
      return "completed initial provisioning";
    }
    if (store.db.prepare("SELECT 1 FROM organizations LIMIT 1").get())
      return "skipped existing company database";
    await createDemoWorkspace(store);
    await populateDemoSamples(store);
    return "created fictional workspace";
  } finally {
    store.close();
  }
}
