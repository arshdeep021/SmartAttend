import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import { getJwtSecret, getQrSecret, getClientUrl } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiGeneralLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import sessionRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve directory paths for static client build hosting
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

// CRITICAL: Set trust proxy for reverse proxies (Render, Railway, Fly, Heroku, Nginx)
// Must be set BEFORE express-rate-limit to ensure correct client IP detection.
app.set('trust proxy', 1);

// Security Headers with Helmet tightened for camera, fonts, and inline assets
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'mediastream:'],
        connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:'],
      },
    },
  })
);

// Restricted CORS policy
const configuredClientUrl = getClientUrl();
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  configuredClientUrl,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile camera links, direct browser navigations, curl)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Reduced payload limit from 10mb down to 100kb for attack surface reduction
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// General rate limiter on all API endpoints
app.use('/api', apiGeneralLimiter);

// Health check endpoint (reports database connection status for Render/Railway probes)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    database: {
      status: states[dbState] || 'unknown',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    },
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '2.0.0',
    service: 'SmartAttend v2 Unified Server',
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all 404 for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint ${req.method} ${req.url} not found.` });
});

// Serve frontend client build in production (Single service, unified origin)
app.use(express.static(clientDistPath));

// SPA Fallback: send index.html for any non-API client route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Centralized error handling
app.use(errorHandler);

// Connect to Database and start server
async function startServer() {
  // Validate secrets at boot
  try {
    getJwtSecret();
    getQrSecret();
  } catch (err) {
    console.error('FATAL BOOTSTRAP CONFIGURATION ERROR:', err.message);
    process.exit(1);
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SmartAttend v2 Unified Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Public Client URL: ${configuredClientUrl}`);
    console.log(`📂 Client Build Path: ${clientDistPath}`);
    console.log(`=======================================================`);
  });
}

// Start server when executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
