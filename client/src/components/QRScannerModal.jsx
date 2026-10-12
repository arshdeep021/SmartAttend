import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RefreshCw, KeyRound, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';

export default function QRScannerModal({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [marking, setMarking] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const scannerRef = useRef(null);
  const isStoppingRef = useRef(false);
  const scannerContainerId = 'qr-reader-viewport';

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#14b8a6', '#f59e0b'],
      });
    } catch (e) {
      // Fallback
    }
  };

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    if (scannerRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Safe catch on cleanup
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
        setScanning(false);
      }
    }
  }, []);

  const handleMarkAttendance = useCallback(async (payload) => {
    if (marking) return;
    setMarking(true);
    setErrorFeedback(null);

    // CRITICAL: Stop camera immediately upon detection
    await stopScanner();

    try {
      const res = await api.post('/attendance/mark', payload);
      setSuccessData(res);
      triggerConfetti();
      if (onSuccess) onSuccess(res);
    } catch (err) {
      let friendlyMsg = err.message || 'Could not verify attendance.';
      if (err.code === 'DUPLICATE_ATTENDANCE' || err.message?.includes('already')) {
        friendlyMsg = 'Already marked: Your attendance has already been recorded for this session.';
      } else if (err.code === 'NOT_ENROLLED' || err.message?.includes('not enrolled')) {
        friendlyMsg = 'Course mismatch: You are not enrolled in this course.';
      } else if (err.code === 'CODE_EXPIRED' || err.message?.includes('expired')) {
        friendlyMsg = 'Code expired: The QR code or PIN has expired. Please scan the current refreshed code on the screen.';
      } else if (err.code === 'SESSION_CLOSED' || err.message?.includes('closed')) {
        friendlyMsg = 'Session closed: This attendance session has ended.';
      }
      setErrorFeedback(friendlyMsg);
    } finally {
      setMarking(false);
    }
  }, [marking, stopScanner, onSuccess]);

  const startScanner = useCallback(async (cameraConfig) => {
    try {
      await stopScanner();
      setCameraError(null);
      setErrorFeedback(null);

      // Check for insecure context (e.g., LAN IP over plain HTTP)
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!window.isSecureContext && !isLocal) {
        setCameraError('Camera access requires HTTPS. Insecure HTTP connections over LAN or the web block phone cameras. Please access via HTTPS or use manual PIN entry.');
        return;
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5QrCode;

      // Compute qrbox as percentage of the viewport
      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
        return { width: edge, height: edge };
      };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Parse scanned payload (handles short URLs like /scan?s=...&c=... or raw tokens)
          let payload = { qrPayload: decodedText };
          try {
            if (decodedText.includes('?s=') || decodedText.includes('&s=') || decodedText.includes('&c=') || decodedText.includes('?c=')) {
              const url = new URL(decodedText, window.location.origin);
              const s = url.searchParams.get('s');
              const c = url.searchParams.get('c');
              if (s && c) {
                payload = { sessionId: s, code: c };
              }
            }
          } catch (e) {
            // Keep default payload
          }

          await handleMarkAttendance(payload);
        },
        () => {
          // Ignore individual frame decode misses
        }
      );
      setScanning(true);
    } catch (err) {
      console.warn('Camera scanner start warning:', err);
      let msg = err.message || 'Failed to start camera scanner.';
      if (err.name === 'NotAllowedError' || msg.includes('Permission')) {
        msg = 'Camera permission denied. Please allow camera access in your browser settings or use manual PIN entry.';
      } else if (err.name === 'NotFoundError' || msg.includes('No camera')) {
        msg = 'No camera found on this device. Please use manual session PIN entry.';
      }
      setCameraError(msg);
      setScanning(false);
    }
  }, [stopScanner, handleMarkAttendance]);

  // Discover and initialize cameras
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || successData) {
      stopScanner();
      return;
    }

    // Default to back camera using facingMode: "environment"
    startScanner({ facingMode: 'environment' });

    // Also populate camera device list if available
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch(() => {
        // If device enumeration is blocked, facingMode environment already attempted above
      });

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab, successData, startScanner, stopScanner]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleMarkAttendance({ manualCode: manualCode.trim().toUpperCase() });
  };

  const handleResetAndScanAgain = () => {
    setSuccessData(null);
    setErrorFeedback(null);
    setManualCode('');
    if (activeTab === 'camera') {
      startScanner(selectedCameraId ? selectedCameraId : { facingMode: 'environment' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
      >
        {/* Header with Close */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Mark Live Attendance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan teacher's projector QR or enter rotating PIN
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Camera vs Manual Code */}
        {!successData && (
          <div className="px-5 pt-3 pb-1 flex gap-2">
            <button
              onClick={() => {
                setActiveTab('camera');
                setErrorFeedback(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              Camera Scanner
            </button>
            <button
              onClick={() => {
                setActiveTab('manual');
                stopScanner();
                setErrorFeedback(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Manual 6-Char PIN
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 flex flex-col justify-center">
          {/* SUCCESS STATE */}
          {successData ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-6 flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                Verified Present
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                {successData.message}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {successData.record?.courseName} ({successData.record?.courseCode})
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Topic: {successData.record?.sessionTopic} &bull; {new Date(successData.record?.markedAt).toLocaleTimeString()}
              </p>

              {successData.metrics && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs w-full max-w-xs">
                  <div className="flex justify-between font-semibold">
                    <span>Course Attendance:</span>
                    <span className={successData.metrics.isAtRisk ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>
                      {successData.metrics.percentage}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {successData.metrics.attended} of {successData.metrics.totalConducted} classes attended
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="mt-6 px-6 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg transition-all"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <>
              {/* ERROR ALERT IF ANY */}
              {errorFeedback && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{errorFeedback}</p>
                    <button
                      onClick={handleResetAndScanAgain}
                      className="mt-1.5 text-xs font-bold underline hover:text-red-800 dark:hover:text-red-200 block"
                    >
                      Scan Again
                    </button>
                  </div>
                </div>
              )}

              {/* CAMERA SCANNER VIEW */}
              {activeTab === 'camera' && (
                <div>
                  {cameraError ? (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <Camera className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">{cameraError}</p>
                      <button
                        onClick={() => setActiveTab('manual')}
                        className="px-4 py-2 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 rounded-xl"
                      >
                        Switch to Manual PIN Entry
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Camera Viewport with Futuristic Corner Frames */}
                      <div className="relative overflow-hidden rounded-2xl bg-black aspect-square flex items-center justify-center border-2 border-brand-500/30">
                        <div id={scannerContainerId} className="w-full h-full" />

                        {/* Scanner crosshair overlay */}
                        <div className="absolute inset-10 border border-white/20 rounded-xl pointer-events-none flex flex-col justify-between">
                          <div className="flex justify-between">
                            <span className="w-4 h-4 border-t-2 border-l-2 border-brand-400" />
                            <span className="w-4 h-4 border-t-2 border-r-2 border-brand-400" />
                          </div>
                          <div className="flex justify-between">
                            <span className="w-4 h-4 border-b-2 border-l-2 border-brand-400" />
                            <span className="w-4 h-4 border-b-2 border-r-2 border-brand-400" />
                          </div>
                        </div>

                        {marking && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                            <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mb-2" />
                            <span className="text-xs font-semibold">Verifying attendance code...</span>
                          </div>
                        )}
                      </div>

                      {/* Camera Switcher if multiple detected */}
                      {cameras.length > 1 && (
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Camera Source:</span>
                          <select
                            value={selectedCameraId}
                            onChange={(e) => {
                              setSelectedCameraId(e.target.value);
                              startScanner(e.target.value);
                            }}
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1"
                          >
                            {cameras.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label || `Camera ${c.id.slice(0, 5)}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MANUAL CODE ENTRY VIEW */}
              {activeTab === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter the 6-character PIN displayed on the teacher's projector screen:
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 7X9K2M"
                      autoFocus
                      className="w-full text-center tracking-[0.4em] font-mono font-extrabold text-2xl uppercase py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={marking || manualCode.trim().length !== 6}
                    className="w-full py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 active:scale-95 transition-all rounded-xl shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
                  >
                    {marking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify Attendance PIN
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
