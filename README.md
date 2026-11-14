# 🎓 SmartAttend v2 - Next-Gen Smart Student Attendance Platform

> **Hardened, Production-Ready Intelligent Attendance System featuring Cryptographically Synchronized Rotating QR Codes & 6-Character PINs, Server-Side Time-Windows, Single-Origin SPA Serving, Automated 75% Low Attendance Alert Engine, and Course Roster Tracking.**

Built with **React 18 + Vite, Tailwind CSS, Framer Motion, Node.js 20, Express, MongoDB Atlas (Mongoose), and Web APIs**.

Live App: https://smartattend-qill.onrender.com/

---

## 🌟 Key Highlights & Architectural Guarantees

1. **Synchronized QR Code & 6-Character Session PIN Rotation**:
   - Single source of truth driven by server-side discrete time windows: $\text{windowIndex} = \lfloor \frac{\text{Date.now()}}{\text{interval} \times 1000} \rfloor$.
   - Derives BOTH the QR payload and the manual 6-character PIN deterministically using HMAC-SHA256 with an unambiguous alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, excluding confusing digits `0, O, 1, I`).
   - Server response: `{ code, qrPayload, windowStart, expiresAt, serverTime, intervalSeconds }`. Nothing stored per window in the database (zero DB bloat).
   - Atomic React state updates prevent QR and PIN from ever falling out of sync.
   - Server clock-offset scheduling `(serverTime - Date.now())` eliminates client-side clock drift.
   - Validation accepts the current window and at most ONE previous grace window (for network latency), while rejecting older codes.

2. **Reliable Camera Scanning (< 100 Chars)**:
   - Replaced heavy 350-character JWTs with compact URLs under 100 characters: `https://<domain>/scan?s=<sessionId>&c=<code>`.
   - Students can scan directly with their native phone camera app! Unauthenticated scans smoothly route to `/login?redirect=...` and automatically mark attendance upon authentication.
   - Projector display renders QR with level `M`, 320px SVG, 4-module quiet zone, and high contrast.
   - Built-in scanner modal defaults to the rear environment camera (`facingMode: 'environment'`), dynamic 75% qrbox, and native BarcodeDetector API acceleration.

3. **User Management & Database Persistence**:
   - Full Admin CRUD modal for adding students and faculty with instant approval (`approved: true`) and immediate course enrollment.
   - Student self-enrollment modal using course codes (`POST /api/courses/join`), toggleable in System Settings.
   - ReDoS-safe user searching with regex character escaping.
   - Safe seeding script (`npm run seed`) guarded against accidental execution in production and requiring `--force` if records exist.
   - Production connection resiliency with 5-attempt exponential backoff for MongoDB Atlas.

4. **Production Architecture & Hardening**:
   - **Unified Single-Origin Service**: Express statically serves the compiled Vite client (`client/dist`) with an SPA catch-all fallback (`* -> index.html`), eliminating cross-origin CORS barriers and multiple hosting costs.
   - **Reverse-Proxy Ready**: Configured `app.set('trust proxy', 1)` to prevent express-rate-limit IP collisions behind Render/Railway/Fly/Cloudflare.
   - **NAT-Safe Rate Limiting**: Attendance marking rate limit is keyed per authenticated student user ID (`student_<id>`), preventing entire classroom subnets from being locked out.
   - **Reduced Attack Surface**: Express payload body size capped at `100kb`.
   - **Security Headers**: Tightened Helmet CSP supporting cameras, Google Fonts, and inline data-URI icons.
   - **Strict Boot Secret Validation**: Server fails fast if `JWT_SECRET` or `QR_SECRET` are missing or less than 32 characters in production.

5. **Unmissable 75% Low Attendance Alert Engine**:
   - Real-time percentage math: $\text{Attendance \%} = \frac{\text{Attended Classes}}{\text{Conducted Classes}} \times 100$.
   - Recovery math calculates exact consecutive classes needed to return above 75%: $\lceil \frac{0.75 T - A}{0.25} \rceil$.
   - Calculates safe margin of classes a student can miss without dropping below threshold.
   - Login alert popup, pinned red dashboard banner, and notifications.

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v18+ or v20+ (ESM support required)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017/smartattend_v2`) or MongoDB Atlas URI

### Quick Start
```bash
# 1. Install root, server, and client dependencies
npm install

# 2. Populate development database with seed data
npm run seed -- --force

# 3. Start both backend (port 5000) and frontend (port 5173) in dev mode
npm run dev
```

Application URLs in Development:
- **Client Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

---

## 🌐 Production Deployment Guide

SmartAttend v2 is engineered as a unified single-port application. The backend Express server serves both the REST API and the compiled React SPA from `client/dist`.

### Step 1: Provision MongoDB Atlas Cluster (Free M0)
1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster (AWS/GCP/Azure in your closest region).
3. Under **Security > Database Access**, create a user (e.g. `smartattend_app`) with read/write privileges.
4. Under **Security > Network Access**, click **Add IP Address** and select **Allow Access from Anywhere** (`0.0.0.0/0`) so dynamic cloud hosts can connect.
5. In **Database > Connect**, copy your connection string:
   ```
   mongodb+srv://smartattend_app:<PASSWORD>@cluster0.abcde.mongodb.net/smartattend_v2?retryWrites=true&w=majority
   ```

### Step 2: Deploy to Render.com (Recommended Free/Low-Cost Host)
1. Push your repository to GitHub or GitLab.
2. Sign in to [Render.com](https://render.com) and click **New + > Web Service**.
3. Connect your repository and configure the service:
   - **Name**: `smartattend-v2`
   - **Region**: Closest to your users
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm run build` (runs `npm run build --prefix client`)
   - **Start Command**: `npm start` (runs `node server/src/index.js`)
   - **Instance Type**: `Free` or `Starter`
