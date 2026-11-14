import nodemailer from "nodemailer";

const emailAlertsEnabled = process.env.EMAIL_ALERTS_ENABLED === "true";

let transporter = null;

if (emailAlertsEnabled) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

/**
 * Send low-attendance alert email if enabled, otherwise log to console in dev mode
 */
export async function sendLowAttendanceAlertEmail({
  studentEmail,
  studentName,
  courseName,
  percentage,
  classesNeeded,
}) {
  const subject = `[URGENT] Low Attendance Warning for ${courseName} - SmartAttend`;
  const text = `Dear ${studentName},\n\nYour attendance in ${courseName} has fallen to ${percentage}%, which is below the mandatory 75% threshold.\n\nYou must attend the next ${classesNeeded} consecutive class(es) to recover your attendance to 75%.\n\nPlease speak with your course instructor immediately.\n\nSmartAttend System`;

  if (emailAlertsEnabled && transporter) {
    try {
      await transporter.sendMail({
        from: '"SmartAttend Notification" <no-reply@smartattend.edu>',
        to: studentEmail,
        subject,
        text,
      });
      console.log(`[Email] Alert email successfully sent to ${studentEmail}`);
    } catch (err) {
      console.error(
        `[Email] Failed to send email to ${studentEmail}:`,
        err.message,
      );
    }
  } else {
    console.log(
      `[Dev Notification Dispatch] Email simulation for ${studentEmail}:`,
    );
    console.log(`  To: ${studentEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(
      `  Percentage: ${percentage}% | Needed classes: ${classesNeeded}`,
    );
  }
}

/**
 * Send password reset link
 */
export async function sendPasswordResetEmail({ email, name, resetLink }) {
  console.log(`\n======================================================`);
  console.log(`[PASSWORD RESET] Simulated email to: ${email} (${name})`);
  console.log(`[RESET LINK]: ${resetLink}`);
  console.log(`======================================================\n`);
}
