import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'smartattend_qr_rotation_secret_key_v2_2026_abc123';
const DEFAULT_EXPIRY = Number(process.env.QR_TOKEN_EXPIRY_SECONDS) || 30;

/**
 * Generate a cryptographically signed rotating QR code token
 * @param {object} session - Session document or object
 * @param {number} [expiresInSeconds=30]
 */
export function generateSignedQrToken(session, expiresInSeconds = DEFAULT_EXPIRY) {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = {
    sessionId: String(session._id),
    courseId: String(session.course?._id || session.course),
    room: session.room,
    teacherId: String(session.teacher?._id || session.teacher),
    nonce,
    timestamp: Date.now(),
  };

  const token = jwt.sign(payload, QR_SECRET, {
    expiresIn: `${expiresInSeconds}s`,
  });

  return {
    token,
    expiresInSeconds,
    generatedAt: new Date(),
  };
}

/**
 * Verify and unpack a QR token
 * @param {string} token - The JWT string scanned from QR
 */
export function verifyQrToken(token) {
  if (!token) {
    throw new Error('QR token is missing.');
  }

  try {
    const decoded = jwt.verify(token, QR_SECRET);
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
