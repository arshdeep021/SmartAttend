import { ZodError } from "zod";

export function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== "test") {
    console.error("[Error Handler]", err);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: formattedErrors,
    });
  }

  // Mongoose duplicate key error (11000)
  if (err.code === 11000) {
    if (err.keyPattern) {
      if (err.keyPattern.session && err.keyPattern.student) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_ATTENDANCE",
          message:
            "Your attendance has already been recorded for this session.",
        });
      }
      if (err.keyPattern.student && err.keyPattern.course) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_ENROLLMENT",
          message: "Student is already enrolled in this course.",
        });
      }
      if (err.keyPattern.email) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_EMAIL",
          message: "An account with this email address already exists.",
        });
      }
      if (err.keyPattern.rollNo) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_ROLL_NO",
          message: "A student with this roll number already exists.",
        });
      }
      if (err.keyPattern.code) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_CODE",
          message: "A course or item with this code already exists.",
        });
      }
    }

    const field = Object.keys(err.keyValue || {})[0] || "record";
    const val = err.keyValue ? err.keyValue[field] : "";
    return res.status(409).json({
      success: false,
      code: "DUPLICATE_KEY",
      message: `A duplicate entry already exists for ${field}${val ? `: ${val}` : ""}.`,
    });
  }

  // QR token custom errors
  if (
    err.code === "QR_EXPIRED" ||
    err.code === "QR_INVALID" ||
    err.code === "CODE_EXPIRED"
  ) {
    return res.status(400).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // Default fallback
  const statusCode =
    err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error occurred.",
  });
}
