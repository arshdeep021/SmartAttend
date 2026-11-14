import { Router } from "express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Session from "../models/Session.js";
import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import SystemSetting from "../models/SystemSetting.js";
import AuditLog from "../models/AuditLog.js";
import Notification from "../models/Notification.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { calculateAttendanceMetrics } from "../utils/attendanceCalculator.js";

const router = Router();
router.use(authenticate, authorize("admin"));

// Helper to escape regex special characters (prevents ReDoS attacks)
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/admin/pending-teachers - Get teachers awaiting approval
router.get("/pending-teachers", async (req, res, next) => {
  try {
    const pending = await User.find({ role: "teacher", approved: false }).sort({
      createdAt: -1,
    });
    res.json({ success: true, pendingTeachers: pending });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/approve-teacher/:id - Approve teacher account
router.post("/approve-teacher/:id", async (req, res, next) => {
  try {
    const teacher = await User.findOneAndUpdate(
      { _id: req.params.id, role: "teacher" },
      { approved: true },
      { new: true },
    );

    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher account not found." });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: "TEACHER_APPROVED",
      targetType: "User",
      targetId: String(teacher._id),
      details: { name: teacher.name, email: teacher.email },
      ip: req.ip || "",
    });

    await Notification.create({
      user: teacher._id,
      type: "approval",
      title: "Teacher Account Approved",
      message:
        "Your instructor account has been approved by the administrator. You now have full access to create courses and sessions.",
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
router.post("/reject-teacher/:id", async (req, res, next) => {
  try {
    const teacher = await User.findOneAndDelete({
      _id: req.params.id,
      role: "teacher",
      approved: false,
    });
    if (!teacher) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Pending teacher account not found.",
        });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: "TEACHER_REJECTED",
      targetType: "User",
      targetId: String(teacher._id),
      details: { name: teacher.name, email: teacher.email },
      ip: req.ip || "",
    });

    res.json({
      success: true,
      message: `Teacher account for ${teacher.name} has been rejected.`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users - User directory with filters, search, and not-enrolled filter
router.get("/users", async (req, res, next) => {
  try {
    const { role, search, notEnrolledOnly, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role && ["student", "teacher", "admin"].includes(role)) {
      filter.role = role;
    }

    // Filter students who are not enrolled anywhere
    if (notEnrolledOnly === "true") {
      filter.role = "student";
      const enrolledStudentIds = await Enrollment.distinct("student");
      filter._id = { $nin: enrolledStudentIds };
    }

    // Safe escaped regex search
    if (search && search.trim()) {
      const safe = escapeRegex(search.trim());
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { rollNo: regex },
        { department: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    // Enrich students with enrolled courses count
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const uObj = u.toObject();
        if (u.role === "student") {
          const enrollments = await Enrollment.find({
            student: u._id,
          }).populate("course", "name code");
          uObj.enrolledCoursesCount = enrollments.length;
          uObj.enrolledCourses = enrollments
            .map((e) => e.course)
            .filter(Boolean);
        }
        return uObj;
      }),
    );

    res.json({
      success: true,
      users: enrichedUsers,
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

// POST /api/admin/users - Admin creates student, teacher, or admin (immediately approved)
router.post("/users", async (req, res, next) => {
  try {
    const {
      role = "student",
      name,
      email,
      password,
      department,
      rollNo,
      section = "A",
      courseIds = [],
    } = req.body;

    if (!name?.trim() || !email?.trim() || !department?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, email, and department are required.",
        });
    }

    if (!["student", "teacher", "admin"].includes(role)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid role (student, teacher, admin) is required.",
        });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res
        .status(409)
        .json({
          success: false,
          message: `An account with email "${cleanEmail}" already exists.`,
        });
    }

    if (role === "student") {
      if (!rollNo?.trim()) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Roll number is required for students.",
          });
      }
      const cleanRoll = rollNo.toUpperCase().trim();
      const existingRoll = await User.findOne({ rollNo: cleanRoll });
      if (existingRoll) {
        return res
          .status(409)
          .json({
            success: false,
            message: `A student with roll number "${cleanRoll}" already exists.`,
          });
      }
    }

    const defaultPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : role === "student"
          ? "Student@123"
          : role === "teacher"
            ? "Teacher@123"
            : "Admin@123";

    const passwordHash = await User.hashPassword(defaultPassword);

    // CRITICAL: Users created directly by an administrator are auto-approved!
    const userData = {
      role,
      name: name.trim(),
      email: cleanEmail,
      department: department.trim(),
      passwordHash,
      approved: true,
      isActive: true,
    };

    if (role === "student") {
      userData.rollNo = rollNo.toUpperCase().trim();
      userData.section = section.trim();
    }

    const newUser = await User.create(userData);

    // Handle initial course enrollments if courses were selected
    let enrolledCourses = [];
    if (
      role === "student" &&
      Array.isArray(courseIds) &&
      courseIds.length > 0
    ) {
      const validCourses = await Course.find({ _id: { $in: courseIds } });
      const enrollmentDocs = validCourses.map((c) => ({
        student: newUser._id,
        course: c._id,
        enrolledAt: new Date(),
      }));
      if (enrollmentDocs.length > 0) {
        await Enrollment.insertMany(enrollmentDocs);
        enrolledCourses = validCourses;
      }
    }

    await AuditLog.create({
      actor: req.user._id,
      action: "ADMIN_USER_CREATED",
      targetType: "User",
      targetId: String(newUser._id),
      details: {
        role,
        name: newUser.name,
        email: newUser.email,
        enrolledCount: enrolledCourses.length,
      },
      ip: req.ip || "",
    });

    const userObj = newUser.toObject();
    delete userObj.passwordHash;
    userObj.enrolledCoursesCount = enrolledCourses.length;
    userObj.enrolledCourses = enrolledCourses;

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account for ${newUser.name} created successfully.`,
      user: userObj,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id - Edit user profile and course enrollment
router.put("/users/:id", async (req, res, next) => {
  try {
    const {
      name,
      email,
      department,
      rollNo,
      section,
      password,
      courseIds,
      approved,
      isActive,
    } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const existing = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res
          .status(409)
          .json({
            success: false,
            message: `Email "${email}" is already in use by another account.`,
          });
      }
      user.email = email.toLowerCase().trim();
    }

    if (
      user.role === "student" &&
      rollNo &&
      rollNo.toUpperCase().trim() !== user.rollNo
    ) {
      const existing = await User.findOne({
        rollNo: rollNo.toUpperCase().trim(),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res
          .status(409)
          .json({
            success: false,
            message: `Roll number "${rollNo}" is already in use.`,
          });
      }
      user.rollNo = rollNo.toUpperCase().trim();
    }

    if (name) user.name = name.trim();
    if (department) user.department = department.trim();
    if (section && user.role === "student") user.section = section.trim();
    if (approved !== undefined) user.approved = Boolean(approved);
    if (isActive !== undefined && String(user._id) !== String(req.user._id))
      user.isActive = Boolean(isActive);

    if (password && password.trim().length >= 6) {
      user.passwordHash = await User.hashPassword(password.trim());
    }

    await user.save();

    // Update course enrollments if provided
    if (user.role === "student" && Array.isArray(courseIds)) {
      await Enrollment.deleteMany({ student: user._id });
      if (courseIds.length > 0) {
        const validCourses = await Course.find({ _id: { $in: courseIds } });
        const enrollments = validCourses.map((c) => ({
          student: user._id,
          course: c._id,
          enrolledAt: new Date(),
        }));
        await Enrollment.insertMany(enrollments);
      }
    }

    await AuditLog.create({
      actor: req.user._id,
      action: "ADMIN_USER_UPDATED",
      targetType: "User",
      targetId: String(user._id),
      details: { name: user.name, email: user.email },
      ip: req.ip || "",
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.json({
      success: true,
      message: `User ${user.name} updated successfully.`,
      user: userObj,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id - Delete or deactivate user
router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (String(user._id) === String(req.user._id)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You cannot delete your own admin account.",
        });
    }

    // Check if user has attendance records
    const attendanceCount = await Attendance.countDocuments({
      student: user._id,
    });
    const isForce = req.query.force === "true";

    if (attendanceCount > 0 && !isForce) {
      return res.status(400).json({
        success: false,
        code: "HAS_ATTENDANCE_RECORDS",
        attendanceCount,
        message: `This student has ${attendanceCount} recorded attendance check-ins. Deleting this account will permanently destroy historical attendance data. We recommend deactivating the user instead. Pass force=true to proceed with permanent deletion.`,
      });
    }

    // Clean up enrollments and user record
    await Enrollment.deleteMany({ student: user._id });
    await User.findByIdAndDelete(user._id);

    await AuditLog.create({
      actor: req.user._id,
      action: "ADMIN_USER_DELETED",
      targetType: "User",
      targetId: String(user._id),
      details: {
        name: user.name,
        email: user.email,
        hadAttendance: attendanceCount,
      },
      ip: req.ip || "",
    });

    res.json({
      success: true,
      message: `Account for ${user.name} has been removed successfully.`,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/toggle-status - Activate/Deactivate user
router.put("/users/:id/toggle-status", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (String(user._id) === String(req.user._id)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You cannot deactivate your own admin account.",
        });
    }

    user.isActive = !user.isActive;
    await user.save();

    await AuditLog.create({
      actor: req.user._id,
      action: user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      targetType: "User",
      targetId: String(user._id),
      details: { name: user.name, email: user.email, isActive: user.isActive },
      ip: req.ip || "",
    });

    res.json({
      success: true,
      message: `User ${user.name} is now ${user.isActive ? "Active" : "Deactivated"}.`,
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
router.get("/settings", async (req, res, next) => {
  try {
    let settings = await SystemSetting.findOne({ key: "global_config" });
    if (!settings) {
      settings = await SystemSetting.create({ key: "global_config" });
    }
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings - Update global system settings
router.put("/settings", async (req, res, next) => {
  try {
    const {
      attendanceThreshold,
      qrRefreshInterval,
      qrTokenExpiry,
      lateGraceMinutes,
      emailAlertsEnabled,
      autoApproveTeachers,
      allowStudentSelfEnrollment,
      institutionName,
    } = req.body;

    let settings = await SystemSetting.findOne({ key: "global_config" });
    if (!settings) {
      settings = new SystemSetting({ key: "global_config" });
    }

    if (attendanceThreshold !== undefined)
      settings.attendanceThreshold = Number(attendanceThreshold);
    if (qrRefreshInterval !== undefined)
      settings.qrRefreshInterval = Number(qrRefreshInterval);
    if (qrTokenExpiry !== undefined)
      settings.qrTokenExpiry = Number(qrTokenExpiry);
    if (lateGraceMinutes !== undefined)
      settings.lateGraceMinutes = Number(lateGraceMinutes);
    if (emailAlertsEnabled !== undefined)
      settings.emailAlertsEnabled = Boolean(emailAlertsEnabled);
    if (autoApproveTeachers !== undefined)
      settings.autoApproveTeachers = Boolean(autoApproveTeachers);
    if (allowStudentSelfEnrollment !== undefined)
      settings.allowStudentSelfEnrollment = Boolean(allowStudentSelfEnrollment);
    if (institutionName !== undefined)
      settings.institutionName = institutionName;

    await settings.save();

    await AuditLog.create({
      actor: req.user._id,
      action: "SETTINGS_UPDATED",
      targetType: "SystemSetting",
      targetId: String(settings._id),
      details: req.body,
      ip: req.ip || "",
    });

    res.json({
      success: true,
      message: "System settings updated successfully.",
      settings,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs - Audit logs
router.get("/audit-logs", async (req, res, next) => {
  try {
    const { page = 1, limit = 25, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor", "name email role")
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
router.get("/analytics", async (req, res, next) => {
  try {
    const settings = await SystemSetting.findOne({ key: "global_config" });
    const threshold = settings?.attendanceThreshold || 75;

    const [
      totalStudents,
      totalTeachers,
      pendingTeachersCount,
      totalCourses,
      totalSessions,
      totalAttendanceMarks,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher", approved: true }),
      User.countDocuments({ role: "teacher", approved: false }),
      Course.countDocuments(),
      Session.countDocuments(),
      Attendance.countDocuments(),
    ]);

    // Active live sessions right now
    const now = new Date();
    const activeSessionsCount = await Session.countDocuments({
      status: "open",
      endTime: { $gt: now },
    });

    // Aggregate attendance counts by course to optimize N+1 query loop
    const attendanceStats = await Attendance.aggregate([
      { $match: { status: { $in: ["present", "late"] } } },
      {
        $group: {
          _id: { student: "$student", course: "$course" },
          attended: { $sum: 1 },
        },
      },
    ]);

    const studentAttendedMap = new Map();
    for (const stat of attendanceStats) {
      studentAttendedMap.set(
        `${stat._id.student}_${stat._id.course}`,
        stat.attended,
      );
    }

    // Sessions count by course
    const sessionCounts = await Session.aggregate([
      { $group: { _id: "$course", total: { $sum: 1 } } },
    ]);
    const sessionCountMap = new Map();
    for (const sc of sessionCounts) {
      sessionCountMap.set(String(sc._id), sc.total);
    }

    const enrollments = await Enrollment.find().select("student course");
    const totalEnrollmentInstances = enrollments.length;
    let atRiskInstances = 0;

    for (const enr of enrollments) {
      const courseTotal = sessionCountMap.get(String(enr.course)) || 0;
      if (courseTotal === 0) continue;
      const attended =
        studentAttendedMap.get(`${enr.student}_${enr.course}`) || 0;
      const metrics = calculateAttendanceMetrics(
        attended,
        courseTotal,
        threshold,
      );
      if (metrics.isAtRisk) {
        atRiskInstances++;
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
