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
      <Panel
        title="Payroll Standard Templates"
        description="Configure standardized payroll calculation templates. Define custom allowances (Basic, HRA, Special, etc.), deductions (PF, ESI, PT), gratuity rules, and monthly formula rates."
      >
        <div className="space-y-6">
          {(draft.payrollTemplates || []).map((tpl: Row, tplIdx: number) => (
            <div key={tpl.id || tplIdx} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{tpl.name}</h3>
                  <p className="text-xs text-slate-500">{tpl.description || "Custom payroll template"}</p>
                </div>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => {
                    const nextTemplates = draft.payrollTemplates.filter((_: any, i: number) => i !== tplIdx);
                    setDraft({ ...draft, payrollTemplates: nextTemplates });
                  }}
                >
                  Delete Template
                </button>
              </div>

              {/* Allowances Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Allowances (Earnings)</h4>
                <Table
                  rows={tpl.allowances || []}
                  columns={[
                    ["name", "Component Name"],
                    ["type", "Calc Type"],
                    ["value", "Value (% or ₹)"],
                    ["taxable", "Taxable"],
                  ]}
                  actions={(item: Row) => (
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        const next = structuredClone(draft.payrollTemplates);
                        next[tplIdx].allowances = next[tplIdx].allowances.filter((a: Row) => a.id !== item.id);
                        setDraft({ ...draft, payrollTemplates: next });
                      }}
                    >
                      Delete Allowance
                    </button>
                  )}
                />
                <Form
                  key={`alw-form-${tpl.id}-${tpl.allowances?.length}`}
                  fields={[
                    { key: "name", label: "Allowance Name", required: true, hint: "e.g. Transport Allowance" },
                    { key: "type", label: "Type", options: [{ value: "percentage", label: "Percentage of Gross (%)" }, { value: "fixed", label: "Fixed Amount (₹)" }] },
                    { key: "value", label: "Value", type: "number", required: true },
                    { key: "taxable", label: "Taxable Allowance", type: "checkbox" },
                  ]}
                  initial={{ type: "percentage", value: 10, taxable: true }}
                  onSubmit={(body) => {
                    const next = structuredClone(draft.payrollTemplates);
                    next[tplIdx].allowances.push({
                      id: `alw_${Date.now()}`,
                      name: body.name,
                      type: body.type,
                      value: Number(body.value),
                      taxable: !!body.taxable,
                    });
                    setDraft({ ...draft, payrollTemplates: next });
                    return Promise.resolve(true);
                  }}
                  submit="+ Add Allowance to Template"
                />
              </div>

              {/* Deductions Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Deductions & Statutory Contributions</h4>
                <Table
                  rows={tpl.deductions || []}
                  columns={[
                    ["name", "Deduction Name"],
                    ["type", "Calc Type"],
                    ["value", "Value (% or ₹)"],
                    ["statutory", "Statutory"],
                  ]}
                  actions={(item: Row) => (
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        const next = structuredClone(draft.payrollTemplates);
                        next[tplIdx].deductions = next[tplIdx].deductions.filter((d: Row) => d.id !== item.id);
                        setDraft({ ...draft, payrollTemplates: next });
                      }}
                    >
                      Delete Deduction
                    </button>
                  )}
                />
                <Form
                  key={`ded-form-${tpl.id}-${tpl.deductions?.length}`}
                  fields={[
                    { key: "name", label: "Deduction Name", required: true, hint: "e.g. Voluntary PF / Insurance" },
                    { key: "type", label: "Type", options: [{ value: "percentage", label: "Percentage (%)" }, { value: "fixed", label: "Fixed Amount (₹)" }] },
                    { key: "value", label: "Value", type: "number", required: true },
                    { key: "statutory", label: "Statutory Rule", type: "checkbox" },
                  ]}
                  initial={{ type: "percentage", value: 5, statutory: false }}
                  onSubmit={(body) => {
                    const next = structuredClone(draft.payrollTemplates);
                    next[tplIdx].deductions.push({
                      id: `ded_${Date.now()}`,
                      name: body.name,
                      type: body.type,
                      value: Number(body.value),
                      statutory: !!body.statutory,
                    });
                    setDraft({ ...draft, payrollTemplates: next });
                    return Promise.resolve(true);
                  }}
                  submit="+ Add Deduction to Template"
                />
              </div>

              {/* Gratuity & Monthly Calculation Rules */}
              <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`grat_check_${tplIdx}`}
                    checked={tpl.gratuity?.enabled ?? true}
                    onChange={(e) => {
                      const next = structuredClone(draft.payrollTemplates);
                      if (!next[tplIdx].gratuity) next[tplIdx].gratuity = {};
                      next[tplIdx].gratuity.enabled = e.target.checked;
                      setDraft({ ...draft, payrollTemplates: next });
                    }}
                  />
                  <label htmlFor={`grat_check_${tplIdx}`} className="text-sm font-medium">
                    Enable Monthly Gratuity & Retirement Benefit Accrual
                  </label>
                </div>
                {tpl.gratuity?.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div>
                      <span className="text-slate-500">Gratuity Accrual Rate:</span>
                      <p className="font-mono font-medium">{tpl.gratuity.percentage || 4.81}% of Basic Pay (15/26 days per year)</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Vesting Eligibility:</span>
                      <p className="font-mono font-medium">{tpl.gratuity.eligibilityYears || 5} Years continuous service</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Monthly Calculation Formula:</span>
                      <p className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{tpl.gratuity.calculationFormula || "(Basic * 15 / 26) per year of service"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Add New Template Form */}
          <Form
            fields={[
              { key: "name", label: "Template Name", required: true, hint: "e.g., Executive Standard Payroll" },
              { key: "description", label: "Description", required: false },
            ]}
            initial={{ name: "", description: "" }}
            onSubmit={(body) => {
              const newTpl = {
                id: `tpl_${Date.now()}`,
                name: body.name,
                description: body.description,
                allowances: [
                  { id: `alw_b_${Date.now()}`, name: "Basic Salary", type: "percentage", value: 50, taxable: true },
                  { id: `alw_h_${Date.now()}`, name: "HRA", type: "percentage", value: 40, taxable: true },
                ],
                deductions: [
                  { id: `ded_p_${Date.now()}`, name: "PF", type: "percentage", value: 12, statutory: true },
                ],
                gratuity: {
                  enabled: true,
                  percentage: 4.81,
                  eligibilityYears: 5,
                  calculationFormula: "(Basic * 15 / 26) per year of service",
                },
              };
              return save({
                ...draft,
                payrollTemplates: [...(draft.payrollTemplates || []), newTpl],
              });
            }}
            submit="Create New Standard Template"
          />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button className={buttonClass} onClick={() => void save(draft)}>
            Save All Payroll Templates
          </button>
        </div>
      </Panel>
      </Panel>
    </div>
  );
}
