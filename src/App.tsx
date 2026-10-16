/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { User as UserType } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { MemberDashboard } from './components/member/MemberDashboard';
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ShieldAlert, RefreshCcw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);
        if (firebaseUser) {
          // Fetch user role document from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setCurrentUser(userDocSnap.data() as UserType);
          } else {
            // Fallback default role based on email or demo accounts
            const email = firebaseUser.email || '';
            let role: UserType['role'] = 'member';
            if (email.includes('admin') || email === 'gmaurice101@gmail.com') role = 'admin';
            else if (email.includes('manager')) role = 'manager';

            const defaultUser: UserType = {
              uid: firebaseUser.uid,
              email,
              role,
              status: 'active',
              createdAt: new Date().toISOString(),
            };
            
            // Save user document to Firestore so security rules succeed
            await setDoc(userDocRef, defaultUser).catch(() => {});
            setCurrentUser(defaultUser);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err: any) {
        console.error('Auth state change error:', err);
        setAuthError(err.message || 'Authentication error occurred.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium text-slate-300">Loading Urigiti Sacco System...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-rose-950/50 border border-rose-800 p-6 rounded-2xl max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold">Authentication Error</h3>
          <p className="text-xs text-rose-200">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <main className="flex-1 pb-16">
        {currentUser.role === 'admin' ? (
          <AdminDashboard currentUser={currentUser} />
        ) : currentUser.role === 'manager' ? (
          <ManagerDashboard currentUser={currentUser} />
        ) : (
          <MemberDashboard currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}
