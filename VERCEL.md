# Free personal demo on Vercel + Turso

This is the selected deployment route for the **personal, non-commercial demo**. The existing paid Render configuration is an alternative and does not need to be applied.

## Architecture and cost

- Vercel serves the built website from `dist/public` and sends `/api/*` to `api/index.ts`.
- The Node.js API connects directly to a remote Turso database using the SQLite-compatible `libsql` driver. Records, uploads and sessions live in Turso, not on Vercel's temporary filesystem.
- Use **Vercel Hobby** and **Turso Free**. No paid service, trial upgrade or billing add-on is needed for this setup within the free limits. Vercel Hobby is restricted to personal non-commercial use. Turso advertises no card requirement and 5 GB storage on Free; usage quotas still apply.

Sources checked 16 September 2026: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Turso pricing](https://turso.tech/pricing), [libSQL driver](https://github.com/tursodatabase/libsql-js).

## 1. Create the database

Sign in to [Turso](https://app.turso.tech/) and create a new, empty **SQLite/libSQL-compatible** database on the **Free** plan, named `hr-studio-demo` or another unused name. Choose a region close to the Vercel function region where available. Copy its database URL and generate a database-scoped read/write token. This token is a server secret; do not put it in browser code, a `VITE_*` variable, Git, screenshots or chat.

Add the following values to the ignored `.env.local` on the development machine:

```dotenv
TURSO_DATABASE_URL=libsql://YOUR_DATABASE_HOST
TURSO_AUTH_TOKEN=YOUR_DATABASE_TOKEN
```

Initialize it once from the repository root:

```sh
npm ci
npm run setup:turso
```

Setup builds fictional sample data locally, then inserts it into the new remote database. It does not upload the current local HR database. Existing HR Studio v3 workspaces are preserved; other schemas are refused. It creates Admin, HR and Employee demo access without printing passwords or tokens. The API does not run schema migrations or reseed data on requests or cold starts.

## 2. Configure Vercel

Use the Vercel account that owns the project. If the old deployment says **You Need Access**, switch to its authorized account; build configuration cannot remove that access requirement.

Import `mcciaexplore-netizen/HR-Studio`, or update the existing project. Use:

| Setting           | Value                       |
| ----------------- | --------------------------- |
| Deployment branch | `feat/mccia-msme-hr-studio` |
| Root directory    | Repository root             |
| Framework         | Vite                        |
| Node              | 24.x                        |
| Install           | `npm ci`                    |
| Build             | `npm run build`             |
| Output            | `dist/public`               |

`vercel.json` supplies the build output, API rewrite, browser security headers, function duration and Excel worker/native-driver files.

Set these **server environment variables** in the Vercel project for the intended deployment environment:

| Variable             | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `TURSO_DATABASE_URL` | Database URL from step 1                                                                               |
| `TURSO_AUTH_TOKEN`   | Database-scoped secret token from step 1                                                               |
| `DEMO_LOGIN_ENABLED` | `true`                                                                                                 |
| `APP_URL`            | Exact public HTTPS origin used for sign-in, such as your assigned `https://project.vercel.app` address |

Use the actual assigned domain. If `APP_URL` is omitted, the handler uses Vercel's immutable `VERCEL_URL`, so a different alias can be rejected during sign-in. Set the stable production alias explicitly. For preview deployments, use a separate demo database and the preview's origin or omit `APP_URL` there. Do not connect untrusted preview code to a database containing real records.

No `DATABASE_PATH`, persistent disk, `DEMO_BOOTSTRAP`, SMTP secret or Gemini key is required for this demo. Registration is always closed in the Vercel entry point, and cookies are always secure. Configure the environment before redeploying; environment changes require a new deployment.

## 3. Verify the live deployment

1. Open the new deployment's public domain; old immutable URLs keep their old build.
2. Visit `/api/health` and expect `{"status":"ok"}`. A 503 means database credentials, connectivity or schema setup needs attention; it is not a successful full-app deployment.
3. Sign in using each demo role and check employee access is limited to the linked employee.
4. Add a fictional asset, redeploy, and verify the same record remains. Test one small Excel import/export and payroll workflow against the remote database.

Local compatibility tests do not verify your cloud credentials, Vercel routing or remote latency. Those checks require the accounts and a deployed service. Remote transactions have stricter time/latency constraints than a local file, so this synchronous compatibility adapter is intended for the small demo; large imports and payroll runs need remote load testing and potentially batched operations before business use. Authentication rate limits currently apply per function instance, not globally across Vercel instances.

## Local verification

```sh
npm run lint
npm test
npm run test:libsql
npm run build
npm run test:production
npm run test:hosted
```

The libSQL suite runs the same permission, transaction, import/export and persistence tests against the compatible local driver. Additional tests exercise the Vercel handler, missing-secret failures, bulk initialization and rollback. No cloud database or real email is touched by these checks.
