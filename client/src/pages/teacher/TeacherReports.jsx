import React, { useState, useEffect } from "react";
import {
  FileBarChart,
  Download,
  Printer,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import { api } from "../../api/client.js";
import toast from "react-hot-toast";

export default function TeacherReports() {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [rosterData, setRosterData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  // Audit Edit modal
  const [editingRecord, setEditingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState("present");
  const [auditReason, setAuditReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchCourses = async () => {
    try {
      const res = await api.get("/courses");
      const list = res.courses || [];
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourseId(list[0]._id);
        fetchRoster(list[0]._id);
      }
    } catch (err) {
      toast.error("Failed to load courses.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (courseId) => {
    setLoading(true);
    try {
      const res = await api.get(`/courses/${courseId}/roster`);
      setRosterData(res.roster || []);
    } catch (err) {
      toast.error("Failed to load roster report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCourseChange = (id) => {
    setSelectedCourseId(id);
    fetchRoster(id);
  };

  const handleSendLowAttendanceReminders = async () => {
    setSendingAlerts(true);
    try {
      const res = await api.post(
        "/notifications/send-low-attendance-reminders",
        {
          courseId: selectedCourseId,
        },
      );
      toast.success(res.message || "Reminders dispatched to at-risk students!");
    } catch (err) {
      toast.error(err.message || "Failed to dispatch reminders.");
    } finally {
      setSendingAlerts(false);
    }
  };

  const handleExportCSV = () => {
    if (rosterData.length === 0) return;
    const currentCourse = courses.find((c) => c._id === selectedCourseId);
    let csv =
      "Roll No,Student Name,Email,Department,Attended,Total Sessions,Percentage,Status,Classes Needed\n";

    rosterData.forEach((r) => {
      const roll = r.student?.rollNo || "";
      const name = `"${r.student?.name || ""}"`;
      const email = r.student?.email || "";
      const dept = r.student?.department || "";
      const att = r.attendance?.attended || 0;
      const total = r.attendance?.totalConducted || 0;
      const pct = r.attendance?.percentage || 0;
      const status = r.attendance?.isAtRisk ? "AT RISK (<75%)" : "ELIGIBLE";
      const needed = r.attendance?.classesToRecover || 0;
      csv += `${roll},${name},${email},${dept},${att},${total},${pct}%,${status},${needed}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentCourse?.code || "course"}_attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Report CSV exported successfully!");
  };

  const atRiskStudents = rosterData.filter((r) => r.attendance?.isAtRisk);
  const currentCourse = courses.find((c) => c._id === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Course Attendance Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Official department compliance logs, eligibility tracking & bulk
            warning dispatches
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSendLowAttendanceReminders}
            disabled={sendingAlerts || atRiskStudents.length === 0}
            className="px-4 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>Notify {atRiskStudents.length} At-Risk Student(s)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-brand-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-teal-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Course Selector Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase">
            Select Course:
          </span>
          <select
            value={selectedCourseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            className="text-xs font-bold py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        {currentCourse && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">
              Total Sessions Conducted:{" "}
              <strong>{rosterData[0]?.attendance?.totalConducted || 0}</strong>
            </span>
            <span className="text-slate-500">
              Enrolled: <strong>{rosterData.length}</strong>
            </span>
            <span className="text-red-500 font-bold">
              At-Risk (&lt;75%): <strong>{atRiskStudents.length}</strong>
            </span>
          </div>
        )}
      </div>

      {/* At-Risk Callout Banner if any */}
      {atRiskStudents.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 flex items-start gap-3.5">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-bold text-sm text-red-900 dark:text-red-200">
              {atRiskStudents.length} Student(s) Currently Below 75% Mandatory
              Attendance
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              These students are at risk of exam debarment. Click "Notify
              At-Risk Students" above to dispatch high-priority warning
              notifications and emails.
            </p>
          </div>
        </div>
      )}

      {/* Detailed Roster Report Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading report...
          </div>
        ) : rosterData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No records available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Roll No</th>
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5">Attended / Total</th>
                  <th className="px-6 py-3.5">Attendance %</th>
                  <th className="px-6 py-3.5">Recovery classes</th>
                  <th className="px-6 py-3.5">Academic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {rosterData.map((r) => {
                  const isAtRisk = r.attendance?.isAtRisk;
                  const isApproaching = r.attendance?.isApproachingRisk;

                  return (
                    <tr
                      key={r.student?._id}
                      className={`transition-colors ${
                        isAtRisk
                          ? "bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {r.student?.rollNo || "---"}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {r.student?.name}
                        <p className="text-[11px] font-normal text-slate-400">
                          {r.student?.email}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.attendance?.attended || 0} of{" "}
                        {r.attendance?.totalConducted || 0} classes
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-black text-xs px-2.5 py-1 rounded-md ${
                            isAtRisk
                              ? "bg-red-600 text-white shadow-sm shadow-red-500/20 animate-pulse"
                              : isApproaching
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {r.attendance?.percentage || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {isAtRisk ? (
                          <span className="text-red-600 dark:text-red-400 font-bold">
                            +{r.attendance?.classesToRecover} consecutive
                            classes
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Can miss {r.attendance?.classesCanMiss}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isAtRisk ? (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                            Below 75%
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Compliant
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
