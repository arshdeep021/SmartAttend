import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference is required'],
    },
    topic: {
      type: String,
      required: [true, 'Session topic is required'],
      trim: true,
    },
    room: {
      type: String,
      required: [true, 'Room label is required'],
      trim: true,
      default: 'LH-101',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      required: false, // Codes are dynamically & deterministically derived per time window
    },
    qrRefreshInterval: {
      type: Number,
      default: 30, // seconds
    },
    allowManualCode: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes for fast lookup
sessionSchema.index({ course: 1, createdAt: -1 });
sessionSchema.index({ teacher: 1, createdAt: -1 });
sessionSchema.index({ status: 1, endTime: 1 });

export default mongoose.model('Session', sessionSchema);
