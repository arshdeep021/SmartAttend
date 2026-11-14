import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api } from "../../api/client.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.message);
      if (res.devResetLink) {
        setDevResetLink(res.devResetLink);
      }
    } catch (err) {
      setError(err.message || "Failed to dispatch reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/25">
            <GraduationCap className="w-7 h-7" />
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Smart
            <span className="text-brand-600 dark:text-brand-400">Attend</span>
          </span>
        </Link>
        <h2 className="text-center text-2xl font-extrabold text-slate-900 dark:text-white">
          Reset your password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Enter your registered email address and we'll dispatch a secure
          recovery link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-slate-200 dark:border-slate-800">
          {message && (
            <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{message}</p>
                  {devResetLink && (
                    <div className="mt-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-700">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dev Direct Link:
                      </p>
                      <a
                        href={devResetLink}
                        className="text-brand-600 dark:text-brand-400 font-mono text-[11px] break-all underline"
                      >
                        {devResetLink}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Dispatching..." : "Send Recovery Link"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
