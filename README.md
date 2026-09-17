# HR Studio

HR software for an MSME pilot, built with React, TypeScript, Express and SQLite. Company workspaces now include employee operations, configurable approvals, imports, work schedules and reviewed payroll for Pune, Maharashtra. See [the implementation guide](IMPLEMENTATION.md) for the complete feature map and remaining boundaries.

## Run locally

Use **Node.js 24 or newer**. SQLite is built into Node; no database service is needed. Node may display an experimental SQLite warning.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Choose **New company? Create a workspace**. Set your company name, a unique workspace code, your email and a password of at least 12 characters. There are no default accounts or passwords.

1. In **Settings & access**, configure your departments, leave types and timezone.
2. Add employee records in **Employees**, including monthly salary amounts in INR.
3. Create employee or HR login accounts in **Settings & access**. A temporary password is displayed once; share it securely. The employee must replace it before opening the workspace. No invitation email is sent automatically.
4. Link the owner's account to their own employee record to use attendance and self-service leave.

The default database is `var/hrstudio.sqlite`. Records survive page reloads and server restarts. The app does not import records from a previously open browser tab; the original app did not persist them.

### MCCIA demo workspace

Run `npm run demo:create` once to create the `mccia-demo` workspace in the configured database. The command displays the owner email and a randomly generated password once. It uses the same `.env.local`, `.env` and `DATABASE_PATH` configuration as the server. It refuses to overwrite an existing demo workspace or reset its credentials.

The demo includes eight fictional employees, two Pune-area branches, five days of attendance, leave and expense approvals, recruitment candidates, assets, a review, onboarding, a document, a policy, a helpdesk request and draft payroll. All email addresses use the reserved `.example` domain. The payroll has unconfirmed inputs, with no payments or filings recorded. No email is sent during setup. Other workspaces are unaffected.

The sign-in screen and sidebar use the original MCCIA logo. Typography follows its website's Candara/Segoe UI system-font references, with locally hosted Lato/Poppins fallbacks. See [asset sources and font licenses](public/branding/mccia/README.md). Use `npm run branding:fetch` to refresh the downloaded assets.

To enable the three **demo login buttons**, run `npm run demo:populate`, set `DEMO_LOGIN_ENABLED=true` in `.env.local`, and restart the server. This adds HR and employee accounts, personal documents and requests, an assigned laptop, a future promotion and an approved example payroll for the previous month. It preserves existing records and passwords; repeated runs do not duplicate sample records. The prior-month payslip is available from February 2026 onward.

The buttons create normal role-limited sessions for the explicitly provisioned sample company. No passwords are embedded in the browser. Demo entry is disabled by default and cannot target other companies. Demo accounts cannot change account security, send email, call external AI or create integration keys. All demo users share the fictional data; edits persist. Set `DEMO_LOGIN_ENABLED=false` to remove the buttons and disable new button sign-ins. Existing sessions keep their normal expiry. Use **Switch demo role** in the workspace to return to the demo buttons.

## What works

| Area           | Current behavior                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Companies      | Separate workspaces, configurable name, departments, leave types and timezone; INR salary amounts                                                                                                                |
| Accounts       | Owner, HR and employee access; password hashing; expiring server sessions; forced temporary-password change; account enable/disable                                                                              |
| Employees      | Create, edit, search and filter; custom fields, worker types, branches, cost centres, reporting managers, bank-detail approvals and dated employment history                                                     |
| Attendance     | Server-timestamped clock events, shift assignments, worked-hours summaries, overtime suggestions and reviewed attendance corrections                                                                             |
| Leave          | Annual/monthly allowances, balances, carry-forward, adjustments, branch holidays, weekly days off, pending reservations and approval chains                                                                      |
| Payroll        | Monthly, daily and hourly earnings; dated salary inputs; unpaid days, overtime, bonus, reimbursements, reviewed PF/ESI/PT/LWF/TDS; separate submission/approval; locked payslips and external payment references |
| Operations     | Onboarding/offboarding checklists, dated employment changes, expense claims and receipts, helpdesk, restricted grievances, policy revisions and acknowledgements                                                 |
| Import/export  | CSV/XLSX import preview and atomic commit; Excel employee, attendance, leave, expense, payroll, history and acknowledgement reports                                                                              |
| Generalization | Company module switches; General, Manufacturing, Retail and Services checklist templates; configurable categories and approval stages                                                                            |
| Integrations   | Scoped, revocable attendance/signature event keys; duplicate-event protection; approved payroll accounting amounts export                                                                                        |
| Documents      | Store and download actual PDF, PNG, JPEG and TXT files up to 2 MB; editable letter drafts saved as TXT                                                                                                           |
| Recruitment    | Create openings and applicants, store resume text, change hiring stages, derive applicant counts                                                                                                                 |
| Assets         | Track serial numbers and assignment to existing employees; change custody/status                                                                                                                                 |
| Performance    | Save reviews and manager ratings, approve reviews                                                                                                                                                                |
| Email          | Copy/open drafts without sending; explicit SMTP send; persistent Queued/Accepted/Failed history                                                                                                                  |
| Activity       | Record who created, updated or deleted records, changed settings or administered accounts                                                                                                                        |

