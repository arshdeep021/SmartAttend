import mongoose from "mongoose";

/**
 * Connect to MongoDB with automated exponential backoff retry.
 * Supports both local MongoDB and MongoDB Atlas clusters.
 */
export async function connectDB(maxRetries = 5, initialDelayMs = 1500) {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smartattend_v2";
  let retries = 0;
  let delay = initialDelayMs;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(uri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
      });

      const isAtlas = uri.includes("mongodb.net");
      console.log(
        `[Database] MongoDB connected successfully to ${isAtlas ? "MongoDB Atlas Cluster" : "Local MongoDB"}:`,
      );
      console.log(`  Host: ${conn.connection.host}`);
      console.log(`  Database: ${conn.connection.name}`);
      return conn;
    } catch (err) {
      retries++;
      console.error(
        `[Database] Connection attempt ${retries}/${maxRetries} failed: ${err.message}`,
      );

      if (retries >= maxRetries) {
        console.error(
          "\n================================================================",
        );
        console.error("❌ MONGODB CONNECTION FATAL ERROR:");
        console.error(
          "   Could not connect to MongoDB after multiple attempts.",
        );
        console.error(
          "   Configured URI:",
          uri.replace(/:([^:@]+)@/, ":****@"),
        );
        if (uri.includes("mongodb.net")) {
          console.error("   Atlas Checklist:");
          console.error(
            "   1. Check Atlas Network Access (whitelist 0.0.0.0/0 or host IP).",
          );
          console.error(
            "   2. Verify username and password are correct in MONGODB_URI.",
          );
          console.error(
            "   3. Ensure database user has readWrite permissions.",
          );
        } else {
          console.error("   Local MongoDB Checklist:");
          console.error(
            "   1. Ensure mongod service is running locally on port 27017.",
          );
          console.error(
            "   2. Or provide a MongoDB Atlas cloud URI in your .env file.",
          );
        }
        console.error(
          "================================================================\n",
        );
        throw err;
      }

      console.log(`[Database] Retrying connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
