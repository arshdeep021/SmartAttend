import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "../../api/client.js";
import QRScannerModal from "../../components/QRScannerModal.jsx";

export default function StudentScan() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const s = searchParams.get("s") || searchParams.get("sessionId");
  const c = searchParams.get("c") || searchParams.get("code");

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [autoMarking, setAutoMarking] = useState(false);
  const [autoMarkSuccess, setAutoMarkSuccess] = useState(null);
  const [autoMarkError, setAutoMarkError] = useState(null);
  const hasTriggeredRef = useRef(false);

  // Trigger celebration fireworks
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#4f46e5", "#10b981", "#14b8a6", "#f59e0b"],
      });
    } catch (e) {
      // Confetti fallback
    }
  };

  // If query parameters are present, auto-mark immediately
  useEffect(() => {
    if (s && c && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      setAutoMarking(true);
      setAutoMarkError(null);

      api
        .post("/attendance/mark", { sessionId: s, code: c })
        .then((res) => {
          setAutoMarkSuccess(res);
          triggerConfetti();
        })
        .catch((err) => {
          let msg = err.message || "Could not verify attendance.";
          if (
            err.code === "DUPLICATE_ATTENDANCE" ||
            err.message?.includes("already")
          ) {
            msg = "Your attendance has already been recorded for this session.";
          } else if (
            err.code === "NOT_ENROLLED" ||
            err.message?.includes("not enrolled")
          ) {
            msg = "You are not enrolled in this course.";
          } else if (
            err.code === "CODE_EXPIRED" ||
            err.message?.includes("expired")
          ) {
            msg =
              "This QR attendance link has expired. Please scan the current refreshed code on the classroom projector.";
          } else if (
            err.code === "SESSION_CLOSED" ||
            err.message?.includes("closed")
          ) {
            msg = "This attendance session has ended.";
          }
          setAutoMarkError(msg);
        })
        .finally(() => {
          setAutoMarking(false);
        });
    }
  }, [s, c]);

  // If auto-marking was triggered via direct camera link:
  if (s && c) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        {autoMarking && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-center flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-brand-600 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Verifying Attendance...
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Authenticating cryptographic session signature
            </p>
          </div>
        )}

        {autoMarkSuccess && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-center flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
              Verified Present
            </span>

            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-3">
              Attendance Recorded!
            </h2>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {autoMarkSuccess.record?.courseName} (
              {autoMarkSuccess.record?.courseCode})
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Topic: {autoMarkSuccess.record?.sessionTopic} &bull;{" "}
              {new Date(autoMarkSuccess.record?.markedAt).toLocaleTimeString()}
            </p>

            {autoMarkSuccess.metrics && (
              <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs w-full">
                <div className="flex justify-between items-center font-bold">
                  <span>Course Attendance:</span>
                  <span
                    className={
                      autoMarkSuccess.metrics.isAtRisk
                        ? "text-red-500 text-sm"
                        : "text-emerald-500 text-sm"
                    }
                  >
                    {autoMarkSuccess.metrics.percentage}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {autoMarkSuccess.metrics.attended} of{" "}
                  {autoMarkSuccess.metrics.totalConducted} classes attended
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col w-full gap-2">
              <Link
                to="/student/dashboard"
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/student/history"
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl text-center"
              >
                View Attendance History
              </Link>
            </div>
          </motion.div>
        )}

        {autoMarkError && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-center flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-300 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertCircle className="w-9 h-9" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Check-in Failed
            </h2>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900">
              {autoMarkError}
            </p>

            <div className="mt-6 flex flex-col w-full gap-2">
              <button
                onClick={() => {
                  hasTriggeredRef.current = false;
                  navigate("/student/scan");
                  setIsScannerOpen(true);
                }}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Open Scanner / Enter PIN</span>
              </button>
              <Link
                to="/student/dashboard"
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl text-center"
              >
                Return to Dashboard
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/10">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Classroom Attendance Scanner
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Scan the rotating QR code projected in your lecture hall or input the
          6-character session PIN.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-center">
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
            Ready to check in?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SmartAttend verifies your course enrollment and cryptographically
            validates your presence in real-time.
          </p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="w-full sm:w-auto px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-2xl shadow-xl shadow-brand-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 mx-auto"
        >
          <Camera className="w-6 h-6" />
          <span>Launch Camera Scanner / PIN Entry</span>
        </button>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              ⚡ 30-Second Synchronized Rotation
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              QR codes and PINs rotate synchronously on server time windows to
              eliminate screenshot sharing.
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              🔒 Unique Entry Protection
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Only one attendance record per student per session can be
              recorded. Duplicates are strictly blocked.
            </span>
          </div>
        </div>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => {
          // Success modal handled internally
        }}
      />
    </div>
  );
}
