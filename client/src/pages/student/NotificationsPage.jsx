import React, { useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { Bell, AlertTriangle, Sparkles, Check, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Notification Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            System announcements, live session invites & low attendance alerts
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="px-3.5 py-2 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
            <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            No notifications in your inbox.
          </div>
        ) : (
          notifications.map((n) => {
            const isWarning = n.type === 'low_attendance_warning';

            return (
              <div
                key={n._id}
                className={`p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                  !n.read
                    ? isWarning
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 shadow-sm'
                      : 'bg-brand-50/50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-900/50 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isWarning
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-brand-600 text-white'
                  }`}
                >
                  {isWarning ? <ShieldAlert className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {n.title}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {new Date(n.createdAt).toLocaleDateString()} &bull; {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {n.message}
                  </p>

                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n._id)}
                      className="mt-3 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Acknowledge & Mark Read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
