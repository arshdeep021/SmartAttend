import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  LayoutDashboard,
  QrCode,
  History,
  CalendarDays,
  Bell,
  UserCheck,
  BookOpen,
  FileBarChart,
  Settings,
  ShieldCheck,
  Users,
  ScrollText,
  User,
  Radio,
} from "lucide-react";

export default function Sidebar() {
  const { isStudent, isTeacher, isAdmin } = useAuth();
  const location = useLocation();

  const studentLinks = [
    { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      to: "/student/scan",
      label: "Scan Attendance",
      icon: QrCode,
      highlight: true,
    },
    { to: "/student/history", label: "My Records", icon: History },
    { to: "/student/timetable", label: "Timetable", icon: CalendarDays },
    { to: "/student/notifications", label: "Alerts", icon: Bell },
    { to: "/student/profile", label: "Profile", icon: User },
  ];

  const teacherLinks = [
    { to: "/teacher/dashboard", label: "Overview", icon: LayoutDashboard },
    {
      to: "/teacher/live",
      label: "Live QR Projector",
      icon: Radio,
      highlight: true,
    },
    { to: "/teacher/courses", label: "Courses & Roster", icon: BookOpen },
    { to: "/teacher/reports", label: "Attendance Reports", icon: FileBarChart },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Analytics", icon: LayoutDashboard },
    {
      to: "/admin/approvals",
      label: "Teacher Approvals",
      icon: UserCheck,
      highlight: true,
    },
    { to: "/admin/users", label: "User Directory", icon: Users },
    { to: "/admin/settings", label: "System Settings", icon: Settings },
    { to: "/admin/audit-logs", label: "Audit Trail", icon: ScrollText },
  ];

  const links = isStudent
    ? studentLinks
    : isTeacher
      ? teacherLinks
      : adminLinks;

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 shrink-0 min-h-[calc(100vh-4rem)]">
        <div className="space-y-1.5 flex-1">
          <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navigation Menu
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                      : link.highlight
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : ""}`}
                />
                <span>{link.label}</span>
                {link.highlight && !isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-brand-500 animate-ping" />
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Security / System Footer Note */}
        <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Anti-Proxy Security</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Single-session rotating JWT tokens with unique compound index
            enforcement.
          </p>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
        {links.slice(0, 5).map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold transition-all ${
                isActive
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive
                    ? "bg-brand-500/10"
                    : link.highlight
                      ? "bg-brand-600 text-white p-1.5 -translate-y-2 shadow-lg shadow-brand-600/30"
                      : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="mt-0.5 truncate max-w-[60px]">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
