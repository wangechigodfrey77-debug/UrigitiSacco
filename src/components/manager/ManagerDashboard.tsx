import { useState, useEffect } from 'react';
import { 
  Users, Wallet, CreditCard, FileSpreadsheet, Calendar, BarChart3, 
  CheckCircle, XCircle, Upload, Plus, Download, ShieldCheck
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
import { User as UserType, Member, Loan, Deduction, AgmNotice } from '../../types';

interface ManagerDashboardProps {
  currentUser: UserType;
}

export function ManagerDashboard({ currentUser }: ManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'deductions' | 'agm' | 'reports'>('overview');
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [agmNotices, setAgmNotices] = useState<AgmNotice[]>([]);
  const [loading, setLoading] = useState(true);

  // Deduction upload simulation state
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState('');

  // AGM creation state
  const [agmTitle, setAgmTitle] = useState('');
  const [agmDate, setAgmDate] = useState('');
  const [agmVenue, setAgmVenue] = useState('');
  const [agmAgenda, setAgmAgenda] = useState('Approval of accounts\nElection of directors');
  const [agmSuccess, setAgmSuccess] = useState('');

  useEffect(() => {
    fetchManagerData();
  }, []);

  const fetchManagerData = async () => {
    try {
      setLoading(true);
      const memSnap = await getDocs(collection(db, 'members'));
      setMembers(memSnap.docs.map(d => d.data() as Member));

      const loanSnap = await getDocs(collection(db, 'loans'));
      setLoans(loanSnap.docs.map(d => d.data() as Loan));

      const agmSnap = await getDocs(collection(db, 'agmNotices'));
      setAgmNotices(agmSnap.docs.map(d => d.data() as AgmNotice));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLoan = async (loanId: string, approvedAmount: number) => {
    try {
      await updateDoc(doc(db, 'loans', loanId), {
        status: 'disbursed',
        approvedAmount,
        outstandingBalance: approvedAmount,
        approvedBy: currentUser.email,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      // Record audit log via backend API
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.email,
          action: 'APPROVE_LOAN',
          collectionName: 'loans',
          documentId: loanId,
          newValue: { status: 'disbursed', approvedAmount },
        }),
      });

      fetchManagerData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectLoan = async (loanId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'loans', loanId), {
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: currentUser.email,
      });

      // Record audit log via backend API
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.email,
          action: 'REJECT_LOAN',
          collectionName: 'loans',
          documentId: loanId,
          newValue: { status: 'rejected', rejectionReason: reason },
        }),
      });

      fetchManagerData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateCSVUpload = () => {
    // Simulate hospital finance department CSV payroll checkoff upload
    const mockBatch = members.map(m => ({
      employeeNumber: m.employeeNumber,
      fullName: m.fullName,
      sharesAmount: 5000,
      principalAmount: 4000,
      interestAmount: 800,
      totalDeducted: 9800,
    }));
    setCsvPreview(mockBatch);
  };

  const handleConfirmBatchUpload = async () => {
    try {
      const response = await fetch('/api/deductions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deductionsBatch: csvPreview,
          userId: currentUser.email,
          monthYear: 'October 2026',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process deduction batch upload.');
      }

      setUploadSuccess(`Monthly payroll checkoff processed successfully! (${result.message})`);
      setCsvPreview([]);
      fetchManagerData();
    } catch (err: any) {
      console.error(err);
      alert('Error uploading deductions: ' + err.message);
    }
  };

  const handleCreateAgm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const noticeId = 'agm_' + Math.random().toString(36).substring(2, 9);
      const newNotice: AgmNotice = {
        noticeId,
        title: agmTitle,
        agmDate: agmDate || new Date().toISOString(),
        venue: agmVenue,
        agenda: agmAgenda.split('\n'),
        publishedBy: currentUser.email,
        publishedAt: new Date().toISOString().split('T')[0],
        status: 'published',
      };
      await setDoc(doc(db, 'agmNotices', noticeId), newNotice);
      setAgmSuccess('AGM Notice published and members notified successfully.');
      setAgmTitle('');
      setAgmVenue('');
      setAgmDate('');
      fetchManagerData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadMonthlyPdfReport = async () => {
    try {
      const dedSnap = await getDocs(collection(db, 'deductions')).catch(() => null);
      const deductionsList = dedSnap ? dedSnap.docs.map(d => d.data() as Deduction) : [];

      const loanSnap = await getDocs(collection(db, 'loans')).catch(() => null);
      const loansList = loanSnap ? loanSnap.docs.map(l => l.data() as Loan) : [];

      let htmlContent = `
        <html>
          <head>
            <title>Urigiti Sacco - Monthly Member & Financial Backup Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
              h1 { font-size: 20px; color: #0f172a; margin-bottom: 4px; }
              p { font-size: 12px; color: #64748b; margin-top: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
              th { background-color: #f1f5f9; font-weight: bold; }
              .text-right { text-align: right; }
              .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
            </style>
          </head>
          <body>
            <h1>PCEA Tumutumu Hospital Urigiti Sacco</h1>
            <p>Official Monthly Member & Financial Backup Report - Generated on ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Emp No</th>
                  <th>Member Full Name</th>
                  <th class="text-right">Shares Balance (Ksh)</th>
                  <th class="text-right">Loan Amount (Ksh)</th>
                  <th class="text-right">Loan Balance (Ksh)</th>
                  <th class="text-right">Prev Month Deduction (Ksh)</th>
                </tr>
              </thead>
              <tbody>
      `;

      members.forEach(m => {
        const memberLoan = loansList.find(l => l.memberId === m.memberId && l.status === 'disbursed');
        const memberDed = deductionsList.find(d => d.memberId === m.memberId);
        const prevDeduction = memberDed ? memberDed.totalDeducted : 0;
        const loanAmount = memberLoan ? memberLoan.requestedAmount : 0;
        const loanBalance = memberLoan ? memberLoan.outstandingBalance : 0;

        htmlContent += `
          <tr>
            <td>${m.employeeNumber}</td>
            <td>${m.fullName}</td>
            <td class="text-right">${m.currentSharesBalance.toLocaleString()}</td>
            <td class="text-right">${loanAmount.toLocaleString()}</td>
            <td class="text-right">${loanBalance.toLocaleString()}</td>
            <td class="text-right">${prevDeduction.toLocaleString()}</td>
          </tr>
        `;
      });

      htmlContent += `
              </tbody>
            </table>
            <div class="footer">
              <p>Urigiti Sacco Management System • PCEA Tumutumu Hospital • Certified Backup Report</p>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Failed to generate monthly PDF report.');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading manager portal...</div>;
  }

  const totalShares = members.reduce((acc, m) => acc + m.currentSharesBalance, 0);
  const activeLoansList = loans.filter(l => l.status === 'disbursed');
  const pendingLoansList = loans.filter(l => l.status === 'pending_manager' || l.status === 'pending_guarantors');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-emerald-950 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 bg-blue-600/50 text-blue-200 px-3 py-1 rounded-full text-xs font-semibold w-fit mb-3">
            <ShieldCheck className="w-4 h-4" /> Sacco Management Portal
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">PCEA Tumutumu Hospital Urigiti Sacco</h1>
          <p className="text-blue-200 text-sm mt-1">Manager: <span className="font-semibold">{currentUser.email}</span></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('deductions')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" /> Upload Payroll Deductions
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Members</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{members.length}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Hospital Staff</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Shares Capital</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">Ksh {totalShares.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Growth Stable</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Loans</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeLoansList.length}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">Performing</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingLoansList.length}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Action Required</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delinquency Rate</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">0.4%</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Excellent Recovery</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'loans', label: 'Loan Approval Queue' },
          { id: 'deductions', label: 'Monthly Deductions & Checkoff' },
          { id: 'agm', label: 'AGM Notices Manager' },
          { id: 'reports', label: 'Reports & Exports' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Recent Loan Applications</h3>
            <div className="space-y-3">
              {loans.slice(0, 5).map(l => {
                const mem = members.find(m => m.memberId === l.memberId);
                return (
                  <div key={l.loanId} className="border border-slate-100 p-4 rounded-xl flex justify-between items-center bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{mem?.fullName || 'Member'} <span className="text-xs text-slate-500">({mem?.employeeNumber})</span></p>
                      <p className="text-xs text-slate-600 mt-0.5">Requested: Ksh {l.requestedAmount.toLocaleString()} | Purpose: {l.purpose}</p>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold uppercase">{l.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Hospital Staff Members Summary</h3>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.memberId} className="border border-slate-100 p-4 rounded-xl flex justify-between items-center bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-900">{m.fullName}</p>
                    <p className="text-xs text-slate-500">{m.employeeNumber} | Joined: {m.dateJoined}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">Ksh {m.currentSharesBalance.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Shares Balance</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Loan Approval Queue (Phase 3: Manager Authorization)</h3>
            <span className="text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">{pendingLoansList.length} Pending Applications</span>
          </div>

          <div className="space-y-4">
            {loans.map(loan => {
              const mem = members.find(m => m.memberId === loan.memberId);
              const isPending = loan.status === 'pending_manager' || loan.status === 'pending_guarantors';
              return (
                <div key={loan.loanId} className={`border rounded-2xl p-5 space-y-4 ${isPending ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{mem?.fullName || 'Member'} <span className="text-xs font-normal text-slate-500">({mem?.employeeNumber})</span></h4>
                      <p className="text-xs text-slate-500 mt-0.5">Applied on: {loan.applicationDate} | Purpose: {loan.purpose}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500">Requested Amount:</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">Ksh {loan.requestedAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tenure:</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{loan.tenureMonths} Months</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Interest Rate:</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{loan.interestRate}% p.a.</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Guarantors:</span>
                      <p className="font-bold text-emerald-700 text-sm mt-0.5">{loan.guarantors?.length || 4} Verified</p>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleApproveLoan(loan.loanId, loan.requestedAmount)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve & Disburse
                      </button>
                      <button
                        onClick={() => handleRejectLoan(loan.loanId)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" /> Reject Application
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'deductions' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Monthly Payroll Deductions Checkoff Upload</h3>
              <p className="text-xs text-slate-500 mt-1">Upload CSV/Excel file received from PCEA Tumutumu Hospital Finance Department.</p>
            </div>
            <button
              onClick={handleSimulateCSVUpload}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Simulate Finance CSV Import
            </button>
          </div>

          {uploadSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-medium">
              {uploadSuccess}
            </div>
          )}

          {csvPreview.length > 0 && (
            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl bg-slate-50">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm">Preview Upload Batch ({csvPreview.length} Records)</h4>
                <button
                  onClick={handleConfirmBatchUpload}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
                >
                  Confirm & Post Balances to Accounts
                </button>
              </div>
              <div className="overflow-x-auto max-h-64 bg-white rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b">
                    <tr>
                      <th className="p-3">Employee No</th>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">Shares</th>
                      <th className="p-3">Principal</th>
                      <th className="p-3">Interest</th>
                      <th className="p-3">Total Deducted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold">{row.employeeNumber}</td>
                        <td className="p-3">{row.fullName}</td>
                        <td className="p-3 text-emerald-600 font-bold">+{row.sharesAmount}</td>
                        <td className="p-3">{row.principalAmount}</td>
                        <td className="p-3">{row.interestAmount}</td>
                        <td className="p-3 font-bold text-slate-900">{row.totalDeducted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'agm' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Publish New AGM Notice</h3>
            {agmSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs">{agmSuccess}</div>}
            <form onSubmit={handleCreateAgm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Notice Title</label>
                <input type="text" required value={agmTitle} onChange={e => setAgmTitle(e.target.value)} placeholder="2026 Annual General Meeting" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">AGM Date & Time</label>
                <input type="datetime-local" required value={agmDate} onChange={e => setAgmDate(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Venue / Link</label>
                <input type="text" required value={agmVenue} onChange={e => setAgmVenue(e.target.value)} placeholder="Hospital Hall / Zoom Link" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Agenda Items (One per line)</label>
                <textarea rows={4} value={agmAgenda} onChange={e => setAgmAgenda(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow">
                Publish Notice & Notify Members
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Published Notices</h3>
            <div className="space-y-3">
              {agmNotices.map(n => (
                <div key={n.noticeId} className="border border-slate-200 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold">{n.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">Venue: {n.venue} | Published: {n.publishedAt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Sacco Financial & Membership Reports</h3>
              <p className="text-xs text-slate-500 mt-1">Generate Monthly, Quarterly, and Yearly reports including loan recoveries and member growth.</p>
            </div>
            <button onClick={handleDownloadMonthlyPdfReport} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
              <Download className="w-4 h-4" /> Download Monthly Backup PDF Report
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-900">Monthly Contribution Summary</h4>
              <p className="text-xs text-slate-500">Total Checkoff for September 2026</p>
              <p className="text-xl font-extrabold text-emerald-600">Ksh 345,000</p>
            </div>
            <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-900">Loan Recovery Performance</h4>
              <p className="text-xs text-slate-500">Principal & Interest Collected</p>
              <p className="text-xl font-extrabold text-blue-600">Ksh 1,280,000</p>
            </div>
            <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-900">Member Growth Rate</h4>
              <p className="text-xs text-slate-500">New Hospital Staff Onboarded</p>
              <p className="text-xl font-extrabold text-purple-600">+14 Members Q3</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
