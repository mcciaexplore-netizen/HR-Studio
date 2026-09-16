import React, { useState } from "react";
import {
  Form,
  Panel,
  Table,
  inputClass,
  buttonClass,
  secondaryClass,
  options,
  type Row,
} from "./Controls";

export default function Configuration({
  state,
  run,
}: {
  state: Row;
  run: (path: string, method: string, body?: Row) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Row>(structuredClone(state.settings));
  const save = (next: Row) =>
    run("/suite/config", "PATCH", {
      version: state.companyVersion,
      settings: next,
    });
  const modules = [
    "leaves",
    "payroll",
    "documents",
    "recruitment",
    "performance",
    "assets",
    "emailhub",
    "expenses",
    "lifecycle",
    "helpdesk",
    "policies",
    "reports",
    "integrations",
  ];
  const labels: Row = {
    leaves: "Leave & attendance",
    emailhub: "Email",
    lifecycle: "Joining, changes & exits",
    helpdesk: "Helpdesk",
    policies: "Policies",
    reports: "Reports",
    integrations: "Integrations",
    payroll: "Payroll",
    documents: "Documents",
    recruitment: "Recruitment",
    performance: "Performance",
    assets: "Assets",
    expenses: "Expenses",
  };
  return (
    <div className="space-y-5">
      <Panel
        title="Company modules"
        description="Disabled modules are hidden and their main actions are blocked. Existing records are retained."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await save(draft);
          }}
          className="space-y-4"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map((module) => (
              <label className="text-sm flex gap-2" key={module}>
                <input
                  type="checkbox"
                  checked={draft.enabledModules.includes(module)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      enabledModules: e.target.checked
                        ? [...draft.enabledModules, module]
                        : draft.enabledModules.filter(
                            (v: string) => v !== module,
                          ),
                    })
                  }
                />
                {labels[module]}
              </label>
            ))}
          </div>
          <button className={buttonClass}>Save configuration</button>
        </form>
      </Panel>
      <Panel
        title="Industry and language"
        description="Templates update worker categories and checklist tasks. Existing departments and employee records are preserved."
      >
        <Form
          fields={[
            {
              key: "industry",
              label: "Industry",
              options: Object.keys(state.templates),
            },
            {
              key: "defaultLanguage",
              label: "Default navigation language",
              options: [
                { value: "en", label: "English" },
                { value: "hi", label: "हिन्दी" },
                { value: "mr", label: "मराठी" },
              ],
            },
          ]}
          initial={{
            industry: draft.industry,
            defaultLanguage: draft.defaultLanguage,
          }}
          onSubmit={(body) => {
            const template = state.templates[body.industry];
            return save({
              ...draft,
              ...body,
              workerTypes: template.workerTypes,
              onboarding: template.onboarding,
              offboarding: template.offboarding,
            });
          }}
          submit="Apply template"
        />
      </Panel>
      <Panel
        title="Approval chains"
        description="Stages are completed in order. A reporting manager must have an active login. People cannot approve their own requests."
      >
        {Object.entries({
          leaves: "Leave",
          expenses: "Expenses",
          profileRequests: "Profile and letter requests",
          attendanceCorrections: "Attendance corrections",
        }).map(([kind, label]) => (
          <div key={kind} className="space-y-2">
            <h3 className="text-sm font-medium">{label}</h3>
            {draft.approvalChains[kind].map((stage: string, index: number) => (
              <div className="flex gap-2 items-center" key={index}>
                <label
                  className="text-sm shrink-0"
                  htmlFor={`${kind}-${index}`}
                >
                  Stage {index + 1}
                </label>
                <select
                  id={`${kind}-${index}`}
                  className={inputClass}
                  value={stage}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      approvalChains: {
                        ...draft.approvalChains,
                        [kind]: draft.approvalChains[kind].map(
                          (v: string, i: number) =>
                            i === index ? e.target.value : v,
                        ),
                      },
                    })
                  }
                >
                  <option value="manager">Reporting manager</option>
                  <option value="hr">Any HR administrator or owner</option>
                  <option value="owner">Company owner</option>
                  {state.accounts.map((account: Row) => (
                    <option value={account.id} key={account.id}>
                      {account.name} ({account.role})
                    </option>
                  ))}
                </select>
                {draft.approvalChains[kind].length > 1 && (
                  <button
                    className={secondaryClass}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        approvalChains: {
                          ...draft.approvalChains,
                          [kind]: draft.approvalChains[kind].filter(
                            (_: string, i: number) => i !== index,
                          ),
                        },
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {draft.approvalChains[kind].length < 5 && (
              <button
                className={secondaryClass}
                onClick={() =>
                  setDraft({
                    ...draft,
                    approvalChains: {
                      ...draft.approvalChains,
                      [kind]: [...draft.approvalChains[kind], "hr"],
                    },
                  })
                }
              >
                Add stage
              </button>
            )}
          </div>
        ))}
        <button className={buttonClass} onClick={() => void save(draft)}>
          Save approval chains
        </button>
      </Panel>
      <Panel
        title="Custom employee fields"
        description="Fields can be text, numbers, dates or a choice list. Required fields must be supplied when creating or updating employees, including imports."
      >
        <Table
          rows={draft.customFields}
          columns={[
            ["key", "Key"],
            ["label", "Label"],
            ["type", "Type"],
            ["required", "Required"],
          ]}
          actions={(field) => (
            <button
              className={secondaryClass}
              onClick={() =>
                void save({
                  ...draft,
                  customFields: draft.customFields.filter(
                    (f: Row) => f.key !== field.key,
                  ),
                })
              }
            >
              Remove field
            </button>
          )}
        />
        <Form
          fields={[
            {
              key: "key",
              label: "Field key",
              hint: "Lowercase letters, numbers and underscores; e.g. uniform_size",
            },
            { key: "label", label: "Display label" },
            {
              key: "type",
              label: "Field type",
              options: ["text", "number", "date", "select"],
            },
            {
              key: "optionsText",
              label: "Choice options",
              required: false,
              hint: "Comma-separated; required for choice lists.",
            },
            { key: "required", label: "Required field", type: "checkbox" },
          ]}
          initial={{ type: "text" }}
          onSubmit={(body) =>
            save({
              ...draft,
              customFields: [
                ...draft.customFields,
                {
                  ...body,
                  options: (body.optionsText || "")
                    .split(",")
                    .map((v: string) => v.trim())
                    .filter(Boolean),
                },
              ],
            })
          }
          submit="Add field"
        />
      </Panel>
      <Panel title="Worker categories, expenses and checklists">
        <Form
          fields={[
            {
              key: "workerTypes",
              label: "Worker categories",
              type: "textarea",
              hint: "One per line.",
            },
            {
              key: "expenseCategories",
              label: "Expense categories",
              type: "textarea",
              hint: "One per line.",
            },
            {
              key: "expenseLimit",
              label: "Maximum claim amount (INR)",
              type: "number",
            },
            {
              key: "onboarding",
              label: "Onboarding tasks",
              type: "textarea",
              hint: "One per line.",
            },
            {
              key: "offboarding",
              label: "Offboarding tasks",
              type: "textarea",
              hint: "One per line.",
            },
          ]}
          initial={{
            workerTypes: draft.workerTypes.join("\n"),
            expenseCategories: draft.expenseCategories.join("\n"),
            expenseLimit: draft.expenseLimit,
            onboarding: draft.onboarding.join("\n"),
            offboarding: draft.offboarding.join("\n"),
          }}
          onSubmit={(body) =>
            save({
              ...draft,
              ...body,
              ...Object.fromEntries(
                [
                  "workerTypes",
                  "expenseCategories",
                  "onboarding",
                  "offboarding",
                ].map((key) => [
                  key,
                  body[key]
                    .split("\n")
                    .map((v: string) => v.trim())
                    .filter(Boolean),
                ]),
              ),
            })
          }
          submit="Save lists"
        />
      </Panel>
    </div>
  );
}
