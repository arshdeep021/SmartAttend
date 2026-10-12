import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldCheck, Bell, Clock, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';
import toast from 'react-hot-toast';

export default function SystemSettings() {
  const [threshold, setThreshold] = useState(75);
  const [qrRefresh, setQrRefresh] = useState(20);
  const [qrExpiry, setQrExpiry] = useState(30);
  const [lateGrace, setLateGrace] = useState(10);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [institutionName, setInstitutionName] = useState('Apex Institute of Technology');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.settings) {
        setThreshold(res.settings.attendanceThreshold || 75);
        setQrRefresh(res.settings.qrRefreshInterval || 20);
        setQrExpiry(res.settings.qrTokenExpiry || 30);
        setLateGrace(res.settings.lateGraceMinutes || 10);
        setEmailEnabled(Boolean(res.settings.emailAlertsEnabled));
        setInstitutionName(res.settings.institutionName || 'Apex Institute of Technology');
      }
    } catch (err) {
      toast.error('Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/admin/settings', {
        attendanceThreshold: Number(threshold),
        qrRefreshInterval: Number(qrRefresh),
        qrTokenExpiry: Number(qrExpiry),
        lateGraceMinutes: Number(lateGrace),
        emailAlertsEnabled: Boolean(emailEnabled),
        institutionName,
      });
      toast.success(res.message || 'System settings saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Loading system settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Global System Configurations
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Adjust compliance thresholds, anti-proxy rotation intervals, and notification dispatch rules
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        {/* Institutional Settings */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-500" />
            Institutional Parameters
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Institution Name
              </label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Mandatory Attendance Threshold (%)
                </label>
                <span className="font-mono font-bold text-sm text-red-600 dark:text-red-400">
                  {threshold}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Students dropping below this percentage will immediately trigger unmissable red warnings, login popups, and notification bell badges.
              </p>
            </div>
          </div>
        </div>

        {/* QR Security & Anti-Proxy Timing */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-500" />
            QR Security & Rotation Intervals
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                QR Refresh Interval (Seconds)
              </label>
              <input
                type="number"
                min={10}
                max={60}
                required
                value={qrRefresh}
                onChange={(e) => setQrRefresh(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                How often the projector generates a fresh signed token (default: 20s).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Token Expiration (Seconds)
              </label>
              <input
                type="number"
                min={15}
                max={120}
                required
                value={qrExpiry}
                onChange={(e) => setQrExpiry(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Valid window before a captured QR code becomes permanently void (default: 30s).
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Late Grace Period (Minutes)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              required
              value={lateGrace}
              onChange={(e) => setLateGrace(e.target.value)}
              className="w-full max-w-xs px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Check-ins recorded after this many minutes from session start will be marked 'Late' instead of 'Present'.
            </p>
          </div>
        </div>

        {/* Email Alerts Toggle */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Automated SMTP Email Notifications
              </h3>
              <p className="text-[11px] text-slate-400">
                Dispatch external emails via Nodemailer when low attendance thresholds are crossed
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg shadow-brand-600/25 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Changes...' : 'Save Global Settings'}</span>
        </button>
      </form>
    </div>
  );
}
