# FUNT Platform

A production LMS and operations platform for robotics education built as a Turborepo monorepo.

**Live domains:**
- Backend API: `https://api.funt.in`
- Admin Console: `https://admin.funt.in`
- Student LMS: `https://learn.funt.in`
- Support Portal: `https://support.funt.in`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 4, Mongoose 8, Redis (ioredis), JWT, Zod, PDFKit, Socket.IO |
| Admin | Next.js 16, React 18, TailwindCSS 3, Recharts |
| LMS | Next.js 16, React 18, TailwindCSS 3, Recharts |
| Support | Next.js 16, React 18, TailwindCSS 3 |
| Editor | TipTap / ProseMirror (shared package) |
| Tooling | Turborepo, TypeScript 5, Node 20+ |
| Database | MongoDB Atlas |
| Storage | Cloudflare R2 (videos, images) |
| Payments | Razorpay + manual UPI/QR |
| Cache | Redis (Upstash) — rate limiting + caching |

---

## Monorepo Structure

```
funt-platform/
├── apps/
│   ├── backend/          Express API + business logic + MongoDB models
│   ├── admin/            Next.js admin/staff dashboard (port 3000)
│   ├── lms/             Next.js student/parent portal (port 3001)
│   └── support/          Next.js support agent portal (port 3002)
├── packages/
│   ├── constants/        Shared enums (roles, statuses, types)
│   ├── types/            Shared TypeScript type contracts
│   └── rich-text-editor/ TipTap-based editor with media handling
├── docs/
│   └── DEPLOYMENT.md     Production deploy runbook
├── turbo.json
└── package.json
```

---

## User Roles

| Role | Access |
|------|--------|
| Super Admin | Full platform governance, admin approvals, system config, git backup |
| Admin | Courses, batches, students, assignments, shop, payments, coupons, badges |
| Trainer | Assigned academic operations with role-based visibility |
| Support Agent | Ticket management and student support |
| Student | LMS courses, assignments, progress, shop, achievements |
| Parent | Linked student visibility and monitoring |

---

## Features

### Learning & Content
- Global modules and global assignments (reusable source assets)
- Course creation with ordered module snapshots
- Batch management with course snapshots and per-course controls
- Rich text editor with video embeds (YouTube, Drive, Vimeo), images, tables, code blocks
- Chapter-based content delivery with progress tracking
- Learning plans with milestones (date-based, progress-based, manual unlock)
- Content protection (anti-piracy controls per batch)
- Chapter export as Word document (.doc) with embedded images

### Quizzes
- Quiz builder with multiple choice questions
- Timed quiz attempts with auto-submit
- Per-batch quiz assignment
- Score tracking and review

### Academic Operations
- Enrollment lifecycle (pending → active → completed/suspended/dropped)
- Enrollment requests and license key enrollment
- Assignment submissions (file, text, link) with review workflow
- Attendance tracking (course-specific + general/standalone)
- Progress tracking and manual progress overrides
- Skill profiles and skill tag system
- Leave management (sick, casual, earned) with approval workflow

### Gamification & Rewards
- **XP** — awarded on module/course completion
- **Coins** — grant system with expiry, redeemable in shop
- **Badges/Achievements** — auto-trigger and manual award modes
- Badge definitions: first assignment, 7-day streak, first course completed, perfect attendance

### Commerce
- Shop product catalog with stock management
- Cart-based checkout with coupon + coin redemption
- Coupon system (SHOP and COURSE types, percent discount, validity window)
- Order lifecycle (confirmed → shipping → delivered, with cancel/issue flows)
- Stock reservation with timed release

### Payments
- Manual UPI submission with QR codes (rolling QR refresh)
- Razorpay integration (card / UPI app checkout)
- Payment approval workflows
- Payment promises (pay-later with due dates and overdue processing)
- UPI config management with change request auditing

### Invoices & Certificates
- PDF invoice generation with digital signing
- Certificate generation with QR verification
- Milestone-based certificates
- Public verification endpoint (`/verify`)

### Franchise System
- Franchise center management
- License key pools per franchise
- Trainer assignment and status tracking
- Payment proof uploads (direct to R2)
- Key request workflow with admin approval

