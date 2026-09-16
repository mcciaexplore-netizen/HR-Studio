import React, { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import type { SessionUser, WorkspaceState } from "../../types";
import {
  Form,
  Panel,
  Table,
  buttonClass,
  inputClass,
  secondaryClass,
  options,
  readFile,
  money,
  type Row,
  type Field,
} from "./Controls";
import PayrollSuite from "./PayrollSuite";
import Configuration from "./Configuration";

const moduleFor: Row = {
  expenses: "expenses",
  lifecycle: "lifecycle",
  helpdesk: "helpdesk",
  policies: "policies",
  workforce: "leaves",
  reports: "reports",
  integrations: "integrations",
  payroll: "payroll",
};
const sectionLabels: Row = {
  approvals: "Approvals",
  self: "My requests",
  expenses: "Expenses",
  lifecycle: "Joining & exits",
  workforce: "Work schedules",
  organization: "Organization",
  policies: "Policies",
  helpdesk: "Helpdesk",
  imports: "Import employees",
  reports: "Reports",
  integrations: "Integrations",
  configuration: "Configuration",
};
export default function SuiteView({
  user,
  workspace,
  onRefresh,
  initialSection = "approvals",
}: {
  user: SessionUser;
  workspace: WorkspaceState;
  onRefresh: () => Promise<void>;
  initialSection?: string;
}) {
  const [state, setState] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [section, setSection] = useState(initialSection);
  const [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<Row | null>(null),
    [token, setToken] = useState("");
  const pending = useRef(false);
  const requestSequence = useRef(0);
  const staff = user.accessRole !== "employee",
    owner = user.accessRole === "owner";
  async function load() {
    const sequence = ++requestSequence.current;
    const next = await api("/suite");
    if (sequence === requestSequence.current) setState(next);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [workspace]);
  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  async function perform(
    action: () => Promise<any>,
    success = "Saved successfully.",
  ): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      try {
        await load();
        await onRefresh();
      } catch {
        setError(
          "Saved, but the screen could not refresh. Refresh before continuing.",
        );
      }
      return true;
    } catch (e) {
      setError(e.message);
      if (e.status === 409) await load().catch(() => {});
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const run = (path: string, method: string, body?: Row) =>
    perform(() => api(path, method, body));
  const create = (kind: string, body: Row) =>
    run(`/suite/records/${kind}`, "POST", body);
  if (!state)
    return (
      <div role={error ? "alert" : "status"} className="p-5">
        {error || "Loading HR operations…"}
      </div>
    );
  const employeeField: Field = {
    key: "employeeId",
    label: "Employee",
    options: options(state.people),
  };
  const selfInitial = { employeeId: user.employeeId || "" };
  const employeeFields = staff ? [employeeField] : [];
  const selectedEmployee =
    state.people.find((p: Row) => p.id === selected) || state.people[0];
  const visible = Object.keys(sectionLabels).filter(
    (key) =>
      (staff ||
        [
          "approvals",
          "self",
          "expenses",
          "workforce",
          "policies",
          "helpdesk",
        ].includes(key)) &&
      (owner || key !== "configuration") &&
      (!moduleFor[key] ||
        state.settings.enabledModules.includes(moduleFor[key])),
  );
  const active =
    section === "payroll"
      ? "payroll"
      : visible.includes(section)
        ? section
        : visible[0];
  const table = (rows: Row[], columns: Array<[string, string]>) => (
    <Table rows={rows} columns={columns} />
  );
  const cancellation = (kind: string, r: Row) =>
    r.status === "Pending" ? (
      <button
        className={secondaryClass}
        onClick={() =>
          void run(`/suite/cancel/${kind}/${r.id}`, "POST", {
            version: r.version,
          })
        }
      >
        Cancel request
      </button>
    ) : null;
  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {initialSection === "payroll" ? "PAY & BENEFITS" : "EVERYDAY HR"}
          </p>
          <h1>
            {initialSection === "payroll"
              ? staff
                ? "Payroll & payslips"
                : "Your payslips"
              : "HR operations"}
          </h1>
          <p>
            {initialSection === "payroll"
              ? "Pay periods, reviewed inputs and clear records."
              : "Keep requests, policies and the working day moving."}
          </p>
        </div>
      </div>
      {initialSection !== "payroll" && (
        <nav aria-label="HR operations" className="suite-tabs">
          {visible.map((key) => (
            <button
              key={key}
              aria-current={active === key ? "page" : undefined}
              className={active === key ? buttonClass : secondaryClass}
              onClick={() => {
                setSection(key);
                setSelected("");
                setError("");
                setNotice("");
              }}
            >
              {sectionLabels[key]}
              {key === "approvals" && state.approvals.length
                ? ` (${state.approvals.length})`
                : ""}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg p-4 bg-red-50 text-red-800 border border-red-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-5 min-w-0">
        {active === "payroll" && (
          <PayrollSuite state={state} user={user} run={run} />
        )}
        {active === "configuration" && owner && (
          <Configuration key={state.companyVersion} state={state} run={run} />
        )}
        {active === "approvals" && (
          <>
            <Panel
              title="Waiting for your decision"
              description="Only requests assigned to your current approval stage appear here. Approving advances the request to the next stage, where configured."
            >
              {!state.approvals.length && (
                <p className="text-sm text-slate-500">
                  You have no pending approvals.
                </p>
              )}
              {state.approvals.map((r: Row) => (
                <details
                  className="border-b border-slate-200 dark:border-slate-700 py-4"
                  key={`${r.kind}-${r.id}`}
                >
                  <summary className="cursor-pointer font-medium">
                    {r.employeeName} ·{" "}
                    {r.type ||
                      r.leaveType ||
                      r.category ||
                      "Attendance correction"}{" "}
                    {r.amount ? `· ${money(r.amount)}` : ""}
                  </summary>
                  <div className="space-y-3 mt-4 text-sm">
                    <p className="whitespace-pre-wrap">
                      {r.reason || r.purpose}
                    </p>
                    <p>
                      {r.startDate &&
                        `${r.startDate} to ${r.endDate} · ${r.days} days`}
                      {r.spentOn}
                      {r.checkInAt && `${r.checkInAt} → ${r.checkOutAt}`}
                      {r.lastWorkingDate &&
                        `Last working date: ${r.lastWorkingDate}`}
                    </p>
                    {r.changes &&
                      Object.entries(r.changes).map(([key, value]) => (
                        <p key={key}>
                          <b>{key}: </b>
                          {typeof value === "object"
                            ? Object.entries(value as Row)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")
                            : String(value)}
                        </p>
                      ))}
                    {r.receipt && (
                      <a
                        className="underline"
                        href={`/api/suite/expenses/${r.id}/receipt`}
                      >
                        Download receipt
                      </a>
                    )}
                    {r.decisions?.length > 0 &&
                      table(r.decisions, [
                        ["name", "Reviewer"],
                        ["action", "Decision"],
                        ["comment", "Note"],
                      ])}
                    <Form
                      key={`${r.id}-${r.version}`}
                      fields={[
                        {
                          key: "status",
                          label: "Decision",
                          options: ["Approved", "Rejected"],
                        },
                        {
                          key: "comment",
                          label:
                            r.type === "Letter request"
                              ? "Letter download link or collection instructions"
                              : "Decision note",
                          type: "textarea",
                          required: r.type === "Letter request",
                        },
                      ]}
                      initial={{ version: r.version }}
                      onSubmit={(body) =>
                        run(`/suite/decisions/${r.kind}/${r.id}`, "POST", body)
                      }
                      submit="Save decision"
                    />
                  </div>
                </details>
              ))}
            </Panel>
            <Panel
              title="Upcoming and overdue reminders"
              description="Contract dates, probation reviews and document expiry within the next 30 days."
            >
              {table(state.reminders, [
                ["employeeName", "Employee"],
                ["title", "Reminder"],
                ["date", "Due date"],
              ])}
            </Panel>
          </>
        )}
        {active === "expenses" && (
          <>
            <Panel
              title="Submit an expense"
              description={`Claims are in INR. Maximum ${money(state.settings.expenseLimit)} per claim. Attach a PDF or image receipt up to 2 MB.`}
            >
              <Form
                fields={[
                  ...employeeFields,
                  { key: "spentOn", label: "Expense date", type: "date" },
                  {
                    key: "category",
                    label: "Category",
                    options: state.settings.expenseCategories,
                  },
                  {
                    key: "amount",
                    label: "Amount (INR)",
                    type: "number",
                    min: 0.01,
                  },
                  {
                    key: "purpose",
                    label: "Business purpose",
                    type: "textarea",
                  },
                  {
                    key: "receipt",
                    label: "Receipt",
                    type: "file",
                    required: false,
                  },
                ]}
                initial={selfInitial}
                onSubmit={(body) => create("expenses", body)}
                submit="Submit claim"
              />
            </Panel>
            <Panel title="Expense claims">
              <Table
                rows={state.expenses}
                columns={[
                  ["employeeName", "Employee"],
                  ["spentOn", "Date"],
                  ["category", "Category"],
                  ["amount", "Amount (INR)"],
                  ["status", "Status"],
                  ["paymentReference", "Payment reference"],
                ]}
                actions={(r) => (
                  <>
                    {r.receipt && (
                      <a
                        className={secondaryClass}
                        href={`/api/suite/expenses/${r.id}/receipt`}
                      >
                        Receipt
                      </a>
                    )}
                    {cancellation("expenses", r)}
                    {staff && r.status === "Approved" && (
                      <button
                        className={secondaryClass}
                        onClick={() => setSelected(r.id)}
                      >
                        Record reimbursement
                      </button>
                    )}
                  </>
                )}
              />
              {state.expenses.some(
                (r: Row) => r.id === selected && r.status === "Approved",
              ) && (
                <Form
                  key={selected}
                  fields={[
                    {
                      key: "reference",
                      label: "Completed bank/payment reference",
                    },
                  ]}
                  initial={{
                    version: state.expenses.find((r: Row) => r.id === selected)
                      .version,
                  }}
                  onSubmit={(body) =>
                    run(`/suite/expenses/${selected}/reimburse`, "POST", body)
                  }
                  submit="Record external payment"
                />
              )}
            </Panel>
          </>
        )}
        {active === "self" && (
          <>
            <Panel
              title="Request a profile correction"
              description="Updates are sent through your company’s approval chain."
            >
              <Form
                fields={[
                  ...employeeFields,
                  {
                    key: "changes.name",
                    label: "Corrected full name",
                    required: false,
                  },
                  {
                    key: "changes.email",
                    label: "Corrected email",
                    type: "email",
                    required: false,
                  },
                  {
                    key: "changes.contact",
                    label: "Corrected phone number",
                    required: false,
                  },
                  { key: "reason", label: "Reason", type: "textarea" },
                ]}
                initial={{ ...selfInitial, type: "Profile correction" }}
                onSubmit={(body) =>
                  create("profileRequests", {
                    ...body,
                    changes: Object.fromEntries(
                      Object.entries(body.changes || {}).filter(
                        ([, v]) => v !== "",
                      ),
                    ),
                  })
                }
                submit="Request correction"
              />
            </Panel>
            <Panel title="Bank details change">
              <Form
                fields={[
                  ...employeeFields,
                  {
                    key: "changes.bankDetails.accountName",
                    label: "Account holder",
                  },
                  { key: "changes.bankDetails.bankName", label: "Bank name" },
                  {
                    key: "changes.bankDetails.accountNumber",
                    label: "Account number",
                  },
                  { key: "changes.bankDetails.ifsc", label: "IFSC" },
                  { key: "reason", label: "Reason", type: "textarea" },
                ]}
                initial={{ ...selfInitial, type: "Bank details" }}
                onSubmit={(body) => create("profileRequests", body)}
                submit="Request bank update"
              />
            </Panel>
            <Panel title="Letters and resignation">
              <Form
                fields={[
                  ...employeeFields,
                  {
                    key: "type",
                    label: "Request type",
                    options: ["Letter request", "Resignation"],
                  },
                  {
                    key: "lastWorkingDate",
                    label: "Proposed last working date",
                    type: "date",
                    required: false,
                    hint: "Required for resignation.",
                  },
                  { key: "reason", label: "Request details", type: "textarea" },
                ]}
                initial={selfInitial}
                onSubmit={(body) => create("profileRequests", body)}
                submit="Submit request"
              />
            </Panel>
            <Panel title="Request history">
              <Table
                rows={state.profileRequests}
                columns={[
                  ["employeeName", "Employee"],
                  ["type", "Request"],
                  ["reason", "Details"],
                  ["status", "Status"],
                  ["fulfilment", "Letter instructions"],
                ]}
                actions={(r) => cancellation("profileRequests", r)}
              />
            </Panel>
            <Panel title="Employment history">
              {table(state.employeeHistory, [
                ["employeeName", "Employee"],
                ["effectiveDate", "Effective date"],
                ["action", "Change"],
                ["changedBy", "Recorded by"],
              ])}
            </Panel>
            <Panel title="My assigned assets">
              {table(
                workspace.assets.filter(
                  (asset) => asset.assignedToId === user.employeeId,
                ),
                [
                  ["name", "Asset"],
                  ["serialNumber", "Serial number"],
                  ["category", "Category"],
                  ["status", "Status"],
                ],
              )}
            </Panel>
            <Panel title="My performance reviews">
              {table(
                workspace.appraisals.filter(
                  (review) => review.employeeId === user.employeeId,
                ),
                [
                  ["period", "Period"],
                  ["goalsSet", "Goals"],
                  ["feedback", "Feedback"],
                  ["managerRating", "Rating"],
                  ["status", "Status"],
                ],
              )}
            </Panel>
          </>
        )}
        {active === "lifecycle" && staff && (
          <>
            <Panel title="Joining and exit checklists">
              <Form
                fields={[
                  employeeField,
                  {
                    key: "type",
                    label: "Checklist",
                    options: ["Onboarding", "Offboarding"],
                  },
                  {
                    key: "dueDate",
                    label: "Due / last working date",
                    type: "date",
                  },
                ]}
                onSubmit={(body) => create("lifecycle", body)}
                submit="Create checklist"
              />
              {state.lifecycle.map((r: Row) => (
                <details key={r.id} className="border-t pt-4">
                  <summary className="cursor-pointer font-medium">
                    {r.employeeName} · {r.type} · {r.status} · {r.dueDate}
                  </summary>
                  <div className="py-4 space-y-3">
                    {r.tasks.map((task: Row) => (
                      <label key={task.id} className="flex gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={task.done}
                          disabled={r.status !== "Open"}
                          onChange={(e) =>
                            void run(`/suite/lifecycle/${r.id}`, "POST", {
                              version: r.version,
                              taskId: task.id,
                              done: e.target.checked,
                            })
                          }
                        />
                        {task.title}
                      </label>
                    ))}
                    {r.status === "Open" && (
                      <button
                        className={secondaryClass}
                        onClick={() =>
                          void run(`/suite/lifecycle/${r.id}`, "POST", {
                            version: r.version,
                            action: "Complete",
                          })
                        }
                      >
                        Complete {r.type.toLowerCase()}
                      </button>
                    )}
                  </div>
                </details>
              ))}
            </Panel>
            <Panel
              title="Dated employment changes"
              description="Schedule a change, then apply it when its effective date arrives. If the profile changes meanwhile, cancel and reschedule after review. The salary history is used in payroll calculations."
            >
              <EmploymentChangeForm state={state} create={create} />
              <Table
                rows={state.employmentChanges}
                columns={[
                  ["employeeName", "Employee"],
                  ["type", "Change"],
                  ["effectiveDate", "Effective date"],
                  ["status", "Status"],
                ]}
                actions={(r) =>
                  r.status === "Scheduled" && (
                    <>
                      <button
                        className={secondaryClass}
                        onClick={() =>
                          void run(`/suite/employmentChanges/${r.id}`, "POST", {
                            version: r.version,
                            action: "Apply",
                          })
                        }
                      >
                        Apply when due
                      </button>
                      <button
                        className={secondaryClass}
                        onClick={() =>
                          void run(`/suite/employmentChanges/${r.id}`, "POST", {
                            version: r.version,
                            action: "Cancel",
                          })
                        }
                      >
                        Cancel
                      </button>
                    </>
                  )
                }
              />
            </Panel>
          </>
        )}
        {active === "organization" && staff && (
          <>
            <Panel title="Branches and sites">
              <Form
                fields={[
                  { key: "code", label: "Branch code" },
                  { key: "name", label: "Branch name" },
                  { key: "location", label: "Location" },
                  { key: "costCentre", label: "Cost centre", required: false },
                ]}
                onSubmit={(body) => create("branches", body)}
                submit="Add branch"
              />
              {table(state.branches, [
                ["code", "Code"],
                ["name", "Branch"],
                ["location", "Location"],
                ["costCentre", "Cost centre"],
              ])}
            </Panel>
            <Panel title="Reporting lines and worker details">
              <label className="block text-sm space-y-2">
                Employee
                <select
                  className={inputClass}
                  value={selectedEmployee?.id || ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {state.people.map((p: Row) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedEmployee && (
                <Form
                  key={`${selectedEmployee.id}-${selectedEmployee.version}`}
                  reset={false}
                  initial={selectedEmployee}
                  fields={[
                    {
                      key: "branchId",
                      label: "Branch",
                      options: options(state.branches),
                      required: false,
                    },
                    {
                      key: "managerId",
                      label: "Reporting manager",
                      options: options(
                        state.directory.filter(
                          (p: Row) => p.id !== selectedEmployee.id,
                        ),
                      ),
                      required: false,
                    },
                    {
                      key: "costCentre",
                      label: "Cost centre",
                      required: false,
                    },
                    {
                      key: "workerType",
                      label: "Worker category",
                      options: state.settings.workerTypes,
                    },
                    {
                      key: "payBasis",
                      label: "Pay basis",
                      options: ["Monthly", "Daily", "Hourly"],
                    },
                    {
                      key: "payRate",
                      label: "Daily / hourly rate (INR)",
                      type: "number",
                      required: false,
                    },
                    {
                      key: "probationEnd",
                      label: "Probation review date",
                      type: "date",
                      required: false,
                    },
                    {
                      key: "endDate",
                      label: "Contract / last working date",
                      type: "date",
                      required: false,
                    },
                    ...state.settings.customFields.map((f: Row) => ({
                      key: `customFields.${f.key}`,
                      label: f.label,
                      type: f.type === "select" ? "text" : f.type,
                      options: f.type === "select" ? f.options : undefined,
                      required: f.required,
                    })),
                  ]}
                  onSubmit={(body) =>
                    run(
                      `/records/employees/${selectedEmployee.id}`,
                      "PATCH",
                      body,
                    )
                  }
                  submit="Save employee details"
                />
              )}
            </Panel>
            <Panel title="Reporting directory">
              {table(
                state.directory.map((p: Row) => ({
                  ...p,
                  manager: state.directory.find(
                    (m: Row) => m.id === p.managerId,
                  )?.name,
                  branch: state.branches.find((b: Row) => b.id === p.branchId)
                    ?.name,
                })),
                [
                  ["name", "Employee"],
                  ["role", "Designation"],
                  ["department", "Department"],
                  ["manager", "Reports to"],
                  ["branch", "Branch"],
                ],
              )}
            </Panel>
            <Panel title="Document expiry">
              <Form
                fields={[
                  {
                    key: "documentId",
                    label: "Document",
                    options: options(workspace.documents),
                  },
                  {
                    key: "expiryDate",
                    label: "Expiry date",
                    type: "date",
                    required: false,
                  },
                ]}
                onSubmit={(body) => {
                  const doc = workspace.documents.find(
                    (d) => d.id === body.documentId,
                  );
                  return run(`/suite/documents/${body.documentId}`, "PATCH", {
                    expiryDate: body.expiryDate,
                    version: doc?.version,
                  });
                }}
                submit="Save expiry date"
              />
              {table(state.reminders, [
                ["employeeName", "Employee"],
                ["title", "Reminder"],
                ["date", "Due date"],
              ])}
            </Panel>
          </>
        )}
        {active === "workforce" && (
          <Workforce
            state={state}
            staff={staff}
            owner={owner}
            user={user}
            company={workspace.company}
            attendance={workspace.attendance}
            create={create}
            run={run}
          />
        )}
        {active === "policies" && (
          <>
            {staff && (
              <Panel title="Publish a policy">
                <Form
                  fields={[
                    { key: "title", label: "Policy title" },
                    { key: "content", label: "Policy text", type: "textarea" },
                    {
                      key: "branchId",
                      label: "Branch",
                      options: options(state.branches),
                      required: false,
                      hint: "Leave blank to apply to all branches.",
                    },
                    {
                      key: "dueDate",
                      label: "Acknowledgement due date",
                      type: "date",
                      required: false,
                    },
                    {
                      key: "status",
                      label: "Status",
                      options: ["Draft", "Published"],
                    },
                  ]}
                  initial={{ status: "Draft" }}
                  onSubmit={(body) => create("policies", body)}
                  submit="Save policy"
                />
              </Panel>
            )}
            <Panel title="Company policies">
              {!state.policies.length && (
                <p className="text-sm text-slate-500">No policies available.</p>
              )}
              {state.policies.map((p: Row) => {
                const acknowledged = state.acknowledgements.some(
                  (a: Row) =>
                    a.policyId === p.id &&
                    a.policyVersion === p.revision &&
                    a.employeeId === user.employeeId,
                );
                return (
                  <details className="border-b py-4" key={p.id}>
                    <summary className="font-medium cursor-pointer">
                      {p.title} · Revision {p.revision} · {p.status}
                      {acknowledged ? " · Acknowledged" : ""}
                    </summary>
                    <p className="text-sm whitespace-pre-wrap my-4">
                      {p.content}
                    </p>
                    {p.dueDate && (
                      <p className="text-sm mb-3">Acknowledge by {p.dueDate}</p>
                    )}
                    {user.employeeId &&
                      p.status === "Published" &&
                      !acknowledged && (
                        <Form
                          fields={[
                            {
                              key: "accepted",
                              label: "I have read and understood this policy",
                              type: "checkbox",
                            },
                          ]}
                          initial={{ version: p.version }}
                          onSubmit={(body) =>
                            run(
                              `/suite/policies/${p.id}/acknowledge`,
                              "POST",
                              body,
                            )
                          }
                          submit="Record acknowledgement"
                        />
                      )}
                    {staff && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm">
                          Revise or publish
                        </summary>
                        <Form
                          key={`${p.id}-${p.version}`}
                          initial={p}
                          fields={[
                            { key: "title", label: "Title" },
                            {
                              key: "content",
                              label: "Policy text",
                              type: "textarea",
                            },
                            {
                              key: "status",
                              label: "Status",
                              options: ["Draft", "Published"],
                            },
                            {
                              key: "dueDate",
                              label: "Due date",
                              type: "date",
                              required: false,
                            },
                          ]}
                          onSubmit={(body) =>
                            run(
                              `/suite/records/policies/${p.id}`,
                              "PATCH",
                              body,
                            )
                          }
                          submit="Save new revision"
                        />
                      </details>
                    )}
                  </details>
                );
              })}
            </Panel>
            <Panel title="Acknowledgement register">
              {table(state.acknowledgements, [
                ["employeeName", "Employee"],
                ["title", "Policy"],
                ["policyVersion", "Revision"],
                ["at", "Acknowledged at"],
              ])}
            </Panel>
          </>
        )}
        {active === "helpdesk" && (
          <>
            <Panel
              title="Contact HR"
              description="Grievances are visible only to you, the company owner, and an explicitly assigned HR handler."
            >
              <Form
                fields={[
                  { key: "subject", label: "Subject" },
                  {
                    key: "category",
                    label: "Category",
                    options: ["General", "Payroll", "Documents", "Grievance"],
                  },
                  { key: "body", label: "Details", type: "textarea" },
                  {
                    key: "confidential",
                    label: "Restrict to owner and assigned handler",
                    type: "checkbox",
                  },
                ]}
                initial={{ category: "General" }}
                onSubmit={(body) => create("tickets", body)}
                submit="Create ticket"
              />
            </Panel>
            <Panel title="Helpdesk tickets">
              {!state.tickets.length && (
                <p className="text-sm text-slate-500">No tickets yet.</p>
              )}
              {state.tickets.map((ticket: Row) => (
                <details key={ticket.id} className="border-b py-4">
                  <summary className="cursor-pointer font-medium">
                    {ticket.subject} · {ticket.status}
                    {ticket.confidential ? " · Restricted" : ""}
                  </summary>
                  <p className="text-sm my-3">From {ticket.requesterName}</p>
                  <p className="text-sm whitespace-pre-wrap mb-4">
                    {ticket.body}
                  </p>
                  {table(ticket.comments, [
                    ["by", "Author"],
                    ["body", "Reply"],
                    ["at", "Date"],
                  ])}
                  <Form
                    key={`${ticket.id}-${ticket.version}`}
                    fields={[
                      {
                        key: "comment",
                        label: "Reply",
                        type: "textarea",
                        required: false,
                      },
                      {
                        key: "status",
                        label: "Status",
                        options: staff
                          ? ["Open", "In progress", "Resolved"]
                          : ["Open", "Resolved"],
                      },
                      ...(owner
                        ? [
                            {
                              key: "assignedTo",
                              label: "Handler",
                              options: options(
                                state.accounts.filter(
                                  (a: Row) => a.role !== "employee",
                                ),
                              ),
                              required: false,
                            },
                          ]
                        : []),
                    ]}
                    initial={{
                      version: ticket.version,
                      status: ticket.status,
                      ...(owner ? { assignedTo: ticket.assignedTo } : {}),
                    }}
                    onSubmit={(body) =>
                      run(`/suite/tickets/${ticket.id}`, "POST", body)
                    }
                    submit="Update ticket"
                  />
                </details>
              ))}
            </Panel>
          </>
        )}
        {active === "imports" && staff && (
          <>
            <Panel
              title="Import employees"
              description="Download the template, add up to 500 employees, then upload CSV or XLSX (up to 1 MB). Create branches and managers first. Every row is checked before anything is imported."
            >
              <div className="flex gap-2">
                <a className={secondaryClass} href="/api/suite/export/template">
                  Download Excel template
                </a>
                <a
                  className={secondaryClass}
                  href="/api/suite/export/employees"
                >
                  Export employees
                </a>
              </div>
              <label className="block text-sm space-y-2">
                <span>Employee file</span>
                <input
                  className={inputClass}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPreview(null);
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      setError("Choose a file up to 1 MB.");
                      return;
                    }
                    void perform(async () => {
                      setPreview(
                        await api(
                          "/suite/imports/preview",
                          "POST",
                          await readFile(file),
                        ),
                      );
                    }, "Preview ready. Review the rows below.");
                  }}
                />
              </label>
            </Panel>
            {preview && (
              <Panel
                title={`${preview.count} employees checked`}
                description={
                  preview.valid
                    ? "All rows are valid. Confirm to import them together."
                    : "Fix the row errors in your file, then upload it again."
                }
              >
                <Table
                  rows={preview.rows.map((r: Row) => ({
                    ...r,
                    ...r.input,
                    result: r.error || "Ready",
                  }))}
                  columns={[
                    ["row", "Row"],
                    ["name", "Name"],
                    ["email", "Email"],
                    ["department", "Department"],
                    ["result", "Validation"],
                  ]}
                />
                {preview.valid && (
                  <button
                    className={buttonClass}
                    onClick={() =>
                      void perform(async () => {
                        await api(
                          `/suite/imports/${preview.id}/commit`,
                          "POST",
                          { version: preview.version },
                        );
                        setPreview(null);
                      }, "Employees imported successfully.")
                    }
                  >
                    Import {preview.count} employees
                  </button>
                )}
              </Panel>
            )}
          </>
        )}
        {active === "reports" && staff && (
          <>
            <Panel title="People overview">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  [
                    "Active employees",
                    state.people.filter((p: Row) => p.status === "Active")
                      .length,
                  ],
                  ["Pending approvals", state.approvals.length],
                  [
                    "Open helpdesk tickets",
                    state.tickets.filter((t: Row) => t.status !== "Resolved")
                      .length,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4"
                  >
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="text-3xl font-semibold mt-2">{value}</p>
                  </div>
                ))}
              </div>
              <Table
                rows={workspace.company.departments.map((department) => ({
                  department,
                  headcount: state.people.filter(
                    (p: Row) =>
                      p.department === department && p.status === "Active",
                  ).length,
                  monthlySalary: money(
                    state.people
                      .filter(
                        (p: Row) =>
                          p.department === department &&
                          p.status === "Active" &&
                          p.payBasis === "Monthly",
                      )
                      .reduce(
                        (sum: number, p: Row) =>
                          sum +
                          p.salary.basic +
                          p.salary.hra +
                          p.salary.allowances,
                        0,
                      ),
                  ),
                }))}
                columns={[
                  ["department", "Department"],
                  ["headcount", "Active people"],
                  ["monthlySalary", "Monthly contracted earnings"],
                ]}
              />
            </Panel>
            <Panel
              title="Download reports"
              description="Excel exports use current company records. Payroll and accounting exports are available within an individual payroll period."
            >
              <div className="flex flex-wrap gap-3">
                {[
                  "employees",
                  "attendance",
                  "leaves",
                  "expenses",
                  "history",
                  "policies",
                ]
                  .filter(
                    (kind) =>
                      !moduleFor[kind] ||
                      state.settings.enabledModules.includes(moduleFor[kind]),
                  )
                  .map((kind) => (
                    <a
                      className={secondaryClass}
                      key={kind}
                      href={`/api/suite/export/${kind}`}
                    >
                      {(
                        {
                          history: "Employment history",
                          policies: "Policy acknowledgements",
                        } as Row
                      )[kind] || kind.charAt(0).toUpperCase() + kind.slice(1)}
                    </a>
                  ))}
              </div>
            </Panel>
          </>
        )}
        {active === "integrations" && staff && (
          <>
            <Panel
              title="Integrations"
              description="Connect an attendance device or signing provider through the authenticated event endpoint. Accounting amounts can be exported from approved payroll periods. Vendor-specific setup requires your provider’s credentials and mapping."
            >
              <p className="text-sm">
                Attendance integrations accept completed check-in/check-out
                periods. Signature integrations record a provider’s confirmation
                against an existing document. Requests are deduplicated by event
                ID.
              </p>
              <a
                className="text-sm underline"
                href="/api/suite/integrations/guide"
                target="_blank"
                rel="noreferrer"
              >
                Open integration setup guide
              </a>
            </Panel>
            {owner && (
              <>
                <Panel title="Create a scoped access key">
                  <Form
                    fields={[
                      { key: "name", label: "Integration name" },
                      {
                        key: "scope",
                        label: "Allowed events",
                        options: [
                          { value: "attendance", label: "Attendance periods" },
                          {
                            value: "signatures",
                            label: "Document signature reports",
                          },
                        ],
                      },
                    ]}
                    onSubmit={(body) =>
                      perform(async () => {
                        const result = await api(
                          "/suite/integrations/keys",
                          "POST",
                          body,
                        );
                        setToken(result.token);
                      }, "Access key created. Copy it now; it will not be shown again.")
                    }
                    submit="Create access key"
                  />
                  {token && (
                    <div className="space-y-2">
                      <label className="block text-sm">
                        New access key
                        <input
                          className={`${inputClass} font-mono`}
                          value={token}
                          readOnly
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                      <button
                        className={secondaryClass}
                        onClick={() => setToken("")}
                      >
                        Hide key
                      </button>
                    </div>
                  )}
                </Panel>
                <Panel title="Access keys">
                  <Table
                    rows={state.integrationKeys}
                    columns={[
                      ["name", "Integration"],
                      ["scope", "Scope"],
                      ["active", "Active"],
                    ]}
                    actions={(key) =>
                      key.active && (
                        <button
                          className={secondaryClass}
                          onClick={() =>
                            void run(
                              `/suite/integrations/keys/${key.id}/revoke`,
                              "POST",
                              { version: key.version },
                            )
                          }
                        >
                          Revoke
                        </button>
                      )
                    }
                  />
                </Panel>
              </>
            )}
          </>
        )}
      </fieldset>
      {busy && (
        <p role="status" className="text-sm text-slate-500">
          Saving changes…
        </p>
      )}
    </div>
  );
}

function EmploymentChangeForm({
  state,
  create,
}: {
  state: Row;
  create: (kind: string, body: Row) => Promise<boolean>;
}) {
  const [type, setType] = useState("Promotion");
  const fields: Record<string, Field[]> = {
    Promotion: [{ key: "changes.role", label: "New designation" }],
    Transfer: [
      { key: "changes.department", label: "New department" },
      {
        key: "changes.branchId",
        label: "Branch",
        options: options(state.branches),
        required: false,
      },
      {
        key: "changes.managerId",
        label: "Reporting manager",
        options: options(state.directory),
        required: false,
      },
      { key: "changes.costCentre", label: "Cost centre", required: false },
    ],
    "Salary revision": [
      { key: "changes.salary.basic", label: "Monthly basic", type: "number" },
      { key: "changes.salary.hra", label: "Monthly HRA", type: "number" },
      {
        key: "changes.salary.allowances",
        label: "Monthly allowances",
        type: "number",
      },
      {
        key: "changes.salary.deductions",
        label: "Monthly deductions",
        type: "number",
      },
      {
        key: "changes.payBasis",
        label: "Pay basis",
        options: ["Monthly", "Daily", "Hourly"],
      },
      {
        key: "changes.payRate",
        label: "Daily / hourly rate",
        type: "number",
        required: false,
      },
    ],
    "Probation confirmation": [
      { key: "changes.probationEnd", label: "Confirmation date", type: "date" },
    ],
    "Contract renewal": [
      { key: "changes.endDate", label: "New contract end date", type: "date" },
    ],
  };
  return (
    <>
      <label className="block text-sm space-y-2">
        Change type
        <select
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {Object.keys(fields).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <Form
        key={type}
        fields={[
          {
            key: "employeeId",
            label: "Employee",
            options: options(state.people),
          },
          { key: "effectiveDate", label: "Effective date", type: "date" },
          ...fields[type],
          { key: "reason", label: "Reason", type: "textarea" },
        ]}
        initial={{ type }}
        onSubmit={(body) => create("employmentChanges", body)}
        submit="Schedule change"
      />
    </>
  );
}

function Workforce({
  state,
  staff,
  owner,
  user,
  company,
  attendance,
  create,
  run,
}: {
  state: Row;
  staff: boolean;
  owner: boolean;
  user: SessionUser;
  company: Row;
  attendance: Row[];
  create: (kind: string, body: Row) => Promise<boolean>;
  run: (path: string, method: string, body?: Row) => Promise<boolean>;
}) {
  const employeeField: Field = {
    key: "employeeId",
    label: "Employee",
    options: options(state.people),
  };
  return (
    <>
      <Panel
        title="Leave balances"
        description="Calendar-year balances show accrued allowance, carry-forward and adjustments, less approved and pending bookings. Future bookings reserve days now; monthly accrual continues over the year."
      >
        <Table
          rows={state.balances}
          columns={[
            ["employeeName", "Employee"],
            ["leaveType", "Leave type"],
            ["allowance", "Accrued"],
            ["carried", "Carried"],
            ["adjustments", "Adjustment"],
            ["approved", "Approved"],
            ["pending", "Pending"],
            ["available", "Available after bookings"],
          ]}
        />
      </Panel>
      {owner && (
        <Panel
          title="Leave policy"
          description="One policy per leave type. Saving replaces that type’s policy. Annual grants apply on joining; monthly grants accrue from the joining month. Working-day leave excludes configured weekly days off and branch holidays."
        >
          <Form
            key={state.companyVersion}
            fields={[
              {
                key: "leaveType",
                label: "Leave type",
                options: company.leaveTypes,
              },
              {
                key: "annualDays",
                label: "Annual allowance",
                type: "number",
                step: "1",
              },
              {
                key: "accrual",
                label: "Accrual",
                options: ["Annual", "Monthly"],
              },
              {
                key: "carryForward",
                label: "Maximum carry-forward days",
                type: "number",
                step: "1",
              },
              {
                key: "excludeNonWorking",
                label: "Exclude weekends and holidays",
                type: "checkbox",
              },
              { key: "paid", label: "Paid leave", type: "checkbox" },
            ]}
            initial={{
              accrual: "Annual",
              carryForward: 0,
              paid: true,
              excludeNonWorking: true,
            }}
            onSubmit={(body) =>
              run("/suite/config", "PATCH", {
                version: state.companyVersion,
                settings: {
                  ...state.settings,
                  leavePolicies: [
                    ...state.settings.leavePolicies.filter(
                      (p: Row) => p.leaveType !== body.leaveType,
                    ),
                    body,
                  ],
                },
              })
            }
            submit="Save policy"
          />
          <Table
            rows={state.settings.leavePolicies}
            columns={[
              ["leaveType", "Leave type"],
              ["annualDays", "Annual days"],
              ["accrual", "Accrual"],
              ["carryForward", "Carry-forward cap"],
              ["paid", "Paid"],
            ]}
          />
          <Form
            key={`weekends-${state.companyVersion}`}
            fields={[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((label, index) => ({
              key: String(index),
              label,
              type: "checkbox",
            }))}
            initial={Object.fromEntries(
              state.settings.weekendDays.map((day: number) => [
                String(day),
                true,
              ]),
            )}
            onSubmit={(body) =>
              run("/suite/config", "PATCH", {
                version: state.companyVersion,
                settings: {
                  ...state.settings,
                  weekendDays: Object.entries(body)
                    .filter(([, checked]) => checked)
                    .map(([day]) => Number(day)),
                },
              })
            }
            submit="Save weekly days off"
          />
        </Panel>
      )}
      {staff && (
        <Panel title="Balance adjustments">
          <Form
            fields={[
              employeeField,
              {
                key: "leaveType",
                label: "Leave type",
                options: company.leaveTypes,
              },
              {
                key: "year",
                label: "Year",
                type: "number",
                min: 2000,
                max: 2100,
                step: "1",
              },
              {
                key: "days",
                label: "Days to add or deduct",
                type: "number",
                min: -366,
                max: 366,
                step: "1",
              },
              { key: "reason", label: "Reason", type: "textarea" },
            ]}
            initial={{ year: Number(state.today.slice(0, 4)) }}
            onSubmit={(body) => create("leaveAdjustments", body)}
            submit="Record adjustment"
          />
        </Panel>
      )}
      <Panel title="Holidays">
        {staff && (
          <Form
            fields={[
              { key: "name", label: "Holiday name" },
              { key: "date", label: "Date", type: "date" },
              {
                key: "branchId",
                label: "Branch",
                options: options(state.branches),
                required: false,
                hint: "Leave blank for all branches.",
              },
            ]}
            onSubmit={(body) => create("holidays", body)}
            submit="Add holiday"
          />
        )}
        <Table
          rows={state.holidays}
          columns={[
            ["name", "Holiday"],
            ["date", "Date"],
          ]}
        />
      </Panel>
      <Panel title="Shifts">
        {staff && (
          <Form
            fields={[
              { key: "name", label: "Shift name" },
              { key: "start", label: "Start time", type: "time" },
              { key: "end", label: "End time", type: "time" },
              {
                key: "breakMinutes",
                label: "Unpaid break (minutes)",
                type: "number",
                step: "1",
              },
              {
                key: "graceMinutes",
                label: "Grace period (minutes)",
                type: "number",
                step: "1",
              },
            ]}
            initial={{ breakMinutes: 0, graceMinutes: 0 }}
            onSubmit={(body) => create("shifts", body)}
            submit="Add shift"
          />
        )}
        <Table
          rows={state.shifts}
          columns={[
            ["name", "Shift"],
            ["start", "Starts"],
            ["end", "Ends"],
            ["breakMinutes", "Break minutes"],
            ["hours", "Paid hours"],
          ]}
        />
      </Panel>
      <Panel title="Shift assignments">
        {staff && (
          <Form
            fields={[
              employeeField,
              {
                key: "shiftId",
                label: "Shift",
                options: options(state.shifts),
              },
              { key: "startDate", label: "From date", type: "date" },
              { key: "endDate", label: "Through date", type: "date" },
            ]}
            onSubmit={(body) => create("shiftAssignments", body)}
            submit="Assign shift"
          />
        )}
        <Table
          rows={state.shiftAssignments}
          columns={[
            ["employeeName", "Employee"],
            ["shiftSnapshot.name", "Shift"],
            ["startDate", "From"],
            ["endDate", "Through"],
          ]}
        />
      </Panel>
      <Panel
        title="Worked time and overtime"
        description="Completed clock periods are grouped by work date. The assigned shift’s unpaid break is deducted once per day. Overtime is a review suggestion; payroll requires an approved rate."
      >
        <Table
          rows={state.attendanceSummary}
          columns={[
            ["employeeName", "Employee"],
            ["date", "Work date"],
            ["shift", "Shift"],
            ["workedHours", "Clock hours"],
            ["paidHours", "After breaks"],
            ["scheduledHours", "Scheduled hours"],
            ["overtimeHours", "Suggested overtime"],
          ]}
        />
      </Panel>
      <Panel
        title="Correct attendance"
        description="Enter the actual start and end times in your device’s local time. HR will review the correction. To replace a saved clock record, choose it below."
      >
        <Form
          fields={[
            ...(staff ? [employeeField] : []),
            {
              key: "attendanceId",
              label: "Attendance to correct",
              options: attendance.map((r) => ({
                value: r.id,
                label: r.employeeName + " · " + r.date + " · " + r.checkIn,
              })),
              required: false,
              hint: "Leave blank to add a missing period.",
            },
            {
              key: "checkInAt",
              label: "Actual check-in",
              type: "datetime-local",
            },
            {
              key: "checkOutAt",
              label: "Actual check-out",
              type: "datetime-local",
            },
            { key: "reason", label: "Reason", type: "textarea" },
          ]}
          initial={{ employeeId: user.employeeId || "" }}
          onSubmit={(body) =>
            create("attendanceCorrections", {
              ...body,
              checkInAt: new Date(body.checkInAt).toISOString(),
              checkOutAt: new Date(body.checkOutAt).toISOString(),
            })
          }
          submit="Request correction"
        />
        <Table
          rows={state.attendanceCorrections}
          columns={[
            ["employeeName", "Employee"],
            ["checkInAt", "Check-in"],
            ["checkOutAt", "Check-out"],
            ["reason", "Reason"],
            ["status", "Status"],
          ]}
        />
      </Panel>
    </>
  );
}
