import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ProgressRing from '../../components/ProgressRing.jsx';
import LowAttendanceBanner from '../../components/LowAttendanceBanner.jsx';
import LowAttendanceModal from '../../components/LowAttendanceModal.jsx';
import QRScannerModal from '../../components/QRScannerModal.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showLowAttendanceModal, setShowLowAttendanceModal] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await api.get('/attendance/student-stats');
      setStats(data);

      // Check if modal has already been shown this session
      const acknowledged = sessionStorage.getItem('low_attendance_acknowledged');
      if (data.atRiskCourses?.length > 0 && !acknowledged) {
        setShowLowAttendanceModal(true);
      }
    } catch (err) {
      console.error('Failed to load student stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleModalClose = () => {
    setShowLowAttendanceModal(false);
    sessionStorage.setItem('low_attendance_acknowledged', 'true');
  };

  // Mock trend data based on student stats
  const chartData = [
    { name: 'Week 1', attendance: 88 },
    { name: 'Week 2', attendance: 82 },
    { name: 'Week 3', attendance: 75 },
    { name: 'Week 4', attendance: Math.max(40, (stats?.overall?.percentage || 75) - 4) },
    { name: 'Week 5', attendance: Math.max(45, (stats?.overall?.percentage || 75) - 2) },
    { name: 'Current', attendance: stats?.overall?.percentage || 75 },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading your attendance profile...</p>
      </div>
    );
  }

  const overall = stats?.overall || { percentage: 100, attended: 0, totalConducted: 0 };
  const courses = stats?.courses || [];
  const atRiskCourses = stats?.atRiskCourses || [];
  const approachingCourses = stats?.approachingCourses || [];
  const todaysClasses = stats?.todaysClasses || [];

  return (
    <div className="space-y-6">
      {/* LOW ATTENDANCE CRITICAL WARNING BANNER */}
      <LowAttendanceBanner
        atRiskCourses={atRiskCourses}
        approachingCourses={approachingCourses}
        overallAtRisk={overall.isAtRisk}
      />

      {/* LOGIN MODAL POPUP FOR AT-RISK STUDENTS */}
      <LowAttendanceModal
        isOpen={showLowAttendanceModal}
        atRiskCourses={atRiskCourses}
        onClose={handleModalClose}
      />

      {/* SCAN ATTENDANCE MODAL */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => {
          fetchStats();
        }}
      />

      {/* Top Welcome & Quick Scan CTA Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Hello, {user?.name}! 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Roll: <span className="font-mono font-bold text-brand-600">{user?.rollNo || 'CS001'}</span> &bull; {user?.department} &bull; Section {user?.section || 'A'}
          </p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="px-6 py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-brand-600/25 active:scale-95 transition-all flex items-center justify-center gap-2.5 shrink-0"
        >
          <QrCode className="w-5 h-5" />
          <span>Scan Attendance</span>
        </button>
      </div>

      {/* Primary KPI Grid: Overall Ring + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overall Progress Ring Widget */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
            Cumulative Attendance
          </h2>
          <ProgressRing
            percentage={overall.percentage}
            threshold={stats?.threshold || 75}
            size={190}
            strokeWidth={14}
            label="Overall Degree Average"
          />
          <div className="mt-5 grid grid-cols-2 gap-3 w-full text-center">
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">Attended</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">{overall.attended}</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">Total Classes</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">{overall.totalConducted}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Attendance Progression
              </h2>
              <p className="text-xs text-slate-400">Weekly trajectory against the 75% minimum line</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <span>Percentage</span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="attendance" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#attGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Today's Classes & Live Sessions */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Today's Live Classes & Schedule
            </h2>
            <p className="text-xs text-slate-400">Active classroom check-in windows</p>
          </div>
        </div>

        {todaysClasses.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            No active sessions currently scheduled for today. Check your timetable.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todaysClasses.map((item) => {
              const isLive = item.statusBadge === 'live_now';
              const isMarked = item.statusBadge === 'marked_present' || item.statusBadge === 'marked_late';

              return (
                <div
                  key={item._id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isLive
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                        {item.course?.code}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {item.topic}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.course?.name} &bull; {item.teacher?.name}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isLive && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-full animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Live Now
                        </span>
                      )}
                      {isMarked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-brand-700 bg-brand-100 dark:bg-brand-900/60 dark:text-brand-300 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marked Present
                        </span>
                      )}
                      {!isLive && !isMarked && (
                        <span className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-full">
                          {item.statusBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-brand-500" />
                      <span>{item.room}</span>
                      <span>&bull;</span>
                      <Clock className="w-3.5 h-3.5 text-brand-500" />
                      <span>{new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {isLive && !isMarked && (
                      <button
                        onClick={() => setIsScannerOpen(true)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        Check In Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-Course Breakdown Cards */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Course Eligibility & Progress Cards
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Detailed breakdown with classes needed to recover or safe margin to miss
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((item) => {
            const isAtRisk = item.isAtRisk;
            const isApproaching = item.isApproachingRisk;

            return (
              <div
                key={item.course._id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isAtRisk
                    ? 'bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-900/60'
                    : isApproaching
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400 font-mono">
                      {item.course.code}
                    </span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-md ${
                        isAtRisk
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 animate-pulse'
                          : isApproaching
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      }`}
                    >
                      {item.percentage}%
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-2 line-clamp-1">
                    {item.course.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Faculty: {item.course.teacher?.name}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Attended</span>
                      <span>{item.attended} / {item.totalConducted} classes</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAtRisk ? 'bg-red-500' : isApproaching ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mathematical Insight Footer */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  {isAtRisk ? (
                    <div className="text-red-600 dark:text-red-400 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Must attend next {item.classesToRecover} consecutive class{item.classesToRecover > 1 ? 'es' : ''}</span>
                    </div>
                  ) : (
                    <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Can miss up to <strong>{item.classesCanMiss}</strong> class{item.classesCanMiss > 1 ? 'es' : ''} safely</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