### Support & Tickets
- Multi-category ticket system (course access, payment, technical, etc.)
- Ticket assignment to support agents
- Reply threading with attachments
- Priority and status management
- Real-time updates via Socket.IO

### Knowledge Center
- Admin-authored help articles
- Role-based visibility
- Category and tag system
- Search across articles

### Referral System
- Student referral codes
- Referral tracking and rewards

### Notifications
- In-app notification system
- Mark-as-read functionality
- Role-targeted notifications

### Import / Export & Backup
- Multi-level data export (Level 1–4: course → full platform)
- ZIP package with JSON + manifest
- Import with conflict detection and merge/replace modes
- **Automated weekly git backup** of all database collections
- Manual backup trigger via admin panel

### Security & Governance
- Role-based authorization on all routes
- Full audit logging for critical actions
- Helmet + rate limiting (Redis-backed for multi-instance)
- Strict production env validation (HTTPS, no localhost, min secret length)
- httpOnly cookie-based auth with configurable idle timeout
- CSRF protection
- Content-Security-Policy headers
- Mobile number validation (10 digits or +countrycode format)

---

## Backend API Routes

```
/health, /health/ping, /health/ready

/api/auth                Authentication (login, register, Google OAuth, sessions)
/api/public              Public endpoints (course catalog, explore)
/api/users               User management
/api/admin               Admin operations (users, backup, badges, payments)
/api/admin/data          Import/Export (ZIP backup)
/api/admin/videos        R2 video management (presign, confirm, preview, delete)
/api/admin/knowledge     Knowledge center CRUD
/api/admin/learning-plan Learning plan/milestone management
/api/student             Student operations (courses, media stream)
/api/parent              Parent delegate operations
/api/courses             Course CRUD and management
/api/batches             Batch CRUD and management
/api/assignments         Assignment submissions and review
/api/attendance          Course attendance
/api/general-attendance  Standalone attendance
/api/certificates        Certificate generation and management
/api/global-modules      Global module management (+ .doc export)
/api/global-chapters     Chapter management within modules
/api/global-assignments  Global assignment management
/api/enrollments         Enrollment lifecycle + requests
/api/progress            Student progress tracking
/api/skills              Skill profile management
/api/achievements        Badges and achievement system
/api/audit               Audit log queries
/api/profile             User profile operations
/api/shop                Shop, cart, orders, products
/api/tickets             Support ticket system
/api/notifications       In-app notifications
/api/leaves              Leave management
/api/knowledge           Knowledge center (reader)
/api/quizzes             Quiz management (admin + student)
/api/payment-promises    Pay-later promise management
/api/referral            Referral system
/api/franchise           Franchise operations
/api/content-protection  Content protection config
/verify                  Public certificate/invoice verification
```

---

## Data Models (49)

Achievement, AssignmentSubmission, Attendance, AuditLog, BadgeTypeDefinition, Batch, BatchEnrollmentExclusion, Certificate, CoinGrant, ContentProtection, Counter, Coupon, CouponRedemption, Course, Enrollment, EnrollmentRequest, FranchiseCenter, FranchiseKeyPool, FranchiseTransaction, GeneralAttendance, GlobalAssignment, GlobalAssignmentSubmission, GlobalModule, Invoice, InvoiceSettings, KnowledgeArticle, LeaveBalance, LeavePolicy, LeaveRequest, LicenseKey, MilestoneProgress, ModuleProgress, Notification, OAuthNonce, PaymentPromise, PaymentQrGeneration, PaymentSubmission, PaymentUpiChangeRequest, PaymentUpiConfig, Quiz, QuizAttempt, RazorpayOrderContext, Referral, RegistrationRequest, ShopOrder, ShopProduct, Ticket, TicketMessage, User

---

## Page Sitemap

### Admin Console (`admin.funt.in`)

