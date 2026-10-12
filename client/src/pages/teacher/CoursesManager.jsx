import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Plus,
  Upload,
  UserPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Download,
} from 'lucide-react';
import { api } from '../../api/client.js';
import toast from 'react-hot-toast';

export default function CoursesManager() {
  const [searchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || '';

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Modals
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showSingleEnrollModal, setShowSingleEnrollModal] = useState(false);
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);

  // Create course form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newSection, setNewSection] = useState('A');
  const [newRoom, setNewRoom] = useState('LH-101');
  const [newTotalPlanned, setNewTotalPlanned] = useState('40');
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Single enroll form state
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [enrollingSingle, setEnrollingSingle] = useState(false);

  // Bulk enroll form state
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [enrollingBulk, setEnrollingBulk] = useState(false);

  // Search in roster
  const [rosterSearch, setRosterSearch] = useState('');

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      const list = res.courses || [];
      setCourses(list);

      if (list.length > 0) {
        const found = initialCourseId ? list.find((c) => c._id === initialCourseId) : list[0];
        const toSelect = found || list[0];
        setSelectedCourse(toSelect);
        fetchRoster(toSelect._id);
      }
    } catch (err) {
      toast.error('Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (courseId) => {
    setLoadingRoster(true);
    try {
      const res = await api.get(`/courses/${courseId}/roster`);
      setRoster(res.roster || []);
    } catch (err) {
      toast.error('Failed to load roster.');
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    fetchRoster(course._id);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCreatingCourse(true);
    try {
      const res = await api.post('/courses', {
        code: newCode.toUpperCase().trim(),
        name: newName.trim(),
        department: newDept,
        section: newSection,
        roomDefault: newRoom,
        totalPlannedClasses: Number(newTotalPlanned),
      });

      toast.success('Course created successfully!');
      setShowCreateCourseModal(false);
      setNewCode('');
      setNewName('');
      fetchCourses();
    } catch (err) {
      toast.error(err.message || 'Failed to create course.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleSingleEnroll = async (e) => {
    e.preventDefault();
    if (!studentIdentifier.trim()) return;

    setEnrollingSingle(true);
    try {
      const res = await api.post(`/courses/${selectedCourse._id}/enroll`, {
        studentIdentifier: studentIdentifier.trim(),
      });
      toast.success(res.message);
      setShowSingleEnrollModal(false);
      setStudentIdentifier('');
      fetchRoster(selectedCourse._id);
    } catch (err) {
      toast.error(err.message || 'Failed to enroll student.');
    } finally {
      setEnrollingSingle(false);
    }
  };

  const handleBulkEnroll = async (e) => {
    e.preventDefault();
    // Parse roll numbers / emails from lines or comma-separated
    const identifiers = bulkCsvText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (identifiers.length === 0) {
      toast.error('Please enter at least one roll number or email.');
      return;
    }

    setEnrollingBulk(true);
    try {
      const res = await api.post(`/courses/${selectedCourse._id}/enroll-bulk`, {
        identifiers,
      });
      toast.success(res.message);
      setShowBulkEnrollModal(false);
      setBulkCsvText('');
      fetchRoster(selectedCourse._id);
    } catch (err) {
      toast.error(err.message || 'Failed to bulk enroll.');
    } finally {
      setEnrollingBulk(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this course?`)) return;

    try {
      await api.delete(`/courses/${selectedCourse._id}/enroll/${studentId}`);
      toast.success(`${studentName} removed from course.`);
      fetchRoster(selectedCourse._id);
    } catch (err) {
      toast.error(err.message || 'Failed to remove student.');
    }
  };

  const handleExportRosterCSV = () => {
    if (roster.length === 0) return;
    let csv = 'Roll No,Student Name,Email,Department,Section,Attended,Total Sessions,Percentage,Status\n';
    roster.forEach((r) => {
      const roll = r.student?.rollNo || '';
      const name = `"${r.student?.name || ''}"`;
      const email = r.student?.email || '';
      const dept = r.student?.department || '';
      const sec = r.student?.section || '';
      const att = r.attendance?.attended || 0;
      const total = r.attendance?.totalConducted || 0;
      const pct = r.attendance?.percentage || 0;
      const status = r.attendance?.isAtRisk ? 'BELOW 75%' : 'ELIGIBLE';
      csv += `${roll},${name},${email},${dept},${sec},${att},${total},${pct}%,${status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCourse?.code}_roster_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('Roster CSV downloaded!');
  };

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Loading course management...</p>
      </div>
    );
  }

  const filteredRoster = roster.filter((r) => {
    if (!rosterSearch) return true;
    const q = rosterSearch.toLowerCase();
    return (
      r.student?.name?.toLowerCase().includes(q) ||
      r.student?.rollNo?.toLowerCase().includes(q) ||
      r.student?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Courses & Roster Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create courses, enroll students individually or via CSV import, and inspect rosters
          </p>
        </div>

        <button
          onClick={() => setShowCreateCourseModal(true)}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </button>
      </div>

      {/* Course Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {courses.map((c) => (
          <button
            key={c._id}
            onClick={() => handleSelectCourse(c)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
              selectedCourse?._id === c._id
                ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>{c.code}</span>
            <span className="opacity-75 font-normal">&bull; {c.name}</span>
          </button>
        ))}
      </div>

      {/* Active Course View */}
      {selectedCourse && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-6">
          {/* Course Details Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  {selectedCourse.code}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedCourse.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Department: {selectedCourse.department} &bull; Section: {selectedCourse.section || 'A'} &bull; Default Room: {selectedCourse.roomDefault}
              </p>
            </div>

            {/* Roster Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowSingleEnrollModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Student</span>
              </button>

              <button
                onClick={() => setShowBulkEnrollModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk CSV Import</span>
              </button>

              <button
                onClick={handleExportRosterCSV}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Roster Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search students in roster..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <span className="text-xs font-bold text-slate-400">
              {filteredRoster.length} student(s) enrolled
            </span>
          </div>

          {/* Roster Table */}
          {loadingRoster ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading course roster...</div>
          ) : filteredRoster.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No students enrolled in this course yet. Use Add Student or Bulk CSV Import.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Roll No</th>
                    <th className="px-5 py-3.5">Student Name</th>
                    <th className="px-5 py-3.5">Attended / Total</th>
                    <th className="px-5 py-3.5">Attendance %</th>
                    <th className="px-5 py-3.5">Eligibility Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredRoster.map((r) => {
                    const isAtRisk = r.attendance?.isAtRisk;
                    const isApproaching = r.attendance?.isApproachingRisk;

                    return (
                      <tr key={r.student?._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono font-bold text-brand-600 dark:text-brand-400">
                          {r.student?.rollNo || '---'}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {r.student?.name}
                          <p className="text-[11px] font-normal text-slate-400">{r.student?.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                          {r.attendance?.attended || 0} / {r.attendance?.totalConducted || 0} classes
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-md ${
                              isAtRisk
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : isApproaching
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {r.attendance?.percentage || 0}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isAtRisk ? (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Below 75% (+{r.attendance?.classesToRecover} classes)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Eligible (can miss {r.attendance?.classesCanMiss})
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleRemoveStudent(r.student?._id, r.student?.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Remove student from roster"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Single Student Enroll Modal */}
      {showSingleEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Add Student to Course
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the student's roll number or email to enroll them into {selectedCourse?.code}
            </p>

            <form onSubmit={handleSingleEnroll} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Roll Number or Email
                </label>
                <input
                  type="text"
                  required
                  value={studentIdentifier}
                  onChange={(e) => setStudentIdentifier(e.target.value)}
                  placeholder="e.g. CS001 or aravind@smartattend.edu"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSingleEnrollModal(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollingSingle}
                  className="flex-1 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md"
                >
                  {enrollingSingle ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showBulkEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Bulk Student Enrollment (CSV)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste roll numbers or emails (one per line or comma-separated) to enroll multiple students at once:
            </p>

            <form onSubmit={handleBulkEnroll} className="space-y-4">
              <div>
                <textarea
                  rows={6}
                  required
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder={"CS001\nCS002\nCS003\nriya.sharma@smartattend.edu"}
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkEnrollModal(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollingBulk}
                  className="flex-1 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md"
                >
                  {enrollingBulk ? 'Importing...' : 'Enroll Students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Create New Course
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a new course curriculum to your faculty schedule
            </p>

            <form onSubmit={handleCreateCourse} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. CS401"
                    className="w-full px-3.5 py-2 text-xs uppercase font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    required
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder="e.g. A"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Default Room
                  </label>
                  <input
                    type="text"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    placeholder="e.g. LH-101"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Total Classes Planned
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newTotalPlanned}
                    onChange={(e) => setNewTotalPlanned(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="flex-1 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md"
                >
                  {creatingCourse ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
