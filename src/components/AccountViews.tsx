import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  LogOut,
  ShieldCheck,
  Briefcase,
  UserRound,
  Users,
  CalendarDays,
  Wallet,
  Check,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { api } from "../api";
import { CompanySettings, Employee, SessionUser } from "../types";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="account-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      {message}
    </p>
  ) : null;
}

export function AuthView({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [register, setRegister] = useState(false),
    [registrationOpen, setRegistrationOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [demoRoles, setDemoRoles] = useState<string[]>([]),
    [openingDemo, setOpeningDemo] = useState("");
  const demos = [
    { role: "owner", label: "Administrator", icon: ShieldCheck },
    { role: "hr", label: "HR Manager", icon: Briefcase },
    { role: "employee", label: "Employee", icon: UserRound },
  ];
  useEffect(() => {
    api("/auth/options")
      .then((result) => {
        setRegistrationOpen(result.registrationOpen);
        setDemoRoles(result.demoRoles || []);
      })
      .catch((error) => setError(error.message));
  }, []);
  async function openDemo(role: string) {
    setBusy(true);
    setOpeningDemo(role);
    setError("");
    try {
      await api("/auth/demo", "POST", { role });
      await onSignedIn();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      setOpeningDemo("");
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/auth/${register ? "register" : "login"}`, "POST", fields);
      await onSignedIn();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About HR Studio">
        <BrandMark />
        <div className="auth-story-main">
          <p className="eyebrow">
            <span className="small-dot" /> PEOPLE. PROCESSES. PROGRESS.
          </p>
          <h2>
            Built around
            <br />
            your <em>people.</em>
          </h2>
          <p className="auth-intro">
            From the first day to payday, bring your team's everyday HR into one
            well-organized workspace.
          </p>
          <div className="auth-workflows">
            <div>
              <span>
                <Users size={22} />
              </span>
              <section>
                <h3>A place for every person</h3>
                <p>Employee profiles, documents and your team structure.</p>
              </section>
              <Check size={16} />
            </div>
            <div>
              <span>
                <CalendarDays size={22} />
              </span>
              <section>
                <h3>A clearer working day</h3>
                <p>Attendance, leave and requests, kept together.</p>
              </section>
              <Check size={16} />
            </div>
            <div>
              <span>
                <Wallet size={22} />
              </span>
              <section>
                <h3>Confidence at every payday</h3>
                <p>Reviewed payroll and payslips your team can access.</p>
              </section>
              <Check size={16} />
            </div>
          </div>
        </div>
        <p className="auth-story-footer">
          Mahratta Chamber of Commerce,
          <br />
          Industries and Agriculture
        </p>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <BrandMark />
        </div>
        <div className="auth-form-content">
          <div className="auth-heading">
            <p className="eyebrow">MCCIA HR STUDIO</p>
            <h1>{register ? "Make room for your team." : "Welcome back."}</h1>
            <p>
              {register
                ? "Create a workspace for your people and everyday HR."
                : "Your people and your working day, all in one place."}
            </p>
          </div>
          <ErrorMessage message={error} />
          {!register && demoRoles.length > 0 && (
            <section className="demo-entry" aria-labelledby="demo-heading">
              <div className="demo-entry-heading">
                <h2 id="demo-heading">Take a look around</h2>
                <span>No password needed</span>
              </div>
              <div className="demo-role-grid">
                {demos
                  .filter((demo) => demoRoles.includes(demo.role))
                  .map((demo) => (
                    <button
                      key={demo.role}
                      type="button"
                      disabled={busy}
                      aria-label={"Demo login as " + demo.label}
                      onClick={() => void openDemo(demo.role)}
                      className="demo-role-button"
                    >
                      <demo.icon size={21} />
                      <span>
                        {openingDemo === demo.role ? "Opening…" : demo.label}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
              </div>
              <p>
                Explore a sample company. All demo data is fictional and shared.
              </p>
            </section>
          )}
          {!register && demoRoles.length > 0 && (
            <div className="auth-divider">
              <span>or sign in to your workspace</span>
            </div>
          )}
          <form onSubmit={submit} className="auth-form">
            <fieldset disabled={busy}>
              {register && (
                <>
                  <Field label="Company name">
                    <input
                      name="companyName"
                      required
                      maxLength={120}
                      autoComplete="organization"
                      placeholder="Your company name"
                    />
                  </Field>
                  <Field label="Your name">
                    <input
                      name="name"
                      required
                      maxLength={200}
                      autoComplete="name"
                      placeholder="Full name"
                    />
                  </Field>
                </>
              )}
              <Field label="Workspace code">
                <input
                  name="slug"
                  required
                  maxLength={50}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="Your company workspace"
                  autoCapitalize="none"
                  autoComplete="organization-title"
                />
              </Field>
              {register && (
                <p className="field-hint">
                  Use lowercase letters and hyphens. Your team will use this
                  code to sign in.
                </p>
              )}
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="username"
                  placeholder="you@company.com"
                />
              </Field>
              <Field
                label={
                  register ? "Password (at least 12 characters)" : "Password"
                }
              >
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                />
              </Field>
              <button className="account-primary auth-submit" type="submit">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create workspace"
                    : "Sign in to workspace"}
                <ArrowRight size={17} />
              </button>
            </fieldset>
          </form>
          {registrationOpen && (
            <p className="auth-register">
              {register ? "Already have a workspace?" : "New to HR Studio?"}{" "}
              <button
                disabled={busy}
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register ? "Sign in" : "Create a workspace"}
                <ArrowUpRight size={14} />
              </button>
            </p>
          )}
        </div>
        <p className="auth-footnote">One workspace. A better day at work.</p>
      </section>
    </main>
  );
}

export function PasswordForm({
  onChanged,
  required = false,
}: {
  onChanged: () => Promise<void>;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setError("");
    setSuccess(false);
    if (values.newPassword !== values.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/password", "POST", values);
      form.reset();
      setSuccess(true);
      await onChanged();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="account-panel space-y-4 max-w-xl">
      <h2 className="font-bold text-lg">
        {required ? "Choose your own password" : "Change password"}
      </h2>
      <p className="text-sm text-slate-500">
        {required
          ? "Replace your temporary password to open the workspace."
          : "Changing your password signs out your other sessions."}
      </p>
      <ErrorMessage message={error} />
      {success && (
        <p role="status" className="text-sm text-emerald-700">
          Password updated.
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <Field label={required ? "Temporary password" : "Current password"}>
          <input
            required
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={128}
          />
        </Field>
        <Field label="New password (at least 12 characters)">
          <input
            required
            name="newPassword"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            required
            name="confirmPassword"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
        </Field>
        <button type="submit" className="account-primary">
          {busy ? "Updating…" : "Update password"}
        </button>
      </fieldset>
    </form>
  );
}

export function SettingsView({
  company,
  user,
  employees,
  onRefresh,
}: {
  company: CompanySettings;
  user: SessionUser;
  employees: Employee[];
  onRefresh: () => Promise<void>;
}) {
  const [users, setUsers] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [credential, setCredential] = useState<any>(null);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const owner = user.accessRole === "owner" && !user.demo;
  async function reload() {
    if (owner) setUsers(await api("/users"));
    if (user.accessRole !== "employee") setAudit(await api("/audit"));
  }
  useEffect(() => {
    reload().catch((error) => setError(error.message));
  }, [user.id]);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
      await reload();
      await onRefresh();
      setMessage("Changes saved.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 text-slate-900 dark:text-white">
      <div>
        <h1 className="text-2xl font-bold">Settings & access</h1>
        <p className="text-sm text-slate-500 mt-1">
          Workspace: <strong>{company.slug}</strong> · Your access:{" "}
          {user.accessRole}
        </p>
      </div>
      <ErrorMessage message={error} />
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      {owner && (
        <div className="grid gap-6 xl:grid-cols-2">
          <form
            key={company.version}
            className="account-panel space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              void run(async () => {
                await api("/company", "PATCH", {
                  ...values,
                  departments: String(values.departments)
                    .split("\n")
                    .filter((v) => v.trim()),
                  leaveTypes: String(values.leaveTypes)
                    .split("\n")
                    .filter((v) => v.trim()),
                  version: company.version,
                });
              });
            }}
          >
            <h2 className="text-lg font-bold">Company</h2>
            <fieldset disabled={busy} className="space-y-4">
              <Field label="Company name">
                <input
                  name="name"
                  required
                  defaultValue={company.name}
                  maxLength={120}
                />
              </Field>
              <Field label="Timezone">
                <input
                  name="timezone"
                  required
                  defaultValue={company.timezone}
                  placeholder="Asia/Kolkata"
                />
              </Field>
              <Field label="Departments — one per line">
                <textarea
                  name="departments"
                  required
                  rows={4}
                  defaultValue={company.departments.join("\n")}
                />
              </Field>
              <Field label="Leave types — one per line">
                <textarea
                  name="leaveTypes"
                  required
                  rows={3}
                  defaultValue={company.leaveTypes.join("\n")}
                />
              </Field>
              <p className="text-xs text-slate-500">
                Salary amounts use INR. Configure leave policies, balances and
                holiday rules in HR operations.
              </p>
              <button className="account-primary">
                {busy ? "Saving…" : "Save company settings"}
              </button>
            </fieldset>
          </form>
          <div className="space-y-6">
            <form
              className="account-panel space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                setCredential(null);
                void run(async () =>
                  setCredential(await api("/users", "POST", values)),
                );
              }}
            >
              <h2 className="text-lg font-bold">Create a team account</h2>
              <p className="text-sm text-slate-500">
                Add the employee to the directory first. HR accounts can manage
                all company records, including salaries.
              </p>
              <fieldset disabled={busy} className="space-y-4">
                <Field label="Employee">
                  <select name="employeeId" required defaultValue="">
                    <option value="">Choose employee</option>
                    {employees
                      .filter(
                        (emp) =>
                          emp.status === "Active" &&
                          !users.some((u) => u.employeeId === emp.id),
                      )
                      .map((emp) => (
                        <option value={emp.id} key={emp.id}>
                          {emp.name} — {emp.email}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Access">
                  <select name="accessRole">
                    <option value="employee">
                      Employee — own records only
                    </option>
                    <option value="hr">HR — all company records</option>
                  </select>
                </Field>
                <button className="account-primary">
                  {busy ? "Creating…" : "Create account"}
                </button>
              </fieldset>
              {credential && (
                <div
                  role="status"
                  className="rounded-lg p-4 bg-indigo-50 dark:bg-indigo-950 space-y-2 text-sm"
                >
                  <strong>Account created for {credential.email}</strong>
                  <p>Temporary password (shown once):</p>
                  <code className="select-all break-all block font-bold">
                    {credential.temporaryPassword}
                  </code>
                  <p>
                    Share this password securely with the employee. No email has
                    been sent.
                  </p>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setCredential(null)}
                  >
                    Hide password
                  </button>
                </div>
              )}
            </form>
            <form
              className="account-panel space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                void run(async () => {
                  await api("/account/employee", "PATCH", values);
                });
              }}
            >
              <h2 className="font-bold text-lg">Your employee profile</h2>
              <p className="text-sm text-slate-500">
                Link your owner account to your own directory record for
                attendance and leave.
              </p>
              <Field label="Your directory record">
                <select
                  required
                  name="employeeId"
                  defaultValue={user.employeeId || ""}
                  disabled={busy}
                >
                  <option value="">Choose your profile</option>
                  {employees
                    .filter(
                      (emp) =>
                        !users.some(
                          (u) => u.employeeId === emp.id && u.id !== user.id,
                        ),
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button disabled={busy} className="account-primary">
                Link profile
              </button>
            </form>
          </div>
        </div>
      )}
      {owner && (
        <section className="account-panel overflow-x-auto">
          <h2 className="text-lg font-bold mb-4">Team access</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Account</th>
                <th className="p-2">Access</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr
                  key={account.id}
                  className="border-t border-slate-200 dark:border-slate-800"
                >
                  <td className="p-2">
                    {account.name}
                    <span className="block text-xs text-slate-500">
                      {account.email}
                    </span>
                  </td>
                  <td className="p-2">{account.accessRole}</td>
                  <td className="p-2">
                    {account.active ? "Active" : "Disabled"}
                    {account.mustChangePassword
                      ? " · Password change required"
                      : ""}
                  </td>
                  <td className="p-2">
                    {account.accessRole !== "owner" && (
                      <button
                        disabled={busy}
                        className="text-indigo-600 underline"
                        onClick={() =>
                          void run(async () => {
                            await api(`/users/${account.id}`, "PATCH", {
                              active: !account.active,
                            });
                          })
                        }
                      >
                        {account.active ? "Disable" : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {user.demo ? (
        <p className="account-panel text-sm text-slate-500">
          Demo accounts are ready to use. Select “Switch demo role” to explore
          another view. Account security changes and external services are
          unavailable in this sample workspace.
        </p>
      ) : (
        <PasswordForm onChanged={onRefresh} />
      )}
      {user.accessRole !== "employee" && (
        <section className="account-panel">
          <h2 className="text-lg font-bold mb-4">Recent activity</h2>
          <p className="text-xs text-slate-500 mb-3">
            Latest 200 changes. Times shown in {company.timezone}.
          </p>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {audit.map((entry) => (
              <div
                key={entry.id}
                className="py-3 text-sm flex justify-between gap-4"
              >
                <span>
                  {entry.action}
                  <span className="block text-xs text-slate-500">
                    {entry.actorName}
                  </span>
                </span>
                <time className="text-xs text-slate-500">
                  {new Date(entry.at).toLocaleString(undefined, {
                    timeZone: company.timezone,
                  })}
                </time>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
