import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getQrSecret, getDefaultRotationInterval, getClientUrl } from '../config/env.js';

// Unambiguous 32-character alphabet (excludes confusing digits/letters 0, O, 1, I)
export const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Compute the discrete time window index for a given timestamp
 * @param {number} [timestamp=Date.now()]
 * @param {number} [intervalSeconds=30]
 * @returns {number}
 */
export function getWindowIndex(timestamp = Date.now(), intervalSeconds = 30) {
  const safeInterval = Math.max(5, Number(intervalSeconds) || 30);
  return Math.floor(timestamp / (safeInterval * 1000));
}

/**
 * Deterministically derive the 6-character session PIN for a given session and window index.
 * HMAC-SHA256(QR_SECRET, sessionId + ":" + windowIndex) mapped into the unambiguous alphabet.
 * @param {string} sessionId
 * @param {number} windowIndex
 * @param {string} [secret]
 * @returns {string} 6-character uppercase alphanumeric code
 */
export function deriveWindowCode(sessionId, windowIndex, secret = getQrSecret()) {
  const hmac = crypto.createHmac('sha256', secret)
    .update(`${String(sessionId)}:${windowIndex}`)
    .digest();

  let code = '';
  for (let i = 0; i < 6; i++) {
    code += UNAMBIGUOUS_ALPHABET[hmac[i] % UNAMBIGUOUS_ALPHABET.length];
  }
  return code;
}

/**
 * Generate synchronized window payload for a live session:
 * Returns the exact 6-char code and the compact URL QR payload for this time window.
 *
 * @param {object} session
 * @param {number} [intervalSeconds]
 * @param {string} [baseUrl]
 * @returns {object} { code, qrPayload, windowStart, expiresAt, serverTime, intervalSeconds }
 */
export function generateWindowSessionData(sessionOrId, intervalSeconds, baseUrl) {
  const sessionId = sessionOrId && sessionOrId._id ? sessionOrId._id : sessionOrId;
  const interval = Math.max(5, Number(intervalSeconds) || getDefaultRotationInterval());
  const now = Date.now();
  const windowIndex = getWindowIndex(now, interval);
  const code = deriveWindowCode(sessionId, windowIndex);
  const windowStart = windowIndex * interval * 1000;
  const expiresAt = (windowIndex + 1) * interval * 1000;

  // Short URL payload under 100 chars: https://<domain>/scan?s=<sessionId>&c=<code>
  const cleanBase = (baseUrl || getClientUrl()).replace(/\/$/, '');
  const qrPayload = `${cleanBase}/scan?s=${sessionId}&c=${code}`;

  return {
    code,
    qrPayload,
    windowIndex,
    windowStart,
    expiresAt,
    serverTime: now,
    intervalSeconds: interval,
  };
}

/**
 * Validates a submitted code against a session's current time window
 * and allows at most ONE previous window (grace for network latency).
 *
 * @param {string} sessionId
 * @param {string} submittedCode
 * @param {number} [intervalSeconds=30]
 * @param {number} [now=Date.now()]
 * @returns {{ valid: boolean, isPreviousGrace?: boolean, windowIndex?: number, reason?: string }}
 */
export function validateSessionCode(sessionId, submittedCode, intervalSeconds = getDefaultRotationInterval(), now = Date.now()) {
  if (!submittedCode || typeof submittedCode !== 'string') {
    return { valid: false, reason: 'Session attendance code is required.' };
  }

  const cleanCode = submittedCode.trim().toUpperCase();
  if (cleanCode.length !== 6) {
    return { valid: false, reason: 'Session attendance code must be 6 characters.' };
  }

  const interval = Math.max(5, Number(intervalSeconds) || getDefaultRotationInterval());
  const currentWindow = getWindowIndex(now, interval);

  // 1. Check current active window
  const currentCode = deriveWindowCode(sessionId, currentWindow);
  if (cleanCode === currentCode) {
    return { valid: true, isPreviousGrace: false, windowIndex: currentWindow };
  }

  // 2. Check at most ONE previous window (grace window)
  const previousWindow = currentWindow - 1;
  const previousCode = deriveWindowCode(sessionId, previousWindow);
  if (cleanCode === previousCode) {
    return { valid: true, isPreviousGrace: true, windowIndex: previousWindow };
  }

  // 3. Rejected - expired or incorrect
  return {
    valid: false,
    reason: 'This attendance code has expired. Please enter or scan the refreshed code on the screen.',
  };
}

// ---------------------------------------------------------------------------
// Legacy Token Utilities (retained for backward compatibility and test suites)
// ---------------------------------------------------------------------------

export function generateSignedQrToken(session, expiresInSeconds = 30) {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = {
    sessionId: String(session._id),
    courseId: String(session.course?._id || session.course),
    room: session.room,
    teacherId: String(session.teacher?._id || session.teacher),
    nonce,
    timestamp: Date.now(),
  };

  const token = jwt.sign(payload, getQrSecret(), {
    expiresIn: `${expiresInSeconds}s`,
  });

  return {
    token,
    expiresInSeconds,
    generatedAt: new Date(),
  };
}

export function verifyQrToken(token) {
  if (!token) {
    throw new Error('QR token is missing.');
  }

  try {
    const decoded = jwt.verify(token, getQrSecret());
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('This QR code has expired. Please scan the current refreshed code on the screen.');
      error.code = 'QR_EXPIRED';
      throw error;
    }
    const error = new Error('Invalid or tampered QR code token.');
    error.code = 'QR_INVALID';
    throw error;
  }
}
