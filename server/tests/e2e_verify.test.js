import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Session from '../src/models/Session.js';
import Enrollment from '../src/models/Enrollment.js';
import Attendance from '../src/models/Attendance.js';
import { generateWindowSessionData, validateSessionCode } from '../src/utils/qrToken.js';

describe('End-to-End User Persistence & Rotating Attendance Flow', () => {
  test('should create student/teacher, persist across DB disconnect/reconnect, and allow attendance marking', async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    let testCourse;
    let teacher;
    let student;
    let session;

    try {
      const passwordHash = await User.hashPassword('Password123!');
      const teacherEmail = 'e2e.teacher_' + Date.now() + '@example.com';
      teacher = await User.create({
        name: 'Prof. Barbara Liskov',
        email: teacherEmail,
        passwordHash,
        role: 'teacher',
        department: 'CS',
        approved: true,
      });
      assert.equal(teacher.approved, true, 'Teacher should be approved');

      testCourse = await Course.create({
        code: 'E2E' + Math.floor(100 + Math.random() * 800),
        name: 'End-to-End Systems Verification',
        department: 'CS',
        semester: 6,
        teacher: teacher._id,
      });

      const studentEmail = 'e2e.student_' + Date.now() + '@example.com';
      const rollNo = 'E2E' + Math.floor(1000 + Math.random() * 9000);
      student = await User.create({
        name: 'Claude Shannon',
        email: studentEmail,
        passwordHash,
        role: 'student',
        rollNo,
        department: 'CS',
        semester: 6,
        approved: true,
      });
      assert.equal(student.approved, true, 'Student should be approved');

      // Enroll student
      await Enrollment.create({ course: testCourse._id, student: student._id });

      // SIMULATE SERVER RESTART / RE-CONNECT
      await mongoose.connection.close();
      await connectDB();

      // Verify persistence
      const persistedTeacher = await User.findOne({ email: teacherEmail });
      const persistedStudent = await User.findOne({ email: studentEmail });
      assert.ok(persistedTeacher, 'Teacher must exist after restart');
      assert.ok(persistedStudent, 'Student must exist after restart');
      assert.equal(persistedTeacher.approved, true);
      assert.equal(persistedStudent.approved, true);

      // Verify login password checks
      assert.equal(await persistedTeacher.comparePassword('Password123!'), true);
      assert.equal(await persistedStudent.comparePassword('Password123!'), true);

      // Teacher creates session
      session = await Session.create({
        course: testCourse._id,
        teacher: persistedTeacher._id,
        room: 'Hall A',
        topic: 'Fault Tolerance & Replication',
        status: 'open',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
      });

      // Synchronized rotating code generated
      const sessionData = generateWindowSessionData(session._id);
      assert.equal(typeof sessionData.code, 'string');
      assert.equal(sessionData.code.length, 6);
      assert.ok(sessionData.qrPayload.includes(`/scan?s=${session._id}&c=${sessionData.code}`));

      // Student validates code
      const validation = validateSessionCode(session._id, sessionData.code);
      assert.equal(validation.valid, true);

      // Student marks attendance
      const record = await Attendance.create({
        session: session._id,
        student: persistedStudent._id,
        course: testCourse._id,
        method: 'manual_code',
        status: 'present',
      });
      assert.ok(record._id);

      // Duplicate mark is prevented
      await assert.rejects(
        async () => {
          await Attendance.create({
            session: session._id,
            student: persistedStudent._id,
            course: testCourse._id,
            method: 'qr',
          });
        },
        (err) => err.code === 11000,
        'Duplicate attendance should trigger duplicate key error 11000'
      );
    } finally {
      if (session) await Attendance.deleteMany({ session: session._id });
      if (session) await Session.deleteOne({ _id: session._id });
      if (testCourse) await Enrollment.deleteMany({ course: testCourse._id });
      if (testCourse) await Course.deleteOne({ _id: testCourse._id });
      if (teacher && student) await User.deleteMany({ _id: { $in: [teacher._id, student._id] } });
      await mongoose.connection.close();
    }
  });
});
