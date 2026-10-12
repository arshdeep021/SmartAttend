import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Sparkles, ShieldCheck, Camera } from 'lucide-react';
import QRScannerModal from '../../components/QRScannerModal.jsx';

export default function StudentScan() {
  const [isScannerOpen, setIsScannerOpen] = useState(true);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/10">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Classroom Attendance Scanner
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Scan the rotating QR code projected in your lecture hall or input the session code manually.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-center">
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
            Ready to check in?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SmartAttend verifies your enrollment and records your presence in real-time.
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
              ⚡ 20-Second Refresh
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              QR tokens rotate continuously to prevent screenshot sharing.
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              🔒 Unique Entry
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Only one attendance record per student per session can be recorded.
            </span>
          </div>
        </div>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => {
          // Success handled in modal
        }}
      />
    </div>
  );
}
