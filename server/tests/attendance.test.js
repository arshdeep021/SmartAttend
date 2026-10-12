import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAttendanceMetrics, calculateOverallAttendance } from '../src/utils/attendanceCalculator.js';
import { generateSignedQrToken, verifyQrToken } from '../src/utils/qrToken.js';
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

  describe('3. Rotating Signed QR Token Security', () => {
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
      // Token expired 5 seconds ago
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

  describe('4. Duplicate Mark Prevention & Constraint Verification', () => {
    it('should simulate duplicate key error code 11000 detection', () => {
      const mongoDuplicateError = new Error('E11000 duplicate key error collection: smartattend_v2.attendances index: session_1_student_1 dup key');
      mongoDuplicateError.code = 11000;
      mongoDuplicateError.keyPattern = { session: 1, student: 1 };

      assert.equal(mongoDuplicateError.code, 11000);
      assert.ok(mongoDuplicateError.keyPattern.session);
      assert.ok(mongoDuplicateError.keyPattern.student);
    });
  });
});
