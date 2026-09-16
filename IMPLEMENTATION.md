# HR Studio — implementation status and operating guide

Updated 16 September 2026. Payroll jurisdiction: **Pune, Maharashtra, India**.

## What changed

The project has moved from employee records and salary estimates to connected HR workflows backed by the existing company-scoped SQLite store. The main additions are under **HR operations** and **Payroll & payslips**. All new records persist across restarts; requests use the existing authenticated sessions and optimistic record versions.

| Feature                      | Where to use it                        | Behavior                                                                                                                                                             |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branches/sites/cost centres  | HR operations → Organization           | Add branches and assign employee branch/cost centre.                                                                                                                 |
| Reporting managers           | Employees or Organization              | Assign a manager; cyclic reporting relationships are rejected.                                                                                                       |
| Worker categories            | Configuration and Employees            | Permanent, contractor, apprentice, temporary, daily wage and part-time defaults; company-defined categories supported.                                               |
| Custom fields                | Configuration, Employees, Organization | Text, number, date and choice fields; optional/required validation also applies to imports.                                                                          |
| Industry templates           | Configuration                          | General, Manufacturing, Retail and Services worker/checklist presets. Existing departments are preserved.                                                            |
| Module switches              | Configuration                          | Hide disabled modules and block their core APIs without deleting data.                                                                                               |
| Approval chains              | Configuration → Approval chains        | One to five ordered stages, selecting manager, HR, owner or named accounts. Stages are snapshotted when a request is submitted.                                      |
| Approval inbox               | Approvals                              | Only requests at the signed-in user's stage appear; no self-approval. Decisions and notes are retained.                                                              |
| Employee import/export       | Import employees                       | Download template; preview CSV/XLSX; see row errors; import all rows atomically. A committed or expired preview cannot be reused.                                    |
| Onboarding/offboarding       | Joining & exits                        | Snapshot company checklists; record task completion; offboarding checks asset return and ends employment/revokes access when complete.                               |
| Employment changes           | Joining & exits                        | Schedule promotion, transfer, salary revision, probation confirmation or contract renewal; explicitly apply when due. Concurrent profile edits require rescheduling. |
| Employee history             | My requests and report export          | Before/after employee snapshots with effective date and actor from this version onward.                                                                              |
| Profile and bank updates     | My requests                            | Approval-controlled corrections, validated bank details, letter requests and resignation. Approved resignation creates offboarding tasks.                            |
| Expenses                     | Expenses                               | Dated INR claims, category limits, receipts, approvals and external reimbursement references. Approved claims may be included in payroll.                            |
| Leave policy/balance         | Work schedules                         | Annual/monthly grants, carry-forward caps, balance adjustments, pending reservations, holidays and weekends.                                                         |
| Shifts/attendance correction | Work schedules                         | Shift definitions and non-overlapping assignments, worked hours, break deductions, overtime suggestions and reviewed corrections.                                    |
| Helpdesk/grievances          | Helpdesk                               | Tickets with replies and resolution. Confidential records are restricted to the requester, owner and assigned HR handler.                                            |
| Policies                     | Policies                               | Draft/published revisions, branch applicability, due date, explicit employee acknowledgement and preserved text/hash evidence per revision.                          |
| Expiry/probation reminders   | Approvals and Organization             | In-app reminders for dates due within 30 days, including overdue dates.                                                                                              |
| Payroll/payslips             | Payroll & payslips                     | Draft calculations, per-employee review, separate submission/approval, locked payslips and payment references.                                                       |
| Reports                      | Reports                                | Headcount and contracted monthly earnings by department; Excel operational exports. Payroll/accounting exports are inside a period.                                  |
| Integrations                 | Integrations                           | Revocable scoped keys and idempotent attendance/signature event endpoint; setup guide available in-app.                                                              |
| Mobile/languages             | Responsive navigation and header       | Responsive forms/tables plus English/Hindi/Marathi navigation. Full content translation remains pending.                                                             |

## Recommended setup sequence

1. Set departments, leave types and timezone in **Settings & access**.
2. In **HR operations → Configuration**, select modules, worker categories and checklist template. Add custom fields before downloading the import template.
3. Create branches, then add/import managers before employees who reference them. Import supports new records only, with a maximum of 500 rows and 1 MB per file. Formulas, linked cells and multiple sheets are rejected.
4. Create the relevant HR and employee logins. A manager-based approval stage requires the manager to have an active account. Keep an HR preparer and an owner reviewer for payroll.
5. Configure leave allowances, weekly days off, holidays and opening balance adjustments. Add shifts and employee assignments.
6. Run a sample claim, leave request, policy acknowledgement and payroll period before onboarding real records.

## Payroll operating model

