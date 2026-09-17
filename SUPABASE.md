# Connect HR Studio to Supabase

The cloud backend uses **Supabase PostgreSQL**. The existing HR Studio login, secure cookies and Owner/HR/Employee permissions remain in place. Supabase Auth is not used by this version.

## 1. Create a free project and copy one connection string

1. Open [Supabase](https://supabase.com/dashboard), create a project on the **Free** plan, and choose Mumbai if available.
2. Set and save your database password privately. Wait for the project to finish starting.
3. Click **Connect → Transaction pooler** and copy the PostgreSQL URI (normally port **6543**). Replace the password placeholder with your database password. Percent-encode special characters in the password, for example `@` becomes `%40`.
4. Add the connection string to the ignored `.env.local` file in this repository:

```dotenv
SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@YOUR_POOLER_HOST:6543/postgres
```

Use the exact host and username shown by your own project. This is a server secret: keep it out of chat, Git, screenshots and any `VITE_*` variable. An anon key, publishable key or service-role key is not a PostgreSQL connection string.

TLS certificate verification is enabled. If the connection needs a custom root certificate, download the PEM certificate from Supabase's database settings and set `SUPABASE_DB_CA` to its contents (literal `\n` line separators are supported). Do not disable certificate verification.

## 2. Create the schema and sample accounts

From the repository folder:

```sh
npm ci
npm run setup:supabase
```

This one command creates the private `hrstudio` schema and fictional sample data with Admin, HR and Employee demo accounts. It prepares samples locally and inserts them in a single database transaction. Repeating it preserves existing companies, account changes and records. It does not upload or change your existing local SQLite database.

The reviewed PostgreSQL schema is in [`supabase/schema.sql`](supabase/schema.sql). You can inspect it in advance. Running this file alone in Supabase's SQL Editor creates tables but does **not** create sample accounts; use the command above to complete the demo setup.

The schema is private, row-level security is enabled, and Supabase's `anon` and `authenticated` roles have no access. Requests go through the existing Express permission checks using the private server connection. Do not expose `hrstudio` in the public Data API or put the database password in browser code.

## 3. Connect Vercel and redeploy

In **HR Studio → Settings → Environment Variables**, add these for **Production**:

| Name                 | Value                                   |
| -------------------- | --------------------------------------- |
| `SUPABASE_DB_URL`    | The same private transaction-pooler URI |
| `DEMO_LOGIN_ENABLED` | `true`                                  |
| `APP_URL`            | `https://hr-studio-lake.vercel.app`     |
| `SUPABASE_DB_CA`     | Only if required in step 1              |

Save, then redeploy the latest commit of `feat/mccia-msme-hr-studio`. No frontend API keys are needed. Vercel must use Node **24.x**, build command `npm run build` and output `dist/public`; these are already configured in the repository.

Check `https://hr-studio-lake.vercel.app/api/health` for `{"status":"ok"}`. The login page should show three demo buttons. Try each role, create a fictional asset, reload and confirm it remains. Existing immutable deployment URLs retain their previous code/configuration; use the stable URL above.

## If something fails

- **503 / Supabase is not connected:** check `SUPABASE_DB_URL`, password, project status, TLS certificate and that `setup:supabase` completed. Environment changes require redeployment.
- **500 / ERR_MODULE_NOT_FOUND:** the old API build is still deployed. Redeploy the commit containing `api/index.js` and `dist/vercel.cjs`.
- **403 on login:** `APP_URL` must match the exact origin being used.
- **No demo buttons:** confirm setup completed and `DEMO_LOGIN_ENABLED=true` was included in the new deployment.
- **Free project paused:** resume it in Supabase, then retry. Free projects can pause after inactivity.

Without `SUPABASE_DB_URL`, local development continues using `var/hrstudio.sqlite`. With it, `npm run dev` and the normal production server use Supabase. Vercel always requires Supabase and never substitutes temporary local storage.

## Verification and limits

`npm test` covers local SQLite and database setup checks. `npm run test:postgres` runs the API and HR workflow tests on PGlite, a local PostgreSQL engine, including tenancy, transactions, permissions, imports, payroll and persisted sessions. `npm run build` also checks the exact Vercel entry using plain Node. These tests do not verify your live Supabase credentials, pooler connectivity or cloud response times.

This deployment is for the confirmed **personal, non-commercial demo**. Supabase Free currently includes a 500 MB database quota and may pause inactive projects; Vercel Hobby has personal-use restrictions and usage limits. Large payroll runs/imports need remote load testing. Rate limits currently apply per Vercel instance. Database backups and restore testing are separate tasks; do not rely on the demo as the only copy of real records.

Official references: [Supabase connections and poolers](https://supabase.com/docs/guides/database/connecting-to-postgres), [Postgres.js](https://supabase.com/docs/guides/database/postgres-js), [Supabase pricing](https://supabase.com/pricing), [free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Vercel Hobby](https://vercel.com/docs/plans/hobby). Checked 17 September 2026.
