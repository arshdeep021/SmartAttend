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
import { validateSessionCode, verifyQrToken } from '../utils/qrToken.js';
import { getDefaultRotationInterval } from '../config/env.js';
import { calculateAttendanceMetrics, calculateOverallAttendance } from '../utils/attendanceCalculator.js';
import { sendLowAttendanceAlertEmail } from '../utils/mailer.js';

const router = Router();
router.use(authenticate);

// POST /api/attendance/mark - Student marks attendance via rotating QR token or manual code
router.post('/mark', authorize('student'), attendanceMarkLimiter, async (req, res, next) => {
  try {
    const { qrToken, qrPayload, manualCode, code, sessionId: inputSessionId, s, c, deviceInfo } = req.body;

    let sessionId = inputSessionId || s;
    let submittedCode = code || manualCode || c;
    let method = manualCode ? 'manual_code' : 'qr';

    const rawScan = qrPayload || qrToken;
    if (rawScan) {
      method = 'qr';
      if (typeof rawScan === 'string') {
        const trimmed = rawScan.trim();
        // Check for URL containing parameters s and c
        if (trimmed.includes('?s=') || trimmed.includes('&s=') || trimmed.includes('&c=') || trimmed.includes('?c=')) {
          try {
            const urlObj = new URL(trimmed, 'http://dummy.com');
            sessionId = urlObj.searchParams.get('s') || sessionId;
            submittedCode = urlObj.searchParams.get('c') || submittedCode;
          } catch (e) {
            const sMatch = trimmed.match(/[?&]s=([a-f0-9]{24})/i);
            const cMatch = trimmed.match(/[?&]c=([A-Z0-9]{6})/i);
            if (sMatch) sessionId = sMatch[1];
            if (cMatch) submittedCode = cMatch[1];
          }
        } else if (trimmed.includes(':') && trimmed.length >= 31) {
          // Compact format sessionId:code
          const parts = trimmed.split(':');
          if (parts[0].length === 24) {
            sessionId = parts[0];
            submittedCode = parts[1];
          }
        } else {
          // Legacy signed JWT fallback
          try {
            const payload = verifyQrToken(trimmed);
            sessionId = payload.sessionId;
          } catch (e) {
            return res.status(400).json({
              success: false,
              code: e.code || 'QR_INVALID',
              message: e.message || 'Invalid or expired QR code.',
            });
          }
        }
      }
    }

    if (!sessionId && !submittedCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a scanned QR code or the 6-character session PIN.',
      });
    }

    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const intervalSeconds = settings?.qrRefreshInterval || getDefaultRotationInterval();
    const now = new Date();

    let session = null;

    if (sessionId) {
      session = await Session.findById(sessionId).populate('course');
      if (!session) {
        return res.status(404).json({ success: false, message: 'Attendance session not found.' });
      }

      if (session.status !== 'open' || session.endTime <= now) {
        return res.status(400).json({
          success: false,
          code: 'SESSION_CLOSED',
          message: 'This attendance session has ended or has been closed by the instructor.',
        });
      }

      // Verify student enrollment
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

      // If submitted via manual code, check if teacher enabled manual code
      if (method === 'manual_code' && !session.allowManualCode) {
        return res.status(400).json({
          success: false,
          code: 'MANUAL_CODE_DISABLED',
          message: 'The instructor has disabled manual code entry for this session.',
        });
      }

      // Validate rotating code (accepts current window and 1 previous grace window)
      if (submittedCode) {
        const val = validateSessionCode(session._id, submittedCode, intervalSeconds, now.getTime());
        if (!val.valid) {
          return res.status(400).json({
            success: false,
            code: 'CODE_EXPIRED',
            message: val.reason,
          });
        }
      }
    } else {
      // Student entered manual code WITHOUT specifying sessionId
      const codeClean = (submittedCode || '').trim().toUpperCase();
      if (codeClean.length !== 6) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CODE',
          message: 'Session PIN must be 6 characters.',
        });
      }

      // Find courses student is enrolled in
      const enrollments = await Enrollment.find({ student: req.user._id }).select('course');
      const courseIds = enrollments.map((e) => e.course);

      if (courseIds.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'NOT_ENROLLED',
          message: 'You are not enrolled in any active courses.',
        });
      }

      // Find open sessions for student's enrolled courses
      const openSessions = await Session.find({
        course: { $in: courseIds },
        status: 'open',
        endTime: { $gt: now },
      }).populate('course');

      if (openSessions.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'NO_OPEN_SESSION',
          message: 'No active attendance sessions found for your enrolled courses.',
        });
      }

      let matchedSession = null;
      let manualCodeDisabled = false;

      for (const sess of openSessions) {
        const val = validateSessionCode(sess._id, codeClean, intervalSeconds, now.getTime());
        if (val.valid) {
          if (!sess.allowManualCode) {
            manualCodeDisabled = true;
            continue;
          }
          matchedSession = sess;
          break;
        }
      }

      if (!matchedSession) {
        if (manualCodeDisabled) {
          return res.status(400).json({
            success: false,
            code: 'MANUAL_CODE_DISABLED',
            message: 'Manual code entry is disabled for this session by the instructor.',
          });
        }
        return res.status(400).json({
          success: false,
          code: 'INVALID_CODE',
          message: 'Invalid or expired session code.',
        });
      }

      session = matchedSession;
      method = 'manual_code';
    }

    // Determine attendance status (present vs late based on grace minutes)
    const lateGraceMinutes = settings?.lateGraceMinutes || 10;
    const threshold = settings?.attendanceThreshold || 75;

    let attendanceStatus = 'present';
    const elapsedMinutes = (now.getTime() - new Date(session.startTime).getTime()) / 60000;
    if (elapsedMinutes > lateGraceMinutes) {
      attendanceStatus = 'late';
    }

    // Record attendance (compound unique index catches duplicates)
    let attendance;
    try {
      attendance = await Attendance.create({
        session: session._id,
        student: req.user._id,
        course: session.course._id,
        method,
        status: attendanceStatus,
        markedAt: now,
        ip: req.ip || req.headers['x-forwarded-for'] || '',
        deviceInfo: deviceInfo || '',
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ATTENDANCE',
          message: 'Your attendance has already been recorded for this session.',
        });
      }
      throw createErr;
    }

    // Recompute student metrics for this course (conducted = closed or ended sessions + this marked session)
    const totalConducted = await Session.countDocuments({
      course: session.course._id,
      $or: [
        { status: 'closed' },
        { endTime: { $lte: now } },
        { _id: session._id },
      ],
    });

    const totalAttended = await Attendance.countDocuments({
      student: req.user._id,
      course: session.course._id,
      status: { $in: ['present', 'late'] },
    });

    const metrics = calculateAttendanceMetrics(totalAttended, totalConducted, threshold);

    // If attendance is below threshold, trigger notification immediately
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

        // Dispatch alert email
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

    const now = new Date();
    const courseStatsList = [];

    for (const enr of enrollments) {
      if (!enr.course) continue;
      // Count conducted sessions: closed or ended sessions, or any session student attended
      const attendedSessionIds = await Attendance.find({
        student: req.user._id,
        course: enr.course._id,
        status: { $in: ['present', 'late'] },
      }).distinct('session');

      const totalConducted = await Session.countDocuments({
        course: enr.course._id,
        $or: [
          { status: 'closed' },
          { endTime: { $lte: now } },
          { _id: { $in: attendedSessionIds } },
        ],
      });

      const attended = attendedSessionIds.length;

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

    // Find sessions scheduled or created today (CRITICAL: never expose session code)
    const todaysSessions = await Session.find({
      course: { $in: enrolledCourseIds },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    })
      .select('-code')
      .populate('course', 'name code color')
      .populate('teacher', 'name')
      .sort({ startTime: 1 });

    const todaysEnriched = await Promise.all(
      todaysSessions.map(async (sess) => {
        const mark = await Attendance.findOne({ session: sess._id, student: req.user._id });
        let statusBadge = 'upcoming';

        if (mark) {
          statusBadge = mark.status === 'present' ? 'marked_present' : 'marked_late';
        } else if (sess.status === 'open' && sess.endTime > now) {
          statusBadge = 'live_now';
        } else if (sess.endTime <= now || sess.status === 'closed') {
          statusBadge = 'missed';
        }

        const sessObj = sess.toObject();
        delete sessObj.code;

        return {
          ...sessObj,
          statusBadge,
          markedRecord: mark,
        };
      })
    );

    // Recent 8 attendance records for activity feed
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
