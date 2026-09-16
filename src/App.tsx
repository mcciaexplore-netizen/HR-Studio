import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Layers,
  Users,
  Calendar,
  CreditCard,
  FolderLock,
  Briefcase,
  Award,
  Laptop,
  Network,
  Mail,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { api, ApiError } from "./api";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { SessionUser, WorkspaceState } from "./types";
import {
  AuthView,
  ErrorMessage,
  PasswordForm,
  SettingsView,
} from "./components/AccountViews";
const DashboardView = lazy(() => import("./components/modules/DashboardView"));
const EmployeesView = lazy(() => import("./components/modules/EmployeesView"));
const LeavesView = lazy(() => import("./components/modules/LeavesView"));
const SuiteView = lazy(() => import("./components/suite/SuiteView"));
const DocsView = lazy(() => import("./components/modules/DocsView"));
const IDCardView = lazy(() => import("./components/IDCardView"));
const RecruitmentView = lazy(
  () => import("./components/modules/RecruitmentView"),
);
const PerformanceView = lazy(
  () => import("./components/modules/PerformanceView"),
);
const AssetsView = lazy(() => import("./components/modules/AssetsView"));
const OrgChartView = lazy(() => import("./components/modules/OrgChartView"));
const EmailHubView = lazy(() => import("./components/modules/EmailHubView"));

