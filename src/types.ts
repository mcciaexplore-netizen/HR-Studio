export interface Versioned {
  version?: number;
}
export interface Employee extends Versioned {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  department: string;
  status: "Active" | "On Leave" | "Suspended" | "Terminated";
  contact: string;
  hireDate: string;
  salary: {
    basic: number;
    hra: number;
    allowances: number;
    deductions: number;
  };
}

export interface LeaveRequest extends Versioned {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  days: number;
}

export interface AttendanceLog extends Versioned {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  status: "Present" | "Absent" | "On Leave" | "Late";
}

export interface EmployeeDocument extends Versioned {
  expiryDate?: string;
  signature?: {
    provider: string;
    reference: string;
    signedAt: string;
    status: string;
  };
  mimeType?: string;
  contentBase64?: string;
  id: string;
  employeeId: string;
  name: string;
  category: "Contract" | "ID Proof" | "Certificate" | "Other";
  uploadDate: string;
  size: string;
}

export interface GeneratedDoc {
  id: string;
  type: "Offer Letter" | "Appointment Letter" | "LOR" | "Experience Letter";
  employeeName: string;
  details: Record<string, string>;
  content: string;
  dateGenerated: string;
}

export interface JobOpening extends Versioned {
  id: string;
  title: string;
  department: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract" | "Remote";
  status: "Active" | "Closed";
  applicantsCount: number;
}

export interface Candidate extends Versioned {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobId: string;
  jobTitle: string;
  stage: "Applied" | "Interview" | "Offered" | "Rejected";
  resumeText?: string;
  aiScore?: number;
  aiEvaluation?: string;
  appliedDate: string;
}

export interface Asset extends Versioned {
  id: string;
  name: string;
  serialNumber: string;
  category: "Laptop" | "Monitor" | "Mobile" | "Other";
  status: "Assigned" | "Available" | "Maintenance";
  assignedToId?: string;
  assignedToName?: string;
  purchaseDate: string;
}

export interface Appraisal extends Versioned {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerName: string;
  period: string;
  goalsSet: string;
  selfRating: number;
  managerRating: number;
  feedback: string;
  status: "Draft" | "Submitted" | "Approved";
  date: string;
}

export interface HRNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: "leave" | "payroll" | "document" | "general" | "recruitment";
  read: boolean;
}

export interface EmailCampaign {
  id: string;
  name: string;
  triggerType: "Birthday" | "Anniversary" | "Payslip" | "Welcome";
  subject: string;
  templateBody: string;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface EmailLog extends Versioned {
  id: string;
  employeeId: string;
  employeeName: string;
  recipientEmail: string;
  campaignType: "Birthday" | "Work Anniversary" | "Payslip" | "General Notice";
  subject: string;
  body: string;
  status: "Queued" | "Accepted" | "Failed";
  previewUrl?: string;
  timestamp: string;
}

export interface SessionUser {
  demo?: boolean;
  id: string;
  orgId: string;
  name: string;
  email: string;
  accessRole: "owner" | "hr" | "employee";
  employeeId: string | null;
  mustChangePassword: boolean;
}
export interface CompanySettings {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  departments: string[];
  leaveTypes: string[];
  version: number;
  suite?: any;
}
export interface WorkspaceState {
  user: SessionUser;
  company: CompanySettings;
  mailConfigured: boolean;
  employees: Employee[];
  leaves: LeaveRequest[];
  attendance: AttendanceLog[];
  documents: EmployeeDocument[];
  jobs: JobOpening[];
  candidates: Candidate[];
  assets: Asset[];
  appraisals: Appraisal[];
  emailLogs: EmailLog[];
}
