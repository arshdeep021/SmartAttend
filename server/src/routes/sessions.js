import { Router } from 'express';
import Session from '../models/Session.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateWindowSessionData } from '../utils/qrToken.js';
import { getDefaultRotationInterval, getClientUrl } from '../config/env.js';

const router = Router();
router.use(authenticate);

// Helper to get active rotation interval from settings
async function getActiveInterval() {
  const setting = await SystemSetting.findOne({ key: 'global_config' }).select('qrRefreshInterval');
  return setting?.qrRefreshInterval || getDefaultRotationInterval();
}

// POST /api/sessions - Create & start a live session
router.post('/', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { courseId, topic, room, durationMinutes = 15, allowManualCode = true } = req.body;

    if (!courseId || !topic?.trim()) {
      return res.status(400).json({ success: false, message: 'Course and topic are required.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (req.user.role === 'teacher' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You are not the designated teacher for this course.' });
    }

    const duration = Math.min(240, Math.max(5, Number(durationMinutes) || 15));
    const startTime = new Date();
    const endTime = new Date(Date.now() + duration * 60 * 1000);
    const intervalSeconds = await getActiveInterval();

    const session = await Session.create({
      course: course._id,
      teacher: req.user._id,
      topic: topic.trim(),
      room: (room || course.roomDefault || 'LH-101').trim(),
      startTime,
      endTime,
      status: 'open',
      allowManualCode: Boolean(allowManualCode),
      qrRefreshInterval: intervalSeconds,
    });

    const populated = await Session.findById(session._id)
      .populate('course', 'name code')
      .populate('teacher', 'name email');

    // Generate initial deterministic window data
    const origin = req.get('origin') || getClientUrl();
    const windowData = generateWindowSessionData(populated, intervalSeconds, origin);

    res.status(201).json({
      success: true,
      message: 'Live attendance session started.',
      session: populated,
      code: windowData.code,
      qrPayload: windowData.qrPayload,
      qrToken: windowData.qrPayload, // backward-compat alias
      windowStart: windowData.windowStart,
      expiresAt: windowData.expiresAt,
      serverTime: windowData.serverTime,
      intervalSeconds: windowData.intervalSeconds,
      expiresInSeconds: windowData.intervalSeconds,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions - List sessions
router.get('/', async (req, res, next) => {
  try {
    const { courseId, status } = req.query;
    const filter = {};

    if (courseId) filter.course = courseId;
    if (status) filter.status = status;

    if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
      const sessions = await Session.find(filter)
        .populate('course', 'name code department')
        .sort({ createdAt: -1 })
        .limit(100);

      const enriched = await Promise.all(
        sessions.map(async (sess) => {
          const attendanceCount = await Attendance.countDocuments({ session: sess._id });
          const enrolledCount = await Enrollment.countDocuments({ course: sess.course._id });
          const sessObj = sess.toObject();
          return {
            ...sessObj,
            attendanceCount,
            enrolledCount,
          };
        })
      );

      return res.json({ success: true, sessions: enriched });
    }

    if (req.user.role === 'student') {
      // Find courses student is enrolled in
      const enrollments = await Enrollment.find({ student: req.user._id }).select('course');
      const courseIds = enrollments.map((e) => e.course);

      // Student can see sessions for enrolled courses (CRITICAL: never expose session code)
      const sessions = await Session.find({
        course: { $in: courseIds },
        ...(status ? { status } : {}),
      })
        .select('-code') // Strip rotating code completely from student responses
        .populate('course', 'name code department')
        .populate('teacher', 'name')
        .sort({ createdAt: -1 })
        .limit(50);

      // Check if student has marked attendance in each session
      const enriched = await Promise.all(
        sessions.map(async (sess) => {
          const myAttendance = await Attendance.findOne({
            session: sess._id,
            student: req.user._id,
          });
          const sessObj = sess.toObject();
          delete sessObj.code; // guarantee code is never present

          return {
            ...sessObj,
            markedByMe: Boolean(myAttendance),
            myAttendanceStatus: myAttendance?.status || null,
            myMarkedAt: myAttendance?.markedAt || null,
          };
        })
      );

      return res.json({ success: true, sessions: enriched });
    }

    // Admin
    const allSessions = await Session.find(filter)
      .populate('course', 'name code')
      .populate('teacher', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, sessions: allSessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', async (req, res, next) => {
  try {
    const isStudent = req.user.role === 'student';
    let query = Session.findById(req.params.id)
      .populate('course', 'name code department totalPlannedClasses')
      .populate('teacher', 'name email department');

    if (isStudent) {
      query = query.select('-code');
    }

    const session = await query;
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Ownership check for teachers
    if (req.user.role === 'teacher' && String(session.teacher._id || session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access forbidden: You do not own this session.' });
    }

    const attendanceCount = await Attendance.countDocuments({ session: session._id });
    const enrolledCount = await Enrollment.countDocuments({ course: session.course._id });

    const sessionObj = session.toObject();
    if (isStudent) {
      delete sessionObj.code;
    }

    res.json({
      success: true,
      session: {
        ...sessionObj,
        attendanceCount,
        enrolledCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/qr - Get rotating signed QR and code (Single Source of Truth)
router.get('/:id/qr', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('course', 'name code')
      .populate('teacher', 'name email');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (req.user.role === 'teacher' && String(session.teacher._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to session QR.' });
    }

    const now = new Date();
    if (session.status !== 'open' || session.endTime <= now) {
      return res.status(400).json({
        success: false,
        message: 'This attendance session has ended or is closed.',
        isClosed: true,
      });
    }

    const intervalSeconds = await getActiveInterval();
    const origin = req.get('origin') || getClientUrl();
    const windowData = generateWindowSessionData(session, intervalSeconds, origin);

    res.json({
      success: true,
      code: windowData.code,
      qrPayload: windowData.qrPayload,
      qrToken: windowData.qrPayload, // backward-compat alias
      windowStart: windowData.windowStart,
      expiresAt: windowData.expiresAt,
      serverTime: windowData.serverTime,
      intervalSeconds: windowData.intervalSeconds,
      expiresInSeconds: windowData.intervalSeconds,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/close - Close session
router.post('/:id/close', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (req.user.role === 'teacher' && String(session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    session.status = 'closed';
    session.endTime = new Date();
    await session.save();

    res.json({ success: true, message: 'Session closed successfully.', session });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/extend - Extend session time
router.post('/:id/extend', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { additionalMinutes = 5 } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (req.user.role === 'teacher' && String(session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const currentEnd = new Date(Math.max(new Date(session.endTime).getTime(), Date.now()));
    session.endTime = new Date(currentEnd.getTime() + Math.max(1, Number(additionalMinutes)) * 60 * 1000);
    session.status = 'open';
    await session.save();

    res.json({
      success: true,
      message: `Session extended by ${additionalMinutes} minutes.`,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/attendees - Live check-in list for projector/teacher view
router.get('/:id/attendees', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).populate('course');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Ownership check for teachers
    if (req.user.role === 'teacher' && String(session.teacher._id || session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this session.' });
    }

    const totalEnrolled = await Enrollment.countDocuments({ course: session.course._id });
    const records = await Attendance.find({ session: session._id })
      .populate('student', 'name email rollNo department section')
      .sort({ markedAt: -1 });

    res.json({
      success: true,
      session,
      totalEnrolled,
      checkedInCount: records.length,
      records,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/manual-mark - Teacher marks student manually
router.post('/:id/manual-mark', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { studentId, status = 'present', note } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (req.user.role === 'teacher' && String(session.teacher._id || session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this session.' });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.findOne({ course: session.course, student: studentId });
    if (!isEnrolled) {
      return res.status(400).json({ success: false, message: 'Student is not enrolled in this course.' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Check if already marked
    let record = await Attendance.findOne({ session: session._id, student: studentId });
    if (record) {
      record.status = status;
      record.method = 'manual';
      record.note = note || 'Manually updated by instructor';
      record.editedBy = req.user._id;
      record.editedAt = new Date();
      await record.save();
    } else {
      record = await Attendance.create({
        session: session._id,
        student: studentId,
        course: session.course,
        status,
        method: 'manual',
        note: note || 'Manually marked by instructor',
        editedBy: req.user._id,
        editedAt: new Date(),
      });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: 'ATTENDANCE_MANUAL_MARK',
      targetType: 'Attendance',
      targetId: String(record._id),
      details: { student: student.name, rollNo: student.rollNo, status, note },
      ip: req.ip || '',
    });

    const populated = await Attendance.findById(record._id).populate('student', 'name rollNo email');

    res.json({
      success: true,
      message: `Marked ${student.name} as ${status}.`,
      record: populated,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id/attendance/:studentId - Undo mark
router.delete('/:id/attendance/:studentId', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (req.user.role === 'teacher' && String(session.teacher._id || session.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this session.' });
    }

    const deleted = await Attendance.findOneAndDelete({
      session: session._id,
      student: req.params.studentId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'No attendance record found to remove.' });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: 'ATTENDANCE_REVOKED',
      targetType: 'Attendance',
      targetId: String(deleted._id),
      details: { studentId: req.params.studentId, session: session.topic },
      ip: req.ip || '',
    });

    res.json({ success: true, message: 'Attendance record revoked successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