| Path | Description |
|------|-------------|
| `/dashboard` | Overview dashboard |
| `/admin-management` | Team management, registration requests, user creation |
| `/analytics` | Platform analytics |
| `/assignments` | Assignment review |
| `/attendance` | Course attendance management |
| `/audit` | Audit log viewer |
| `/audit-hub` | Centralized audit dashboard |
| `/badges` | Badge definitions and awards |
| `/batches` | Batch CRUD, student access, schedules, enrollment |
| `/batches/[id]/view` | Batch detail view |
| `/batches/[id]/student-access` | Manage enrolled students |
| `/batches/[id]/enrollment-requests` | Batch enrollment requests |
| `/batches/[id]/submissions` | Assignment submissions for batch |
| `/batches/[id]/moderators` | Batch moderators |
| `/batches/[id]/certificates` | Batch certificate management |
| `/batches/[id]/settings` | Batch settings hub |
| `/certificates` | Certificate management |
| `/config` | System configuration |
| `/coupon-audit` | Coupon usage audit trail |
| `/coupons` | Coupon management |
| `/courses` | Course CRUD |
| `/courses/[id]` | Course editor (modules, videos, assignments) |
| `/courses/[id]/view` | Course detail view |
| `/enrollment-requests` | Global enrollment request queue |
| `/enrollments` | Enrollment management |
| `/finance` | Financial overview |
| `/franchise` | Franchise management hub |
| `/franchise/centers` | Franchise center list |
| `/franchise/trainers` | Franchise trainer management |
| `/franchise/license-keys` | Franchise key pool management |
| `/franchise/key-requests` | Key allocation requests |
| `/franchise/my-students` | Franchise student management |
| `/general-attendance` | Standalone attendance |
| `/global-assignments` | Global assignment CRUD |
| `/global-modules` | Global module/chapter CRUD (+ .doc export) |
| `/global-modules/[id]` | Module editor |
| `/global-modules/[id]/view` | Module view |
| `/import-export` | Data export (ZIP), import, and git backup |
| `/invoices` | Invoice management |
| `/invoices/settings` | Invoice template settings |
| `/knowledge-center` | Knowledge article management |
| `/leaves` | Leave request management |
| `/license-key-audit` | License key audit trail |
| `/license-keys` | License key generation and management |
| `/payment-promises` | Pay-later promise tracking |
| `/payment-qr` | UPI QR code management |
| `/payments` | Payment approval queue |
| `/people-insights` | User search and insights |
| `/profile-search` | Profile lookup |
| `/quizzes` | Quiz builder and management |
| `/shop` | Shop product and order management |
| `/support` | Support ticket dashboard |
| `/support-live` | Live support view |
| `/team-management` | Staff team management |
| `/users` | User directory |

### Student LMS (`learn.funt.in`)

| Path | Description |
|------|-------------|
| `/` | Student dashboard |
| `/courses` | My enrolled courses |
| `/courses/[courseId]` | Course learning view (chapters, progress) |
| `/assignments` | My assignments |
| `/attendance` | My attendance records |
| `/achievements` | Badges and XP |
| `/certificates` | My certificates |
| `/invoices` | My invoices |
| `/payment` | Payment submission |
| `/payment-promises` | My pay-later promises |
| `/request-pay-later` | Request pay-later enrollment |
| `/progress` | Detailed progress view |
| `/quiz` | Take quizzes |
| `/shop` | FUNT Shop (browse + checkout) |
| `/skills` | Skill profile radar |
| `/referral` | Referral program |
| `/enroll-license` | License key enrollment |
| `/franchise-link` | Franchise linking |
| `/support` | Submit support tickets |
| `/account` | Account settings |
| `/profile` | My profile |
| `/faq` | Help & FAQ |
| `/parent/login` | Parent login |
| `/parent/dashboard` | Parent monitoring dashboard |
| `/signup` | Student registration |

### Support Portal (`support.funt.in`)

| Path | Description |
|------|-------------|
| `/login` | Support agent login |
| `/signup` | Request support agent access |
| `/dashboard` | Ticket management dashboard |

---

## Local Development

### Prerequisites
- Node.js 20+
- npm 10+
- MongoDB (Atlas or local)

### Setup

```bash
# Install dependencies
npm install

# Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/lms/.env.example apps/lms/.env.local

# Edit .env files with your MongoDB URI and JWT secret

# Run all services
npm run dev

# Or run individually
npm run dev:backend          # Backend only (port 38472)
npm run dev --workspace=@funt-platform/admin   # Admin (port 3000)
npm run dev --workspace=@funt-platform/lms     # LMS (port 3001)
```

### Seed Data

