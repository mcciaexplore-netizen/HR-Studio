import type { Store } from "./store";

export const DEMO_SLUG = "mccia-demo";
export const DEMO_EMAIL = "admin@mccia-demo.example";
export const demoRoles = ["owner", "hr", "employee"] as const;

/** Only trusted provisioning code can populate this allowlist, never an HTTP route. */
export function demoAccounts(store: Store) {
  return store.db
    .prepare(
      `
    SELECT u.* FROM demo_access d
    JOIN organizations o ON o.id=d.org_id
    JOIN users u ON u.id=d.user_id AND u.org_id=d.org_id AND u.role=d.role
    JOIN records e ON e.org_id=u.org_id AND e.id=u.employee_id AND e.kind='employees'
    WHERE o.slug=? AND u.active=1 AND u.must_change=0 AND json_extract(e.data,'$.status')='Active'
  `,
    )
    .all(DEMO_SLUG);
}

export function isDemoWorkspace(store: Store, orgId: string) {
  return !!store.db
    .prepare("SELECT 1 FROM demo_access WHERE org_id=? LIMIT 1")
    .get(orgId);
}
