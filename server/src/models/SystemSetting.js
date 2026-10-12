import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_config',
    },
    attendanceThreshold: {
      type: Number,
      default: 75,
      min: 50,
      max: 100,
    },
    qrRefreshInterval: {
      type: Number,
      default: 20, // seconds
      min: 10,
      max: 60,
    },
    qrTokenExpiry: {
      type: Number,
      default: 30, // seconds
      min: 15,
      max: 120,
    },
    lateGraceMinutes: {
      type: Number,
      default: 10,
      min: 0,
      max: 60,
    },
    emailAlertsEnabled: {
      type: Boolean,
      default: false,
    },
    institutionName: {
      type: String,
      default: 'Apex Institute of Technology',
    },
  },
  { timestamps: true }
);

export default mongoose.model('SystemSetting', systemSettingSchema);