```bash
# Create initial super admin
npm run seed:super-admin --workspace=@funt-platform/backend

# Create dev login accounts (super admin + admin + student)
DEV_LOGIN_PASSWORD=yourpass DEV_LOGIN_SEED_CONFIRM=1 npm run seed:dev-logins --workspace=@funt-platform/backend

# Seed knowledge center articles
npm run seed:knowledge --workspace=@funt-platform/backend
```

---

## Build & Quality Gates

```bash
npm run lint              # TypeScript type checking
npm run build             # Production build (all apps)
npm run predeploy:check   # lint + build (run before every deploy)
```

---

## Deployment

### Current Setup

| Service | Platform | Domain | Build Command | Start Command |
|---------|----------|--------|---------------|---------------|
| Backend | Railway | `api.funt.in` | `npm ci && npm run build` | `npm run start:backend` |
| Admin | Vercel | `admin.funt.in` | `npm run build` | auto |
| LMS | Vercel | `learn.funt.in` | `npm run build` | auto |
| Support | Vercel | `support.funt.in` | `npm run build` | auto |

### Backend Environment Variables (Railway)

**Required:**
```
NODE_ENV=production
MONGO_URI=<mongodb atlas uri>
JWT_SECRET=<min 32 chars random>
CORS_ORIGINS=https://admin.funt.in,https://learn.funt.in,https://support.funt.in
BACKEND_PUBLIC_URL=https://api.funt.in
FRONTEND_ADMIN_URL=https://admin.funt.in
FRONTEND_LMS_URL=https://learn.funt.in
```

**Optional:**
```
REDIS_URL=<redis connection string>
JWT_EXPIRES_IN_ADMIN=8h
JWT_EXPIRES_IN_LMS=12h
IDLE_TIMEOUT_MINUTES_ADMIN=180
IDLE_TIMEOUT_MINUTES_LMS=45
GOOGLE_CLIENT_ID=<for OAuth>
GOOGLE_CLIENT_SECRET=<for OAuth>
RAZORPAY_KEY_ID=<for payments>
RAZORPAY_KEY_SECRET=<for payments>
PAYMENT_UPI_ID=<UPI VPA>
INVOICE_SIGNING_SECRET=<min 32 chars>
R2_ACCOUNT_ID=<cloudflare account>
R2_ACCESS_KEY_ID=<r2 key>
R2_SECRET_ACCESS_KEY=<r2 secret>
R2_BUCKET=funt
```

**Git Backup:**
```
BACKUP_ENABLED=1
BACKUP_GIT_REPO_URL=https://github.com/manchikanti-varun/funt_backup.git
BACKUP_GIT_TOKEN=<github PAT with repo write>
BACKUP_GIT_BRANCH=main
BACKUP_GIT_USER_NAME=FUNT Backup Bot
BACKUP_GIT_USER_EMAIL=backup@funt.in
BACKUP_CRON_SCHEDULE=0 2 * * 0
```

### Frontend Environment Variables (Vercel)

All frontend apps need:
```
NEXT_PUBLIC_API_URL=https://api.funt.in
```

---

## Health Checks

```
GET /health        → { status: "ok" }
GET /health/ping   → { ok: true }
GET /health/ready  → { status: "ok", db: "connected" }
```

Use `/health/ready` for Railway/platform readiness probes.

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Run all services locally |
| `npm run dev:backend` | Backend only |
| `npm run build` | Production build all apps |
| `npm run lint` | TypeScript checks |
| `npm run predeploy:check` | Pre-release gate (lint + build) |
| `npm run start:backend` | Run built backend |
| `npm run free-ports` | Kill processes on dev ports (Windows) |

---

## Security Notes

- Secrets live in environment variables only — never commit `.env` or `.env.local`
- JWT secret must be 32+ characters in production
- CORS origins are explicit (no wildcards)
- Backend enforces HTTPS and non-localhost URLs in production
- Rate limiting on auth (stricter) and API (general)
- Auth via httpOnly cookies (not localStorage tokens)
- Route protection via Next.js `proxy.ts` convention
- Mobile numbers validated: 10 digits or +countrycode (11-14 digits)
- R2 media accessed via short-lived presigned URLs (never permanent links)
- Automated weekly git backup to private repository
