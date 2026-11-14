import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: [true, "Session reference is required"],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ["qr", "manual", "manual_code"],
      default: "qr",
    },
    status: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "present",
    },
    ip: {
      type: String,
      default: "",
    },
    deviceInfo: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// CRITICAL UNIQUE CONSTRAINT: One attendance record per student per session!
attendanceSchema.index({ session: 1, student: 1 }, { unique: true });

// Performance lookup indexes
attendanceSchema.index({ student: 1, course: 1 });
attendanceSchema.index({ course: 1, markedAt: -1 });

export default mongoose.model("Attendance", attendanceSchema);
