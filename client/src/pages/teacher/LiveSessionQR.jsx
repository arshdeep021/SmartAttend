import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Clock,
  Users,
  XCircle,
  Plus,
  RefreshCw,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../../api/client.js';
import toast from 'react-hot-toast';

export default function LiveSessionQR() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [code, setCode] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [expiresAt, setExpiresAt] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [loading, setLoading] = useState(true);

  // Manual mark modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [roster, setRoster] = useState([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [markingStudent, setMarkingStudent] = useState(false);

  const isFetchingRef = useRef(false);

  // Fetch rotating QR payload and code together (Single Source of Truth)
  const fetchQrToken = useCallback(async () => {
    if (!sessionId || isPaused || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await api.get(`/sessions/${sessionId}/qr`);
      const offset = (res.serverTime || Date.now()) - Date.now();
      const interval = res.intervalSeconds || 30;

      // ATOMIC UPDATE: Both code and QR payload set in the exact same state pass
      setCode(res.code || '');
      setQrPayload(res.qrPayload || '');
      setExpiresAt(res.expiresAt || 0);
      setIntervalSeconds(interval);
      setServerOffset(offset);
      if (res.session) setSession(res.session);

      const nowServer = Date.now() + offset;
      const initialRemaining = Math.max(0, Math.ceil(((res.expiresAt || 0) - nowServer) / 1000));
      setSecondsRemaining(initialRemaining > 0 ? initialRemaining : interval);
    } catch (err) {
      if (err.code === 'SESSION_CLOSED' || err.message?.includes('closed')) {
        toast.error('This attendance session has closed.');
      } else {
        console.error('QR refresh error:', err);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [sessionId, isPaused]);

  // Poll attendees every 3 seconds for live check-in feed
  const fetchAttendees = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/sessions/${sessionId}/attendees`);
      setAttendees(res.records || []);
      setTotalEnrolled(res.totalEnrolled || 0);
      if (res.session) setSession(res.session);
    } catch (err) {
      console.error('Attendee poll error:', err);
    }
  }, [sessionId]);

  // Fetch course roster for manual mark search
  const fetchRoster = async (courseId) => {
    try {
      const res = await api.get(`/courses/${courseId}/roster`);
      setRoster(res.roster || []);
    } catch (err) {
      console.error('Roster error:', err);
    }
  };

  // Initial load
  useEffect(() => {
    async function init() {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchQrToken();
      await fetchAttendees();
      setLoading(false);
    }
    init();
  }, [sessionId, fetchQrToken, fetchAttendees]);

  // Load roster when session is set
  useEffect(() => {
    if (session?.course?._id) {
      fetchRoster(session.course._id);
    }
  }, [session?.course]);

  // Precision countdown ticker synced with server clock offset
  useEffect(() => {
    if (isPaused || !expiresAt) return;

    const intervalId = setInterval(() => {
      const nowServer = Date.now() + serverOffset;
      const msLeft = expiresAt - nowServer;

      if (msLeft <= 500) {
        // Window expired on server clock, fetch next window immediately
        fetchQrToken();
      } else {
        const secsLeft = Math.ceil(msLeft / 1000);
        setSecondsRemaining(Math.max(0, secsLeft));
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt, serverOffset, isPaused, fetchQrToken]);

  // If unpaused, immediately fetch fresh current window
  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      // Will trigger fresh fetch
      setTimeout(() => {
        fetchQrToken();
      }, 50);
    } else {
      setIsPaused(true);
    }
  };

  // Attendee polling interval (every 3s)
  useEffect(() => {
    const attendeeInterval = setInterval(fetchAttendees, 3000);
    return () => clearInterval(attendeeInterval);
  }, [fetchAttendees]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Close session action
  const handleCloseSession = async () => {
    if (!window.confirm('Are you sure you want to end and close this live attendance session?')) return;
    try {
      await api.post(`/sessions/${sessionId}/close`);
      toast.success('Live session closed.');
      navigate('/teacher/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to close session.');
    }
  };

  // Extend session time
  const handleExtendTime = async (mins) => {
    try {
      await api.post(`/sessions/${sessionId}/extend`, { additionalMinutes: mins });
      toast.success(`Session extended by ${mins} minutes!`);
      fetchQrToken();
    } catch (err) {
      toast.error(err.message || 'Failed to extend session.');
    }
  };

  // Manual mark student present
  const handleManualMark = async (studentId) => {
    setMarkingStudent(true);
    try {
      await api.post(`/sessions/${sessionId}/manual-mark`, {
        studentId,
        status: 'present',
        note: 'Marked manually by instructor on projector screen',
      });
      toast.success('Student marked present.');
      fetchAttendees();
      setShowManualModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to mark student.');
    } finally {
      setMarkingStudent(false);
    }
  };

  // Undo attendance mark
  const handleUndoMark = async (studentId) => {
    try {
      await api.delete(`/sessions/${sessionId}/attendance/${studentId}`);
      toast.success('Attendance mark revoked.');
      fetchAttendees();
    } catch (err) {
      toast.error(err.message || 'Failed to revoke attendance mark.');
    }
  };

  if (!sessionId) {
    return (
      <div className="py-20 text-center text-slate-500">
        <p className="text-sm font-semibold mb-3">No active live session selected.</p>
        <Link
          to="/teacher/dashboard"
          className="px-4 py-2 bg-brand-600 text-white font-bold text-xs rounded-xl shadow-md"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Initializing Live Synchronized QR Projector...</p>
      </div>
    );
  }

  // Circular countdown calculations
  const countdownRadius = 18;
  const countdownCircumference = 2 * Math.PI * countdownRadius;
  const countdownRatio = intervalSeconds > 0 ? Math.min(1, Math.max(0, secondsRemaining / intervalSeconds)) : 1;
  const countdownProgress = countdownRatio * countdownCircumference;

  return (
    <div className={`space-y-6 ${isFullscreen ? 'p-8 bg-slate-950 text-white min-h-screen' : ''}`}>
      {/* Top Projector Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/teacher/dashboard"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}`} />
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {session?.topic || 'Live Attendance'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {session?.course?.code} - {session?.course?.name} &bull; Room: {session?.room}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pause / Resume Button */}
          <button
            onClick={handleTogglePause}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              isPaused
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Rotation' : 'Pause Rotation'}</span>
          </button>

          {/* Extend Time */}
          <button
            onClick={() => handleExtendTime(5)}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>+5 Mins</span>
          </button>

          {/* Manual Mark Button */}
          <button
            onClick={() => setShowManualModal(true)}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mark Student Manually</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all"
            title="Toggle Projector Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* End Session Button */}
          <button
            onClick={handleCloseSession}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 active:scale-95 transition-all"
          >
            Close Session
          </button>
        </div>
      </div>

      {/* Main Dual Grid: Giant Rotating QR Projector (Left) vs Live Check-In Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Huge QR Code Screen (Projector Friendly) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center text-center">
          {/* Live Badge & Countdown Ring */}
          <div className="flex items-center justify-between w-full mb-6">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 text-xs font-black uppercase tracking-wider text-white rounded-full flex items-center gap-1.5 shadow-sm ${
                  isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white" />
                {isPaused ? 'Rotation Frozen' : 'Live Projector'}
              </span>
            </div>

            {/* Circular Countdown Ring */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg width="40" height="40" className="transform -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r={countdownRadius}
                    stroke="currentColor"
                    strokeWidth="3.5"
                    className="text-slate-200 dark:text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r={countdownRadius}
                    stroke={isPaused ? '#f59e0b' : '#4f46e5'}
                    strokeWidth="3.5"
                    strokeDasharray={countdownCircumference}
                    strokeDashoffset={countdownCircumference - countdownProgress}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-brand-600 dark:text-brand-400">
                  {isPaused ? '⏸' : `${secondsRemaining}s`}
                </span>
              </div>
              <span className="hidden sm:inline">
                {isPaused ? 'Paused' : `Rotates every ${intervalSeconds}s`}
              </span>
            </div>
          </div>

          {/* High-Contrast Projector-Optimized QR Code Display */}
          <motion.div
            key={code || qrPayload}
            initial={{ scale: 0.97, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="p-4 sm:p-8 bg-white rounded-3xl shadow-2xl border-4 border-slate-100 dark:border-slate-800 inline-block my-2 max-w-full"
          >
            {qrPayload ? (
              <QRCodeSVG
                value={qrPayload}
                size={320}
                level="M"
                marginSize={4}
                bgColor="#ffffff"
                fgColor="#000000"
                className="w-full max-w-[340px] h-auto aspect-square"
              />
            ) : (
              <div className="w-[320px] h-[320px] flex items-center justify-center text-slate-400">
                Generating QR Token...
              </div>
            )}
          </motion.div>

          {/* Prominent Synchronized Manual Session PIN Fallback */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 w-full max-w-md">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Synchronized Session PIN (6 Chars)
            </p>
            <span className="font-mono font-black text-3xl sm:text-4xl tracking-[0.3em] text-brand-600 dark:text-brand-400 select-all">
              {code || '------'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Students without camera access can enter this exact 6-character code
            </p>
          </div>
        </div>

        {/* Right Column: Live Attendees Check-in Feed */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col h-[580px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-500" />
                Live Check-in Roster
              </h2>
              <p className="text-xs text-slate-400">Real-time attendance stream</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400 font-mono">
                {attendees.length} / {totalEnrolled}
              </span>
              <p className="text-[10px] text-slate-400">
                {totalEnrolled > 0 ? Math.round((attendees.length / totalEnrolled) * 100) : 0}% Present
              </p>
            </div>
          </div>

          {/* Attendees List with Animated Entrances */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-1 py-2 space-y-1">
            {attendees.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse text-brand-500" />
                Waiting for students to scan QR code...
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {attendees.map((a, idx) => (
                  <motion.div
                    key={a._id}
                    initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(79, 70, 229, 0.15)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                    transition={{ duration: 0.3 }}
                    className="p-3 text-xs flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {a.student?.name || 'Student'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {a.student?.rollNo || 'CS---'} &bull;{' '}
                          {new Date(a.markedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {a.status}
                      </span>
                      <button
                        onClick={() => handleUndoMark(a.student?._id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                        title="Undo check-in"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Manual Mark Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Mark Student Manually
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an enrolled student to manually verify their presence
            </p>

            <input
              type="text"
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              placeholder="Search by name or roll number..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-3 text-slate-900 dark:text-white"
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {roster
                .filter((r) => {
                  if (!searchStudent) return true;
                  const q = searchStudent.toLowerCase();
                  return (
                    r.student?.name?.toLowerCase().includes(q) ||
                    r.student?.rollNo?.toLowerCase().includes(q)
                  );
                })
                .map((r) => {
                  const alreadyMarked = attendees.some((a) => a.student?._id === r.student?._id);

                  return (
                    <div
                      key={r.student?._id}
                      className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{r.student?.name}</p>
                        <p className="text-slate-400 font-mono text-[11px]">{r.student?.rollNo}</p>
                      </div>

                      {alreadyMarked ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Marked
                        </span>
                      ) : (
                        <button
                          disabled={markingStudent}
                          onClick={() => handleManualMark(r.student?._id)}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs"
                        >
                          Mark Present
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
