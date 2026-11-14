import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [role, setRole] = useState("student"); // 'student' | 'teacher' | 'admin'
  const [email, setEmail] = useState(
    initialEmail || "kabir.mehta@smartattend.edu",
  );
  const [password, setPassword] = useState("Student@123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  // If email was passed in URL query, set it
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      if (initialEmail.includes("admin")) {
        setRole("admin");
        setPassword("Admin@123");
      } else if (
        initialEmail.includes("dr.") ||
        initialEmail.includes("prof.")
      ) {
        setRole("teacher");
        setPassword("Teacher@123");
      } else {
        setRole("student");
        setPassword("Student@123");
      }
    }
  }, [initialEmail]);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setErrorMessage("");
    if (selectedRole === "admin") {
      setEmail("admin@smartattend.edu");
      setPassword("Admin@123");
    } else if (selectedRole === "teacher") {
      setEmail("dr.sharma@smartattend.edu");
      setPassword("Teacher@123");
    } else {
      setEmail("kabir.mehta@smartattend.edu");
      setPassword("Student@123");
    }
  };

  const setDemoUser = (userType) => {
    setErrorMessage("");
    if (userType === "at-risk") {
      setRole("student");
      setEmail("kabir.mehta@smartattend.edu");
      setPassword("Student@123");
    } else if (userType === "good-standing") {
      setRole("student");
      setEmail("aravind.swamy@smartattend.edu");
      setPassword("Student@123");
    } else if (userType === "teacher-approved") {
      setRole("teacher");
      setEmail("dr.sharma@smartattend.edu");
      setPassword("Teacher@123");
    } else if (userType === "teacher-pending") {
      setRole("teacher");
      setEmail("dr.sen@smartattend.edu");
      setPassword("Teacher@123");
    } else if (userType === "admin") {
      setRole("admin");
      setEmail("admin@smartattend.edu");
      setPassword("Admin@123");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await login(email, password);
      toast.success(res.message || "Logged in successfully!");

      const redirectUrl = searchParams.get("redirect");
      if (redirectUrl && redirectUrl.startsWith("/")) {
        navigate(redirectUrl, { replace: true });
        return;
      }

      if (res.user.role === "student") {
        navigate("/student/dashboard");
      } else if (res.user.role === "teacher") {
        navigate("/teacher/dashboard");
      } else if (res.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      setErrorMessage(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-brand-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <Link
          to="/"
          className="flex items-center justify-center gap-2.5 mb-6 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/25 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-7 h-7" />
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Smart
            <span className="text-brand-600 dark:text-brand-400">Attend</span>
          </span>
        </Link>

        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome back
        </h2>
        <p className="mt-1.5 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Sign in to access your portal, QR attendance & records
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-2xl shadow-slate-200/50 dark:shadow-none rounded-3xl border border-slate-200/80 dark:border-slate-800">
          {/* Role Toggle */}
          <div className="mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex gap-1">
            <button
              type="button"
              onClick={() => handleRoleChange("student")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                role === "student"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("teacher")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                role === "teacher"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("admin")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                role === "admin"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@smartattend.edu"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 active:scale-95 transition-all rounded-xl shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Buttons */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
              1-Click Demo Fill
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDemoUser("at-risk")}
                className="p-1.5 text-left font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 transition-colors"
              >
                🔴 Student (&lt;75% Alert)
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("good-standing")}
                className="p-1.5 text-left font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
              >
                🟢 Student (Safe 90%)
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("teacher-approved")}
                className="p-1.5 text-left font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 transition-colors"
              >
                👨‍🏫 Teacher (Dr. Sharma)
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("teacher-pending")}
                className="p-1.5 text-left font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 transition-colors"
              >
                ⏳ Teacher (Pending)
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("admin")}
                className="col-span-2 p-1.5 text-center font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 transition-colors"
              >
                👑 Administrator
              </button>
            </div>
          </div>

          {/* Registration Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Don't have an account yet?{" "}
            <Link
              to="/register"
              className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