4. Add the following **Environment Variables** in the Render Dashboard:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations & strict secret checking |
| `PORT` | `10000` | Port automatically set by Render |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas connection string from Step 1 |
| `JWT_SECRET` | *(64-char hex)* | Generate via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `QR_SECRET` | *(64-char hex)* | Generate via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `CLIENT_URL` | `https://smartattend.onrender.com` | Your public domain (or custom domain) |
| `QR_ROTATION_INTERVAL_SECONDS` | `30` | Time window for QR & PIN rotation (default 30) |

5. Under **Settings > Health Check Path**, set:
   ```
   /api/health
   ```
6. Click **Create Web Service**. Render will install dependencies, build the React bundle to `client/dist`, start Node, and verify healthy database connectivity.

### Step 3: Custom Domain & SSL/TLS Setup
1. In Render, navigate to **Settings > Custom Domains** and add your domain (e.g. `attend.yourinstitution.edu`).
2. In your DNS provider (Cloudflare, Namecheap, GoDaddy):
   - For apex domain (`yourinstitution.edu`): Add an `ANAME` or `ALIAS` pointing to Render's DNS target.
   - For subdomain (`attend.yourinstitution.edu`): Add a `CNAME` pointing to Render's DNS target.
3. Render automatically issues and renews a free Let's Encrypt SSL/TLS certificate.
4. Update `CLIENT_URL` in your environment variables to match `https://attend.yourinstitution.edu`.

---

## 🔑 Demo Accounts for Evaluation

| Role | Email | Password | Features / Test Scenario |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@smartattend.edu` | `Admin@123` | Institutional dashboard, User Management CRUD modal, System Settings, Audit logs |
| **Faculty (Approved)** | `dr.sharma@smartattend.edu` | `Teacher@123` | Teaches CS301, CS303, CS305. Can start live QR projector sessions & manage rosters |
| **Faculty (Pending Approval)** | `dr.sen@smartattend.edu` | `Teacher@123` | Test the admin approval queue by approving this account |
| **Student (< 75% Alert)** | `kabir.mehta@smartattend.edu` | `Student@123` | **33.3% in CS301**. Red alert banner, login modal, consecutive class recovery count |
| **Student (Good Standing)** | `aravind.swamy@smartattend.edu` | `Student@123` | **~90% Overall**. Safe classes margin calculation |

*Tip: Quick-fill buttons are available on the Sign In page (`/login`) for evaluation.*

---

## 🧪 Automated Testing

SmartAttend v2 includes a test suite covering mathematical accuracy, synchronized time-window derivation, grace period validation, duplicate mark constraints, and database persistence:

```bash
# Run all automated tests
npm test
```

Test Results:
- **25/25 tests passing** (`attendance.test.js` and `e2e_verify.test.js`).
- Tests run with Node's native test runner (`node --test`).

---

## 📁 Repository Structure

```
smartattend-v2/
├── package.json              # Root npm scripts (build, start, dev, seed, test)
├── .env.example              # Comprehensive environment configuration documentation
├── README.md                 # System overview and deployment guide
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── config/           # db.js (Atlas retry), env.js (Strict validation)
│   │   ├── models/           # User, Course, Enrollment, Session, Attendance, Notification, SystemSetting, AuditLog
│   │   ├── middleware/       # auth, RBAC, rateLimiter (per student ID), errorHandler (11000 handling)
│   │   ├── utils/            # qrToken.js (deterministic window index & 6-char derivation)
│   │   ├── routes/           # auth, courses, sessions, attendance, notifications, admin
│   │   ├── seed/seed.js      # Safe seed script (protected with --force)
│   │   └── index.js          # Unified Express server & client/dist static hosting
│   └── tests/
│       ├── attendance.test.js # 24 unit and integration tests
│       └── e2e_verify.test.js # End-to-end restart persistence & attendance flow test
└── client/
    ├── package.json
    ├── vite.config.js        # React plugin + /api proxy
    ├── tailwind.config.js    # Responsive utility styling
    └── src/
        ├── api/client.js     # Centralized fetch client
        ├── components/       # QRScannerModal, ProgressRing, LowAttendanceBanner, LowAttendanceModal
        └── pages/
            ├── student/      # StudentDashboard, StudentScan, AttendanceHistory
            ├── teacher/      # TeacherDashboard, LiveSessionQR, CoursesManager
            └── admin/        # AdminDashboard, UsersManager, SystemSettings, AuditLogs
```

---
