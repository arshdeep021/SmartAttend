import React, { useState, useEffect } from 'react';
import { UserCheck, CheckCircle2, XCircle, RefreshCw, Mail, Calendar, Shield } from 'lucide-react';
import { api } from '../../api/client.js';
import toast from 'react-hot-toast';

export default function TeacherApprovals() {
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/pending-teachers');
      setPendingTeachers(res.pendingTeachers || []);
    } catch (err) {
      toast.error('Failed to load pending teachers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id, name) => {
    setProcessingId(id);
    try {
      const res = await api.post(`/admin/approve-teacher/${id}`);
      toast.success(res.message || `Teacher ${name} approved!`);
      setPendingTeachers((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to approve teacher.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to reject the teacher registration for ${name}?`)) return;

    setProcessingId(id);
    try {
      const res = await api.post(`/admin/reject-teacher/${id}`);
      toast.success(res.message || `Teacher ${name} rejected.`);
      setPendingTeachers((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to reject teacher.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Teacher & Faculty Approvals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review and grant access to instructors before they can log in and manage classes
          </p>
        </div>

        <button
          onClick={fetchPending}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-900 transition-colors"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mb-2" />
            Loading pending approval queue...
          </div>
        ) : pendingTeachers.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/60" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Approval Queue Clear
            </p>
            <p className="mt-1 text-slate-400 max-w-sm mx-auto">
              All faculty registrations have been reviewed. New teacher registrations will appear here for verification.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingTeachers.map((teacher) => (
              <div
                key={teacher._id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {teacher.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {teacher.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{teacher.email}</span>
                      <span>&bull;</span>
                      <span>Department: {teacher.department}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Registered on {new Date(teacher.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    disabled={processingId === teacher._id}
                    onClick={() => handleReject(teacher._id, teacher.name)}
                    className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded-xl transition-all"
                  >
                    Reject
                  </button>
                  <button
                    disabled={processingId === teacher._id}
                    onClick={() => handleApprove(teacher._id, teacher.name)}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
