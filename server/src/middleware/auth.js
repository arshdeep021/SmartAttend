import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/env.js';

/**
 * Authentication middleware verifying Bearer JWT
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required. Please sign in.',
      });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been removed.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    // Check approval for teachers
    if (user.role === 'teacher' && !user.approved) {
      return res.status(403).json({
        success: false,
        code: 'PENDING_APPROVAL',
        message: 'Your teacher account is pending administrator approval.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token. Please sign in.',
    });
  }
}

/**
 * Role-based authorization middleware
 * @param  {...string} roles Allowed roles ('student', 'teacher', 'admin')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${roles.join(', ')}] permissions. Current role is ${req.user.role}.`,
      });
    }
    next();
  };
}
