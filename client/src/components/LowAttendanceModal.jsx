import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, ShieldAlert, X } from "lucide-react";

export default function LowAttendanceModal({
  atRiskCourses = [],
  isOpen,
  onClose,
}) {
  if (!isOpen || atRiskCourses.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 overflow-hidden"
        >
          {/* Header Accent Bar */}
          <div className="h-3 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 border border-red-200 dark:border-red-800 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Critical Attendance Warning
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Academic Eligibility Alert
                </h3>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Your attendance record currently falls below the mandatory{" "}
              <strong>75% attendance threshold</strong>. You are at immediate
              risk of attendance shortage.
            </p>

            <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {atRiskCourses.map((c, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {c.course?.code} - {c.course?.name}
                    </h4>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      Current Attendance:{" "}
                      <strong className="font-extrabold text-red-700 dark:text-red-300">
                        {c.percentage}%
                      </strong>{" "}
                      ({c.attended} of {c.totalConducted} classes)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 text-xs font-bold bg-red-600 text-white rounded-lg shadow-sm">
                      +{c.classesToRecover} classes
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      needed for 75%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />I Acknowledge & Understand
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
