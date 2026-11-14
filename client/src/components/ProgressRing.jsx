import React from "react";
import { motion } from "framer-motion";

export default function ProgressRing({
  percentage = 100,
  size = 180,
  strokeWidth = 14,
  label = "Overall Attendance",
  threshold = 75,
  showLabel = true,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  let strokeColor = "#10b981"; // Green (>=85%)
  let statusBadge = "Excellent Standing";
  let badgeColor =
    "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";

  if (clamped < threshold) {
    strokeColor = "#ef4444"; // Red (<75%)
    statusBadge = "Critical: Below 75%";
    badgeColor =
      "text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse";
  } else if (clamped < threshold + 10) {
    strokeColor = "#f59e0b"; // Amber (75-84%)
    statusBadge = "Approaching Threshold";
    badgeColor =
      "text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
            fill="transparent"
          />
          {/* Animated Progress ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {clamped}%
          </motion.span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Min req: {threshold}%
          </span>
        </div>
      </div>

      {showLabel && (
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {label}
          </p>
          <span
            className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${badgeColor}`}
          >
            {statusBadge}
          </span>
        </div>
      )}
    </div>
  );
}
