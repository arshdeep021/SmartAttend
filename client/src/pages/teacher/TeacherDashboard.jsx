import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Radio,
  BookOpen,
  AlertTriangle,
  Plus,
  Play,
  ArrowRight,
  RefreshCw,
  Bell,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../api/client.js";
import toast from "react-hot-toast";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [topic, setTopic] = useState("");
  const [room, setRoom] = useState("");
  const [duration, setDuration] = useState("15");
  const [creatingSession, setCreatingSession] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [coursesRes, sessionsRes] = await Promise.all([
        api.get("/courses"),
        api.get("/sessions"),
      ]);
      setCourses(coursesRes.courses || []);
      setSessions(sessionsRes.sessions || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !topic.trim()) {
      toast.error("Please select a course and topic.");
      return;
    }

    setCreatingSession(true);
    try {
      const res = await api.post("/sessions", {
        courseId: selectedCourseId,
        topic: topic.trim(),
        room: room.trim() || undefined,
        durationMinutes: Number(duration),
      });

      toast.success("Live session started!");
      navigate(`/teacher/live?sessionId=${res.session._id}`);
    } catch (err) {
      toast.error(err.message || "Failed to start session.");
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await api.post(
        "/notifications/send-low-attendance-reminders",
        {},
      );
      toast.success(res.message || "Low-attendance reminders dispatched!");
    } catch (err) {
      toast.error(err.message || "Failed to dispatch reminders.");
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Loading faculty dashboard...</p>
      </div>
    );
  }

  const activeSessions = sessions.filter(
    (s) => s.status === "open" && new Date(s.endTime) > new Date(),
  );

  const totalStudents = courses.reduce(
    (sum, c) => sum + (c.enrolledStudentsCount || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Instructor Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage live class sessions, student rosters, rotating QR projectors
            & audit logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-600/25 active:scale-95 transition-all flex items-center gap-2"
          >
            <Radio className="w-4 h-4" />
            <span>Start Live Session</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">
              My Courses
            </span>
            <BookOpen className="w-5 h-5 text-brand-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {courses.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Assigned teaching subjects
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Active Students
            </span>
            <Users className="w-5 h-5 text-teal-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {totalStudents}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Enrolled across all courses
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Live Sessions Now
            </span>
            <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {activeSessions.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Currently open for check-in
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Total Sessions Held
            </span>
            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {sessions.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Historical lecture sessions
          </p>
        </div>
      </div>

      {/* Live Active Sessions Alert Box */}
      {activeSessions.length > 0 && (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/40 dark:bg-emerald-950/20 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                Live Attendance Session In Progress!
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {activeSessions.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((s) => (
              <div
                key={s._id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between shadow-sm"
              >
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-500/10 text-brand-600 rounded">
                    {s.course?.code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {s.topic}
                  </h3>
                  <p className="text-xs text-slate-400">
                    PIN:{" "}
                    <strong className="font-mono text-brand-600">
                      {s.code}
                    </strong>{" "}
                    &bull; Room: {s.room}
                  </p>
                </div>

                <Link
                  to={`/teacher/live?sessionId=${s._id}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Open Projector Screen
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              My Courses & Student Rosters
            </h2>
            <p className="text-xs text-slate-400">
              Click any course to manage roster or view attendance breakdown
            </p>
          </div>
          <Link
            to="/teacher/courses"
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            Manage Courses &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div
              key={c._id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                    {c.code}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Sec {c.section || "A"}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                  {c.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {c.enrolledStudentsCount || 0} students enrolled &bull;{" "}
                  {c.totalSessionsConducted || 0} sessions held
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setSelectedCourseId(c._id);
                    setTopic(`Session ${c.totalSessionsConducted + 1}`);
                    setRoom(c.roomDefault || "LH-101");
                    setShowCreateModal(true);
                  }}
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Quick Live
                </button>
                <Link
                  to={`/teacher/courses?courseId=${c._id}`}
                  className="font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Roster &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start Live Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Start Live Attendance Session
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Launches rotating QR code and opens live check-in screen
            </p>

            <form onSubmit={handleStartSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Course
                </label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Session Topic / Chapter
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Binary Search Trees & AVL Balancing"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Room / Hall
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. LH-101"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSession}
                  className="flex-1 py-2.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md"
                >
                  {creatingSession ? "Starting..." : "Launch Projector QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