const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, staff: false },
  { id: "employees", label: "Employees", icon: Users, staff: true },
  { id: "leaves", label: "Leave & attendance", icon: Calendar, staff: false },
  {
    id: "payroll",
    label: "Payroll & payslips",
    icon: CreditCard,
    staff: false,
  },
  { id: "operations", label: "HR operations", icon: Briefcase, staff: false },
  { id: "documents", label: "Documents", icon: FolderLock, staff: false },
  { id: "idcard", label: "ID cards", icon: Layers, staff: false },
  { id: "recruitment", label: "Recruitment", icon: Briefcase, staff: true },
  { id: "performance", label: "Performance", icon: Award, staff: true },
  { id: "assets", label: "Assets", icon: Laptop, staff: true },
  { id: "orgchart", label: "Departments", icon: Network, staff: true },
  { id: "emailhub", label: "Email", icon: Mail, staff: true },
  { id: "settings", label: "Settings & access", icon: Settings, staff: false },
];
export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null),
    [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("dashboard");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("hrstudio-theme") || "light",
  );
  const [language, setLanguage] = useState(
    () => localStorage.getItem("hrstudio-language") || "",
  );
  const refreshSequence = useRef(0),
    mutationPending = useRef(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("hrstudio-theme", theme);
  }, [theme]);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    try {
      const session = await api("/auth/me");
      const state = session.user.mustChangePassword
        ? null
        : await api<WorkspaceState>("/state");
      if (sequence === refreshSequence.current) {
        setUser(session.user);
        setWorkspace(state);
      }
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setWorkspace(null);
      } else throw error;
    }
  }
  useEffect(() => {
    refresh()
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const onFocus = () => {
      if (user && !mutationPending.current)
        refresh().catch((error) => setError(error.message));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);
  async function mutate(
    path: string,
    method: string,
    body?: any,
  ): Promise<boolean> {
    if (mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      try {
        await refresh();
      } catch {
        setError(
          "The change was saved, but the screen could not refresh. Refresh before making another change.",
        );
      }
      return true;
    } catch (error) {
      setError(error.message);
      if (error.status === 401) {
        setUser(null);
        setWorkspace(null);
      }
      if (error.status === 409) await refresh().catch(() => {});
      return false;
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }
  const create = (kind: string, data: any) =>
    mutate(`/records/${kind}`, "POST", data);
  const update = (kind: string, id: string, data: any) =>
    mutate(`/records/${kind}/${id}`, "PATCH", {
      version: (workspace?.[kind] as any[])?.find((record) => record.id === id)
        ?.version,
      ...data,
    });
  const remove = (kind: string, id: string) =>
    mutate(`/records/${kind}/${id}`, "DELETE", {
      version: (workspace?.[kind] as any[])?.find((record) => record.id === id)
        ?.version,
    });
  async function logout() {
    if (await mutate("/auth/logout", "POST")) {
      setUser(null);
      setWorkspace(null);
      setTab("dashboard");
    }
  }
  if (loading)
    return (
      <main
        className="min-h-screen flex items-center justify-center text-slate-500"
        role="status"
      >
        Opening your workspace…
      </main>
    );
  if (!user)
    return (
      <>
        <ErrorMessage message={error} />
        <AuthView
          onSignedIn={async () => {
            setError("");
            await refresh();
          }}
        />
      </>
    );
  if (user.mustChangePassword)
    return (
      <main className="min-h-screen p-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col gap-6 items-center">
        <PasswordForm required onChanged={refresh} />
        <button onClick={() => void logout()} className="text-sm underline">
          Sign out
        </button>
      </main>
    );
  if (!workspace)
    return (
      <main className="p-8 space-y-4">
        <ErrorMessage message={error || "Workspace could not load."} />
        <button
          className="account-primary"
          onClick={() =>
            void refresh().catch((error) => setError(error.message))
          }
        >
          Retry
        </button>
        <button onClick={() => void logout()}>Sign out</button>
      </main>
    );
  const staff = user.accessRole !== "employee",
    allowed = navigation.filter(
      (item) =>
        (staff || !item.staff) &&
        (!user.demo || item.id !== "emailhub") &&
        (!workspace.company.suite ||
          ![
            "leaves",
            "payroll",
            "documents",
            "recruitment",
            "performance",
            "assets",
            "emailhub",
          ].includes(item.id) ||
          workspace.company.suite.enabledModules.includes(item.id)),
    );
  const currentTab = allowed.some((item) => item.id === tab)
    ? tab
    : "dashboard";
  const {
    employees,
    leaves,
    attendance,
    documents,
    jobs,
    candidates,
    assets,
    appraisals,
    emailLogs,
    company,
  } = workspace;
  const currentLanguage = language || company.suite?.defaultLanguage || "en";
  const openClock = attendance.find(
    (log) => log.employeeId === user.employeeId && !log.checkOut,
  );
  const navigate = (id: string) => setTab(id === "idcards" ? "idcard" : id);
  return (
    <WorkspaceShell
      user={user}
      company={company}
      items={allowed}
      active={currentTab}
      language={currentLanguage}
      theme={theme}
      busy={busy}
      onNavigate={navigate}
      onLanguage={(value) => {
        setLanguage(value);
        localStorage.setItem("hrstudio-language", value);
      }}
      onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      onRefresh={() => void refresh().catch((error) => setError(error.message))}
      onLogout={() => void logout()}
    >
      {error && (
        <div className="sticky top-2 z-[100] space-y-1">
          <ErrorMessage message={error} />
          <button
            className="text-xs underline bg-white dark:bg-slate-900 p-1 rounded"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}
      {!user.employeeId && currentTab === "dashboard" && (
        <p className="rounded-xl bg-indigo-50 dark:bg-indigo-950 p-4 text-sm">
          Add your employee record, then link it in{" "}
          <button
            className="underline font-semibold"
            onClick={() => setTab("settings")}
          >
            Settings
          </button>{" "}
          to use attendance.
        </p>
      )}
      <Suspense
        fallback={
          <p role="status" className="section-loading">
            Opening this section…
          </p>
        }
      >
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {currentTab === "dashboard" && (
            <DashboardView
              employees={employees}
              attendance={attendance}
              timezone={company.timezone}
              availableSections={allowed.map((item) => item.id)}
              leaveRequests={leaves}
              jobOpenings={jobs}
              assets={assets}
              currentUserName={user.name}
              onNavigate={navigate}
              onQuickCheckIn={() =>
                void mutate("/attendance/clock", "POST", {
                  action: openClock ? "out" : "in",
                })
              }
              isCheckedIn={!!openClock}
              checkInTime={openClock?.checkIn || null}
              canClock={!!user.employeeId}
              staff={staff}
            />
          )}
          {currentTab === "employees" && (
            <EmployeesView
              employees={employees}
              companyDepartments={company.departments}
              suiteSettings={company.suite}
              onAddEmployee={(data) => create("employees", data)}
              onUpdateEmployee={(data) => update("employees", data.id, data)}
              onDeleteEmployee={(id) => remove("employees", id)}
            />
          )}
          {currentTab === "leaves" && (
            <LeavesView
              employees={employees}
              leaveRequests={leaves}
              attendanceLogs={attendance}
              leaveTypes={company.leaveTypes}
              canApprove={staff}
              currentEmployeeId={user.employeeId}
              onApplyLeave={(data) => create("leaves", data)}
              onApproveLeave={(id) =>
                update("leaves", id, { status: "Approved" })
              }
              onRejectLeave={(id) =>
                update("leaves", id, { status: "Rejected" })
              }
            />
          )}
          {currentTab === "payroll" && (
            <SuiteView
              key="payroll"
              user={user}
              workspace={workspace}
              onRefresh={refresh}
              initialSection="payroll"
            />
          )}
          {currentTab === "operations" && (
            <SuiteView
              key="operations"
              user={user}
              workspace={workspace}
              onRefresh={refresh}
            />
          )}
          {currentTab === "documents" && (
            <DocsView
              employees={employees}
              documents={documents}
              companyName={company.name}
              readOnly={!staff}
              onAddDocument={(data) => mutate("/documents", "POST", data)}
              onDeleteDocument={(id) => remove("documents", id)}
            />
          )}
          {currentTab === "idcard" && (
            <IDCardView employees={employees} companyName={company.name} />
          )}
          {currentTab === "recruitment" && (
            <RecruitmentView
              jobOpenings={jobs}
              candidates={candidates}
              departments={company.departments}
              onAddJobOpening={(data) => create("jobs", data)}
              onAddCandidate={(data) => create("candidates", data)}
              onUpdateCandidateStage={(id, stage) =>
                update("candidates", id, { stage })
              }
              onEvaluateCandidateAI={(id) =>
                mutate("/ai/evaluate", "POST", { candidateId: id })
              }
            />
          )}
          {currentTab === "performance" && (
            <PerformanceView
              appraisals={appraisals}
              employees={employees}
              currentUserName={user.name}
              onAddAppraisal={(data) => create("appraisals", data)}
              onApproveAppraisal={(id) =>
                update("appraisals", id, { status: "Approved" })
              }
            />
          )}
          {currentTab === "assets" && (
            <AssetsView
              assets={assets}
              employees={employees}
              onAddAsset={(data) => create("assets", data)}
              onUpdateAssetStatus={(id, status, assignedToId) =>
                update("assets", id, { status, assignedToId })
              }
              onDeleteAsset={(id) => remove("assets", id)}
            />
          )}
          {currentTab === "orgchart" && <OrgChartView employees={employees} />}
          {currentTab === "emailhub" && (
            <EmailHubView
              employees={employees}
              emailLogs={emailLogs}
              mailConfigured={workspace.mailConfigured}
              onSend={(data) => mutate("/email/send", "POST", data)}
            />
          )}
        </fieldset>
      </Suspense>
      {currentTab === "settings" && (
        <SettingsView
          company={company}
          user={user}
          employees={employees}
          onRefresh={refresh}
        />
      )}
    </WorkspaceShell>
  );
}
