import React, { useState } from "react";
import {
  Form,
  Panel,
  Table,
  options,
  secondaryClass,
  money,
  type Row,
  type Field,
} from "./Controls";
import type { SessionUser } from "../../types";

const numeric = (key: string, label: string): Field => ({
  key: `input.${key}`,
  label,
  type: "number",
  required: false,
});
const check = (key: string, label: string): Field => ({
  key: `input.${key}`,
  label,
  type: "checkbox",
});
export default function PayrollSuite({
  state,
  user,
  run,
}: {
  state: Row;
  user: SessionUser;
  run: (path: string, method: string, body?: Row) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState(""),
    [employeeId, setEmployeeId] = useState("");
  const staff = user.accessRole !== "employee";
  const period =
    state.payroll.find((p: Row) => p.id === selected) || state.payroll[0];
  const line =
    period?.lines.find((l: Row) => l.employeeId === employeeId) ||
    period?.lines[0];
  return (
    <div className="space-y-5">
      {staff && (
        <Panel
          title="Run payroll"
          description="Pune, Maharashtra · INR. Monthly pay is prorated by calendar days and dated salary history. Daily and hourly pay starts from completed attendance. Every employee requires review before submission."
        >
          <Form
            fields={[{ key: "month", label: "Payroll month", type: "month" }]}
            initial={{ month: state.today.slice(0, 7) }}
            onSubmit={(body) => run("/suite/payroll", "POST", body)}
            submit="Create draft"
          />
        </Panel>
      )}
      <Panel
        title={staff ? "Payroll periods" : "My payslips"}
        description={
          staff
            ? "Approved periods are locked. An HR account should prepare and submit; the owner approves. Payment references record transfers made outside HR Studio."
            : "Payslips appear after your company approves payroll."
        }
      >
        <Table
          rows={state.payroll}
          columns={[
            ["month", "Month"],
            ["status", "Status"],
          ]}
          actions={(p) => (
            <button
              className={secondaryClass}
              onClick={() => {
                setSelected(p.id);
                setEmployeeId("");
              }}
            >
              Open period
            </button>
          )}
        />
      </Panel>
      {period && (
        <Panel title={`${period.month} · ${period.status}`}>
          <Table
            rows={period.lines.map((l: Row) => ({
              ...l,
              grossText: money(l.gross),
              deductionsText: money(l.totalDeductions),
              netText: money(l.net),
            }))}
            columns={[
              ["employeeName", "Employee"],
              ["grossText", "Gross"],
              ["deductionsText", "Deductions"],
              ["netText", "Net pay"],
              ["input.reviewed", "Reviewed"],
            ]}
            actions={(l) => (
              <>
                {staff && period.status === "Draft" && (
                  <button
                    className={secondaryClass}
                    onClick={() => setEmployeeId(l.employeeId)}
                  >
                    Review
                  </button>
                )}
                {["Approved", "Paid"].includes(period.status) && (
                  <a
                    className={secondaryClass}
                    target="_blank"
                    rel="noreferrer"
                    href={`/api/suite/payroll/${period.id}/payslip/${l.employeeId}`}
                  >
                    Open payslip
                  </a>
                )}
              </>
            )}
          />
          {staff && (
            <div className="flex flex-wrap gap-2">
              <a
                className={secondaryClass}
                href={`/api/suite/export/payroll?period=${period.id}`}
              >
                Export payroll register
              </a>
              {["Approved", "Paid"].includes(period.status) && (
                <a
                  className={secondaryClass}
                  href={`/api/suite/export/accounting?period=${period.id}`}
                >
                  Export accounting amounts
                </a>
              )}
            </div>
          )}
          {staff && period.status === "Draft" && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  className={secondaryClass}
                  onClick={() =>
                    void run(`/suite/payroll/${period.id}`, "POST", {
                      version: period.version,
                      action: "Refresh earnings",
                    })
                  }
                >
                  Rebuild draft from current records
                </button>
                <button
                  className={secondaryClass}
                  onClick={() =>
                    void run(`/suite/payroll/${period.id}`, "POST", {
                      version: period.version,
                      action: "Include expenses",
                    })
                  }
                >
                  Refresh approved expenses
                </button>
                <button
                  className={secondaryClass}
                  onClick={() =>
                    void run(`/suite/payroll/${period.id}`, "POST", {
                      version: period.version,
                      action: "Submit",
                    })
                  }
                >
                  Submit for approval
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Rebuilding discards draft payroll inputs and reviews. Use it
                after correcting employee, salary or attendance records; then
                review all lines again.
              </p>
            </>
          )}
          {staff && period.status === "Submitted" && (
            <Form
              key={`actions-${period.id}-${period.version}`}
              fields={[
                {
                  key: "action",
                  label: "Decision",
                  options:
                    user.accessRole === "owner"
                      ? ["Approve", "Return"]
                      : ["Return"],
                },
                {
                  key: "note",
                  label: "Review note",
                  type: "textarea",
                  required: false,
                },
              ]}
              initial={{ version: period.version }}
              onSubmit={(body) =>
                run(`/suite/payroll/${period.id}`, "POST", body)
              }
              submit="Save decision"
            />
          )}
          {staff && period.status === "Approved" && (
            <Form
              key={`payment-${period.id}`}
              fields={[
                {
                  key: "reference",
                  label: "Bank/payment reference",
                  hint: "Enter this only after completing the payment through your bank.",
                },
              ]}
              initial={{ version: period.version, action: "Record payment" }}
              onSubmit={(body) =>
                run(`/suite/payroll/${period.id}`, "POST", body)
              }
              submit="Record completed payment"
            />
          )}
          {staff && period.history?.length > 0 && (
            <Table
              rows={period.history}
              columns={[
                ["action", "Action"],
                ["by", "By"],
                ["at", "When"],
                ["note", "Note"],
              ]}
            />
          )}
        </Panel>
      )}
      {staff && period?.status === "Draft" && line && (
        <Panel
          title={`Review ${line.employeeName}`}
          description="Confirm statutory eligibility and assessable wage bases with your payroll adviser. PF/ESI bases are entered explicitly; the app does not infer them from basic salary. Enter TDS from your tax calculation. Employer EDLI, PF administration charges and statutory filings are outside this register."
        >
          <p className="text-sm">
            {line.snapshot.payBasis} pay · {line.snapshot.eligibleDays} eligible
            calendar days · Gross {money(line.gross)} · Reimbursement{" "}
            {money(line.reimbursement)} · Net {money(line.net)}
          </p>
          <p className="text-sm text-slate-500">
            Shift-based overtime suggestion:{" "}
            {line.snapshot.suggestedOvertime || 0} hours. Review actual payable
            time and the approved overtime rate.
          </p>
          {line.snapshot.historyWarning && (
            <p className="rounded-lg bg-amber-50 text-amber-900 p-3 text-sm">
              {line.snapshot.historyWarning}
            </p>
          )}
          <Form
            key={`${period.id}-${period.version}-${line.employeeId}`}
            initial={{
              employeeId: line.employeeId,
              version: period.version,
              input: line.input,
            }}
            reset={false}
            fields={[
              numeric("unpaidDays", "Unpaid leave / absence days"),
              ...(line.snapshot.payBasis === "Monthly"
                ? []
                : [
                    numeric(
                      "units",
                      line.snapshot.payBasis === "Hourly"
                        ? "Payable hours"
                        : "Payable days",
                    ),
                  ]),
              numeric("overtimeHours", "Overtime hours"),
              numeric("overtimeRate", "Approved overtime rate per hour"),
              numeric("bonus", "Bonus"),
              numeric("otherDeductions", "Additional deductions"),
              check("pfApplicable", "PF applies"),
              {
                key: "input.pfRate",
                label: "PF contribution rate",
                options: [
                  { value: "12", label: "12%" },
                  { value: "10", label: "10% — eligible establishments only" },
                ],
              },
              numeric("pfWages", "PF assessable wages"),
              check("pfUncapped", "Contribute above the ₹15,000 ceiling"),
              check("epsEligible", "Eligible for EPS"),
              check("esiApplicable", "ESI applies"),
              numeric("esiWages", "ESI assessable wages"),
              numeric("esiAverageDailyWage", "ESI average daily wage"),
              {
                key: "input.ptCategory",
                label: "Maharashtra professional tax category",
                options: ["Unconfirmed", "Standard", "Women", "Exempt"],
              },
              check("lwfApplicable", "Maharashtra labour welfare applies"),
              numeric("tds", "TDS for this month"),
              {
                key: "input.reviewNote",
                label: "Eligibility and calculation review notes",
                type: "textarea",
                required: false,
              },
              check(
                "reviewed",
                "I reviewed attendance, earnings, eligibility, wage bases and TDS",
              ),
            ]}
            onSubmit={(body) =>
              run(`/suite/payroll/${period.id}`, "PATCH", body)
            }
            submit="Save reviewed calculation"
          />
          <p className="text-xs text-slate-500 mt-3">
            Rule version: {period.ruleVersion}. PF uses the selected 10% or 12%
            rate; ESI uses 0.75% / 3.25% with the daily-wage employee exemption.
            Professional tax uses Maharashtra slabs; LWF is applied in June and
            December.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {state.statutorySources.map((source: Row) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="underline text-indigo-600"
              >
                {source.name}
              </a>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
