import React, { useState } from 'react';
import { Building2, Shield, UserCheck, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // Register new member
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const memberId = 'mem_' + Math.random().toString(36).substring(2, 9);

        // Create user doc
        await setDoc(doc(db, 'users', uid), {
          uid,
          email,
          role: 'member',
          memberId,
          status: 'active',
          createdAt: new Date().toISOString(),
        });

        // Create member doc
        await setDoc(doc(db, 'members', memberId), {
          memberId,
          employeeNumber: employeeNumber || 'EMP-Tum-' + Math.floor(1000 + Math.random() * 9000),
          fullName: fullName || email.split('@')[0],
          phone: phone || '+254700000000',
          email,
          dateJoined: new Date().toISOString().split('T')[0],
          status: 'active',
          currentSharesBalance: 5000, // minimum initial shares
          totalSharesContributed: 5000,
          loanLimit: 15000,
        });

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoRole: UserRole) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
    setLoading(true);

    try {
      // Try sign in
      try {
        await signInWithEmailAndPassword(auth, demoEmail, 'password123');
      } catch {
        // If demo user doesn't exist in Auth yet, create it & initialize record
        const cred = await createUserWithEmailAndPassword(auth, demoEmail, 'password123');
        const uid = cred.user.uid;
        const memberId = demoRole === 'member' ? 'mem_001' : demoRole === 'manager' ? 'mem_003' : 'mem_004';
        
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: demoEmail,
          role: demoRole,
          memberId,
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      // If error occurs, sign in or fallback
      try {
        await signInWithEmailAndPassword(auth, demoEmail, 'password123');
        onLoginSuccess();
      } catch (e2: any) {
        setError('Demo login failed: ' + e2.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto bg-emerald-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 ring-4 ring-emerald-500/20">
          <Building2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Urigiti Sacco</h2>
        <p className="mt-2 text-sm text-emerald-400 font-medium">PCEA Tumutumu Hospital Employees SACCO</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleAuth}>
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Jane Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Employee Number</label>
                  <input
                    type="text"
                    required
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    placeholder="EMP-Tum-2045"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254712345678"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Hospital Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@tumutumuhospital.org"
                  className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : isRegistering ? 'Create Member Account' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition"
            >
              {isRegistering ? 'Already have an account? Sign in' : "New employee? Register for Sacco membership"}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wider mb-3">Quick Demo Role Login</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickDemoLogin('member@urigitisacco.co.ke', 'member')}
                disabled={loading}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Member
              </button>
              <button
                onClick={() => handleQuickDemoLogin('manager@urigitisacco.co.ke', 'manager')}
                disabled={loading}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <Building2 className="w-4 h-4 text-blue-600" />
                Manager
              </button>
              <button
                onClick={() => handleQuickDemoLogin('admin@urigitisacco.co.ke', 'admin')}
                disabled={loading}
                className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 p-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <Shield className="w-4 h-4 text-purple-600" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
