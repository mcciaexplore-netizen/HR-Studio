import {
  ArrowRight,
  ArrowUpRight,
  Users,
  CalendarDays,
  BriefcaseBusiness,
  Laptop,
  Clock3,
  Check,
  FileText,
  Wallet,
  CircleCheck,
} from "lucide-react";
import type {
  Employee,
  LeaveRequest,
  JobOpening,
  Asset,
  AttendanceLog,
} from "../../types";
import { PersonAvatar } from "../PersonAvatar";
interface DashboardViewProps {
  canClock: boolean;
  staff: boolean;
  employees: Employee[];
  attendance: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  jobOpenings: JobOpening[];
  assets: Asset[];
  currentUserName?: string;
  timezone: string;
  availableSections: string[];
  onNavigate: (tab: string) => void;
  onQuickCheckIn: () => void;
  isCheckedIn: boolean;
  checkInTime: string | null;
}
export default function DashboardView({
  employees,
  attendance,
  canClock,
  staff,
  leaveRequests,
  jobOpenings,
  assets,
  currentUserName,
  timezone,
  availableSections,
  onNavigate,
  onQuickCheckIn,
  isCheckedIn,
  checkInTime,
}: DashboardViewProps) {
  const now = new Date(),
    today = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const hour = Number(
    now.toLocaleTimeString("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName =
    currentUserName
      ?.replace(/\(Demo\)/g, "")
      .trim()
      .split(" ")[0] || "there";
  const pending = leaveRequests.filter(
    (request) => request.status === "Pending",
  );
  const active = employees.filter(
    (employee) => employee.status === "Active",
  ).length;
  const assigned = assets.filter((asset) => asset.status === "Assigned").length;
  const attendanceDays = new Set(
    attendance
      .filter((log) => log.date.startsWith(today.slice(0, 7)))
      .map((log) => log.date),
  ).size;
  const metrics = staff
    ? [
        {
          label: "Total employees",
          value: employees.length,
          detail: `${active} active in your workspace`,
          icon: Users,
          tab: "employees",
        },
        {
          label: "Leave requests",
          value: pending.length,
          detail: "Pending review",
          icon: CalendarDays,
          tab: "leaves",
        },
        {
          label: "Open positions",
          value: jobOpenings.filter((job) => job.status === "Active").length,
          detail: "Currently accepting applicants",
          icon: BriefcaseBusiness,
          tab: "recruitment",
        },
        {
          label: "Assets assigned",
          value: assigned,
          detail: `Of ${assets.length} registered assets`,
          icon: Laptop,
          tab: "assets",
        },
      ]
    : [
        {
          label: "Attendance days",
          value: attendanceDays,
          detail: "Recorded this month",
          icon: Clock3,
          tab: "leaves",
        },
        {
          label: "Pending leave",
          value: pending.length,
          detail: "Waiting for a decision",
          icon: CalendarDays,
          tab: "leaves",
        },
        {
          label: "Approved requests",
          value: leaveRequests.filter(
            (request) => request.status === "Approved",
          ).length,
          detail: "Across your leave records",
          icon: CircleCheck,
          tab: "leaves",
        },
        {
          label: "Your equipment",
          value: assigned,
          detail: "Assets assigned to you",
          icon: Laptop,
          tab: "dashboard",
        },
      ];
  const departments = Object.entries(
    employees.reduce<Record<string, number>>((map, employee) => {
      map[employee.department] = (map[employee.department] || 0) + 1;
      return map;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const dateLabel = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  const quickActions = [
    {
      title: "Manage employees",
      description: "People and profiles",
      icon: Users,
      tab: "employees",
    },
    {
      title: "Leave & attendance",
      description: "Time, requests and records",
      icon: CalendarDays,
      tab: "leaves",
    },
    {
      title: "Payroll & payslips",
      description: "Pay periods and statements",
      icon: Wallet,
      tab: "payroll",
    },
    {
      title: "Documents",
      description: "Your team's important files",
      icon: FileText,
      tab: "documents",
    },
  ].filter((action) => availableSections.includes(action.tab));
  return (
    <div className="overview-page">
      <section className="page-heading overview-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE, AT A GLANCE</p>
          <h1>
            {greeting}, {firstName}.
          </h1>
          <p>
            {staff
              ? "A clear view of your people and what needs attention."
              : "Your working day, requests and records, all in one place."}
          </p>
        </div>
        <div className="date-label">
          <CalendarDays size={17} />
          <span>
            {now.toLocaleDateString("en-IN", {
              timeZone: timezone,
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </section>
      <section className="metric-grid" aria-label="Workspace summary">
        {metrics
          .filter((metric) => availableSections.includes(metric.tab))
          .map((metric) => {
            const Tag = metric.tab === "dashboard" ? "article" : "button";
            return (
              <Tag
                className="metric-card"
                key={metric.label}
                onClick={
                  metric.tab === "dashboard"
                    ? undefined
                    : () => onNavigate(metric.tab)
                }
              >
                <span className="metric-top">
                  <span>{metric.label}</span>
                  <metric.icon size={18} />
                </span>
                <strong>{metric.value.toString().padStart(2, "0")}</strong>
                <span className="metric-bottom">
                  <span>{metric.detail}</span>
                  {metric.tab !== "dashboard" && <ArrowUpRight size={16} />}
                </span>
              </Tag>
            );
          })}
      </section>
      <div className="overview-grid">
        <section className="ui-panel requests-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {staff ? "NEEDS ATTENTION" : "YOUR REQUESTS"}
              </p>
              <h2>
                {staff ? "Pending leave requests" : "Waiting for approval"}
                <span className="count-badge">{pending.length}</span>
              </h2>
            </div>
            {availableSections.includes("leaves") && (
              <button
                className="text-action"
                onClick={() => onNavigate("leaves")}
              >
                View all <ArrowRight size={15} />
              </button>
            )}
          </div>
          {pending.length ? (
            <div className="request-list">
              {pending.slice(0, 4).map((request) => (
                <div className="request-row" key={request.id}>
                  <PersonAvatar name={request.employeeName} />
                  <div className="request-person">
                    <strong>{request.employeeName}</strong>
                    <span>
                      {request.leaveType} · {dateLabel(request.startDate)}
                      {request.startDate !== request.endDate
                        ? ` – ${dateLabel(request.endDate)}`
                        : ""}
                    </span>
                  </div>
                  <span className="status-tag status-pending">Pending</span>
                  <button
                    className="icon-button"
                    aria-label={`Review leave for ${request.employeeName}`}
                    onClick={() => onNavigate("leaves")}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="composed-empty">
              <span className="empty-icon">
                <Check size={24} />
              </span>
              <h3>You're all caught up.</h3>
              <p>
                {staff
                  ? "New leave requests will appear here when your team submits them."
                  : "You have no leave requests waiting for a decision."}
              </p>
            </div>
          )}
          <div className="panel-note">
            <span className="small-dot" />
            Records update as requests are submitted and reviewed.
          </div>
        </section>
        <section className="ui-panel distribution-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {staff ? "TEAM STRUCTURE" : "YOUR TEAM"}
              </p>
              <h2>{staff ? "Across departments" : "Your department"}</h2>
            </div>
            <Users size={19} />
          </div>
          <div className="department-total">
            <strong>{employees.length}</strong>
            <span>
              {staff
                ? `people across ${departments.length} departments`
                : "personal employee profile"}
            </span>
          </div>
          <div className="department-bars">
            {departments.map(([name, count], index) => (
              <div className="department-bar" key={name}>
                <div>
                  <span>{name}</span>
                  <strong>{count.toString().padStart(2, "0")}</strong>
                </div>
                <div className="bar-track">
                  <span
                    className={
                      index === 0 ? "bar-fill bar-fill-green" : "bar-fill"
                    }
                    style={{
                      width: `${(count / Math.max(employees.length, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!employees.length && (
            <p className="empty-copy">
              Add your first employee to see your team here.
            </p>
          )}
        </section>
        <section className="ui-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {staff ? "PEOPLE & PROFILES" : "YOUR WORKING WEEK"}
              </p>
              <h2>{staff ? "People at a glance" : "Recent attendance"}</h2>
            </div>
            {staff && availableSections.includes("employees") && (
              <button
                className="text-action"
                onClick={() => onNavigate("employees")}
              >
                Directory <ArrowRight size={15} />
              </button>
            )}
          </div>
          {staff ? (
            <div className="people-list">
              {[...employees]
                .sort((a, b) => b.hireDate.localeCompare(a.hireDate))
                .slice(0, 4)
                .map((employee) => (
                  <div className="person-row" key={employee.id}>
                    <PersonAvatar name={employee.name} src={employee.avatar} />
                    <div>
                      <strong>{employee.name}</strong>
                      <span>{employee.role}</span>
                    </div>
                    <span className="person-department">
                      {employee.department}
                    </span>
                  </div>
                ))}
              {!employees.length && (
                <div className="composed-empty">
                  <Users size={25} />
                  <h3>Make room for your team.</h3>
                  <p>Your employee directory starts with one profile.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="people-list">
              {[...attendance]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((log) => (
                  <div className="attendance-row" key={log.id}>
                    <span>
                      <CalendarDays size={16} />
                      {dateLabel(log.date)}
                    </span>
                    <strong>
                      {log.checkIn} — {log.checkOut || "In progress"}
                    </strong>
                    <span className="status-tag status-active">
                      {log.status}
                    </span>
                  </div>
                ))}
              {!attendance.length && (
                <p className="empty-copy">
                  Clock in to start your attendance record.
                </p>
              )}
            </div>
          )}
        </section>
        <section className="working-day">
          <div className="working-day-top">
            <span className="working-day-icon">
              <Clock3 size={24} />
            </span>
            <span
              className={`status-tag ${isCheckedIn ? "status-active" : "status-neutral"}`}
            >
              {isCheckedIn ? "Clocked in" : "Clocked out"}
            </span>
          </div>
          <div>
            <p className="eyebrow">YOUR ATTENDANCE</p>
            <h2>
              {isCheckedIn ? "Your day is underway." : "Ready for a good day?"}
            </h2>
            <p>
              {isCheckedIn
                ? `You checked in at ${checkInTime}. Clock out when your working day is complete.`
                : canClock
                  ? "A little routine goes a long way. Record your check-in when you start work."
                  : "Link your employee profile in Settings to start recording your attendance."}
            </p>
          </div>
          <button
            className="account-primary"
            onClick={canClock ? onQuickCheckIn : () => onNavigate("settings")}
          >
            {canClock
              ? isCheckedIn
                ? "Clock out"
                : "Clock in"
              : "Open settings"}
            <ArrowRight size={17} />
          </button>
          <span className="working-day-zone">Times follow {timezone}</span>
        </section>
      </div>
      <section className="quick-access">
        <div className="section-title">
          <h2>A few useful shortcuts</h2>
          <span>Less searching. More getting things done.</span>
        </div>
        <div className="quick-access-grid">
          {quickActions.map((action) => (
            <button key={action.tab} onClick={() => onNavigate(action.tab)}>
              <span className="shortcut-icon">
                <action.icon size={19} />
              </span>
              <span>
                <strong>{action.title}</strong>
                <small>{action.description}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
