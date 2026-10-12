# 🎓 SmartAttend v2 - Next-Gen Smart Student Attendance Platform

> **Production-Quality Intelligent Attendance System with Cryptographically Signed Rotating QR Codes, Live Projected Sessions, Automated 75% Low Attendance Alert Engine, and Course Roster Eligibility Tracking.**

Built with **React 18 + Vite, Tailwind CSS, Framer Motion, Node.js 20, Express, MongoDB (Mongoose), JWT, and Web APIs**.

---

## 🌟 Key Highlights & Architectural Improvements over v1

1. **Course Roster & True Percentage Calculations**:
   - Unlike basic versions that merely store loose session counts, SmartAttend v2 enforces relational integrity through `Course` and `Enrollment` models.
   - Calculates exact attendance: $\text{Attendance \%} = \frac{\text{Attended Sessions}}{\text{Total Sessions Conducted}} \times 100$.
2. **Unmissable 75% Low Attendance Alert System**:
   - Immediate red animated warning banner pinned to the top of the dashboard.
   - High-impact modal popup upon student login if any course or overall attendance falls below 75%.
   - Notification bell badges with live unread indicators.
   - Dynamic mathematical recovery calculations: accurately computes the exact number of consecutive classes required to recover to 75% ($\lceil \frac{0.75 T - A}{0.25} \rceil$).
   - Amber "approaching threshold" alerts for students between 75% and 80%.
3. **Rotating Signed QR Tokens & Anti-Proxy Architecture**:
   - Live projector screen generates JWT-signed tokens signed with `QR_SECRET` that rotate every 20 seconds with a 30-second expiry and cryptographic nonce.
   - Prevents screenshot forwards and proxy markings outside the classroom.
   - Compound unique index on `{ session: 1, student: 1 }` prevents double marking at the database layer with standard 409 Conflict handling.
4. **Projector-Ready Teacher Screen**:
   - Full-screen high-contrast view with animated SVG countdown ring.
   - Real-time check-in stream polling every 3 seconds with animated entrances.
   - Fallback manual 6-character session PIN displayed for students with camera hardware limitations.
   - In-session teacher controls: Pause/Resume QR rotation, Extend Time (+5m), Manual Mark, and Undo Mark.
5. **Admin Governance & Compliance**:
   - Mandatory admin approval workflow for faculty accounts before login is permitted.
   - Global system configuration (customizable threshold, QR refresh timing, late mark grace window).
   - Immutable security audit logs recording manual edits, logins, and approvals.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ or v20+ (tested on Node v20/v24)
- **MongoDB**: Local MongoDB server on port `27017` or MongoDB Atlas URI

### Installation & Launch in 3 Simple Steps

```bash
# 1. Navigate to the project root
cd smartattend-v2

# 2. Populate the database with realistic demo data (courses, sessions, at-risk students)
npm run seed

# 3. Launch both the backend server and frontend client concurrently
npm run dev
```

The application will be accessible at:
- **Client Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

---

## 🔑 Demo Accounts for Evaluation

All demo accounts are pre-seeded and ready for immediate testing:

| Role | Email | Password | Notable Characteristics |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@smartattend.edu` | `Admin@123` | Institutional dashboard, teacher approvals, system settings, audit logs |
| **Faculty (Approved)** | `dr.sharma@smartattend.edu` | `Teacher@123` | Teaches CS301, CS303, CS305. Can start live QR sessions & view rosters |
| **Faculty (Approved)** | `prof.patel@smartattend.edu` | `Teacher@123` | Teaches CS302 (DBMS) & CS304 (Networks). |
| **Faculty (Pending Approval)** | `dr.sen@smartattend.edu` | `Teacher@123` | **Pending Approval**. Test the admin approval queue by reviewing this account! |
| **Student (< 75% Alert)** | `kabir.mehta@smartattend.edu` | `Student@123` | **33.3% in CS301**. Immediate red warning banner, login modal & bell badge |
| **Student (< 75% Alert)** | `ananya.iyer@smartattend.edu` | `Student@123` | **50.0% in CS302**. Low attendance warning banner |
| **Student (< 75% Alert)** | `rohan.gupta@smartattend.edu` | `Student@123` | **58.3% in CS303**. Low attendance warning banner |
| **Student (< 75% Alert)** | `pooja.nair@smartattend.edu` | `Student@123` | **66.7% in CS304**. Low attendance warning banner |
| **Student (Good Standing)** | `aravind.swamy@smartattend.edu` | `Student@123` | **~90% Overall**. Green circular progress ring |

> 💡 **Tip:** On the Sign In page (`/login`), click any of the **1-Click Demo Fill** buttons to automatically fill credentials.

---

## 🛠️ Tech Stack & Directory Structure

```
smartattend-v2/
├── package.json              # Orchestrates concurrently dev, seed, and tests
├── README.md                 # Full documentation and evaluation guide
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── config/db.js      # Mongoose connection
│   │   ├── models/           # User, Course, Enrollment, Session, Attendance, Notification, SystemSetting, AuditLog
│   │   ├── middleware/       # JWT auth, RBAC authorize, express-rate-limit, errorHandler
│   │   ├── utils/            # Attendance math formulas, rotating QR JWT token signer/verifier, mailer
│   │   ├── routes/           # auth, courses, sessions, attendance, notifications, admin
│   │   ├── seed/seed.js      # Comprehensive demo database generator
│   │   └── index.js          # Express app entry point
│   └── tests/
│       └── attendance.test.js # Automated test suite for critical business logic
└── client/
    ├── package.json
    ├── vite.config.js        # React plugin + /api proxy
    ├── tailwind.config.js    # Custom indigo/teal palette & animation keyframes
    ├── index.html
    └── src/
        ├── api/client.js     # Centralized fetch client with bearer token injection
        ├── context/          # AuthContext, ThemeContext, NotificationContext
        ├── components/       # ProgressRing, LowAttendanceBanner, LowAttendanceModal, QRScannerModal, Navbar, Sidebar
        ├── pages/
        │   ├── landing/      # SaaS Landing Page
        │   ├── auth/         # Login, Register, ForgotPassword, ResetPassword
        │   ├── student/      # StudentDashboard, StudentScan, AttendanceHistory, Timetable, NotificationsPage, ProfilePage
        │   ├── teacher/      # TeacherDashboard, LiveSessionQR, CoursesManager, TeacherReports
        │   └── admin/        # AdminDashboard, TeacherApprovals, UsersManager, SystemSettings, AuditLogsViewer
        ├── App.jsx           # Protected routes per role & toast notifications
        └── main.jsx
