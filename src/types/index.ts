export type UserRole = 'member' | 'manager' | 'admin';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  memberId?: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  lastLogin?: string;
}

export interface Member {
  memberId: string;
  employeeNumber: string;
  fullName: string;
  phone: string;
  email: string;
  dateJoined: string;
  status: 'active' | 'exited' | 'suspended';
  currentSharesBalance: number;
  totalSharesContributed: number;
  loanLimit: number;
}

export interface ShareTransaction {
  transactionId: string;
  memberId: string;
  date: string;
  type: 'contribution' | 'withdrawal' | 'dividend';
  amount: number;
  source: string;
  monthYear: string;
  processedBy: string;
}

export type LoanStatus = 
  | 'pending_biodata'
  | 'pending_guarantors'
  | 'pending_manager'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'completed';

export interface Guarantor {
  guarantorId: string;
  name: string;
  employeeNumber: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Loan {
  loanId: string;
  memberId: string;
  applicationDate: string;
  requestedAmount: number;
  approvedAmount?: number;
  interestRate: number;
  tenureMonths: number;
  status: LoanStatus;
  outstandingBalance: number;
  nextDueDate?: string;
  approvedBy?: string;
  rejectionReason?: string;
  purpose: string;
  guarantors: Guarantor[];
  phase: 1 | 2 | 3; // Phase 1: BioData/Contract, Phase 2: Guarantors (4 required), Phase 3: Manager Approval
}

export interface Deduction {
  deductionId: string;
  memberId: string;
  monthYear: string;
  sharesAmount: number;
  principalAmount: number;
  interestAmount: number;
  totalDeducted: number;
  source: 'payroll' | 'manual';
  uploadedBy: string;
  createdAt: string;
}

export interface AgmNotice {
  noticeId: string;
  title: string;
  agmDate: string;
  venue: string;
  agenda: string[];
  attachments?: string[];
  publishedBy: string;
  publishedAt: string;
  status: 'published' | 'draft';
}

export interface Report {
  reportId: string;
  type: 'monthly' | 'quarterly' | 'yearly';
  period: string;
  generatedBy: string;
  fileUrl?: string;
  createdAt: string;
  summary: {
    totalContributions: number;
    loansDisbursed: number;
    loanRecoveries: number;
    outstandingBalances: number;
    memberCount: number;
  };
}

export interface AuditLog {
  logId: string;
  userId: string;
  action: string;
  collection: string;
  documentId: string;
  timestamp: string;
  details?: string;
}

export interface SystemSettings {
  minSharesRequirement: number;
  defaultLoanInterestRate: number; // e.g. 12% per annum
  maxGuarantorsRequired: number; // default 4
  maxGuaranteesAllowedPerMember: number; // default 3
  financialYear: string;
  hospitalName: string;
}
