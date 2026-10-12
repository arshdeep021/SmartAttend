import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[Error Handler]', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: formattedErrors,
    });
  }

  // Mongoose duplicate key error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'record';
    // If it's the compound index on session + student
    if (err.keyPattern && err.keyPattern.session && err.keyPattern.student) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_ATTENDANCE',
        message: 'Your attendance has already been marked for this session.',
      });
    }
    if (err.keyPattern && err.keyPattern.student && err.keyPattern.course) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_ENROLLMENT',
        message: 'Student is already enrolled in this course.',
      });
    }
    return res.status(409).json({
      success: false,
      message: `A duplicate entry already exists for ${field}: ${err.keyValue[field]}.`,
    });
  }

  // QR token custom errors
  if (err.code === 'QR_EXPIRED' || err.code === 'QR_INVALID') {
    return res.status(400).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // Default fallback
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
}
