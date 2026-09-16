import React, { useState } from "react";
import {
  Users,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  IndianRupee,
  X,
  Edit2,
  Trash2,
  Check,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { Employee } from "../../types";
import { PersonAvatar } from "../PersonAvatar";

interface EmployeesViewProps {
  suiteSettings?: any;
  companyDepartments: string[];
  employees: Employee[];
  onAddEmployee: (emp: Omit<Employee, "id">) => Promise<boolean>;
  onUpdateEmployee: (emp: Employee) => Promise<boolean>;
  onDeleteEmployee: (id: string) => Promise<boolean>;
}

export default function EmployeesView({
  employees,
  companyDepartments,
  suiteSettings,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
}: EmployeesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Modals / Form toggles
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState(companyDepartments[0]);
  const [status, setStatus] = useState<Employee["status"]>("Active");
  const [saveError, setSaveError] = useState("");
  const [contact, setContact] = useState("");
  const [hireDate, setHireDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [avatar, setAvatar] = useState("");
  const [basic, setBasic] = useState(5000);
  const [hra, setHra] = useState(2000);
  const [allowances, setAllowances] = useState(1000);
  const [deductions, setDeductions] = useState(500);
  const [extras, setExtras] = useState<any>({});

  // Unique departments for filter
  const departments = [
    "All",
    ...Array.from(new Set(employees.map((e) => e.department))),
  ];

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept =
      selectedDept === "All" || emp.department === selectedDept;
    return (
      matchesSearch &&
      matchesDept &&
      (selectedStatus === "All" || emp.status === selectedStatus)
    );
  });

  const handleOpenAdd = () => {
    setExtras({
      workerType: suiteSettings?.workerTypes?.[0] || "Permanent",
      payBasis: "Monthly",
      payRate: 0,
      customFields: {},
    });
    setName("");
    setEmail("");
    setRole("");
    setDepartment(companyDepartments[0]);
    setStatus("Active");
    setSaveError("");
    setContact("");
    setHireDate(new Date().toISOString().split("T")[0]);
    setAvatar("");
    setBasic(0);
    setHra(0);
    setAllowances(0);
    setDeductions(0);
    setIsEditing(false);
    setShowAddForm(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setExtras(emp);
    setName(emp.name);
    setEmail(emp.email);
    setRole(emp.role);
    setDepartment(emp.department);
    setStatus(emp.status);
    setSaveError("");
    setContact(emp.contact);
    setHireDate(emp.hireDate);
    setAvatar(emp.avatar);
    setBasic(emp.salary.basic);
    setHra(emp.salary.hra);
    setAllowances(emp.salary.allowances);
    setDeductions(emp.salary.deductions);
    setIsEditing(true);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...extras,
      name,
      email,
      role,
      department,
      status,
      contact,
      hireDate,
      avatar,
      salary: { basic, hra, allowances, deductions },
    };

    if (isEditing && selectedEmp) {
      const saved = await onUpdateEmployee({
        ...payload,
        id: selectedEmp.id,
        version: selectedEmp.version,
      });
      if (!saved) {
        setSaveError(
          "Could not save. Check the message above. Reopen this form if the record has changed.",
        );
        return;
      }
      setSelectedEmp(null);
    } else {
      if (!(await onAddEmployee(payload))) {
        setSaveError("Could not save. Check the message above and try again.");
        return;
      }
    }
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* If an employee is selected, render their full detail card */}
      {selectedEmp ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEmp(null)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-950 flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Directory</span>
            </button>
            <span className="text-slate-400 font-mono text-xs">
              / {selectedEmp.name}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Basic Details */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center space-y-4">
              <div className="profile-avatar">
                <PersonAvatar
                  name={selectedEmp.name}
                  src={selectedEmp.avatar}
                  large
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedEmp.name}
                </h3>
                <span className="text-xs text-slate-500 font-medium font-mono block mt-0.5 break-all">
                  {selectedEmp.id}
                </span>
                <span className="text-slate-500 text-xs font-semibold block mt-1">
                  {selectedEmp.role}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono mt-0.5">
                  {selectedEmp.department}
                </span>
              </div>

              <div className="flex justify-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    selectedEmp.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {selectedEmp.status}
                </span>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 text-left space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {selectedEmp.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {selectedEmp.contact}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">
                    Hired on {selectedEmp.hireDate}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => handleOpenEdit(selectedEmp)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={async () => {
                    if (confirm("Confirm deletion of employee record?")) {
                      if (await onDeleteEmployee(selectedEmp.id))
                        setSelectedEmp(null);
                    }
                  }}
                  className="py-2 px-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 transition-all text-xs flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: Financial Structure & Analytics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Salary Structure Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-none">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-purple-400" />
                    Salary and Compensations Breakdown
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Monthly INR
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Basic Pay", val: selectedEmp.salary.basic },
                    {
                      label: "House Rent Allowance (HRA)",
                      val: selectedEmp.salary.hra,
                    },
                    {
                      label: "Special Allowances",
                      val: selectedEmp.salary.allowances,
                    },
                    {
                      label: "Professional Deductions",
                      val: selectedEmp.salary.deductions,
                      isDeduction: true,
                    },
                  ].map((sal, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/20 border border-slate-200 dark:border-slate-800/40 p-3 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                          {sal.label}
                        </span>
                        <span
                          className={`text-base font-black font-mono tracking-tight ${sal.isDeduction ? "text-rose-400" : "text-slate-900 dark:text-white"}`}
                        >
                          {sal.isDeduction ? "-" : ""}₹
                          {sal.val.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-purple-950/10 border border-purple-500/20 p-4 rounded-xl mt-6 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
                      Net Take-Home Salary
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Calculated sum after standard deductions
                    </span>
                  </div>
                  <span className="text-2xl font-black font-mono text-purple-400">
                    ₹
                    {(
                      selectedEmp.salary.basic +
                      selectedEmp.salary.hra +
                      selectedEmp.salary.allowances -
                      selectedEmp.salary.deductions
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Onboarding Checklist Status */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-none">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
                  Onboarding Milestones
                </h4>
                <div className="space-y-3">
                  {[
                    { milestone: "Signed Employment Contract", done: false },
                    {
                      milestone: "Provision Company Laptop & Gear",
                      done: false,
                    },
                    { milestone: "HR Welcome Onboarding Sync", done: false },
                    { milestone: "Generate Identity Card", done: false },
                  ].map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-600 dark:text-slate-300">
                        {m.milestone}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                          m.done
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                        }`}
                      >
                        Not tracked yet
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="directory-page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR PEOPLE</p>
              <h1>Employee directory</h1>
              <p>Know your team. Keep every detail in the right place.</p>
            </div>
            <button onClick={handleOpenAdd} className="account-primary">
              <Plus size={17} />
              Add employee
            </button>
          </div>
          <div className="directory-summary">
            <span>
              <strong>{employees.length}</strong> team members
            </span>
            <span>
              <i className="small-dot" />
              <strong>
                {
                  employees.filter((employee) => employee.status === "Active")
                    .length
                }
              </strong>{" "}
              active
            </span>
            <span>
              <strong>{departments.length - 1}</strong> departments
            </span>
          </div>
          <section className="ui-panel directory-panel">
            <div className="directory-toolbar">
              <label className="directory-search">
                <Search size={18} />
                <input
                  aria-label="Search employees"
                  placeholder="Search by name, role or ID…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <div className="directory-filters">
                <select
                  aria-label="Filter by department"
                  value={selectedDept}
                  onChange={(event) => setSelectedDept(event.target.value)}
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "All" ? "All departments" : dept}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by status"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  {["All", "Active", "On Leave", "Suspended", "Terminated"].map(
                    (status) => (
                      <option key={status} value={status}>
                        {status === "All" ? "All statuses" : status}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="directory-table-scroll">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th className="joined-column">Joined</th>
                    <th>
                      <span className="sr-only">View profile</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <button
                          className="directory-person"
                          onClick={() => setSelectedEmp(emp)}
                        >
                          <PersonAvatar name={emp.name} src={emp.avatar} />
                          <span>
                            <strong>{emp.name}</strong>
                            <small>{emp.role}</small>
                          </span>
                        </button>
                      </td>
                      <td>{emp.department}</td>
                      <td>
                        <span
                          className={
                            emp.status === "Active"
                              ? "status-tag status-active"
                              : "status-tag status-pending"
                          }
                        >
                          <i />
                          {emp.status}
                        </span>
                      </td>
                      <td className="joined-column">
                        {new Date(
                          emp.hireDate + "T12:00:00",
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={"View profile for " + emp.name}
                          onClick={() => setSelectedEmp(emp)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredEmployees.length && (
              <div className="composed-empty">
                <Users size={28} />
                <h3>
                  {employees.length
                    ? "No matching people."
                    : "Your team starts here."}
                </h3>
                <p>
                  {employees.length
                    ? "Try a different name or clear your filters."
                    : "Add an employee to build your team directory."}
                </p>
                <button
                  className="text-action"
                  onClick={() => {
                    if (!employees.length) handleOpenAdd();
                    else {
                      setSearchTerm("");
                      setSelectedDept("All");
                      setSelectedStatus("All");
                    }
                  }}
                >
                  {employees.length
                    ? "Clear filters"
                    : "Add your first employee"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <div className="directory-table-footer" aria-live="polite">
              Showing {filteredEmployees.length} of {employees.length} people
              <span>Choose a person to view their full profile</span>
            </div>
          </section>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEditing ? "Modify Employee Record" : "Onboard New Employee"}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {saveError && (
                <p role="alert" className="text-sm text-red-600">
                  {saveError}
                </p>
              )}
              <label className="account-field">
                Employment status
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Employee["status"])
                  }
                >
                  {["Active", "On Leave", "Suspended", "Terminated"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    placeholder="jdoe@hrstudio.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Designation Role
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    placeholder="Senior Engineer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  >
                    {companyDepartments.map((dept) => (
                      <option key={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    placeholder="+1 (555) 012-3456"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    required
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                  Profile Image URL
                </label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-4">
                <label className="text-xs space-y-1">
                  Worker category
                  <select
                    className="account-input"
                    value={extras.workerType || "Permanent"}
                    onChange={(e) =>
                      setExtras({ ...extras, workerType: e.target.value })
                    }
                  >
                    {(suiteSettings?.workerTypes || ["Permanent"]).map(
                      (type: string) => (
                        <option key={type}>{type}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-xs space-y-1">
                  Reporting manager
                  <select
                    className="account-input"
                    value={extras.managerId || ""}
                    onChange={(e) =>
                      setExtras({ ...extras, managerId: e.target.value })
                    }
                  >
                    <option value="">No manager</option>
                    {employees
                      .filter((emp) => emp.id !== extras.id)
                      .map((emp) => (
                        <option value={emp.id} key={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs space-y-1">
                  Pay basis
                  <select
                    className="account-input"
                    value={extras.payBasis || "Monthly"}
                    onChange={(e) =>
                      setExtras({ ...extras, payBasis: e.target.value })
                    }
                  >
                    {["Monthly", "Daily", "Hourly"].map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs space-y-1">
                  Daily / hourly rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="account-input"
                    value={extras.payRate || 0}
                    onChange={(e) =>
                      setExtras({ ...extras, payRate: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-xs space-y-1">
                  Contract / last working date
                  <input
                    type="date"
                    className="account-input"
                    required={status === "Terminated"}
                    value={extras.endDate || ""}
                    onChange={(e) =>
                      setExtras({ ...extras, endDate: e.target.value })
                    }
                  />
                </label>
                <label className="text-xs space-y-1">
                  Probation review date
                  <input
                    type="date"
                    className="account-input"
                    value={extras.probationEnd || ""}
                    onChange={(e) =>
                      setExtras({ ...extras, probationEnd: e.target.value })
                    }
                  />
                </label>
                {(suiteSettings?.customFields || []).map((field: any) => (
                  <label key={field.key} className="text-xs space-y-1">
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.type === "select" ? (
                      <select
                        className="account-input"
                        required={field.required}
                        value={extras.customFields?.[field.key] ?? ""}
                        onChange={(e) =>
                          setExtras({
                            ...extras,
                            customFields: {
                              ...extras.customFields,
                              [field.key]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Choose…</option>
                        {field.options.map((option: string) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="account-input"
                        type={field.type}
                        required={field.required}
                        value={extras.customFields?.[field.key] ?? ""}
                        onChange={(e) =>
                          setExtras({
                            ...extras,
                            customFields: {
                              ...extras.customFields,
                              [field.key]:
                                field.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              {/* Salary Configuration Block */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-purple-400" />
                  Configure Monthly Salary Bands (INR)
                </h4>

                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-slate-500 block">
                      Basic
                    </label>
                    <input
                      type="number"
                      value={basic}
                      onChange={(e) => setBasic(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-slate-500 block">
                      HRA
                    </label>
                    <input
                      type="number"
                      value={hra}
                      onChange={(e) => setHra(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-slate-500 block">
                      Allowances
                    </label>
                    <input
                      type="number"
                      value={allowances}
                      onChange={(e) => setAllowances(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-slate-500 block">
                      Deductions
                    </label>
                    <input
                      type="number"
                      value={deductions}
                      onChange={(e) => setDeductions(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all shadow-md shadow-purple-500/10"
                >
                  {isEditing ? "Save Changes" : "Confirm Onboard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
