import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Course code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned teacher is required"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    section: {
      type: String,
      trim: true,
      default: "A",
    },
    schedule: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          required: true,
        },
        startTime: { type: String, required: true }, // e.g. "09:00"
        endTime: { type: String, required: true }, // e.g. "10:30"
        room: { type: String, default: "Room 301" },
      },
    ],
    totalPlannedClasses: {
      type: Number,
      default: 40,
      min: 1,
    },
    roomDefault: {
      type: String,
      default: "LH-101",
    },
    description: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#4f46e5", // indigo default
    },
  },
  { timestamps: true },
);

export default mongoose.model("Course", courseSchema);
