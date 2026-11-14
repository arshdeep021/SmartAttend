import rateLimit from "express-rate-limit";

/**
 * Authentication rate limiter: 10 failed/total login attempts per 15 minutes
 * Keyed by email + client IP to prevent brute-force attacks while not penalizing whole classrooms.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email
      ? String(req.body.email).toLowerCase().trim()
      : "";
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown_ip";
    return email ? `${email}_${ip}` : ip;
  },
  message: {
    success: false,
    message:
      "Too many authentication attempts. Please wait 15 minutes before trying again.",
  },
});

/**
 * Attendance mark rate limiter: 5 attempts per minute PER AUTHENTICATED USER
 * Prevents automated PIN guessing / proxy marking while allowing classroom NATs.
 */
export const attendanceMarkLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per student
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?._id) {
      return `student_${req.user._id}`;
    }
    return req.ip || req.headers["x-forwarded-for"] || "anonymous";
  },
  message: {
    success: false,
    message:
      "Too many attendance submission attempts. Please wait 1 minute before trying again.",
  },
});

/**
 * General API rate limiter for broad traffic protection
 */
export const apiGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
});
