import { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, CreditCard, CheckCheck, X, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { User as UserType, Loan, AgmNotice } from '../types';

interface NotificationBellProps {
  currentUser: UserType;
}

export interface NotificationItem {
  id: string;
  type: 'agm' | 'loan';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  isRead: boolean;
}

export function NotificationBell({ currentUser }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`urigiti_read_notifs_${currentUser.uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<'all' | 'loan' | 'agm'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch AGM notices and loans
  useEffect(() => {
    if (!currentUser) return;

    let unsubLoans: (() => void) | undefined;
    let unsubAgm: (() => void) | undefined;

    const loadNotifications = async () => {
      try {
        // 1. Listen to published AGM Notices
        const agmCol = collection(db, 'agmNotices');
        unsubAgm = onSnapshot(agmCol, (snapshot) => {
          const agmItems: NotificationItem[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as AgmNotice;
            if (data.status === 'published' || !data.status) {
              const id = `agm_${doc.id}`;
              agmItems.push({
                id,
                type: 'agm',
                title: data.title || 'Annual General Meeting (AGM) Notice',
                description: `Venue: ${data.venue || 'Main Hospital Hall'} • Date: ${data.agmDate ? new Date(data.agmDate).toLocaleDateString() : 'Upcoming'}`,
                timestamp: data.publishedAt || data.agmDate || new Date().toISOString(),
                isRead: readIds.includes(id),
              });
            }
          });

          updateNotificationsList(agmItems, 'agm');
        }, (err) => {
          console.warn('AGM notifications snapshot note:', err);
        });

        // 2. Fetch or listen to member's loans
        // First determine member ID
        let memberId = currentUser.memberId;
        if (!memberId) {
          const memSnap = await getDocs(query(collection(db, 'members'), where('email', '==', currentUser.email))).catch(() => null);
          if (memSnap && !memSnap.empty) {
            memberId = memSnap.docs[0].id;
          }
        }

        const loansQuery = memberId 
          ? query(collection(db, 'loans'), where('memberId', '==', memberId))
          : query(collection(db, 'loans'));

        unsubLoans = onSnapshot(loansQuery, (snapshot) => {
          const loanItems: NotificationItem[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as Loan;
            // Only show to the member if it matches memberId or if memberId is matching
            if (memberId && data.memberId && data.memberId !== memberId) {
              return;
            }

            const id = `loan_${doc.id}_${data.status}`;
            let title = 'Loan Status Update';
            let description = `Your loan application of Ksh ${(data.requestedAmount || 0).toLocaleString()} status is ${data.status}.`;

            if (data.status === 'disbursed' || data.status === 'approved') {
              title = '🎉 Loan Approved & Disbursed!';
              description = `Manager approved Ksh ${(data.approvedAmount || data.requestedAmount || 0).toLocaleString()}. Next repayment due on ${data.nextDueDate || 'scheduled date'}.`;
            } else if (data.status === 'rejected') {
              title = 'Loan Application Rejected';
              description = `Reason: ${data.rejectionReason || 'Please consult the Sacco manager for clarification.'}`;
            } else if (data.status === 'pending_manager') {
              title = 'Loan In Review (Phase 3)';
              description = `Your loan of Ksh ${(data.requestedAmount || 0).toLocaleString()} has cleared guarantor checks and is awaiting Sacco Manager authorization.`;
            } else if (data.status === 'pending_guarantors') {
              title = 'Guarantor Approvals Pending';
              description = `4 hospital member guarantors must verify their endorsement before manager review.`;
            }

            loanItems.push({
              id,
              type: 'loan',
              title,
              description,
              timestamp: data.applicationDate || new Date().toISOString(),
              status: data.status,
              isRead: readIds.includes(id),
            });
          });

          updateNotificationsList(loanItems, 'loan');
        }, (err) => {
          console.warn('Loan notifications snapshot note:', err);
        });

      } catch (err) {
        console.warn('Error setting up notifications:', err);
      }
    };

    loadNotifications();

    return () => {
      if (unsubLoans) unsubLoans();
      if (unsubAgm) unsubAgm();
    };
  }, [currentUser, readIds]);

  const updateNotificationsList = (incoming: NotificationItem[], category: 'agm' | 'loan') => {
    setNotifications((prev) => {
      // Remove previous items of this category and append updated ones
      const others = prev.filter((item) => item.type !== category);
      const combined = [...others, ...incoming];
      // Sort newest first
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return combined;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    try {
      localStorage.setItem(`urigiti_read_notifs_${currentUser.uid}`, JSON.stringify(updated));
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem(`urigiti_read_notifs_${currentUser.uid}`, JSON.stringify(updated));
      } catch {}
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View alerts and notifications"
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-800 animate-fadeIn">
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm tracking-tight">Notifications & Alerts</h3>
              {unreadCount > 0 && (
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Read all
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full font-medium transition ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('loan')}
              className={`px-3 py-1 rounded-full font-medium transition flex items-center gap-1 ${
                filter === 'loan'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <CreditCard className="w-3 h-3" /> Loans
            </button>
            <button
              onClick={() => setFilter('agm')}
              className={`px-3 py-1 rounded-full font-medium transition flex items-center gap-1 ${
                filter === 'agm'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Calendar className="w-3 h-3" /> AGM
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                <p className="text-xs font-medium">No alerts at the moment.</p>
                <p className="text-[11px] text-slate-400">
                  You will receive updates here whenever the manager updates your loans or publishes AGM notices.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start ${
                    !notif.isRead ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500' : ''
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      notif.type === 'agm'
                        ? 'bg-amber-100 text-amber-700'
                        : notif.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : notif.status === 'disbursed' || notif.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {notif.type === 'agm' ? (
                      <Calendar className="w-4 h-4" />
                    ) : notif.status === 'rejected' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : notif.status === 'disbursed' || notif.status === 'approved' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-xs text-slate-900 truncate">
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {notif.description}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {new Date(notif.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Urigiti Sacco • Live alerts & member notices
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