### Access boundaries

- **Owner:** company configuration, accounts, and all company HR records.
- **HR:** company HR records, salaries, documents and operational workflows. Confidential grievances require explicit assignment by the owner. HR cannot change company configuration, administer accounts or approve payroll.
- **Employee:** their own records, approved payslips, requests, assigned assets and appraisals, plus a minimal reporting directory and applicable published policies. An employee who is a named approver or reporting manager sees requests assigned to their current approval stage. They cannot approve their own requests or edit employee records directly.

Access is checked by the server, including downloads. Company IDs supplied by clients are not trusted. Changes include record versions so stale edits cannot silently overwrite newer ones. Employee history prevents destructive deletion; use offboarding. **Completing an offboarding checklist** checks asset return, ends employment and revokes the linked login. A manual status edit alone does not revoke login access.

## Scope of this milestone

This is a **single-server pilot with operational workflows**. It needs production and payroll-adviser review before a broad rollout.

- Payroll calculation is implemented for periods from January 2026. Eligibility, assessable wage bases, overtime rates and TDS are reviewed inputs. It does not calculate annual income tax, employer EDLI/PF administration charges, gratuity or final settlement, send money, or file statutory returns. The calculation version and approved amounts are retained in each period.
- Monthly pay uses calendar-day proration. Hourly/daily pay starts from completed attendance and dated rates. Unpaid absence beyond approved unpaid leave must be reviewed. Changing pay basis between monthly, daily and hourly within a month is not supported; schedule that change on the first day of a month. Editing payable units uses the period's weighted rate.
- Leave policies apply calendar-year grants; annual grants are not prorated for joining, monthly grants include the joining month. Carry-forward uses the configured policy and recorded usage. Historical opening balances must be reconciled through adjustments; there is no retrospective policy-version engine or half-day leave.
- Letter templates need review before issue. Saved drafts are text files; upload a final signed PDF separately. Files are stored in the database for this pilot; malware scanning, object storage and retention controls are future work.
- ID cards are printable visual previews. The decorative pattern is not a scannable QR code or RFID integration.
- Checklist completion is recorded by HR; it does not automatically provision third-party accounts. Scheduled employment changes are applied explicitly when due. Reminders are shown in-app; there is no background notification service.
- External attendance and signature events are supported, but vendor-specific connectors, signer authentication and signing evidence remain the provider's responsibility. Accounting exports require account mapping before posting.
- English/Hindi/Marathi navigation is included; complete translations of forms, validation and documents are still pending. The interface uses responsive layouts; there is no offline/native mobile app.
- Salary advances/loan recovery, birthday automation, job-board publishing, password recovery, MFA, SSO, account-role editing and owner transfer remain future work. AI evaluations are advisory and never move candidates automatically.
- Employee edits have before/after history from this version onward. Older changes cannot be reconstructed. General activity records remain metadata, not an externally protected audit log. Large datasets need pagination and background processing.

## Configuration

Copy `.env.example` to `.env.local` if you need overrides. Environment variables take precedence over files; `.env.local` takes precedence over `.env`.

