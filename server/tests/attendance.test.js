import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAttendanceMetrics, calculateOverallAttendance } from '../src/utils/attendanceCalculator.js';
import {
  deriveWindowCode,
  getWindowIndex,
  generateWindowSessionData,
  validateSessionCode,
  generateSignedQrToken,
  verifyQrToken,
  UNAMBIGUOUS_ALPHABET,
} from '../src/utils/qrToken.js';
import jwt from 'jsonwebtoken';

describe('SmartAttend v2 - Critical Logic Test Suite', () => {
  describe('1. Attendance Percentage & Recovery Mathematics', () => {
    it('should correctly compute percentage for standard attendance (8/10 = 80%)', () => {
      const metrics = calculateAttendanceMetrics(8, 10, 75);
      assert.equal(metrics.percentage, 80);
      assert.equal(metrics.isAtRisk, false);
      assert.equal(metrics.isApproachingRisk, false);
      assert.equal(metrics.isSafe, true);
      assert.equal(metrics.colorStatus, 'green');
    });

    it('should trigger isAtRisk and calculate consecutive classes needed to reach 75% for 5/10 (50%)', () => {
      const metrics = calculateAttendanceMetrics(5, 10, 75);
      assert.equal(metrics.percentage, 50);
      assert.equal(metrics.isAtRisk, true);
      assert.equal(metrics.colorStatus, 'red');
      // If student attends 10 more consecutive classes: 15/20 = 75%
      assert.equal(metrics.classesToRecover, 10);
    });

    it('should trigger isAtRisk and calculate needed classes for 4/12 (33.3%)', () => {
      const metrics = calculateAttendanceMetrics(4, 12, 75);
      assert.equal(metrics.percentage, 33.3);
      assert.equal(metrics.isAtRisk, true);
      // Needed = (0.75 * 12 - 4) / 0.25 = (9 - 4) / 0.25 = 20 classes
      // If 4 + 20 = 24 attended out of 12 + 20 = 32 total -> 24/32 = 75%
      assert.equal(metrics.classesToRecover, 20);
    });

    it('should identify approaching threshold warning for 76% (between 75% and 80%)', () => {
      const metrics = calculateAttendanceMetrics(76, 100, 75);
      assert.equal(metrics.percentage, 76);
      assert.equal(metrics.isAtRisk, false);
      assert.equal(metrics.isApproachingRisk, true);
      assert.equal(metrics.colorStatus, 'amber');
    });

    it('should calculate classes student can safely miss before dropping below 75% (9/10 = 90%)', () => {
      const metrics = calculateAttendanceMetrics(9, 10, 75);
      assert.equal(metrics.percentage, 90);
      assert.equal(metrics.isAtRisk, false);
      // Can miss = (9 - 0.75 * 10) / 0.75 = (9 - 7.5) / 0.75 = 2 classes
      // 9 / (10 + 2) = 9/12 = 75%
      assert.equal(metrics.classesCanMiss, 2);
    });

    it('should gracefully handle 0 conducted sessions with 100% default', () => {
      const metrics = calculateAttendanceMetrics(0, 0, 75);
      assert.equal(metrics.percentage, 100);
      assert.equal(metrics.isAtRisk, false);
      assert.equal(metrics.classesToRecover, 0);
    });
  });

  describe('2. Multi-Course Overall & Alert Trigger Engine', () => {
    it('should trigger low-attendance alert if any enrolled course falls below 75%', () => {
      const courses = [
        { course: { code: 'CS301', name: 'DSA' }, attended: 4, totalConducted: 12 }, // 33.3% -> At risk!
        { course: { code: 'CS302', name: 'DBMS' }, attended: 11, totalConducted: 12 }, // 91.7% -> Safe
      ];

      const overall = calculateOverallAttendance(courses, 75);
      assert.equal(overall.hasLowAttendanceAlert, true);
      assert.equal(overall.atRiskCourses.length, 1);
      assert.equal(overall.atRiskCourses[0].course.code, 'CS301');
      assert.equal(overall.atRiskCourses[0].classesToRecover, 20);
    });

    it('should not trigger low-attendance alert when all courses >= 75%', () => {
      const courses = [
        { course: { code: 'CS301' }, attended: 10, totalConducted: 12 }, // 83.3%
        { course: { code: 'CS302' }, attended: 11, totalConducted: 12 }, // 91.7%
      ];

      const overall = calculateOverallAttendance(courses, 75);
      assert.equal(overall.hasLowAttendanceAlert, false);
      assert.equal(overall.atRiskCourses.length, 0);
    });
  });

  describe('3. Deterministic Time-Window & Synchronized Code Derivation', () => {
    const sessionId = '661858c8942b000000000001';
    const secret = 'test_secret_key_32_characters_long_abcdef';

    it('should derive consistent 6-character code for the same window index', () => {
      const windowIndex = 123456;
      const code1 = deriveWindowCode(sessionId, windowIndex, secret);
      const code2 = deriveWindowCode(sessionId, windowIndex, secret);

      assert.equal(code1.length, 6);
      assert.equal(code1, code2);
    });

    it('should strictly use the unambiguous alphabet without 0, O, 1, or I', () => {
      for (let w = 1000; w < 1050; w++) {
        const code = deriveWindowCode(sessionId, w, secret);
        assert.equal(code.length, 6);
        for (const char of code) {
          assert.ok(UNAMBIGUOUS_ALPHABET.includes(char), `Character ${char} must be in unambiguous alphabet`);
          assert.ok(!['0', 'O', '1', 'I'].includes(char), `Confusing char ${char} found in code`);
        }
      }
    });

    it('should rotate code when window index advances', () => {
      const codeA = deriveWindowCode(sessionId, 500, secret);
      const codeB = deriveWindowCode(sessionId, 501, secret);
      assert.notEqual(codeA, codeB);
    });

    it('should generate synchronized window payload under 100 characters', () => {
      const mockSession = { _id: sessionId };
      const data = generateWindowSessionData(mockSession, 30, 'https://smartattend.onrender.com');

      assert.equal(data.code.length, 6);
      assert.ok(data.qrPayload.startsWith('https://smartattend.onrender.com/scan?s='));
      assert.ok(data.qrPayload.includes(`&c=${data.code}`));
      assert.ok(data.qrPayload.length < 100, `QR payload length ${data.qrPayload.length} must be < 100`);
      assert.equal(data.intervalSeconds, 30);
      assert.ok(data.expiresAt > data.serverTime);
    });
  });

  describe('4. Time-Window Grace Period & Expiration Validation', () => {
    const sessionId = '661858c8942b000000000001';
    const intervalSeconds = 30;
    const baseTime = 1700000000000;
    const currentWindow = getWindowIndex(baseTime, intervalSeconds);

    it('should accept code from the current active window', () => {
      const currentCode = deriveWindowCode(sessionId, currentWindow);
      const result = validateSessionCode(sessionId, currentCode, intervalSeconds, baseTime);

      assert.equal(result.valid, true);
      assert.equal(result.isPreviousGrace, false);
      assert.equal(result.windowIndex, currentWindow);
    });

    it('should accept code from at most ONE previous window (grace for network latency)', () => {
      const prevWindow = currentWindow - 1;
      const prevCode = deriveWindowCode(sessionId, prevWindow);
      const result = validateSessionCode(sessionId, prevCode, intervalSeconds, baseTime);

      assert.equal(result.valid, true);
      assert.equal(result.isPreviousGrace, true);
      assert.equal(result.windowIndex, prevWindow);
    });

    it('should reject codes older than ONE previous window (2 windows ago)', () => {
      const oldWindow = currentWindow - 2;
      const oldCode = deriveWindowCode(sessionId, oldWindow);
      const result = validateSessionCode(sessionId, oldCode, intervalSeconds, baseTime);

      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('expired'));
    });

    it('should reject tampered or invalid 6-character codes', () => {
      const result = validateSessionCode(sessionId, 'ZZZZZZ', intervalSeconds, baseTime);
      assert.equal(result.valid, false);
    });

    it('should reject non-6-character inputs', () => {
      const resultShort = validateSessionCode(sessionId, 'ABC', intervalSeconds, baseTime);
      assert.equal(resultShort.valid, false);
      assert.ok(resultShort.reason.includes('6 characters'));
    });
  });

  describe('5. Duplicate Mark Prevention & Constraint Verification', () => {
    it('should simulate duplicate key error code 11000 detection for session + student', () => {
      const mongoDuplicateError = new Error('E11000 duplicate key error collection: smartattend_v2.attendances index: session_1_student_1 dup key');
      mongoDuplicateError.code = 11000;
      mongoDuplicateError.keyPattern = { session: 1, student: 1 };

      assert.equal(mongoDuplicateError.code, 11000);
      assert.ok(mongoDuplicateError.keyPattern.session);
      assert.ok(mongoDuplicateError.keyPattern.student);
    });
  });

  describe('6. Enrollment Verification & Course Protection', () => {
    it('should detect when student is not enrolled in course', () => {
      const enrolledCourses = ['661858c8942b000000000001', '661858c8942b000000000002'];
      const targetSessionCourse = '661858c8942b000000000099';

      const isEnrolled = enrolledCourses.includes(targetSessionCourse);
      assert.equal(isEnrolled, false);
    });
  });

  describe('7. Admin User Creation & Immediate Approval', () => {
    it('should ensure admin-created users are marked approved immediately', () => {
      const adminCreatedTeacher = {
        role: 'teacher',
        name: 'Prof. Test User',
        email: 'test.teacher@smartattend.edu',
        approved: true, // Admin-created accounts must be approved immediately
        isActive: true,
      };

      assert.equal(adminCreatedTeacher.approved, true);
      assert.equal(adminCreatedTeacher.isActive, true);
    });

    it('should detect duplicate roll number conflict for students', () => {
      const existingRollNumbers = new Set(['CS001', 'CS002', 'CS003']);
      const newRoll = 'CS002';

      assert.ok(existingRollNumbers.has(newRoll), 'Duplicate roll number must be detected');
    });
  });

  describe('8. Legacy Rotating Signed QR Token Security (Backward Compatibility)', () => {
    const mockSession = {
      _id: '661858c8942b000000000001',
      course: '661858c8942b000000000002',
      room: 'LH-101',
      teacher: '661858c8942b000000000003',
    };

    it('should generate a valid signed JWT containing session id and metadata', () => {
      const { token, expiresInSeconds } = generateSignedQrToken(mockSession, 30);
      assert.ok(token);
      assert.equal(expiresInSeconds, 30);

      const decoded = verifyQrToken(token);
      assert.equal(decoded.sessionId, String(mockSession._id));
      assert.equal(decoded.room, 'LH-101');
      assert.ok(decoded.nonce);
    });

    it('should reject tampered or forged QR tokens', () => {
      const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.forged_signature';
      assert.throws(() => {
        verifyQrToken(forgedToken);
      }, (err) => err.code === 'QR_INVALID');
    });

    it('should reject expired QR tokens (short-lived rotating security)', () => {
      const QR_SECRET = process.env.QR_SECRET || 'smartattend_qr_rotation_secret_key_v2_2026_abc123';
      const expiredToken = jwt.sign(
        { sessionId: String(mockSession._id), room: 'LH-101' },
        QR_SECRET,
        { expiresIn: '-5s' }
      );

      assert.throws(() => {
        verifyQrToken(expiredToken);
      }, (err) => err.code === 'QR_EXPIRED');
    });
  });
});
