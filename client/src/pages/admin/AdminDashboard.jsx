import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  BookOpen,
  Radio,
  Settings,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client.js';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/admin/analytics');
      setAnalytics(res.analytics);
    } catch (err) {
      toast.error('Failed to load system analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Loading campus analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Administrative Control Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Institutional overview, faculty approvals, audit monitoring & system configuration
          </p>
        </div>

        {analytics?.pendingTeachersCount > 0 && (
          <Link
            to="/admin/approvals"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 animate-pulse"
          >
            <UserCheck className="w-4 h-4" />
            <span>{analytics.pendingTeachersCount} Faculty Awaiting Approval</span>
          </Link>
        )}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Students</span>
            <Users className="w-5 h-5 text-brand-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {analytics?.totalStudents || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Enrolled student accounts</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Approved Faculty</span>
            <UserCheck className="w-5 h-5 text-teal-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {analytics?.totalTeachers || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active teaching instructors</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Courses Offered</span>
            <BookOpen className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {analytics?.totalCourses || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Academic curriculums</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">At-Risk Instances</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-black text-red-600 dark:text-red-400 mt-2">
            {analytics?.atRiskInstances || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Below {analytics?.threshold || 75}% threshold</p>
        </div>
      </div>

      {/* System Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 uppercase">Conducted Lectures</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {analytics?.totalSessions || 0} Sessions
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {analytics?.totalAttendanceMarks || 0} verified check-in records
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 uppercase">Live Right Now</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {analytics?.activeSessionsCount || 0} Active Session(s)
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Projector QR currently open in lecture halls
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 uppercase">Configured Threshold</span>
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">
            {analytics?.threshold || 75}% Minimum
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Regulated institutional compliance
          </p>
        </div>
      </div>

      {/* Administrative Navigation Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/approvals"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors flex items-center justify-between">
            Teacher Approvals
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-slate-400 mt-1">Review pending faculty registrations</p>
        </Link>

        <Link
          to="/admin/users"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors flex items-center justify-between">
            User Directory
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-slate-400 mt-1">Search, view, and manage accounts</p>
        </Link>

        <Link
          to="/admin/settings"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3">
            <Settings className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors flex items-center justify-between">
            System Settings
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-slate-400 mt-1">Configure threshold, QR timing & alerts</p>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <ScrollText className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors flex items-center justify-between">
            Audit Trail
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-xs text-slate-400 mt-1">Review manual corrections and sign-ins</p>
        </Link>
      </div>
    </div>
  );
}
