# Vercel + Neon deployment

Follow [NEON.md](NEON.md): create a dedicated free Neon project, connect it to Vercel as `DATABASE_URL`, enable demo login, then redeploy. The Vercel build initializes the demo automatically.

## Build and routing

- Branch: `feat/mccia-msme-hr-studio`
- Node: **24.x**
- Framework: **Vite**
- Install: `npm ci`
- Build: `npm run build:vercel`
- Static output: `dist/public`
- API: `/api/*` is routed to `api/index.js`, which imports `dist/vercel.cjs`.

The build bundles server imports before Vercel runs them. The explicit `.cjs` import avoids Node's extensionless-module startup error. Every build runs `test:vercel` in plain Node with the database secret removed, confirming that the function loads and returns its controlled setup response instead of crashing. The private server bundle and Excel worker are included in the function, outside the public assets directory.

Vercel startup opens Neon PostgreSQL asynchronously and shares initialization between concurrent requests. It validates the existing schema, never creates tables or demo accounts on requests, closes registration and uses secure cookies. Missing configuration returns a safe 503 response. No native database driver package or local database file is deployed for persistence.

The Vercel build finishes the ordinary build and import smoke check, then runs `setup:database -- --demo-deployment`. This requires `DEMO_LOGIN_ENABLED=true` and a valid connection; setup failure blocks publication. Setup uses a transaction, creates only the private `hrstudio` schema, and preserves existing samples, accounts and records on subsequent deployments. Local `npm run build` has no database side effects.

## Local checks

```sh
npm run lint
npm test
npm run test:postgres
npm run build
npm run test:production
npm run test:hosted
```

## Live checks

1. `/api/health` returns `{"status":"ok"}`.
2. `/api/auth/options` lists `owner`, `hr`, and `employee` when the demo is configured.
3. Each demo button opens the expected role; employees only see permitted records.
4. A fictional change survives a reload and redeployment.
5. A small import/export and payroll workflow complete against the remote database.

A successful build alone does not prove that the live database is connected. Neon account setup and credentials must be completed before the app is ready for sign-in.
