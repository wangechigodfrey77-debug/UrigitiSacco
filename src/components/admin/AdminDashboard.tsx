import { useState, useEffect } from 'react';
import { 
  Shield, Users, Settings, Database, FileText, UserPlus, CheckCircle, AlertCircle, Save 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { User as UserType, Member, SystemSettings, AuditLog } from '../../types';

interface AdminDashboardProps {
  currentUser: UserType;
}

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'members' | 'settings' | 'audit' | 'backup'>('users');
  const [users, setUsers] = useState<UserType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    minSharesRequirement: 5000,
    defaultLoanInterestRate: 12,
    maxGuarantorsRequired: 4,
    maxGuaranteesAllowedPerMember: 3,
    financialYear: '2026/2027',
    hospitalName: 'PCEA Tumutumu Hospital',
  });
  const [loading, setLoading] = useState(true);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const userSnap = await getDocs(collection(db, 'users'));
      setUsers(userSnap.docs.map(d => d.data() as UserType));

      const memberSnap = await getDocs(collection(db, 'members'));
      setMembers(memberSnap.docs.map(d => d.data() as Member));

      const logSnap = await getDocs(collection(db, 'auditLogs'));
      setAuditLogs(logSnap.docs.map(d => d.data() as AuditLog));

      const settingsSnap = await getDocs(collection(db, 'systemSettings'));
      if (!settingsSnap.empty) {
        setSettings(settingsSnap.docs[0].data() as SystemSettings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (uid: string, newRole: 'member' | 'manager' | 'admin') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });

      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.email,
          action: 'UPDATE_USER_ROLE',
          collectionName: 'users',
          documentId: uid,
          newValue: { role: newRole },
        }),
      });

      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'systemSettings', 'config'), settings);

      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.email,
          action: 'UPDATE_SYSTEM_SETTINGS',
          collectionName: 'systemSettings',
          documentId: 'config',
          newValue: settings,
        }),
      });

      setSettingsSuccess('System settings updated successfully.');
      setTimeout(() => setSettingsSuccess(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading admin portal...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 bg-purple-600/50 text-purple-200 px-3 py-1 rounded-full text-xs font-semibold w-fit mb-3">
            <Shield className="w-4 h-4" /> System Administration Control Center
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Urigiti Sacco - Admin Panel</h1>
          <p className="text-purple-200 text-sm mt-1">Administrator: <span className="font-semibold">{currentUser.email}</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
        {[
          { id: 'users', label: 'User & Role Management' },
          { id: 'members', label: 'Member Master Data' },
          { id: 'settings', label: 'System Configuration' },
          { id: 'audit', label: 'Audit Logs' },
          { id: 'backup', label: 'Data Backup & Export' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Registered System Users & Role Assignments</h3>
            <span className="text-xs bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full">{users.length} Users</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="p-3">User Email</th>
                  <th className="p-3">Current Role</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3 text-right">Assign Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{u.email}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3"><span className="text-emerald-600 font-semibold text-xs">Active</span></td>
                    <td className="p-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-800"
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Hospital Employee Member Master Data</h3>
            <button onClick={() => alert('Add new member modal...')} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Onboard Employee Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="p-3">Employee No</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3 text-right">Shares Balance</th>
                  <th className="p-3 text-right">Loan Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(m => (
                  <tr key={m.memberId} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{m.employeeNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{m.fullName}</td>
                    <td className="p-3 text-slate-600">{m.email}</td>
                    <td className="p-3 text-slate-600">{m.phone}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">Ksh {m.currentSharesBalance.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-slate-900">Ksh {m.loanLimit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 max-w-xl space-y-6">
          <h3 className="text-lg font-bold text-slate-900">System Financial Settings & Loan Parameters</h3>
          {settingsSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs">{settingsSuccess}</div>}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Minimum Shares Requirement (Ksh)</label>
              <input type="number" value={settings.minSharesRequirement} onChange={e => setSettings({...settings, minSharesRequirement: Number(e.target.value)})} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Default Loan Interest Rate (% p.a.)</label>
              <input type="number" value={settings.defaultLoanInterestRate} onChange={e => setSettings({...settings, defaultLoanInterestRate: Number(e.target.value)})} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Max Guarantors Required per Loan</label>
              <input type="number" value={settings.maxGuarantorsRequired} onChange={e => setSettings({...settings, maxGuarantorsRequired: Number(e.target.value)})} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Financial Year</label>
              <input type="text" value={settings.financialYear} onChange={e => setSettings({...settings, financialYear: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" />
            </div>
            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow flex items-center gap-2">
              <Save className="w-4 h-4" /> Save System Settings
            </button>
          </form>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-lg font-bold text-slate-900">System Audit Logs (Security & Operations)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Collection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">No audit logs recorded yet. All operations logged securely.</td>
                  </tr>
                ) : (
                  auditLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500">{log.timestamp}</td>
                      <td className="p-3 font-semibold text-slate-800">{log.userId}</td>
                      <td className="p-3 text-purple-700 font-bold">{log.action}</td>
                      <td className="p-3">{log.collection}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6 max-w-xl">
          <h3 className="text-lg font-bold text-slate-900">Database Backup & Export</h3>
          <p className="text-sm text-slate-600">Export complete Firestore collections (members, loans, shares, deductions) as encrypted JSON backups.</p>
          <button onClick={() => alert('Downloading secure database JSON backup...')} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-3 rounded-xl text-xs shadow flex items-center gap-2">
            <Database className="w-4 h-4" /> Download Full Database Backup (JSON)
          </button>
        </div>
      )}
    </div>
  );
}
