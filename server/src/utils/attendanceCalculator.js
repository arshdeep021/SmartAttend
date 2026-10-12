/**
 * Attendance calculation utilities for SmartAttend v2
 */

/**
 * Calculate attendance metrics for a given attended and total sessions
 * @param {number} attended - Number of sessions attended
 * @param {number} totalConducted - Number of sessions conducted so far
 * @param {number} [threshold=75] - Required threshold percentage (default 75)
 * @returns {object} Attendance metrics
 */
export function calculateAttendanceMetrics(attended, totalConducted, threshold = 75) {
  const att = Math.max(0, Number(attended) || 0);
  const total = Math.max(0, Number(totalConducted) || 0);
  const targetFraction = threshold / 100;

  if (total === 0) {
    return {
      attended: 0,
      totalConducted: 0,
      percentage: 100,
      isAtRisk: false,
      isApproachingRisk: false,
      isSafe: true,
      classesToRecover: 0,
      classesCanMiss: 0,
      statusLabel: 'No sessions held yet',
      colorStatus: 'green', // 'green' | 'amber' | 'red'
    };
  }

  const rawPercentage = (att / total) * 100;
  const percentage = Math.round(rawPercentage * 10) / 10; // 1 decimal place

  const isAtRisk = percentage < threshold;
  const isApproachingRisk = !isAtRisk && percentage < threshold + 5;
  const isSafe = !isAtRisk && !isApproachingRisk;

  let classesToRecover = 0;
  let classesCanMiss = 0;

  if (isAtRisk) {
    // Formula: (target * total - att) / (1 - target)
    const needed = (targetFraction * total - att) / (1 - targetFraction);
    classesToRecover = Math.max(1, Math.ceil(needed));
  } else {
    // Formula: (att - target * total) / target
    const canMiss = (att - targetFraction * total) / targetFraction;
    classesCanMiss = Math.max(0, Math.floor(canMiss));
  }

  let colorStatus = 'green';
  if (isAtRisk) {
    colorStatus = 'red';
  } else if (isApproachingRisk) {
    colorStatus = 'amber';
  }

  return {
    attended: att,
    totalConducted: total,
    percentage,
    isAtRisk,
    isApproachingRisk,
    isSafe,
    classesToRecover,
    classesCanMiss,
    threshold,
    colorStatus,
  };
}

/**
 * Recompute attendance summary across multiple enrolled courses
 * @param {Array} courseStats - Array of { course, attended, totalConducted }
 * @param {number} [threshold=75]
 */
export function calculateOverallAttendance(courseStats, threshold = 75) {
  let totalAttended = 0;
  let totalConducted = 0;
  const courseSummaries = [];
  const atRiskCourses = [];
  const approachingCourses = [];

  for (const cs of courseStats) {
    const metrics = calculateAttendanceMetrics(cs.attended, cs.totalConducted, threshold);
    const summary = {
      course: cs.course,
      ...metrics,
    };
    courseSummaries.push(summary);

    if (metrics.isAtRisk) {
      atRiskCourses.push(summary);
    } else if (metrics.isApproachingRisk) {
      approachingCourses.push(summary);
    }

    totalAttended += cs.attended;
    totalConducted += cs.totalConducted;
  }

  const overallMetrics = calculateAttendanceMetrics(totalAttended, totalConducted, threshold);

  return {
    overall: overallMetrics,
    courses: courseSummaries,
    atRiskCourses,
    approachingCourses,
    hasLowAttendanceAlert: atRiskCourses.length > 0 || overallMetrics.isAtRisk,
    hasApproachingWarning: approachingCourses.length > 0 || overallMetrics.isApproachingRisk,
  };
}