- `HOST`, `PORT`: default `127.0.0.1:3000`.
- `DATABASE_PATH`: persistent SQLite file location. Keep it on a durable disk, outside the public asset folder.
- `APP_URL`: exact external origin, such as `https://hr.example.com`, when using a reverse proxy. This is used to validate browser mutation requests.
- `REGISTRATION_OPEN=false`: disable creation of new company workspaces after initial setup. Existing accounts can still sign in.
- `COOKIE_SECURE`: defaults to true in production. Use false only for local HTTP testing.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`: optional SMTP transport. Port 465 uses TLS immediately; other ports require STARTTLS. Only **Send email now** makes a send request. Accepted confirms SMTP acceptance, not inbox delivery. Check the mail provider before retrying a Failed or stranded Queued message; delivery may be uncertain. There is no automated retry or delivery webhook.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: optional candidate evaluation. Confirm model availability for your account. Requesting a review sends the job title and resume text to Gemini. No fallback score is invented when the service fails.

SMTP and AI credentials are server-wide in this pilot. A public service would need company-specific integration configuration, quotas and abuse controls.

## Checks and production build

```sh
npm run lint
npm test
npm run test:libsql
npm run build
npm run test:production
npm run test:hosted
```

The integration suite uses isolated databases and injected mail transports; it sends no real email or payments. It verifies access boundaries, persistence, approvals, leave accounting, confidential tickets, policy evidence, imports, historical payroll, statutory boundaries, payment locking, attendance corrections, offboarding and integration token controls.

The build places browser assets in `dist/public`, server code in `dist/server.cjs`, the isolated Excel reader in `dist/excel-worker.cjs` and the optional hosted demo provisioner in `dist/hosted-demo.cjs`. Only `dist/public` is served to browsers. ExcelJS uses a scoped UUID override to the patched 11.x line; workbook round-trip and import tests cover that compatibility.

```sh
npm start
```

`npm start` enables production mode. To test that build locally over HTTP in PowerShell:

```powershell
$env:COOKIE_SECURE = 'false'
npm start
```

For deployment, use Node.js 24.x, put the app behind HTTPS, set `APP_URL`, use secure cookies, close public registration, and protect the server filesystem and environment secrets. Run one application process with the SQLite database on a durable local disk. Horizontal scaling needs a shared database, coordinated rate limits and an object store.

### Full app on a persistent server

For the selected **free personal demo**, follow [Vercel + Turso setup](VERCEL.md). The optional [Render deployment](DEPLOYMENT.md) runs the frontend and API in one service, with SQLite on a persistent disk. `render.yaml` selects the existing feature branch and a small paid instance.

`npm run start:hosted` validates the HTTPS origin and absolute private database path, enables secure cookies and defaults to closed registration. With the Blueprint's explicit demo switches, it creates fictional samples only during initial setup and preserves them on later restarts. The hosted smoke test checks that saved records and sessions survive a restart. No local database or environment secrets are uploaded by this configuration.

### Vercel: full API with a remote database

`vercel.json` explicitly selects Vite and publishes **`dist/public`**. The build writes the entry page to `dist/public/index.html`; publishing `dist` instead can leave `/` without an entry page and expose the separately bundled server code. The configuration uses `npm ci`, `npm run build`, and Node.js 24.x (pinned in `package.json`). Deploy the branch containing this configuration. Existing deployment URLs are immutable; open the new deployment after it completes.

`api/index.js` loads the built `dist/vercel.cjs` bundle and exports the Express handler without starting a listener. `/api/*` is routed to that function, while browser assets remain static. Each build runs `test:vercel` against this entry in plain Node to catch runtime import failures. The API connects directly to Turso using server-only `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Run `npm run setup:turso` once against a new empty database to provision fictional samples, then set `DEMO_LOGIN_ENABLED=true` and the exact HTTPS `APP_URL` in Vercel.

Vercel never opens a local database file, automatically creates a schema or reseeds samples. Missing credentials or an uninitialized schema result in a safe 503 response. The local server continues to use `node:sqlite` by default. Vercel Hobby is limited to personal, non-commercial projects; see [VERCEL.md](VERCEL.md) for free-tier limits, setup and the required live checks.

If Vercel displays **You Need Access**, sign in with an account authorized for the project. This is separate from application routing; changing the build output does not change deployment protection. Configure server environment variables through the hosting provider; `.env.local` is intentionally excluded from Git.

References: [Vercel project configuration](https://vercel.com/docs/project-configuration), [Vercel and SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

### Backup and recovery

Stop the application cleanly before taking an offline copy of the database directory. Copy the whole directory, including any remaining SQLite WAL/SHM files. Store backups securely and test a restore with a separate database path before relying on them. The database contains personal records and files and is **not encrypted by this application**; disk encryption and access controls are deployment responsibilities. Do not delete `var` to troubleshoot a startup issue.

## Recommended rollout checks

1. Configure company modules, branches, worker categories, leave policies and approval stages in **HR operations**.
2. Import a small sample, create HR/employee accounts, then exercise approval and offboarding flows with test records.
3. Reconcile payroll against independently checked Maharashtra payroll for representative employees. Review eligibility, wage bases, PT exemptions, TDS and overtime separately.
4. Set up HTTPS, tested backups, retention, monitoring and company integration credentials before live use.
5. Complete full browser acceptance testing, localization and the production controls listed above before wider rollout.

The earlier project assessment is available in `output/pdf/HR_Studio_Project_Assessment.pdf`; it describes the code before this implementation.
