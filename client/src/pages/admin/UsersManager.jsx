import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Filter,
  Shield,
  UserCheck,
  RefreshCw,
  Power,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  X,
  Mail,
  User,
  GraduationCap,
} from "lucide-react";
import { api } from "../../api/client.js";
import toast from "react-hot-toast";

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [notEnrolledFilter, setNotEnrolledFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Courses list for enrollment picker
  const [availableCourses, setAvailableCourses] = useState([]);

  // Create / Edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalRole, setModalRole] = useState("student");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    department: "Computer Science",
    rollNo: "",
    section: "A",
    courseIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirmation modal state
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch users from server (Never relies on stale optimistic state)
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(notEnrolledFilter ? { notEnrolledOnly: "true" } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      });

      const res = await api.get(`/admin/users?${queryParams.toString()}`);
      setUsers(res.users || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err) {
      toast.error("Failed to load user directory.");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, notEnrolledFilter, searchQuery]);

  // Fetch courses for enrollment checklist
  const fetchCourses = async () => {
    try {
      const res = await api.get("/courses");
      setAvailableCourses(res.courses || []);
    } catch (e) {
      console.error("Failed to load courses for user creator:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openAddModal = (initialRole = "student") => {
    setEditingUser(null);
    setModalRole(initialRole);
    setFormError("");
    setFormData({
      name: "",
      email: "",
      password: "",
      department: "Computer Science",
      rollNo: "",
      section: "A",
      courseIds: [],
    });
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setModalRole(user.role);
    setFormError("");
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      department: user.department || "Computer Science",
      rollNo: user.rollNo || "",
      section: user.section || "A",
      courseIds: (user.enrolledCourses || []).map((c) => c._id || c),
    });
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload = {
        role: modalRole,
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department.trim(),
        courseIds: formData.courseIds,
      };

      if (formData.password?.trim()) {
        payload.password = formData.password.trim();
      }

      if (modalRole === "student") {
        payload.rollNo = formData.rollNo.trim();
        payload.section = formData.section.trim();
      }

      if (editingUser) {
        await api.put(`/admin/users/${editingUser._id}`, payload);
        toast.success(`User ${payload.name} updated successfully.`);
      } else {
        await api.post("/admin/users", payload);
        toast.success(
          `${modalRole === "student" ? "Student" : "Teacher"} created and approved successfully!`,
        );
      }

      setShowAddModal(false);
      // Refresh strictly from the server to guarantee consistency
      await fetchUsers();
    } catch (err) {
      setFormError(
        err.message || "Operation failed. Please verify input fields.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const res = await api.put(`/admin/users/${user._id}/toggle-status`);
      toast.success(res.message);
      await fetchUsers();
    } catch (err) {
      toast.error(err.message || "Failed to toggle status.");
    }
  };

  const handleApproveTeacherDirect = async (teacher) => {
    try {
      const res = await api.post(`/admin/approve-teacher/${teacher._id}`);
      toast.success(res.message || `Approved ${teacher.name}`);
      await fetchUsers();
    } catch (err) {
      toast.error(err.message || "Failed to approve teacher.");
    }
  };

  const initiateDelete = (user) => {
    setDeleteCandidate(user);
    setDeleteWarning("");
  };

  const confirmDelete = async (force = false) => {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      await api.delete(
        `/admin/users/${deleteCandidate._id}${force ? "?force=true" : ""}`,
      );
      toast.success(`User ${deleteCandidate.name} removed successfully.`);
      setDeleteCandidate(null);
      await fetchUsers();
    } catch (err) {
      if (err.code === "HAS_ATTENDANCE_RECORDS") {
        setDeleteWarning(err.message);
      } else {
        toast.error(err.message || "Failed to delete user.");
        setDeleteCandidate(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            User Directory & Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create, manage, and enroll student, teacher, and administrator
            accounts ({totalCount} total)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openAddModal("student")}
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
          <button
            onClick={() => openAddModal("teacher")}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teacher</span>
          </button>
          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, roll no..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
          >
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Faculty / Teachers</option>
            <option value="admin">Administrators</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setNotEnrolledFilter(!notEnrolledFilter);
              setPage(1);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              notEnrolledFilter
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            }`}
          >
            {notEnrolledFilter
              ? "Showing: Not Enrolled Only"
              : "Filter: Unenrolled Students"}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mb-2" />
            Loading user directory from database...
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No matching users found in directory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Roll No / Section</th>
                  <th className="px-6 py-3.5">Courses</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 font-bold flex items-center justify-center text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {u.name}
                            </p>
                            {u.role === "teacher" && !u.approved && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Pending Approval
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                            : u.role === "teacher"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {u.department}
                    </td>

                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                      {u.rollNo ? `${u.rollNo} (${u.section || "A"})` : "N/A"}
                    </td>

                    <td className="px-6 py-4">
                      {u.role === "student" ? (
                        u.enrolledCoursesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <BookOpen className="w-3 h-3 text-brand-500" />
                            {u.enrolledCoursesCount} course
                            {u.enrolledCoursesCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Not Enrolled
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        }`}
                      >
                        {u.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.role === "teacher" && !u.approved && (
                          <button
                            onClick={() => handleApproveTeacherDirect(u)}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Approve teacher access"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit user details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {u.role !== "admin" && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg text-xs font-semibold ${
                                u.isActive
                                  ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                              title={
                                u.isActive
                                  ? "Deactivate user"
                                  : "Reactivate user"
                              }
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => initiateDelete(u)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600" />
                {editingUser
                  ? `Edit Account: ${editingUser.name}`
                  : `Create New ${modalRole === "student" ? "Student" : "Teacher"}`}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              {!editingUser && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Account Role
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModalRole("student")}
                      className={`flex-1 py-2 font-bold rounded-xl border ${
                        modalRole === "student"
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalRole("teacher")}
                      className={`flex-1 py-2 font-bold rounded-xl border ${
                        modalRole === "teacher"
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="name@smartattend.edu"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {modalRole === "student" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.rollNo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rollNo: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g. CS042"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Section
                    </label>
                    <input
                      type="text"
                      value={formData.section}
                      onChange={(e) =>
                        setFormData({ ...formData, section: e.target.value })
                      }
                      placeholder="A"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="Computer Science"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Password {editingUser && "(Leave blank to keep unchanged)"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={
                    editingUser
                      ? "••••••••"
                      : `Default: ${modalRole === "student" ? "Student@123" : "Teacher@123"}`
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {/* Course Enrollment Selection for Students */}
              {modalRole === "student" && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Assign / Enroll in Courses
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Select courses to enroll this student into so they
                    immediately appear in rosters and sessions
                  </p>
                  <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    {availableCourses.map((c) => {
                      const isChecked = formData.courseIds.includes(c._id);
                      return (
                        <label
                          key={c._id}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  courseIds: [...formData.courseIds, c._id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  courseIds: formData.courseIds.filter(
                                    (id) => id !== c._id,
                                  ),
                                });
                              }
                            }}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {c.code}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            &bull; {c.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingUser ? "Save Changes" : "Create User"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Account: {deleteCandidate.name}
              </h3>
            </div>

            {deleteWarning ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs mb-4">
                <p className="font-bold mb-1">Attendance Records Detected</p>
                <p>{deleteWarning}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                Are you sure you want to permanently delete{" "}
                {deleteCandidate.name} ({deleteCandidate.email})?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>

              {deleteWarning ? (
                <>
                  <button
                    onClick={() => {
                      handleToggleStatus(deleteCandidate);
                      setDeleteCandidate(null);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                  >
                    Deactivate Instead (Recommended)
                  </button>
                  <button
                    disabled={deleting}
                    onClick={() => confirmDelete(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                  >
                    Force Delete
                  </button>
                </>
              ) : (
                <button
                  disabled={deleting}
                  onClick={() => confirmDelete(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                >
                  Delete User
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
