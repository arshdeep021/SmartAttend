import "dotenv/config";

/**
 * Validates and retrieves the JWT signing secret.
 * Enforces a minimum 32-character secret in production.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is required in production!",
      );
    }
    return "smartattend_jwt_super_secret_key_v2_2026_xyz987";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long in production.",
    );
  }

  return secret;
}

/**
 * Validates and retrieves the QR code rotation secret.
 * Enforces a minimum 32-character secret in production.
 */
export function getQrSecret() {
  const secret = process.env.QR_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL CONFIGURATION ERROR: QR_SECRET environment variable is required in production!",
      );
    }
    return "smartattend_qr_rotation_secret_key_v2_2026_abc123";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: QR_SECRET must be at least 32 characters long in production.",
    );
  }

  return secret;
}

/**
 * Default QR rotation window in seconds.
 */
export function getDefaultRotationInterval() {
  const val = Number(process.env.QR_ROTATION_INTERVAL_SECONDS);
  return val && val >= 10 && val <= 120 ? val : 30;
}

/**
 * Public client base URL used for links and QR redirects.
 */
export function getClientUrl() {
  return (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
}
