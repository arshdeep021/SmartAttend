import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartattend_v2';
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
    });
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('[Database] MongoDB connection error:', err.message);
    process.exit(1);
  }
}
