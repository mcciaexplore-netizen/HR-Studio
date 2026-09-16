import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  User,
  Coffee,
  Activity,
} from "lucide-react";
import { LeaveRequest, AttendanceLog, Employee } from "../../types";

interface LeavesViewProps {
  leaveTypes: string[];
  canApprove: boolean;
  currentEmployeeId: string | null;
  leaveRequests: LeaveRequest[];
  attendanceLogs: AttendanceLog[];
  employees: Employee[];
  onApproveLeave: (id: string) => void;
  onRejectLeave: (id: string) => void;
  onApplyLeave: (req: Omit<LeaveRequest, "id">) => Promise<boolean>;
}

export default function LeavesView({
  leaveRequests,
  attendanceLogs,
  employees,
  leaveTypes,
  canApprove,
  currentEmployeeId,
  onApproveLeave,
  onRejectLeave,
  onApplyLeave,
}: LeavesViewProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "All" | "Pending" | "Approved" | "Rejected"
  >("All");

  // New leave request form states
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState(leaveTypes[0]);
  const [saveError, setSaveError] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000)
    .toISOString()
    .split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(tomorrowStr);
  const [reason, setReason] = useState("");

  const filteredRequests = leaveRequests.filter((req) => {
    if (filterStatus === "All") return true;
    return req.status === filterStatus;
  });

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    const emp = employees.find((x) => x.id === employeeId);
    if (!emp) {
      setSaveError("Choose an employee before submitting your request.");
      return;
    }

    // Calculate days duration simple diff
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) {
      setSaveError("End date must be on or after start date.");
      return;
    }
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const saved = await onApplyLeave({
      employeeId,
      employeeName: emp.name,
      leaveType,
      startDate,
      endDate,
      reason,
      status: "Pending",
      days: diffDays,
    });
    if (!saved) {
      setSaveError("Could not submit. Check the message above and try again.");
      return;
    }
    setShowApplyModal(false);
    setEmployeeId("");
    setReason("");
  };

  return (
    <div className="space-y-6">
      {/* Top action layout */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Leaves & Attendance Management
          </h2>
          <p className="text-xs text-slate-500">
            Request leave and view saved attendance. Your company policy
            determines chargeable days and balances. Open HR operations for
            balances, work schedules and your approval inbox.
          </p>
        </div>

        <button
          onClick={() => {
            if (employees.length > 0) {
              setEmployeeId(employees[0].id);
            }
            setShowApplyModal(true);
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Apply Leave Request</span>
        </button>
      </div>

      {/* Grid: Left Column (Leave Requests), Right Column (Today's Logs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Requests Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800/60">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Applied Leave Records
            </h3>

            {/* Filter buttons */}
            <div className="flex gap-1.5 bg-slate-950/20 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              {(["All", "Pending", "Approved", "Rejected"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                      filterStatus === status
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {status}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm dark:shadow-none"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {req.employeeName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({req.employeeId})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                    <span className="font-semibold text-purple-400">
                      {req.leaveType}
                    </span>
                    <span>•</span>
                    <span>
                      {req.startDate} to {req.endDate} ({req.days} days)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-lg mt-1 italic">
                    "{req.reason}"
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      req.status === "Approved"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : req.status === "Rejected"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                    }`}
                  >
                    {req.status}
                  </span>

                  {req.status === "Pending" &&
                    canApprove &&
                    req.employeeId !== currentEmployeeId && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onApproveLeave(req.id)}
                          className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-all"
                          title="Approve Leave"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRejectLeave(req.id)}
                          className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 transition-all"
                          title="Reject Leave"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {filteredRequests.length === 0 && (
              <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                <Coffee className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                <span className="text-xs text-slate-500">
                  No matching leave requests found
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Today's Attendance Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-none self-start">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-400" />
              Attendance logs
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Today</span>
          </div>

          <div className="space-y-3">
            {attendanceLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950/20 border border-slate-200 dark:border-slate-800/40 flex justify-between items-center"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    {log.employeeName}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-purple-400" />
                    Check-in: {log.checkIn}{" "}
                    {log.checkOut ? `• Out: ${log.checkOut}` : "• Active"}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                    log.status === "Present"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : log.status === "Late"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-slate-800/40 text-slate-400 border border-slate-700/40"
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply Leave Modal Form */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Apply for Leave Request
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-4">
              {saveError && (
                <p role="alert" className="text-sm text-red-600">
                  {saveError}
                </p>
              )}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                  Select Employee
                </label>
                <select
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                  Leave Category
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                >
                  {leaveTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                    From Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                    To Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">
                  Reason / Details
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for requesting leave..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all shadow-md"
                >
                  Apply Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
