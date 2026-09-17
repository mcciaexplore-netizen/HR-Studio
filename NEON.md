# Connect HR Studio to Neon

The selected demo uses **Vercel + Neon Free**, with a dedicated Neon database. HR Studio keeps its existing login and Admin/HR/Employee roles; Neon Auth is not needed.

## 1. Create the database and save the connection privately

1. Sign in to the [Neon console](https://console.neon.tech/) and create a project named **hr-studio** on the **Free** plan. If your Neon organization is managed by Vercel, create it through **HR Studio → Storage → Create Database → Neon** in Vercel. Review the displayed plan before confirming.
2. Open **Connect**, select the production branch, database and owner role, enable **Connection pooling**, and copy the PostgreSQL connection string. Its hostname contains `-pooler` and ends in `.neon.tech`.
3. In this repository's ignored `.env.local`, set:

```dotenv
DATABASE_URL="postgresql://USER:ENCODED_PASSWORD@YOUR_POOLED_HOST.neon.tech/neondb?sslmode=require"
```

Use the exact connection string shown by Neon. Keep it out of chat, Git, screenshots and any `VITE_*` variable. The connection contains a database password. A public API key is not a replacement.

You may also copy the direct connection (pooling off) into `DATABASE_URL_UNPOOLED` for setup. The setup command prefers this value when present; API requests always use `DATABASE_URL`. Both must target the same branch and database.

TLS certificate and hostname verification are always enabled. URL options cannot disable verification. `DATABASE_CA` accepts a custom PEM root certificate if one is actually required; normally it is blank for Neon. Pooled requests use one client connection per function instance and do not use prepared statements.

## 2. Initialize the fictional demo

Vercel runs `npm run build:vercel`, which builds the app and initializes the database before publishing. This requires `DEMO_LOGIN_ENABLED=true`; it fails instead of silently creating demo accounts in a private deployment. After the connection is saved in step 3, the first deployment creates the tables and samples automatically. Later deployments preserve them. No local password entry is required when using the Vercel integration.

For manual setup from this repository with Node.js 24.x:

```sh
npm ci
npm run setup:database
```

`npm run setup:neon` is an alias. Setup creates the private `hrstudio` schema and fictional samples, including eight employees and three demo roles. It executes in one transaction and preserves existing HR Studio records and passwords on repeat runs. It does not upload the local SQLite database. If the schema contains unrelated tables, setup stops and rolls back.

Review [database/schema.sql](database/schema.sql) before setup. Running the SQL file alone creates tables but not demo accounts. Setup must finish before sign-in will work. The configured Vercel demo build runs setup explicitly. API requests never create tables or reset samples. Ordinary local `npm run build` does not connect to any database.

## 3. Connect the Vercel app

Open **hr-studio → Settings → Environment Variables** and set these for **Production**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | The private pooled Neon connection string |
| `DEMO_LOGIN_ENABLED` | `true` |
| `APP_URL` | `https://hr-studio-lake.vercel.app` |

The Vercel Neon integration can supply `DATABASE_URL` automatically. Connect only the intended **hr-studio** project. Do not attach the demo database to unrelated projects. Preview environments should use a separate Neon branch/database if enabled.

Redeploy the latest commit on `feat/mccia-msme-hr-studio`. Vercel needs Node **24.x**, `npm run build:vercel` and static output `dist/public`; the repository already configures these. Never put database credentials in frontend code.

## Verify the live app

- `/api/health` returns `{"status":"ok"}`.
- `/api/auth/options` offers Admin, HR and Employee demo logins.
- `/api/auth/me` returns **401** before login; this is expected. It should return **200** after demo login.
- Each role sees its allowed records. Create a fictional asset and confirm it survives reload and redeployment.
- A small import/export and payroll workflow completes against Neon.

A successful local test/build does not verify remote credentials or connectivity. Until setup, environment configuration and redeployment are complete, the API returns a controlled **503** response.

## Troubleshooting and limits

- **503:** check `DATABASE_URL`, the selected branch/database, Neon project status and completion of setup. Redeploy after changing Vercel environment variables.
- **403 at login:** `APP_URL` must match the exact HTTPS address used in the browser.
- **No demo buttons:** check `DEMO_LOGIN_ENABLED=true` and that setup completed.
- **First request is slower:** free Neon compute can suspend when idle and wake on the next connection.
- **Local development:** without `DATABASE_URL` or legacy `SUPABASE_DB_URL`, the local server continues using `var/hrstudio.sqlite`.
- **Existing Supabase installations:** `SUPABASE_DB_URL` and `setup:supabase` remain compatible. `DATABASE_URL` takes precedence, and an old `SUPABASE_DB_CA` is not applied to a Neon connection. See [SUPABASE.md](SUPABASE.md).

Neon Free has storage and compute limits; the currently listed storage allowance is 0.5 GB per project. This deployment is the confirmed personal, non-commercial demo on Vercel Hobby. The demo accounts share fictional data. Do not enter real employee records into the public demo.

References: [Neon pricing](https://neon.com/pricing), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Vercel Neon integration](https://vercel.com/integrations/neon). Checked 17 September 2026.
