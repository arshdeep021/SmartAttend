import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function LowAttendanceBanner({
  atRiskCourses = [],
  approachingCourses = [],
  overallAtRisk = false,
}) {
  if (
    atRiskCourses.length === 0 &&
    approachingCourses.length === 0 &&
    !overallAtRisk
  ) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* CRITICAL LOW ATTENDANCE ALERT (< 75%) */}
      {atRiskCourses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-xl shadow-red-500/20 border-2 border-red-400 p-4 sm:p-5"
        >
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <AlertTriangle className="w-48 h-48" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-white text-red-700 rounded-md shadow-sm">
                    Action Required
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Low Attendance Warning (Below 75% Mandatory Threshold)
                  </h3>
                </div>

                <p className="mt-1 text-sm text-red-100 max-w-2xl leading-relaxed">
                  Your attendance has fallen below university eligibility
                  requirements. Failure to recover attendance will result in
                  debarment from semester examinations.
                </p>

                {/* Course pills with recovery math */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {atRiskCourses.map((c, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/25 backdrop-blur-md rounded-lg border border-white/20 text-xs sm:text-sm font-medium"
                    >
                      <span className="font-bold text-white">
                        {c.course?.code || "Course"}:
                      </span>
                      <span className="px-1.5 py-0.5 bg-red-500/80 rounded text-xs font-bold text-white">
                        {c.percentage}%
                      </span>
                      <span className="text-red-200">
                        Attend next{" "}
                        <strong className="text-white underline">
                          {c.classesToRecover}
                        </strong>{" "}
                        consecutive class{c.classesToRecover > 1 ? "es" : ""} to
                        recover
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 pt-2 md:pt-0">
              <Link
                to="/student/history"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-red-700 bg-white hover:bg-red-50 active:scale-95 transition-all rounded-xl shadow-md"
              >
                View Breakdown
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* APPROACHING THRESHOLD WARNING (75% - 80%) */}
      {approachingCourses.length > 0 && atRiskCourses.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-700/40 p-4 text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold">
                Approaching Low Attendance Threshold:{" "}
              </span>
              Your attendance in{" "}
              {approachingCourses.map((c, i) => (
                <span key={i} className="font-semibold underline mr-1">
                  {c.course?.code} ({c.percentage}%)
                </span>
              ))}{" "}
              is hovering close to 75%. You can miss at most{" "}
              {Math.min(...approachingCourses.map((c) => c.classesCanMiss))}{" "}
              more class(es).
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
