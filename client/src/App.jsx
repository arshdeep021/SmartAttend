import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext.jsx';

import Layout from './components/Layout.jsx';
import LandingPage from './pages/landing/LandingPage.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';

// Student
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import StudentScan from './pages/student/StudentScan.jsx';
import AttendanceHistory from './pages/student/AttendanceHistory.jsx';
import Timetable from './pages/student/Timetable.jsx';
import NotificationsPage from './pages/student/NotificationsPage.jsx';
import ProfilePage from './pages/student/ProfilePage.jsx';

// Teacher
import TeacherDashboard from './pages/teacher/TeacherDashboard.jsx';
import LiveSessionQR from './pages/teacher/LiveSessionQR.jsx';
import CoursesManager from './pages/teacher/CoursesManager.jsx';
import TeacherReports from './pages/teacher/TeacherReports.jsx';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import TeacherApprovals from './pages/admin/TeacherApprovals.jsx';
import UsersManager from './pages/admin/UsersManager.jsx';
import SystemSettings from './pages/admin/SystemSettings.jsx';
import AuditLogsViewer from './pages/admin/AuditLogsViewer.jsx';

// Protected Route Guard
function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to their own dashboard
    if (user?.role === 'student') return <Navigate to="/student/dashboard" replace />;
    if (user?.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '16px',
            background: '#0f172a',
            color: '#fff',
            fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Student Portal */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="scan" element={<StudentScan />} />
          <Route path="history" element={<AttendanceHistory />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Teacher Portal */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/teacher/dashboard" replace />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="live" element={<LiveSessionQR />} />
          <Route path="courses" element={<CoursesManager />} />
          <Route path="reports" element={<TeacherReports />} />
        </Route>

        {/* Admin Portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="approvals" element={<TeacherApprovals />} />
          <Route path="users" element={<UsersManager />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="audit-logs" element={<AuditLogsViewer />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
