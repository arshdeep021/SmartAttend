import { Router } from 'express';
import { z } from 'zod';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Session from '../models/Session.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateAttendanceMetrics } from '../utils/attendanceCalculator.js';

const router = Router();
router.use(authenticate);

const courseSchema = z.object({
  code: z.string().min(2, 'Course code is required'),
  name: z.string().min(2, 'Course name is required'),
  department: z.string().min(2, 'Department is required'),
  section: z.string().optional().default('A'),
  schedule: z.array(
    z.object({
      day: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      room: z.string().optional(),
    })
  ).optional().default([]),
  totalPlannedClasses: z.number().optional().default(40),
  roomDefault: z.string().optional().default('LH-101'),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#4f46e5'),
});

// GET /api/courses - List courses based on user role
router.get('/', async (req, res, next) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const threshold = settings?.attendanceThreshold || 75;

    if (req.user.role === 'teacher') {
      const courses = await Course.find({ teacher: req.user._id }).sort({ code: 1 });
      // Enrich each course with student count and total conducted sessions count
      const enriched = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await Enrollment.countDocuments({ course: course._id });
          const totalSessions = await Session.countDocuments({ course: course._id });
          return {
            ...course.toObject(),
            enrolledStudentsCount: studentCount,
            totalSessionsConducted: totalSessions,
          };
        })
      );
      return res.json({ success: true, courses: enriched });
    }

    if (req.user.role === 'student') {
      const enrollments = await Enrollment.find({ student: req.user._id })
        .populate({
          path: 'course',
          populate: { path: 'teacher', select: 'name email department' },
        })
        .sort({ createdAt: -1 });

      const coursesWithStats = await Promise.all(
        enrollments.map(async (enr) => {
          const course = enr.course;
          if (!course) return null;

          const totalConducted = await Session.countDocuments({ course: course._id });
          const attended = await Attendance.countDocuments({
            student: req.user._id,
            course: course._id,
            status: { $in: ['present', 'late'] },
          });

          const metrics = calculateAttendanceMetrics(attended, totalConducted, threshold);

          return {
            ...course.toObject(),
            enrolledAt: enr.enrolledAt,
            attendance: metrics,
          };
        })
      );

      return res.json({
        success: true,
        courses: coursesWithStats.filter(Boolean),
      });
    }

    // Admin role: view all courses
    const allCourses = await Course.find()
      .populate('teacher', 'name email department')
      .sort({ code: 1 });

    const enrichedAdmin = await Promise.all(
      allCourses.map(async (course) => {
        const studentCount = await Enrollment.countDocuments({ course: course._id });
        const totalSessions = await Session.countDocuments({ course: course._id });
        return {
          ...course.toObject(),
          enrolledStudentsCount: studentCount,
          totalSessionsConducted: totalSessions,
        };
      })
    );

    res.json({ success: true, courses: enrichedAdmin });
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id - Course details
router.get('/:id', async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).populate('teacher', 'name email department');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const studentCount = await Enrollment.countDocuments({ course: course._id });
    const totalSessions = await Session.countDocuments({ course: course._id });

    res.json({
      success: true,
      course: {
        ...course.toObject(),
        enrolledStudentsCount: studentCount,
        totalSessionsConducted: totalSessions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses - Create course (teacher or admin)
router.post('/', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const data = courseSchema.parse(req.body);
    const existing = await Course.findOne({ code: data.code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Course with this code already exists.' });
    }

    const teacherId = req.user.role === 'admin' && req.body.teacherId ? req.body.teacherId : req.user._id;

    const course = await Course.create({
      ...data,
      code: data.code.toUpperCase().trim(),
      teacher: teacherId,
    });

    const populated = await Course.findById(course._id).populate('teacher', 'name email');
    res.status(201).json({ success: true, message: 'Course created successfully.', course: populated });
  } catch (err) {
    next(err);
  }
});

// PUT /api/courses/:id - Update course
router.put('/:id', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (req.user.role === 'teacher' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this course.' });
    }

    const data = courseSchema.partial().parse(req.body);
    Object.assign(course, data);
    await course.save();

    res.json({ success: true, message: 'Course updated successfully.', course });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id - Delete course
router.delete('/:id', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (req.user.role === 'teacher' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this course.' });
    }

    await Course.findByIdAndDelete(course._id);
    await Enrollment.deleteMany({ course: course._id });

    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id/roster - Get roster of students with attendance statistics
router.get('/:id/roster', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const settings = await SystemSetting.findOne({ key: 'global_config' });
    const threshold = settings?.attendanceThreshold || 75;

    const totalConducted = await Session.countDocuments({ course: course._id });
    const enrollments = await Enrollment.find({ course: course._id })
      .populate('student', 'name email rollNo department section')
      .sort({ createdAt: -1 });

    const roster = await Promise.all(
      enrollments.map(async (enr) => {
        if (!enr.student) return null;
        const attended = await Attendance.countDocuments({
          student: enr.student._id,
          course: course._id,
          status: { $in: ['present', 'late'] },
        });

        const metrics = calculateAttendanceMetrics(attended, totalConducted, threshold);

        return {
          enrollmentId: enr._id,
          enrolledAt: enr.enrolledAt,
          student: enr.student,
          attendance: metrics,
        };
      })
    );

    const validRoster = roster.filter(Boolean);
    const atRiskCount = validRoster.filter(r => r.attendance.isAtRisk).length;

    res.json({
      success: true,
      course,
      totalSessionsConducted: totalConducted,
      totalEnrolled: validRoster.length,
      atRiskCount,
      roster: validRoster,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/:id/enroll - Enroll single student
router.post('/:id/enroll', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { studentIdentifier } = req.body; // Can be rollNo, email, or student ID
    if (!studentIdentifier) {
      return res.status(400).json({ success: false, message: 'Student roll number, email, or ID is required.' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const cleanId = studentIdentifier.trim();
    const student = await User.findOne({
      role: 'student',
      $or: [
        { email: cleanId.toLowerCase() },
        { rollNo: cleanId.toUpperCase() },
        ...(cleanId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: cleanId }] : []),
      ],
    });

    if (!student) {
      return res.status(404).json({ success: false, message: `No student found matching "${studentIdentifier}".` });
    }

    const existing = await Enrollment.findOne({ course: course._id, student: student._id });
    if (existing) {
      return res.status(409).json({ success: false, message: `${student.name} is already enrolled in this course.` });
    }

    const enrollment = await Enrollment.create({
      course: course._id,
      student: student._id,
    });

    res.status(201).json({
      success: true,
      message: `Enrolled ${student.name} (${student.rollNo}) successfully.`,
      enrollment,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/:id/enroll-bulk - Bulk enrollment via CSV or array
router.post('/:id/enroll-bulk', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const { identifiers } = req.body; // Array of strings (emails or roll numbers)
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of roll numbers or emails.' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    let addedCount = 0;
    const errors = [];

    for (const raw of identifiers) {
      const item = String(raw).trim();
      if (!item) continue;

      const student = await User.findOne({
        role: 'student',
        $or: [{ email: item.toLowerCase() }, { rollNo: item.toUpperCase() }],
      });

      if (!student) {
        errors.push(`Student not found: ${item}`);
        continue;
      }

      const existing = await Enrollment.findOne({ course: course._id, student: student._id });
      if (existing) {
        continue; // already enrolled, skip
      }

      await Enrollment.create({ course: course._id, student: student._id });
      addedCount++;
    }

    res.json({
      success: true,
      message: `Successfully enrolled ${addedCount} student(s).`,
      addedCount,
      errors,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id/enroll/:studentId - Remove student from course
router.delete('/:id/enroll/:studentId', authorize('teacher', 'admin'), async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOneAndDelete({
      course: req.params.id,
      student: req.params.studentId,
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment record not found.' });
    }

    res.json({ success: true, message: 'Student removed from course successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/join - Student self-enrolls using course code (if enabled in settings)
router.post('/join', authorize('student'), async (req, res, next) => {
  try {
    const { courseCode } = req.body;
    if (!courseCode?.trim()) {
      return res.status(400).json({ success: false, message: 'Course code is required.' });
    }

    const settings = await SystemSetting.findOne({ key: 'global_config' });
    if (settings && settings.allowStudentSelfEnrollment === false) {
      return res.status(403).json({
        success: false,
        message: 'Student self-enrollment is currently disabled by administrator settings.',
      });
    }

    const cleanCode = courseCode.trim().toUpperCase();
    const course = await Course.findOne({ code: cleanCode });
    if (!course) {
      return res.status(404).json({ success: false, message: `Course with code "${cleanCode}" not found.` });
    }

    const existing = await Enrollment.findOne({ course: course._id, student: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: `You are already enrolled in ${course.name} (${course.code}).` });
    }

    const enrollment = await Enrollment.create({
      course: course._id,
      student: req.user._id,
      enrolledAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Enrolled in ${course.name} (${course.code}) successfully!`,
      course,
      enrollment,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