The system supports monthly, daily and hourly pay. Monthly components are prorated over calendar days using effective-dated employee history. Daily/hourly calculations start with completed attendance, subtract a shift's unpaid break once per work date and use historical rates. Overtime beyond scheduled hours is suggested separately and requires an entered rate. HR must check missing attendance, absences, wage eligibility, tax inputs and reimbursements.

A draft can be rebuilt from current employee/attendance records; rebuilding discards its manual inputs and reviews. Approved expenses can be refreshed into a draft. Review every employee, submit through an HR account, then approve through a different owner account. Approval locks the period and reserves its included expenses against double reimbursement. Recording an external bank reference marks the period paid and its claims reimbursed; it does not send money.

Employees only see their own payslips after approval. Payslips are escaped HTML documents and can be saved as PDF using the browser's Print menu. Later employee salary changes do not alter approved amounts.

### Calculation scope and source references

The calculation version is `IN-MH-2026-09-16`, supporting periods from January 2026. It includes selected PF rates and wage ceiling, the employer PF/EPS split, employee/employer ESI and its daily-wage employee exemption, Maharashtra professional tax categories, June/December labour welfare contributions, and manually entered TDS. Eligibility and assessable wages are **reviewed inputs**, not inferred from job title, gender or basic salary.

Reference sources: [EPFO contribution rates](https://www.epfindia.gov.in/site_docs/PDFs/MiscPDFs/ContributionRate.pdf), [ESIC contribution guidance](https://esic.gov.in/attachments/esistatedirectoratefile/ef84365f31f15306ddb397902d675858.pdf), [Maharashtra professional tax schedule](https://www.mahagst.gov.in/en/profession-tax-and-other-rate-schedule), [Maharashtra Labour Welfare Board](https://public.mlwb.in/public), and [Ministry of Labour wage-definition clarification](https://www.labour.gov.in/static/uploads/2026/03/a4ccf4c6d97c4f1f36a6d83f8c64213d.pdf). These rules require review before real payroll use and when regulations change. Automated tests validate the implemented arithmetic; they are not an independent statutory compliance certification.

This release does not calculate annual income tax/TDS declarations, employer EDLI or PF administration charges, gratuity, final settlements, salary-advance recovery or statutory return files. It does not submit returns or make bank transfers. Pay-basis changes within a month are rejected; schedule those between periods. Historical data predating employee snapshots requires independent reconciliation. Shift grace periods are stored for policy reference; automatic lateness penalties are not applied.

## Architecture and data safety

- `server/store.ts`: SQLite migrations, company-scoped record storage, nested transactions, versions, audit and employee history. Migration 2 adds uniqueness for payroll periods, branches and policy acknowledgements, plus integration deduplication and payroll expense reservations.
- `server/suite-domain.ts` / `suite-records.ts`: company configuration, employee extensions, approval stages, balances and input validation.
- `server/suite.ts`: authenticated operations, filtered state, reports and payslips. `payroll.ts` owns payroll calculations/transitions; `attendance-summary.ts` derives work-time summaries.
- `server/import-export.ts` / `excel-worker.cjs`: bounded import preview/commit and escaped workbook exports. Excel parsing runs in a separate worker with a memory limit and timeout.
- `server/integration-events.ts`: hash-only token storage, scope checks, tenant isolation, input validation, rate limits and transactional event deduplication.
- `src/components/suite`: operations screens, shared form controls, configuration and payroll review. Existing employee/document screens expose the new fields and signature metadata.

Files, bank details and HR records remain in the SQLite database. Protect the host filesystem, use HTTPS and secure cookies, and take tested backups. General audit entries are not an externally protected compliance log. Server-wide email/AI credentials and loading complete company datasets remain pilot limitations; larger deployments need pagination, object storage, monitoring, retention, granular access and company-specific integration credentials.

## Verification and remaining work

The automated checks cover existing authentication/persistence, two-stage approvals, self-approval rejection, confidential grievance visibility, policy revision evidence, leave accounting, attendance overlap checks, atomic imports, dated payroll calculations, double reimbursement prevention, immutable payslips, offboarding access revocation, bank-update approval and integration token controls. No external emails or financial transactions are sent by the tests.

All 27 automated tests, the production build and TypeScript checks pass. A separate production smoke test also verifies static assets, authentication, the suite routes, Excel worker/import/export, payroll creation and inaccessible server files using a disposable database. Dependency updates removed the reported npm advisories; ExcelJS's UUID dependency is overridden to the patched 11.x line and exercised by workbook tests. Full interactive browser acceptance testing is still required. No live biometric, signing or accounting provider was connected during implementation.

Remaining broader product work includes full Hindi/Marathi localization, loan/advance recovery, half-day leave, retrospective leave-policy versions, automated employment-change execution and notifications, recruitment-to-employee conversion, native/offline mobile access, MFA/SSO/recovery, owner transfer, delivery tracking and production scaling. These are not represented as completed features in this release.
