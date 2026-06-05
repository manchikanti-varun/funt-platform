# FUNT Platform

A production LMS and operations platform for robotics education built as a Turborepo monorepo.

**Live domains:**
- Backend API: `https://api.funt.in`
- Admin Console: `https://admin.funt.in`
- Student LMS: `https://learn.funt.in`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 4, Mongoose 8, Redis (ioredis), JWT, Zod, PDFKit |
| Admin | Next.js 16, React 18, TailwindCSS 3, Recharts |
| LMS | Next.js 16, React 18, TailwindCSS 3, Recharts |
| Editor | TipTap / ProseMirror (shared package) |
| Tooling | Turborepo, TypeScript 5, Node 20+ |
| Database | MongoDB Atlas |
| Payments | Razorpay + manual UPI/QR |

---

## Monorepo Structure

```
funt-platform/
├── apps/
│   ├── backend/          Express API + business logic + MongoDB models
│   ├── admin/            Next.js admin/staff dashboard (port 3000)
│   └── lms/             Next.js student/parent portal (port 3001)
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
| Super Admin | Full platform governance, admin approvals, system config |
| Admin | Courses, batches, students, assignments, shop, payments, coupons, badges |
| Trainer | Assigned academic operations with role-based visibility |
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

### Academic Operations
- Enrollment lifecycle (pending → active → completed/suspended/dropped)
- Enrollment requests and license key enrollment
- Assignment submissions (file, text, link) with review workflow
- Attendance tracking (course-specific + general/standalone)
- Progress tracking and manual progress overrides
- Skill profiles and skill tag system

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
- UPI config management with change request auditing

### Invoices & Certificates
- PDF invoice generation with digital signing
- Certificate generation with QR verification
- Public verification endpoint (`/verify`)

### Security & Governance
- Role-based authorization on all routes
- Full audit logging for critical actions
- Helmet + rate limiting (Redis-backed for multi-instance)
- Strict production env validation (HTTPS, no localhost, min secret length)
- httpOnly cookie-based auth with configurable idle timeout

---

## Backend API Routes

```
/health, /health/ping, /health/ready
/api/auth            Authentication (login, register, Google OAuth, token refresh)
/api/public          Public endpoints (course catalog, etc.)
/api/users           User management
/api/admin           Admin-specific operations
/api/student         Student-specific operations
/api/parent          Parent delegate operations
/api/courses         Course CRUD and management
/api/batches         Batch CRUD and management
/api/assignments     Assignment submissions and review
/api/attendance      Course attendance
/api/general-attendance  Standalone attendance
/api/certificates    Certificate generation and management
/api/global-modules  Global module management
/api/global-chapters Chapter management within modules
/api/global-assignments  Global assignment management
/api/enrollments     Enrollment lifecycle
/api/progress        Student progress tracking
/api/skills          Skill profile management
/api/achievements    Badges and achievement system
/api/audit           Audit log queries
/api/profile         User profile operations
/api/shop            Shop, cart, orders, products
/verify              Public certificate/invoice verification
```

---

## Data Models (34)

Achievement, AssignmentSubmission, Attendance, AuditLog, BadgeTypeDefinition, Batch, BatchEnrollmentExclusion, Certificate, CoinGrant, Counter, Coupon, CouponRedemption, Course, Enrollment, EnrollmentRequest, GeneralAttendance, GlobalAssignment, GlobalAssignmentSubmission, GlobalModule, Invoice, InvoiceSettings, LicenseKey, ModuleProgress, OAuthNonce, PaymentQrGeneration, PaymentSubmission, PaymentUpiChangeRequest, PaymentUpiConfig, RazorpayOrderContext, RegistrationRequest, ShopOrder, ShopProduct, User

---

## Admin Dashboard Pages

Analytics, Assignments, Attendance, Audit Hub, Badges, Batches, Certificates, Config, Coupons (+ audit), Courses, Dashboard, Enrollment Requests, Enrollments, Finance, General Attendance, Global Assignments, Global Modules, Invoices, License Keys (+ audit), Payment QR, Payments, People Insights, Profile Search, Shop, Team Management, Users, Admin Management

---

## LMS Student Pages

Dashboard, Courses (+ learn view), Assignments, Attendance, Achievements, Certificates, Invoices, Payment, Progress, Shop, Skills, Profile, FAQ, Enroll License, Verify Invoice

Parent section: Login, Dashboard, Profiles

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

### Backend Environment Variables (Railway)

**Required:**
```
NODE_ENV=production
MONGO_URI=<mongodb atlas uri>
JWT_SECRET=<min 32 chars random>
CORS_ORIGINS=https://admin.funt.in,https://learn.funt.in
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
```

### Frontend Environment Variables (Vercel)

Both admin and LMS need:
```
NEXT_PUBLIC_API_URL=https://api.funt.in
```

### Railway Migration (New Account)

1. Create new Railway project → deploy backend (connect GitHub repo)
2. Copy all environment variables from old project
3. Add custom domain: Settings → Networking → `api.funt.in`
4. Update DNS CNAME to point to new Railway target
5. Verify: `https://api.funt.in/health/ready`

See `docs/DEPLOYMENT.md` for full deployment runbook.

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

- Secrets live in environment variables only — never commit `.env.local`
- JWT secret must be 32+ characters in production
- CORS origins are explicit (no wildcards)
- Backend enforces HTTPS and non-localhost URLs in production
- Rate limiting on auth (stricter) and API (general)
- Auth via httpOnly cookies (not localStorage tokens)
- Route protection via Next.js `proxy.ts` convention
