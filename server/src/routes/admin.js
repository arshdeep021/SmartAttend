import { Router } from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Session from '../models/Session.js';
import Attendance from '../models/Attendance.js';
import Enrollment from '../models/Enrollment.js';
import SystemSetting from '../models/SystemSetting.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateAttendanceMetrics } from '../utils/attendanceCalculator.js';

const router = Router();
router.use(authenticate, authorize('admin'));

// GET /api/admin/pending-teachers - Get teachers awaiting approval
router.get('/pending-teachers', async (req, res, next) => {
  try {
    const pending = await User.find({ role: 'teacher', approved: false }).sort({ createdAt: -1 });
    res.json({ success: true, pendingTeachers: pending });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/approve-teacher/:id - Approve teacher account
router.post('/approve-teacher/:id', async (req, res, next) => {
  try {
    const teacher = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'teacher' },
      { approved: true },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher account not found.' });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: 'TEACHER_APPROVED',
      targetType: 'User',
      targetId: String(teacher._id),
      details: { name: teacher.name, email: teacher.email },
      ip: req.ip || '',
    });

    await Notification.create({
      user: teacher._id,
      type: 'approval',
      title: 'Teacher Account Approved',
      message: 'Your instructor account has been approved by the administrator. You now have full access to create courses and sessions.',
    });

    res.json({
      success: true,
      message: `Teacher account for ${teacher.name} approved successfully.`,
      teacher,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reject-teacher/:id - Reject / Remove teacher account
router.post('/reject-teacher/:id', async (req, res, next) => {
  try {
    const teacher = await User.findOneAndDelete({ _id: req.params.id, role: 'teacher', approved: false });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Pending teacher account not found.' });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: 'TEACHER_REJECTED',
      targetType: 'User',
      targetId: String(teacher._id),
      details: { name: teacher.name, email: teacher.email },
      ip: req.ip || '',
    });

    res.json({ success: true, message: `Teacher account for ${teacher.name} has been rejected.` });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users - User directory with filters and search
router.get('/users', async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role && ['student', 'teacher', 'admin'].includes(role)) {
      filter.role = role;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { rollNo: regex }, { department: regex }];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/toggle-status - Activate/Deactivate user
router.put('/users/:id/toggle-status', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own admin account.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await AuditLog.create({
      actor: req.user._id,
      action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: String(user._id),
      details: { name: user.name, email: user.email, isActive: user.isActive },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: `User ${user.name} is now ${user.isActive ? 'Active' : 'Deactivated'}.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/settings - Global system settings
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await SystemSetting.findOne({ key: 'global_config' });
    if (!settings) {
      settings = await SystemSetting.create({ key: 'global_config' });
    }
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings - Update global system settings
router.put('/settings', async (req, res, next) => {
  try {
    const { attendanceThreshold, qrRefreshInterval, qrTokenExpiry, lateGraceMinutes, emailAlertsEnabled, institutionName } = req.body;

    let settings = await SystemSetting.findOne({ key: 'global_config' });
    if (!settings) {
      settings = new SystemSetting({ key: 'global_config' });
    }

    if (attendanceThreshold !== undefined) settings.attendanceThreshold = Number(attendanceThreshold);
    if (qrRefreshInterval !== undefined) settings.qrRefreshInterval = Number(qrRefreshInterval);
    if (qrTokenExpiry !== undefined) settings.qrTokenExpiry = Number(qrTokenExpiry);
    if (lateGraceMinutes !== undefined) settings.lateGraceMinutes = Number(lateGraceMinutes);
    if (emailAlertsEnabled !== undefined) settings.emailAlertsEnabled = Boolean(emailAlertsEnabled);
    if (institutionName !== undefined) settings.institutionName = institutionName;

    await settings.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'SETTINGS_UPDATED',
      targetType: 'SystemSetting',
      targetId: String(settings._id),
      details: req.body,
      ip: req.ip || '',
    });

    res.json({ success: true, message: 'System settings updated successfully.', settings });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs - Audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 25, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/analytics - System-wide dashboard analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const threshold = settings?.attendanceThreshold || 75;

    const [totalStudents, totalTeachers, pendingTeachersCount, totalCourses, totalSessions, totalAttendanceMarks] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher', approved: true }),
      User.countDocuments({ role: 'teacher', approved: false }),
      Course.countDocuments(),
      Session.countDocuments(),
      Attendance.countDocuments(),
    ]);

    // Active live sessions right now
    const now = new Date();
    const activeSessionsCount = await Session.countDocuments({ status: 'open', endTime: { $gt: now } });

    // Calculate campus-wide at-risk students count
    const courses = await Course.find();
    let totalEnrollmentInstances = 0;
    let atRiskInstances = 0;

    for (const course of courses) {
      const courseSessionsCount = await Session.countDocuments({ course: course._id });
      if (courseSessionsCount === 0) continue;

      const enrollments = await Enrollment.find({ course: course._id });
      totalEnrollmentInstances += enrollments.length;

      for (const enr of enrollments) {
        const attended = await Attendance.countDocuments({
          student: enr.student,
          course: course._id,
          status: { $in: ['present', 'late'] },
        });

        const metrics = calculateAttendanceMetrics(attended, courseSessionsCount, threshold);
        if (metrics.isAtRisk) {
          atRiskInstances++;
        }
      }
    }

    res.json({
      success: true,
      analytics: {
        totalStudents,
        totalTeachers,
        pendingTeachersCount,
        totalCourses,
        totalSessions,
        totalAttendanceMarks,
        activeSessionsCount,
        totalEnrollmentInstances,
        atRiskInstances,
        threshold,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
