# FUNT Platform Monorepo

FUNT Platform is a production-focused learning and operations platform for robotics education programs.  
It combines:

- a **staff/admin control center**
- a **student LMS**
- a **backend API and business engine**

The system supports learning delivery, performance tracking, rewards/gamification, payment workflows, and operational auditability in one integrated stack.

---

## 1) What this project is

FUNT Platform is built for institutes/training teams that need to manage:

- course content and reusable learning assets
- student batches and enrollment
- assignment submissions and review
- attendance and progress
- certificates, XP, coins, and achievements
- shop purchases and order fulfillment
- couponing and payment operations

It is designed around real operations where multiple staff roles collaborate and every important action can be traced through audit logs.

---

## 2) User roles and experiences

### Super Admin
- Full platform configuration and governance.
- Approves admin access requests.
- Oversees system-wide operations and audit surfaces.

### Admin
- Manages courses, modules, batches, students, coupons, shop products/orders, and payment flows.
- Creates and manages global badge definitions and award controls.

### Trainer
- Works on assigned/allowed academic operations (content, batches, delivery and tracking workflows).
- Has visibility constraints based on role and assignment rules.

### Student
- Learns through LMS course/module flows.
- Submits assignments and tracks progress.
- Earns XP/coins/badges based on configured rules.
- Uses shop/cart/checkout and order tracking.

### Parent delegate flow (LMS)
- Supports parent-linked student visibility/access flow where enabled.

---

## 3) Product capabilities (feature map)

### A. Learning content system
- Global modules and global assignments as reusable source assets.
- Course creation with ordered module snapshots.
- Batch creation with course snapshots and per-course controls.
- Versioning and restore patterns on content entities.

### B. Academic operations
- Enrollment and student access controls.
- Assignment lifecycle and submission review workflow.
- Attendance + general attendance tracking.
- Student profile insights and progress override tools where allowed.

### C. Rewards and gamification
- **Coins** with grant history and expiry policy.
- **XP** defined at module level and awarded on completion.
- **Badges/Achievements**:
  - global badge definitions
  - award mode support (`AUTO`, `MANUAL`, `BOTH`)
  - auto-trigger support for key milestones
  - manual award workflow for admins

### D. Certificates
- Certificate generation and verification surfaces.
- Coin reward integration from course/batch completion context.
- Certificate-related audit events.

### E. Commerce (shop)
- Product catalog and stock.
- Cart-based checkout with coupon + coin redemption.
- Manual payment submission path with address details.
- Order status workflow (`CONFIRMED` -> shipping states -> `DELIVERED`, with issue/cancel options).
- Stock reservation logic and timed release for pending payment scenarios.

### F. Coupons
- Simplified model:
  - `SHOP` coupons (cart-level)
  - `COURSE` coupons (course checkout level)
- Percent discounts, validity window, and one-time-per-user behavior.
- Admin coupon management UI with cleaner controls.

### G. Security and governance
- Role-based authorization and protected routes.
- Audit logging for critical domain actions.
- Helmet/rate-limit middleware in API.
- Strict production env validation.

---

## 4) Technical architecture

### Monorepo apps
- `apps/backend` - Express API + domain services + MongoDB models
- `apps/admin` - Next.js admin/staff dashboard
- `apps/lms` - Next.js student/parent LMS

### Shared packages
- `packages/constants` - shared enums/constants (roles/statuses/types)
- `packages/types` - shared type contracts
- `packages/rich-text-editor` - shared editor package/styles

### Patterns used
- Layered backend: routes -> controllers -> services -> models
- Snapshot strategy for mutable learning entities in batches/courses
- Audit-first operational actions
- Env-driven deployment behavior

---

## 5) Repository structure

- `apps/backend/src/config` - env + db config
- `apps/backend/src/controllers` - request handlers
- `apps/backend/src/services` - domain/business logic
- `apps/backend/src/models` - mongoose schemas
- `apps/backend/src/routes` - API route registration
- `apps/backend/src/middleware` - auth, security, rate-limits, guards
- `apps/backend/src/scripts` - operational/dev scripts
- `apps/admin/src/app` - admin routes/pages
- `apps/lms/src/app` - lms routes/pages
- `docs/DEPLOYMENT.md` - production deploy checklist and runbook

---

## 6) Environment and configuration

### Backend (`apps/backend/.env`)

Start from:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Required minimum:
- `MONGO_URI`
- `JWT_SECRET`

Production-critical:
- `NODE_ENV=production`
- `CORS_ORIGINS`
- `BACKEND_PUBLIC_URL`
- `FRONTEND_ADMIN_URL`
- `FRONTEND_LMS_URL`

In production, backend validates:
- required values present
- URL format correctness
- HTTPS/non-localhost safety rules (unless explicitly overridden for temporary local test)

### Admin (`apps/admin/.env.local`)

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

Set:
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

### LMS (`apps/lms/.env.local`)

```bash
cp apps/lms/.env.example apps/lms/.env.local
```

Set:
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

---

## 7) Local development

Install once at repo root:

```bash
npm install
```

Run all services:

```bash
npm run dev
```

Run individually:

- backend: `npm run dev:backend`
- admin: `npm run dev --workspace=@funt-platform/admin`
- lms: `npm run dev --workspace=@funt-platform/lms`

---

## 8) Quality gates and release checks

- Type/lint gate: `npm run lint`
- Build gate: `npm run build`
- Pre-deploy gate: `npm run predeploy:check`

`predeploy:check` runs lint + build and should pass before every release.

---

## 9) Health, readiness, and operability

Backend endpoints:

- `GET /health` - service heartbeat
- `GET /health/ping` - lightweight ping
- `GET /health/ready` - readiness with DB connection state

Use `/health/ready` for deployment platform readiness probes.

---

## 10) Deployment model

Typical setup:

- Backend -> Railway (or any Node host)
- Admin -> Vercel
- LMS -> Vercel

For complete deployment order, variable matrix, rollback and smoke checks, use:

- `docs/DEPLOYMENT.md`

---

## 11) Security and production notes

- Keep secrets in environment variables only.
- Never commit `.env.local` or real credentials.
- Use strong JWT secrets (>= 32 chars).
- Keep `CORS_ORIGINS` minimal and explicit in production.
- Route protection in admin/lms uses Next.js `proxy.ts` convention.

---

## 12) Scripts you will use most

- `npm run dev` - full local stack
- `npm run dev:backend` - backend only
- `npm run lint` - type/lint checks
- `npm run build` - production build validation
- `npm run predeploy:check` - final release gate
- `npm run start:backend` - run built backend in production mode

---

## 13) Project status

The repository is actively evolving with major enhancements around:
- admin operations UX
- rewards and badge automation
- secure checkout/order workflows
- deployment hardening and production readiness checks

If you are onboarding a new team member, start with:
1. this `README.md`
2. `docs/DEPLOYMENT.md`
3. app-specific `.env.example` files

