import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Radio,
  Clock,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LandingPage() {
  const { user, isStudent, isTeacher, isAdmin } = useAuth();

  const getDashboardLink = () => {
    if (isStudent) return "/student/dashboard";
    if (isTeacher) return "/teacher/dashboard";
    if (isAdmin) return "/admin/dashboard";
    return "/login";
  };

  const demoAccounts = [
    {
      role: "Admin",
      email: "admin@smartattend.edu",
      pass: "Admin@123",
      color: "from-purple-500 to-indigo-600",
    },
    {
      role: "Teacher",
      email: "dr.sharma@smartattend.edu",
      pass: "Teacher@123",
      color: "from-teal-500 to-emerald-600",
    },
    {
      role: "Student (<75% Alert)",
      email: "kabir.mehta@smartattend.edu",
      pass: "Student@123",
      color: "from-red-500 to-rose-600",
    },
    {
      role: "Student (Good Standing)",
      email: "aravind.swamy@smartattend.edu",
      pass: "Student@123",
      color: "from-blue-500 to-cyan-600",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Smart
                <span className="text-brand-600 dark:text-brand-400">
                  Attend
                </span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-md border border-brand-500/20">
                v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={getDashboardLink()}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-brand-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all shadow-brand-600/20"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-brand-500/20 to-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-wider mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Next-Gen Smart Student Attendance Management
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.1]"
          >
            Say goodbye to paper rosters & proxy check-ins.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Rotating cryptographically signed QR tokens, real-time live check-in
            rosters, and an unmissable automated 75% low attendance warning
            system.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to={user ? getDashboardLink() : "/login"}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 rounded-2xl shadow-xl shadow-brand-600/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Launch Live App
            </Link>
            <a
              href="#demo-credentials"
              className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-2xl transition-all shadow-sm"
            >
              Demo Credentials
            </a>
          </motion.div>

          {/* Quick Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-sm">
              <p className="text-2xl sm:text-3xl font-extrabold text-brand-600 dark:text-brand-400">
                20s
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Rotating QR Expiry
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-sm">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                100%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Anti-Proxy Compound Index
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-sm">
              <p className="text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400">
                &lt; 75%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Automated Warning Alert
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-sm">
              <p className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                1-Click
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                CSV & PDF Reports
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step How It Works */}
      <section className="py-16 bg-white dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Effortless 3-Step Workflow
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Designed specifically for fast classroom check-in without taking
              15 minutes of lecture time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
              <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-black text-lg mb-4 shadow-lg shadow-brand-600/20">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Teacher Starts Live Session
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Instructor selects course and projects a large rotating QR code.
                The token auto-refreshes every 20 seconds.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-lg mb-4 shadow-lg shadow-teal-600/20">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Student Scans with Phone
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Student opens SmartAttend, scans the rotating screen code with
                their camera, and gets verified with confetti in 1 second.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg mb-4 shadow-lg shadow-purple-600/20">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Live Analytics & 75% Alerts
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Percentages update immediately. Students falling below 75%
                receive instant unmissable alerts and recovery instructions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Credentials Section */}
      <section id="demo-credentials" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Evaluation & Grading
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Pre-Seeded Demo Accounts
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Click any account below or sign in to test the complete end-to-end
              functionality right away.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {demoAccounts.map((acc, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-bold text-white rounded-lg bg-gradient-to-r ${acc.color} mb-3`}
                  >
                    {acc.role}
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Email:</p>
                    <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                      {acc.email}
                    </p>
                    <p className="text-xs text-slate-400 pt-1">Password:</p>
                    <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {acc.pass}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/login?email=${encodeURIComponent(acc.email)}`}
                  className="mt-5 w-full py-2 text-xs font-bold text-center text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 rounded-xl transition-colors"
                >
                  Quick Sign In &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 text-center text-xs text-slate-500">
        SmartAttend v2 &bull; Enterprise-grade Smart Student Attendance System
        &bull; Built with React, Vite, Node, Express & MongoDB.
      </footer>
    </div>
  );
}
