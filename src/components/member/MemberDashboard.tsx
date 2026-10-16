import { useState, useEffect } from 'react';
import { 
  Wallet, CreditCard, FileText, Calendar, User, PlusCircle, CheckCircle2, 
  Clock, AlertCircle, Download, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { User as UserType, Member, Loan, Deduction, AgmNotice, ShareTransaction } from '../../types';
import { ActivityFeed } from './ActivityFeed';
import { OnboardingWizard } from './OnboardingWizard';

interface MemberDashboardProps {
  currentUser: UserType;
}

export function MemberDashboard({ currentUser }: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'shares' | 'loans' | 'statements' | 'agm' | 'profile'>('overview');
  const [memberRecord, setMemberRecord] = useState<Member | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [sharesTxs, setSharesTxs] = useState<ShareTransaction[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [agmNotices, setAgmNotices] = useState<AgmNotice[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Loan application modal state
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState(50000);
  const [purpose, setPurpose] = useState('');
  const [tenureMonths, setTenureMonths] = useState(12);
  const [selectedGuarantors, setSelectedGuarantors] = useState<string[]>([]);
  const [loanError, setLoanError] = useState('');

  // Profile update state
  const [phone, setPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchMemberData();
  }, [currentUser]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      // Find member record by email or memberId
      let memberData: Member | null = null;
      const memRef = collection(db, 'members');
      const q = query(memRef, where('email', '==', currentUser.email));
      const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'members'));

      if (snap && !snap.empty) {
        memberData = snap.docs[0].data() as Member;
      } else if (currentUser.memberId) {
        const docSnap = await getDoc(doc(db, 'members', currentUser.memberId));
        if (docSnap.exists()) {
          memberData = docSnap.data() as Member;
        }
      }

      if (memberData) {
        setMemberRecord(memberData);
        setPhone(memberData.phone);

        // Fetch loans
        const loanSnap = await getDocs(query(collection(db, 'loans'), where('memberId', '==', memberData.memberId)));
        setLoans(loanSnap.docs.map(d => d.data() as Loan));

        // Fetch deductions
        const dedSnap = await getDocs(query(collection(db, 'deductions'), where('memberId', '==', memberData.memberId)));
        setDeductions(dedSnap.docs.map(d => d.data() as Deduction));

        // Fetch shares transactions
        const txSnap = await getDocs(query(collection(db, 'sharesTransactions'), where('memberId', '==', memberData.memberId)));
        setSharesTxs(txSnap.docs.map(d => d.data() as ShareTransaction));
      }

      // Fetch AGM notices & all members for guarantors
      const agmSnap = await getDocs(collection(db, 'agmNotices'));
      setAgmNotices(agmSnap.docs.map(d => d.data() as AgmNotice));

      const allMemSnap = await getDocs(collection(db, 'members'));
      setAllMembers(allMemSnap.docs.map(d => d.data() as Member));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError('');

    if (!memberRecord) return;
    if (requestedAmount > memberRecord.loanLimit) {
      setLoanError(`Requested amount (Ksh ${requestedAmount.toLocaleString()}) exceeds your maximum loan limit of Ksh ${memberRecord.loanLimit.toLocaleString()} (3x shares).`);
      return;
    }
    if (selectedGuarantors.length !== 4) {
      setLoanError('Exactly 4 guarantors are required for loan processing.');
      return;
    }

    try {
      const loanId = 'loan_' + Math.random().toString(36).substring(2, 9);
      const guarantorsList = selectedGuarantors.map(gId => {
        const gm = allMembers.find(m => m.memberId === gId);
        return {
          guarantorId: gId,
          name: gm?.fullName || 'Colleague',
          employeeNumber: gm?.employeeNumber || 'EMP-Tum',
          status: 'accepted' as const, // auto-accepted for demo convenience
        };
      });

      const newLoan: Loan = {
        loanId,
        memberId: memberRecord.memberId,
        applicationDate: new Date().toISOString().split('T')[0],
        requestedAmount,
        interestRate: 12,
        tenureMonths,
        status: 'pending_manager',
        outstandingBalance: requestedAmount,
        purpose,
        guarantors: guarantorsList,
        phase: 3, // moving past bio & guarantors to manager
      };

      await addDoc(collection(db, 'loans'), newLoan);
      setShowLoanModal(false);
      setRequestedAmount(50000);
      setPurpose('');
      setSelectedGuarantors([]);
      fetchMemberData();
    } catch (err: any) {
      setLoanError(err.message || 'Failed to submit loan application.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberRecord) return;
    try {
      await updateDoc(doc(db, 'members', memberRecord.memberId), { phone });
      setSuccessMsg('Contact information updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading member portal...</div>;
  }

  const activeLoans = loans.filter(l => l.status === 'disbursed' || l.status === 'pending_manager');
  const lastDeduction = deductions[deductions.length - 1] || { sharesAmount: 2500, principalAmount: 5000, interestAmount: 1200, totalDeducted: 8700, monthYear: 'September 2026' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 bg-emerald-700/50 text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold w-fit mb-3">
            <ShieldCheck className="w-4 h-4" /> PCEA Tumutumu Hospital Staff Member
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back, {memberRecord?.fullName}</h1>
          <p className="text-emerald-200 text-sm mt-1">Employee No: <span className="font-semibold">{memberRecord?.employeeNumber}</span> | Urigiti Sacco Member ID: {memberRecord?.memberId}</p>
        </div>
        <div className="flex gap-3">
          {!(memberRecord as any)?.onboardingCompleted && (
            <button
              onClick={() => setShowOnboarding(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-sm animate-pulse"
            >
              Complete Onboarding
            </button>
          )}
          <button
            onClick={() => setShowLoanModal(true)}
            className="bg-white hover:bg-emerald-50 text-emerald-900 font-semibold px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-sm"
          >
            <PlusCircle className="w-5 h-5 text-emerald-600" /> Apply for Loan
          </button>
        </div>
      </div>

      {showOnboarding && memberRecord && (
        <OnboardingWizard
          member={memberRecord}
          onComplete={() => { setShowOnboarding(false); fetchMemberData(); }}
          onCancel={() => setShowOnboarding(false)}
        />
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shares Balance</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">Ksh {(memberRecord?.currentSharesBalance || 0).toLocaleString()}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Limit: Ksh {(memberRecord?.loanLimit || 0).toLocaleString()}</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Loans</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{activeLoans.length}</p>
            <p className="text-xs text-slate-500 mt-1">Total Outstanding: Ksh {activeLoans.reduce((acc, l) => acc + l.outstandingBalance, 0).toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Month Deductions</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">Ksh {lastDeduction.totalDeducted.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{lastDeduction.monthYear || 'September 2026'}</p>
          </div>
          <div className="bg-purple-50 text-purple-600 p-3 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AGM Notices</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{agmNotices.length}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Upcoming AGM Nov 2026</p>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Deductions' },
          { id: 'shares', label: 'Shares History' },
          { id: 'loans', label: 'Loan History' },
          { id: 'statements', label: 'Statements & Reports' },
          { id: 'agm', label: 'AGM Notices' },
          { id: 'profile', label: 'Profile & Contact' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Last Month’s Payroll Deduction Breakdown</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Shares Contribution</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">Ksh {lastDeduction.sharesAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Loan Principal</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">Ksh {lastDeduction.principalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Loan Interest</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">Ksh {lastDeduction.interestAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Total Deducted</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">Ksh {lastDeduction.totalDeducted.toLocaleString()}</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 pt-4">Active Loan Status</h3>
              {activeLoans.length === 0 ? (
                <p className="text-slate-500 text-sm">No active loans currently.</p>
              ) : (
                <div className="space-y-4">
                  {activeLoans.map(loan => (
                    <div key={loan.loanId} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">Ksh {loan.requestedAmount.toLocaleString()}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase">{loan.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Purpose: {loan.purpose} | Tenure: {loan.tenureMonths} months @ {loan.interestRate}% p.a.</p>
                        <p className="text-xs text-slate-600 mt-1">Outstanding Balance: <span className="font-semibold text-slate-900">Ksh {loan.outstandingBalance.toLocaleString()}</span></p>
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        <p>Applied: {loan.applicationDate}</p>
                        <p className="text-emerald-600 font-medium mt-1">Next Due: {loan.nextDueDate || '2026-11-05'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions / Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">SACCO Quick Info</h3>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>Date Joined</span>
                  <span className="font-semibold text-slate-900">{memberRecord?.dateJoined}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>Employee Number</span>
                  <span className="font-semibold text-slate-900">{memberRecord?.employeeNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>Maximum Loan Limit</span>
                  <span className="font-semibold text-emerald-600">Ksh {(memberRecord?.loanLimit || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>Guarantor Requirement</span>
                  <span className="font-semibold text-slate-900">4 Members</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-700" /> Loan Application Workflow</p>
                <p className="mt-1">1. BioData & Contract Check → 2. Guarantor Acceptance (4 members) → 3. Sacco Manager Approval & Disbursement.</p>
              </div>
            </div>
          </div>

          {/* Recent Transaction Activity Feed */}
          <div className="mt-6">
            <ActivityFeed memberId={memberRecord?.memberId || 'mem_001'} />
          </div>
        </>
      )}

      {activeTab === 'shares' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Shares Contribution History</h3>
            <span className="text-sm font-medium text-emerald-600">Current Balance: Ksh {(memberRecord?.currentSharesBalance || 0).toLocaleString()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="p-3">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Amount (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sharesTxs.length === 0 ? (
                  <>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3">2026-09-30</td>
                      <td className="p-3 font-medium text-emerald-600">Monthly Contribution</td>
                      <td className="p-3">Hospital Payroll Checkoff</td>
                      <td className="p-3">September 2026</td>
                      <td className="p-3 text-right font-bold text-slate-900">+5,000</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3">2026-08-31</td>
                      <td className="p-3 font-medium text-emerald-600">Monthly Contribution</td>
                      <td className="p-3">Hospital Payroll Checkoff</td>
                      <td className="p-3">August 2026</td>
                      <td className="p-3 text-right font-bold text-slate-900">+5,000</td>
                    </tr>
                  </>
                ) : (
                  sharesTxs.map(tx => (
                    <tr key={tx.transactionId} className="hover:bg-slate-50">
                      <td className="p-3">{tx.date}</td>
                      <td className="p-3 font-medium text-emerald-600 capitalize">{tx.type}</td>
                      <td className="p-3">{tx.source}</td>
                      <td className="p-3">{tx.monthYear}</td>
                      <td className="p-3 text-right font-bold text-slate-900">+{tx.amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Loan Applications & Repayment History</h3>
            <button
              onClick={() => setShowLoanModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> New Application
            </button>
          </div>
          <div className="space-y-4">
            {loans.map(loan => (
              <div key={loan.loanId} className="border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-900">Ksh {loan.requestedAmount.toLocaleString()}</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-semibold uppercase">{loan.status}</span>
                  </div>
                  <span className="text-xs text-slate-500">Applied on: {loan.applicationDate}</span>
                </div>
                <p className="text-sm text-slate-600"><span className="font-semibold">Purpose:</span> {loan.purpose}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-500">Tenure:</span> <span className="font-bold">{loan.tenureMonths} Months</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Interest Rate:</span> <span className="font-bold">{loan.interestRate}% p.a.</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Outstanding:</span> <span className="font-bold text-emerald-700">Ksh {loan.outstandingBalance.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Guarantors:</span> <span className="font-bold">{loan.guarantors?.length || 4} Members</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'statements' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Personal Account Statements</h3>
              <p className="text-xs text-slate-500 mt-1">Download official PCEA Tumutumu Hospital Urigiti Sacco certified financial statements.</p>
            </div>
            <button
              onClick={() => alert('Downloading official PDF statement...')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> Download PDF Statement
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <p className="font-bold text-slate-900">Urigiti Sacco Member Statement - 2026</p>
                <p className="text-xs text-slate-500">P.O. Box 11-10103, Mukurweini, Tumutumu</p>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">Official Certified</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Member Name:</p>
                <p className="font-bold text-slate-900">{memberRecord?.fullName}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Employee Number:</p>
                <p className="font-bold text-slate-900">{memberRecord?.employeeNumber}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Total Shares Contributed:</p>
                <p className="font-bold text-slate-900">Ksh {(memberRecord?.totalSharesContributed || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Current Outstanding Loans:</p>
                <p className="font-bold text-emerald-700">Ksh {activeLoans.reduce((acc, l) => acc + l.outstandingBalance, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agm' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Annual General Meeting (AGM) Notices & Documents</h3>
          <div className="space-y-4">
            {agmNotices.map(notice => (
              <div key={notice.noticeId} className="border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 text-base">{notice.title}</h4>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold">{notice.status}</span>
                </div>
                <p className="text-xs text-slate-500">Date: {new Date(notice.agmDate).toLocaleString()} | Venue: {notice.venue}</p>
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Meeting Agenda:</p>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {notice.agenda.map((ag, i) => (
                      <li key={i}>{ag}</li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 flex gap-3">
                  <button onClick={() => alert('Downloading AGM document pack...')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download Report Pack (PDF)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 max-w-xl space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Update Personal Contact Info</h3>
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs font-medium border border-emerald-200">
              {successMsg}
            </div>
          )}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name (Read-Only)</label>
              <input type="text" disabled value={memberRecord?.fullName || ''} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Employee Number (Read-Only)</label>
              <input type="text" disabled value={memberRecord?.employeeNumber || ''} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email (Read-Only)</label>
              <input type="text" disabled value={memberRecord?.email || ''} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Loan Application Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Apply for Sacco Loan</h3>
              <button onClick={() => setShowLoanModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {loanError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {loanError}
              </div>
            )}

            <form onSubmit={handleApplyLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Requested Amount (Ksh)</label>
                <input
                  type="number"
                  min="5000"
                  max={memberRecord?.loanLimit || 500000}
                  required
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum eligible limit: Ksh {(memberRecord?.loanLimit || 0).toLocaleString()} (3x shares)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Loan Purpose</label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. School Fees / Medical / Development"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Preferred Tenure (Months)</label>
                <select
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-sm"
                >
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
                  <option value={24}>24 Months</option>
                  <option value={36}>36 Months</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Select Exactly 4 Guarantors</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50">
                  {allMembers.filter(m => m.memberId !== memberRecord?.memberId).map(m => {
                    const isSelected = selectedGuarantors.includes(m.memberId);
                    return (
                      <div
                        key={m.memberId}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGuarantors(selectedGuarantors.filter(id => id !== m.memberId));
                          } else {
                            if (selectedGuarantors.length >= 4) {
                              alert('Maximum 4 guarantors allowed.');
                              return;
                            }
                            setSelectedGuarantors([...selectedGuarantors, m.memberId]);
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer flex justify-between items-center transition ${
                          isSelected ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <p>{m.fullName} ({m.employeeNumber})</p>
                          <p className="text-slate-400 font-normal">Shares: Ksh {m.currentSharesBalance.toLocaleString()}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-1">Selected: {selectedGuarantors.length} / 4</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
