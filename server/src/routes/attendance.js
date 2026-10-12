import { Router } from 'express';
import Attendance from '../models/Attendance.js';
import Session from '../models/Session.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Notification from '../models/Notification.js';
import SystemSetting from '../models/SystemSetting.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { attendanceMarkLimiter } from '../middleware/rateLimiter.js';
import { verifyQrToken } from '../utils/qrToken.js';
import { calculateAttendanceMetrics, calculateOverallAttendance } from '../utils/attendanceCalculator.js';
import { sendLowAttendanceAlertEmail } from '../utils/mailer.js';

const router = Router();
router.use(authenticate);

// POST /api/attendance/mark - Student marks attendance via signed QR token or manual code
router.post('/mark', authorize('student'), attendanceMarkLimiter, async (req, res, next) => {
  try {
    const { qrToken, manualCode, deviceInfo } = req.body;

    if (!qrToken && !manualCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a scanned QR token or the manual session code.',
      });
    }

    let sessionId;
    let method = 'qr';

    if (qrToken) {
      const payload = verifyQrToken(qrToken);
      sessionId = payload.sessionId;
      method = 'qr';
    } else if (manualCode) {
      const codeClean = manualCode.trim().toUpperCase();
      const matchedSession = await Session.findOne({
        code: codeClean,
        status: 'open',
        endTime: { $gt: new Date() },
      });

      if (!matchedSession) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CODE',
          message: 'Invalid, closed, or expired session code.',
        });
      }

      if (!matchedSession.allowManualCode) {
        return res.status(400).json({
          success: false,
          message: 'The instructor has disabled manual code entry for this session.',
        });
      }

      sessionId = matchedSession._id;
      method = 'manual_code';
    }

    // Load session and verify status
    const session = await Session.findById(sessionId).populate('course');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    const now = new Date();
    if (session.status !== 'open' || session.endTime <= now) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_CLOSED',
        message: 'This attendance session has ended or has been closed by the instructor.',
      });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.findOne({
      student: req.user._id,
      course: session.course._id,
    });

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: `You are not enrolled in ${session.course.name} (${session.course.code}). Only enrolled students can record attendance.`,
      });
    }

    // Determine status (check if late based on system settings)
    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const lateGraceMinutes = settings?.lateGraceMinutes || 10;
    const threshold = settings?.attendanceThreshold || 75;

    let attendanceStatus = 'present';
    const elapsedMinutes = (now.getTime() - new Date(session.startTime).getTime()) / 60000;
    if (elapsedMinutes > lateGraceMinutes) {
      attendanceStatus = 'late';
    }

    // Record attendance (compound unique index will catch duplicates)
    const attendance = await Attendance.create({
      session: session._id,
      student: req.user._id,
      course: session.course._id,
      method,
      status: attendanceStatus,
      markedAt: now,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      deviceInfo: deviceInfo || '',
    });

    // Recompute student metrics for this course
    const totalConducted = await Session.countDocuments({ course: session.course._id });
    const totalAttended = await Attendance.countDocuments({
      student: req.user._id,
      course: session.course._id,
      status: { $in: ['present', 'late'] },
    });

    const metrics = calculateAttendanceMetrics(totalAttended, totalConducted, threshold);

    // If attendance is below threshold, trigger notification immediately!
    if (metrics.isAtRisk) {
      const existingWarning = await Notification.findOne({
        user: req.user._id,
        course: session.course._id,
        type: 'low_attendance_warning',
        read: false,
      });

      if (!existingWarning) {
        await Notification.create({
          user: req.user._id,
          type: 'low_attendance_warning',
          title: `Low Attendance Warning: ${session.course.code}`,
          message: `Your attendance in ${session.course.name} (${session.course.code}) is currently ${metrics.percentage}%, below the required ${threshold}%. Attend the next ${metrics.classesToRecover} consecutive class(es) to get back on track.`,
          course: session.course._id,
          data: {
            courseCode: session.course.code,
            percentage: metrics.percentage,
            threshold,
            classesToRecover: metrics.classesToRecover,
          },
        });

        // Dispatch simulated/live email
        await sendLowAttendanceAlertEmail({
          studentEmail: req.user.email,
          studentName: req.user.name,
          courseName: session.course.name,
          percentage: metrics.percentage,
          classesNeeded: metrics.classesToRecover,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Attendance marked successfully for ${session.course.name}!`,
      record: {
        id: attendance._id,
        status: attendance.status,
        method: attendance.method,
        markedAt: attendance.markedAt,
        sessionTopic: session.topic,
        courseCode: session.course.code,
        courseName: session.course.name,
      },
      metrics,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/mine - Student's attendance history
router.get('/mine', authorize('student'), async (req, res, next) => {
  try {
    const { courseId, status, page = 1, limit = 20 } = req.query;
    const filter = { student: req.user._id };

    if (courseId) filter.course = courseId;
    if (status) filter.status = status;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('course', 'name code color')
        .populate({
          path: 'session',
          select: 'topic room startTime endTime teacher',
          populate: { path: 'teacher', select: 'name' },
        })
        .sort({ markedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Attendance.countDocuments(filter),
    ]);

    res.json({
      success: true,
      records,
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

// GET /api/attendance/student-stats - Student dashboard overall & per-course metrics
router.get('/student-stats', authorize('student'), async (req, res, next) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const threshold = settings?.attendanceThreshold || 75;

    // Get all courses student is enrolled in
    const enrollments = await Enrollment.find({ student: req.user._id }).populate({
      path: 'course',
      populate: { path: 'teacher', select: 'name email' },
    });

    const courseStatsList = [];

    for (const enr of enrollments) {
      if (!enr.course) continue;
      const totalConducted = await Session.countDocuments({ course: enr.course._id });
      const attended = await Attendance.countDocuments({
        student: req.user._id,
        course: enr.course._id,
        status: { $in: ['present', 'late'] },
      });

      courseStatsList.push({
        course: enr.course,
        attended,
        totalConducted,
      });
    }

    const overallData = calculateOverallAttendance(courseStatsList, threshold);

    // Get today's classes
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const enrolledCourseIds = enrollments.map((e) => e.course?._id).filter(Boolean);

    // Find sessions scheduled or created today
    const todaysSessions = await Session.find({
      course: { $in: enrolledCourseIds },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('course', 'name code color')
      .populate('teacher', 'name')
      .sort({ startTime: 1 });

    const todaysEnriched = await Promise.all(
      todaysSessions.map(async (sess) => {
        const mark = await Attendance.findOne({ session: sess._id, student: req.user._id });
        const now = new Date();
        let statusBadge = 'upcoming';

        if (mark) {
          statusBadge = mark.status === 'present' ? 'marked_present' : 'marked_late';
        } else if (sess.status === 'open' && sess.endTime > now) {
          statusBadge = 'live_now';
        } else if (sess.endTime <= now || sess.status === 'closed') {
          statusBadge = 'missed';
        }

        return {
          ...sess.toObject(),
          statusBadge,
          markedRecord: mark,
        };
      })
    );

    // Recent 10 attendance records for activity feed
    const recentActivity = await Attendance.find({ student: req.user._id })
      .populate('course', 'name code color')
      .populate('session', 'topic room')
      .sort({ markedAt: -1 })
      .limit(8);

    res.json({
      success: true,
      threshold,
      overall: overallData.overall,
      courses: overallData.courses,
      atRiskCourses: overallData.atRiskCourses,
      approachingCourses: overallData.approachingCourses,
      hasLowAttendanceAlert: overallData.hasLowAttendanceAlert,
      hasApproachingWarning: overallData.hasApproachingWarning,
      todaysClasses: todaysEnriched,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/export-csv - Student export attendance history to CSV
router.get('/export-csv', authorize('student'), async (req, res, next) => {
  try {
    const records = await Attendance.find({ student: req.user._id })
      .populate('course', 'name code')
      .populate('session', 'topic room startTime')
      .sort({ markedAt: -1 });

    let csv = 'Course Code,Course Name,Topic,Room,Date,Status,Method\n';

    for (const r of records) {
      const code = r.course?.code || '';
      const name = `"${(r.course?.name || '').replace(/"/g, '""')}"`;
      const topic = `"${(r.session?.topic || '').replace(/"/g, '""')}"`;
      const room = r.session?.room || '';
      const date = new Date(r.markedAt).toISOString();
      const status = r.status;
      const method = r.method;
      csv += `${code},${name},${topic},${room},${date},${status},${method}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="my_attendance_history.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// PUT /api/attendance/:id/edit - Teacher or Admin edits attendance with audit reason
router.put('/:id/edit', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!status || !['present', 'late', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status (present, late, absent) is required.' });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Audit explanation note is required for attendance correction.' });
    }

    const attendance = await Attendance.findById(req.params.id)
      .populate('student', 'name rollNo')
      .populate('course', 'name code');

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const previousStatus = attendance.status;
    attendance.status = status;
    attendance.note = note.trim();
    attendance.editedBy = req.user._id;
    attendance.editedAt = new Date();
    await attendance.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'ATTENDANCE_CORRECTION',
      targetType: 'Attendance',
      targetId: String(attendance._id),
      details: {
        student: attendance.student?.name,
        previousStatus,
        newStatus: status,
        reason: note,
      },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: 'Attendance record updated successfully with audit trail.',
      attendance,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
