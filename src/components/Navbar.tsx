import { Building2, LogOut, User, Shield, CheckCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  currentUser: UserType | null;
  onLogout: () => void;
}

export function Navbar({ currentUser, onLogout }: NavbarProps) {
  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"><Shield className="w-3 h-3" /> System Admin</span>;
      case 'manager':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sacco Manager</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Member</span>;
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-inner flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-white flex items-center gap-2">
              Urigiti Sacco <span className="text-xs bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded font-normal">PCEA Tumutumu Hospital</span>
            </h1>
            <p className="text-xs text-slate-400">Members Portal & Management System</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationBell currentUser={currentUser} />

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-200">{currentUser.email}</span>
              {getRoleBadge(currentUser.role)}
            </div>
            <button
              onClick={onLogout}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border border-slate-700 shadow-sm"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