```

---

## 🛡️ Anti-Proxy Security Analysis & Honest Disclosures

SmartAttend v2 incorporates defensive layers designed to deter common classroom attendance fraud:

1. **Short-Lived Signed QR Tokens (20s Refresh, 30s Expiry)**:
   - Each rotating QR code is signed with HMAC/SHA-256 using a server secret (`QR_SECRET`), containing session ID, room code, and a random cryptographic nonce.
   - Screenshots messaged across chat apps will expire before a remote student can scan them.
2. **Compound Unique Database Constraint**:
   - `attendanceSchema.index({ session: 1, student: 1 }, { unique: true })` ensures that double markings are structurally impossible at the database layer.
3. **Course Enrollment Verification**:
   - Only students actively enrolled in the course roster can record attendance for a session.
4. **Audit Trail on Manual Edits**:
   - Any manual mark or status edit by faculty is logged with an mandatory audit reason note and client IP address.

> ⚠️ **Honest Disclosure on Proxy Attendance**:
> While rotating QR codes and device checks drastically reduce casual proxy attendance compared to static QR codes or roll calls, no software-only system can 100% eliminate a situation where a student physically present in the room logs in with their absent peer's account credentials or shares an instant screen stream. For mission-critical high-stakes exams, software checks should be paired with room proctor supervision.

---

## 🧪 Automated Testing

Run the automated test suite verifying attendance mathematical formulas, 75% alert triggers, duplicate mark constraints, and token expiration:

```bash
npm run test
```

Test Results Summary:
- 12/12 test suites passing with 0 failures (`node --test tests/attendance.test.js`).

---

## 📡 API Reference Overview

- **Auth**:
  - `POST /api/auth/register` - Student auto-approved; Teacher requires admin approval
  - `POST /api/auth/login` - Rate limited; checks active state and approval
  - `POST /api/auth/forgot-password` - Dispatches recovery link
  - `POST /api/auth/reset-password` - Resets password with token
  - `GET /api/auth/me` - Profile session verification
- **Sessions & QR**:
  - `POST /api/sessions` - Teacher starts live session
  - `GET /api/sessions/:id/qr` - Generates short-lived signed rotating QR token
  - `POST /api/sessions/:id/close` - Closes active session
  - `POST /api/sessions/:id/extend` - Extends session duration
  - `GET /api/sessions/:id/attendees` - Real-time attendee stream polling
  - `POST /api/sessions/:id/manual-mark` - Faculty manual mark with audit log
  - `DELETE /api/sessions/:id/attendance/:studentId` - Revokes attendance
- **Attendance**:
  - `POST /api/attendance/mark` - Mark attendance via scanned QR token or manual PIN
  - `GET /api/attendance/mine` - Paginated student history with filters
  - `GET /api/attendance/student-stats` - Dashboard metrics with 75% risk calculations
  - `GET /api/attendance/export-csv` - Downloads CSV audit export
- **Courses & Roster**:
  - `GET /api/courses` - Lists courses with enrollment & attendance stats
  - `GET /api/courses/:id/roster` - Course roster with student percentage calculations
  - `POST /api/courses/:id/enroll` - Enroll single student
  - `POST /api/courses/:id/enroll-bulk` - Bulk CSV student enrollment
- **Admin**:
  - `GET /api/admin/pending-teachers` - List faculty awaiting approval
  - `POST /api/admin/approve-teacher/:id` - Grant faculty portal access
  - `POST /api/admin/reject-teacher/:id` - Reject faculty registration
  - `GET /api/admin/users` - Global user directory with activation toggle
  - `GET /api/admin/settings` & `PUT /api/admin/settings` - Global system settings
  - `GET /api/admin/audit-logs` - Security audit trail
  - `GET /api/admin/analytics` - Institutional analytics
