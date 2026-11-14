import { Router } from "express";
import Notification from "../models/Notification.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Session from "../models/Session.js";
import Attendance from "../models/Attendance.js";
import SystemSetting from "../models/SystemSetting.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { calculateAttendanceMetrics } from "../utils/attendanceCalculator.js";
import { sendLowAttendanceAlertEmail } from "../utils/mailer.js";

const router = Router();
router.use(authenticate);

// GET /api/notifications - List user's notifications
router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate("course", "name code")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      notifications,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count - Unread count for badge
router.get("/unread-count", async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    const hasLowAttendanceWarning = await Notification.exists({
      user: req.user._id,
      type: "low_attendance_warning",
      read: false,
    });

    res.json({
      success: true,
      unreadCount,
      hasLowAttendanceWarning: Boolean(hasLowAttendanceWarning),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read - Mark single as read
router.put("/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found." });
    }

    res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
router.put("/mark-all-read", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true },
    );
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/send-low-attendance-reminders - 1-Click trigger for teacher/admin
router.post(
  "/send-low-attendance-reminders",
  authorize("teacher", "admin"),
  async (req, res, next) => {
    try {
      const { courseId } = req.body;
      const settings = await SystemSetting.findOne({ key: "global_config" });
      const threshold = settings?.attendanceThreshold || 75;

      let coursesToInspect = [];
      if (courseId) {
        const c = await Course.findById(courseId);
        if (c) coursesToInspect = [c];
      } else if (req.user.role === "teacher") {
        coursesToInspect = await Course.find({ teacher: req.user._id });
      } else {
        coursesToInspect = await Course.find();
      }

      let notifiedStudentsCount = 0;
      const notifiedList = [];

      for (const course of coursesToInspect) {
        const totalSessions = await Session.countDocuments({
          course: course._id,
        });
        if (totalSessions === 0) continue;

        const enrollments = await Enrollment.find({
          course: course._id,
        }).populate("student");

        for (const enr of enrollments) {
          if (!enr.student) continue;

          const attended = await Attendance.countDocuments({
            course: course._id,
            student: enr.student._id,
            status: { $in: ["present", "late"] },
          });

          const metrics = calculateAttendanceMetrics(
            attended,
            totalSessions,
            threshold,
          );

          if (metrics.isAtRisk) {
            // Create notification
            await Notification.create({
              user: enr.student._id,
              type: "low_attendance_warning",
              title: `Low Attendance Warning Reminder: ${course.code}`,
              message: `Official Reminder from ${req.user.name}: Your attendance in ${course.name} is currently ${metrics.percentage}% (below ${threshold}%). You need to attend the next ${metrics.classesToRecover} consecutive classes to reach minimum eligibility.`,
              course: course._id,
              data: {
                courseCode: course.code,
                percentage: metrics.percentage,
                threshold,
                classesToRecover: metrics.classesToRecover,
                sentBy: req.user.name,
              },
            });

            await sendLowAttendanceAlertEmail({
              studentEmail: enr.student.email,
              studentName: enr.student.name,
              courseName: course.name,
              percentage: metrics.percentage,
              classesNeeded: metrics.classesToRecover,
            });

            notifiedStudentsCount++;
            notifiedList.push({
              studentName: enr.student.name,
              rollNo: enr.student.rollNo,
              courseCode: course.code,
              percentage: metrics.percentage,
            });
          }
        }
      }

      res.json({
        success: true,
        message: `Dispatched low attendance reminders to ${notifiedStudentsCount} at-risk students.`,
        notifiedStudentsCount,
        notifiedList,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
