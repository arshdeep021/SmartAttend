import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Session from '../models/Session.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import SystemSetting from '../models/SystemSetting.js';
import AuditLog from '../models/AuditLog.js';
import { calculateAttendanceMetrics } from '../utils/attendanceCalculator.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartattend_v2';

const studentNames = [
  'Aravind Swamy', 'Riya Sharma', 'Kabir Mehta', 'Sneha Reddy', 'Vikram Malhotra',
  'Priya Patel', 'Ananya Iyer', 'Rahul Verma', 'Tanvi Deshmukh', 'Arjun Kapoor',
  'Deepika Sen', 'Rohan Gupta', 'Kavita Joshi', 'Devansh Shah', 'Meera Nambiar',
  'Siddharth Roy', 'Ishaan Trivedi', 'Pooja Nair', 'Gaurav Bhatia', 'Simran Kaur',
  'Karan Singhania', 'Neha Choudhary', 'Varun Dhawan', 'Aditya Rao', 'Bhavna Kulkarni',
  'Harshvardhan Jain', 'Divya Saxena', 'Manish Pandey', 'Shreya Banerjee', 'Nikhil Agarwal'
];

async function seed() {
  console.log('🌱 Starting SmartAttend v2 database seed...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Enrollment.deleteMany({}),
    Session.deleteMany({}),
    Attendance.deleteMany({}),
    Notification.deleteMany({}),
    SystemSetting.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('Cleared existing records.');

  // Initialize System Settings
  const defaultSetting = await SystemSetting.create({
    key: 'global_config',
    attendanceThreshold: 75,
    qrRefreshInterval: 20,
    qrTokenExpiry: 30,
    lateGraceMinutes: 10,
    emailAlertsEnabled: false,
    institutionName: 'Apex Institute of Technology',
  });
  console.log('Created System Settings (Threshold: 75%).');

  // Create Admin
  const adminPasswordHash = await User.hashPassword('Admin@123');
  const admin = await User.create({
    role: 'admin',
    name: 'Chief Administrator',
    email: 'admin@smartattend.edu',
    department: 'Administration',
    passwordHash: adminPasswordHash,
    approved: true,
  });

  // Create Teachers
  const teacherPasswordHash = await User.hashPassword('Teacher@123');
  const teacher1 = await User.create({
    role: 'teacher',
    name: 'Dr. Ramesh Sharma',
    email: 'dr.sharma@smartattend.edu',
    department: 'Computer Science',
    passwordHash: teacherPasswordHash,
    approved: true,
  });

  const teacher2 = await User.create({
    role: 'teacher',
    name: 'Prof. Anita Patel',
    email: 'prof.patel@smartattend.edu',
    department: 'Computer Science',
    passwordHash: teacherPasswordHash,
    approved: true,
  });

  // Teacher 3 pending approval for Admin testing
  const teacher3 = await User.create({
    role: 'teacher',
    name: 'Dr. Sunita Sen',
    email: 'dr.sen@smartattend.edu',
    department: 'Information Technology',
    passwordHash: teacherPasswordHash,
    approved: false, // Pending Admin approval!
  });

  console.log('Created Admin and 3 Teachers (2 approved, 1 pending approval).');

  // Create 30 Students
  const studentPasswordHash = await User.hashPassword('Student@123');
  const studentDocs = [];

  for (let i = 0; i < studentNames.length; i++) {
    const rollNo = `CS${String(i + 1).padStart(3, '0')}`;
    const emailName = studentNames[i].toLowerCase().replace(/\s+/g, '.');
    const student = await User.create({
      role: 'student',
      name: studentNames[i],
      email: `${emailName}@smartattend.edu`,
      rollNo,
      department: 'Computer Science',
      section: i < 15 ? 'A' : 'B',
      passwordHash: studentPasswordHash,
      approved: true,
    });
    studentDocs.push(student);
  }
  console.log(`Created ${studentDocs.length} students.`);

  // Create 5 Courses
  const coursesData = [
    {
      code: 'CS301',
      name: 'Data Structures & Algorithms',
      teacher: teacher1._id,
      department: 'Computer Science',
      section: 'A',
      roomDefault: 'LH-101',
      color: '#4f46e5', // indigo
      totalPlannedClasses: 40,
      description: 'Fundamental data structures, sorting algorithms, dynamic programming, and complexity analysis.',
      schedule: [
        { day: 'Monday', startTime: '09:00', endTime: '10:30', room: 'LH-101' },
        { day: 'Wednesday', startTime: '09:00', endTime: '10:30', room: 'LH-101' },
      ],
    },
    {
      code: 'CS302',
      name: 'Database Management Systems',
      teacher: teacher2._id,
      department: 'Computer Science',
      section: 'A',
      roomDefault: 'LH-102',
      color: '#0d9488', // teal
      totalPlannedClasses: 40,
      description: 'Relational database design, SQL querying, indexing, transaction management, and ACID properties.',
      schedule: [
        { day: 'Tuesday', startTime: '11:00', endTime: '12:30', room: 'LH-102' },
        { day: 'Thursday', startTime: '11:00', endTime: '12:30', room: 'LH-102' },
      ],
    },
    {
      code: 'CS303',
      name: 'Operating Systems & Kernels',
      teacher: teacher1._id,
      department: 'Computer Science',
      section: 'A',
      roomDefault: 'LH-201',
      color: '#0284c7', // sky
      totalPlannedClasses: 36,
      description: 'Processes, concurrency, semaphores, memory virtualization, paging, and file systems.',
      schedule: [
        { day: 'Monday', startTime: '14:00', endTime: '15:30', room: 'LH-201' },
        { day: 'Wednesday', startTime: '14:00', endTime: '15:30', room: 'LH-201' },
      ],
    },
    {
      code: 'CS304',
      name: 'Computer Networks & Security',
      teacher: teacher2._id,
      department: 'Computer Science',
      section: 'A',
      roomDefault: 'LH-202',
      color: '#7c3aed', // violet
      totalPlannedClasses: 36,
      description: 'OSI stack, TCP/IP, routing protocols, TLS encryption, and network security architectures.',
      schedule: [
        { day: 'Tuesday', startTime: '14:00', endTime: '15:30', room: 'LH-202' },
        { day: 'Friday', startTime: '10:00', endTime: '11:30', room: 'LH-202' },
      ],
    },
    {
      code: 'CS305',
      name: 'Software Engineering & DevOps',
      teacher: teacher1._id,
      department: 'Computer Science',
      section: 'A',
      roomDefault: 'LH-103',
      color: '#ea580c', // orange
      totalPlannedClasses: 32,
      description: 'Agile methodologies, CI/CD pipelines, containerization with Docker, testing, and system design.',
      schedule: [
        { day: 'Thursday', startTime: '09:00', endTime: '10:30', room: 'LH-103' },
        { day: 'Friday', startTime: '14:00', endTime: '15:30', room: 'LH-103' },
      ],
    },
  ];

  const courseDocs = await Course.insertMany(coursesData);
  console.log(`Created ${courseDocs.length} courses.`);

  // Enroll all students into all 5 courses
  const enrollmentsData = [];
  for (const course of courseDocs) {
    for (const student of studentDocs) {
      enrollmentsData.push({
        course: course._id,
        student: student._id,
        enrolledAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // enrolled 45 days ago
      });
    }
  }
  await Enrollment.insertMany(enrollmentsData);
  console.log(`Created ${enrollmentsData.length} course enrollments.`);

  // Generate 6 weeks of past sessions for each course (12 sessions per course)
  const sessionTopics = {
    CS301: [
      'Course Intro & Asymptotic Notation', 'Arrays & Linked Lists', 'Stacks & Queues',
      'Binary Search Trees', 'AVL Trees & Balancing', 'Heap & Priority Queues',
      'Graph Representations & BFS', 'DFS & Topological Sort', 'Dijkstra Shortest Path',
      'Divide and Conquer Algorithms', 'Greedy Techniques & Huffman', 'Dynamic Programming Foundations'
    ],
    CS302: [
      'Introduction to Relational Databases', 'Entity-Relationship Modeling', 'Relational Algebra',
      'SQL DDL and Basic Queries', 'Complex SQL Joins & Subqueries', 'Database Normalization 1NF to BCNF',
      'Storage Architecture & B+ Trees', 'Hashing Techniques in DBMS', 'Transaction Concept & ACID',
      'Concurrency Control & Locks', 'Deadlock Detection & Recovery', 'NoSQL and MongoDB Fundamentals'
    ],
    CS303: [
      'Operating System Architecture', 'Process Management & PCB', 'CPU Scheduling Algorithms',
      'Process Synchronization', 'Critical Section & Semaphores', 'Classical IPC Problems',
      'Deadlocks: Avoidance & Banker Algorithm', 'Memory Management: Paging', 'Virtual Memory & Page Replacement',
      'File System Implementation', 'Mass Storage & Disk Scheduling', 'Security & Access Control'
    ],
    CS304: [
      'Network Layers & OSI Reference Model', 'Physical Layer & Data Encoding', 'Data Link Layer & Framing',
      'Error Detection & CRC', 'Medium Access Control (CSMA/CD)', 'IPv4 Addressing & Subnetting',
      'Routing Algorithms (OSPF, BGP)', 'Transport Layer & UDP', 'TCP 3-Way Handshake & Flow Control',
      'Congestion Control Algorithms', 'Application Layer: HTTP/DNS', 'Network Cryptography & TLS'
    ],
    CS305: [
      'Software Process Models & Agile', 'Requirements Engineering & User Stories', 'System Architecture & Design Patterns',
      'UML Class & Sequence Diagrams', 'Object-Oriented Design Principles (SOLID)', 'Test-Driven Development & Unit Testing',
      'Version Control Best Practices with Git', 'Continuous Integration / Continuous Deployment', 'Docker Containerization',
      'Microservices vs Monoliths', 'Software Metrics & Code Quality', 'DevOps Culture and Monitoring'
    ],
  };

  const sessionsCreated = [];
  const attendancesCreated = [];

  // Deliberately target students for low attendance:
  // studentDocs[2] (CS003 - Kabir Mehta) -> CS301 (attended only 4 of 12 = 33.3%)
  // studentDocs[6] (CS007 - Ananya Iyer) -> CS302 (attended only 6 of 12 = 50.0%)
  // studentDocs[11] (CS012 - Rohan Gupta) -> CS303 (attended only 7 of 12 = 58.3%)
  // studentDocs[17] (CS018 - Pooja Nair) -> CS304 (attended only 8 of 12 = 66.7%)
  // studentDocs[23] (CS024 - Aditya Rao) -> CS305 (attended 9 of 12 = 75.0% - Borderline)

  const lowAttendanceConfig = {
    [String(studentDocs[2]._id)]: { courseCode: 'CS301', maxAttends: 4 },  // Kabir
    [String(studentDocs[6]._id)]: { courseCode: 'CS302', maxAttends: 6 },  // Ananya
    [String(studentDocs[11]._id)]: { courseCode: 'CS303', maxAttends: 7 }, // Rohan
    [String(studentDocs[17]._id)]: { courseCode: 'CS304', maxAttends: 8 }, // Pooja
  };

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomCode() {
    let res = '';
    for (let k = 0; k < 6; k++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  }

  for (const course of courseDocs) {
    const topics = sessionTopics[course.code] || [];
    for (let sIdx = 0; sIdx < topics.length; sIdx++) {
      // Days in past: from 42 days ago up to 1 day ago
      const daysAgo = 42 - sIdx * 3.5;
      const sessionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      sessionDate.setHours(10, 0, 0, 0);
      const sessionEnd = new Date(sessionDate.getTime() + 60 * 60 * 1000);

      const session = await Session.create({
        course: course._id,
        teacher: course.teacher,
        topic: topics[sIdx],
        room: course.roomDefault,
        startTime: sessionDate,
        endTime: sessionEnd,
        status: 'closed',
        code: randomCode(),
        allowManualCode: true,
      });
      sessionsCreated.push(session);

      // Create attendance records for each student in this session
      for (let stIdx = 0; stIdx < studentDocs.length; stIdx++) {
        const student = studentDocs[stIdx];
        const studentIdStr = String(student._id);

        let shouldAttend = true;

        if (lowAttendanceConfig[studentIdStr] && lowAttendanceConfig[studentIdStr].courseCode === course.code) {
          // Only attend up to maxAttends
          shouldAttend = sIdx < lowAttendanceConfig[studentIdStr].maxAttends;
        } else {
          // Standard student: 85% - 95% attendance probability
          const rand = Math.sin(stIdx * 17 + sIdx * 31);
          shouldAttend = rand > -0.65; // ~85% attendance
        }

        if (shouldAttend) {
          const isLate = (stIdx + sIdx) % 7 === 0;
          const markTime = new Date(sessionDate.getTime() + (isLate ? 12 : 3) * 60 * 1000);
          attendancesCreated.push({
            session: session._id,
            student: student._id,
            course: course._id,
            markedAt: markTime,
            method: (stIdx + sIdx) % 5 === 0 ? 'manual_code' : 'qr',
            status: isLate ? 'late' : 'present',
          });
        }
      }
    }
  }

  await Attendance.insertMany(attendancesCreated);
  console.log(`Created ${sessionsCreated.length} past sessions with ${attendancesCreated.length} attendance records.`);

  // Create 1 LIVE ACTIVE session happening right now for CS301 (Dr. Sharma)
  // This lets the user test the Live QR projector immediately!
  const liveSession = await Session.create({
    course: courseDocs[0]._id, // CS301
    teacher: teacher1._id,
    topic: 'Advanced Graph Algorithms & Maximum Flow',
    room: 'LH-101',
    startTime: new Date(),
    endTime: new Date(Date.now() + 45 * 60 * 1000), // ends in 45 minutes
    status: 'open',
    code: 'LIVE99',
    allowManualCode: true,
  });

  // Pre-mark 5 students into the live session so it looks active
  for (let i = 0; i < 5; i++) {
    await Attendance.create({
      session: liveSession._id,
      student: studentDocs[i]._id,
      course: courseDocs[0]._id,
      markedAt: new Date(),
      method: 'qr',
      status: 'present',
    });
  }
  console.log('Created 1 currently LIVE active session (Code: LIVE99) for CS301.');

  // Create immediate Low Attendance Notifications for the at-risk students
  const atRiskStudentsInfo = [
    { student: studentDocs[2], course: courseDocs[0], percentage: 33.3, needed: 10 },
    { student: studentDocs[6], course: courseDocs[1], percentage: 50.0, needed: 6 },
    { student: studentDocs[11], course: courseDocs[2], percentage: 58.3, needed: 4 },
    { student: studentDocs[17], course: courseDocs[3], percentage: 66.7, needed: 3 },
  ];

  for (const item of atRiskStudentsInfo) {
    await Notification.create({
      user: item.student._id,
      type: 'low_attendance_warning',
      title: `Low Attendance Warning: ${item.course.code}`,
      message: `CRITICAL ALERT: Your attendance in ${item.course.name} (${item.course.code}) is ${item.percentage}%, which is below the required 75% threshold. You must attend the next ${item.needed} consecutive classes to recover.`,
      course: item.course._id,
      data: {
        courseCode: item.course.code,
        percentage: item.percentage,
        threshold: 75,
        classesToRecover: item.needed,
      },
      read: false,
    });
  }
  console.log('Created Low Attendance Warning Notifications for at-risk students.');

  console.log('\n========================================================================');
  console.log('🎉 SMARTATTEND v2 SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');
  console.log('\n🔑 DEMO ACCOUNTS FOR EVALUATION:\n');
  console.log('1. ADMIN ACCOUNT:');
  console.log('   Email:    admin@smartattend.edu');
  console.log('   Password: Admin@123');
  console.log('   Role:     Admin (Teacher Approvals, Audit Logs, Settings, Analytics)\n');
  console.log('2. TEACHER ACCOUNTS:');
  console.log('   Email:    dr.sharma@smartattend.edu');
  console.log('   Password: Teacher@123');
  console.log('   Role:     Teacher (Approved - Live QR screen, Roster, Reports, Manual Mark)\n');
  console.log('   Email:    prof.patel@smartattend.edu');
  console.log('   Password: Teacher@123');
  console.log('   Role:     Teacher (Approved - Database & Networks Courses)\n');
  console.log('   Email:    dr.sen@smartattend.edu');
  console.log('   Password: Teacher@123');
  console.log('   Role:     Teacher (PENDING APPROVAL - test Admin approving this account!)\n');
  console.log('3. AT-RISK STUDENTS (< 75% Attendance - Immediate Alerts Visible):');
  console.log('   a) Kabir Mehta (CS003):');
  console.log('      Email:    kabir.mehta@smartattend.edu');
  console.log('      Password: Student@123');
  console.log('      Status:   33.3% in CS301 (Severe Red Banner + Login Modal + Bell Alert)\n');
  console.log('   b) Ananya Iyer (CS007):');
  console.log('      Email:    ananya.iyer@smartattend.edu');
  console.log('      Password: Student@123');
  console.log('      Status:   50.0% in CS302 (Red Banner + Modal + Bell Alert)\n');
  console.log('   c) Rohan Gupta (CS012):');
  console.log('      Email:    rohan.gupta@smartattend.edu');
  console.log('      Password: Student@123');
  console.log('      Status:   58.3% in CS303 (Red Banner + Modal + Bell Alert)\n');
  console.log('   d) Pooja Nair (CS018):');
  console.log('      Email:    pooja.nair@smartattend.edu');
  console.log('      Password: Student@123');
  console.log('      Status:   66.7% in CS304 (Red Banner + Modal + Bell Alert)\n');
  console.log('4. GOOD STANDING STUDENT (>= 85% Attendance):');
  console.log('   Email:    aravind.swamy@smartattend.edu (Roll: CS001)');
  console.log('   Password: Student@123');
  console.log('   Status:   Green Ring (~90% Attendance)\n');
  console.log('========================================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Seed complete.');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
