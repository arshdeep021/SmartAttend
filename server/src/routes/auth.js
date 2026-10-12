import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smartattend_jwt_super_secret_key_v2_2026_xyz987';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const registerStudentSchema = z.object({
  role: z.literal('student'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  rollNo: z.string().min(2, 'Roll number is required'),
  department: z.string().min(2, 'Department is required'),
  section: z.string().optional().default('A'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerTeacherSchema = z.object({
  role: z.literal('teacher'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  department: z.string().min(2, 'Department is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Helper to generate JWT
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const role = req.body.role || 'student';

    let validated;
    if (role === 'teacher') {
      validated = registerTeacherSchema.parse(req.body);
    } else {
      validated = registerStudentSchema.parse(req.body);
    }

    const existingUser = await User.findOne({ email: validated.email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    if (role === 'student' && validated.rollNo) {
      const existingRoll = await User.findOne({ rollNo: validated.rollNo.toUpperCase() });
      if (existingRoll) {
        return res.status(409).json({
          success: false,
          message: 'An account with this roll number already exists.',
        });
      }
    }

    const passwordHash = await User.hashPassword(validated.password);

    const userData = {
      role,
      name: validated.name.trim(),
      email: validated.email.toLowerCase().trim(),
      department: validated.department.trim(),
      passwordHash,
      approved: role !== 'teacher', // Teachers require admin approval
    };

    if (role === 'student') {
      userData.rollNo = validated.rollNo.toUpperCase().trim();
      userData.section = (validated.section || 'A').trim();
    }

    const newUser = await User.create(userData);

    // If teacher, do not return auth token yet since pending approval
    if (role === 'teacher') {
      return res.status(201).json({
        success: true,
        pendingApproval: true,
        message: 'Teacher account registration submitted! Your account is pending administrator approval before you can sign in.',
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          approved: false,
        },
      });
    }

    // Students are auto-approved and logged in immediately
    const token = generateToken(newUser);
    return res.status(201).json({
      success: true,
      pendingApproval: false,
      message: 'Student account registered successfully! Welcome to SmartAttend.',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        rollNo: newUser.rollNo,
        department: newUser.department,
        section: newUser.section,
        avatar: newUser.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    if (user.role === 'teacher' && !user.approved) {
      return res.status(403).json({
        success: false,
        code: 'PENDING_APPROVAL',
        message: 'Your teacher account is pending administrator approval. Please check back later or contact the admin.',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: 'USER_LOGIN',
      targetType: 'User',
      targetId: String(user._id),
      details: { role: user.role, email: user.email },
      ip: req.ip || req.headers['x-forwarded-for'] || '',
    });

    const token = generateToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department,
        section: user.section,
        avatar: user.avatar,
        approved: user.approved,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't leak whether user exists for security, return positive message
      return res.json({
        success: true,
        message: 'If that email address exists in our system, a password reset link has been dispatched.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetLink: resetUrl,
    });

    res.json({
      success: true,
      message: 'Password reset link dispatched. In development mode, check your server console.',
      devResetLink: process.env.NODE_ENV === 'development' ? resetUrl : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Token and a password of at least 6 characters are required.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.',
      });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: 'PASSWORD_RESET',
      targetType: 'User',
      targetId: String(user._id),
      details: { email: user.email },
      ip: req.ip || '',
    });

    res.json({
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      rollNo: req.user.rollNo,
      department: req.user.department,
      section: req.user.section,
      avatar: req.user.avatar,
      approved: req.user.approved,
    },
  });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, department, section, avatar } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (department) user.department = department.trim();
    if (section && user.role === 'student') user.section = section.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department,
        section: user.section,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Current password and a new password with at least 6 characters are required.',
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
