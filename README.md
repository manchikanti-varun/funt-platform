# FUNT Platform Monorepo

## Overview

FUNT Platform is a full-stack Learning Management System (LMS) for robotics training.  
It supports multiple roles (Super Admin, Admin, Trainer, Student) and provides:

- **Course & module management** – create courses, define ordered modules, manage versions and archive old content.
- **Assignment authoring & reuse** – create global assignment templates, link them into modules, track statuses.
- **Student LMS portal** – students see enrolled courses, modules, assignments and can submit work (text/link/file).
- **Progress tracking** – per-student module and assignment progress, completion status, and audit-friendly IDs.
- **Authentication & authorization** – secure login flows, role-based access, and Admin/Super Admin approval flows.
- **FUNT IDs** – human-readable IDs for entities (e.g. FUNT IDs for users, SUB‑YY‑XXXXXXXX for submissions).

The monorepo is built with:

- **Backend API** (`apps/backend`) – Node.js/Express + MongoDB (Mongoose).
- **Admin Dashboard** (`apps/admin`) – Next.js 14 + Tailwind CSS.
- **LMS (Student Portal)** (`apps/lms`) – Next.js 14 + Tailwind CSS.
- **Shared packages** (`packages/constants`, `packages/types`) – common enums/types across apps.

It is designed to run locally for development and be deployed to:

- **Railway** – backend API (and optionally admin/lms as services).
- **Vercel** – admin and lms frontends.

---

## 1. Project layout

- `apps/backend`
  - Auth (email/password, JWT, Google OAuth callback).
  - Users & roles (Super Admin, Admin, Trainer, Student).
  - Courses, modules, global modules, assignments, submissions.
  - Module/assignment progress tracking and audit logging.
  - Security middleware: rate limiting, helmet, CORS from env.
- `apps/admin`
  - Dashboards for Super Admin / Admin / Trainer.
  - Admin account request/approval flow.
  - Course, batch, module, global module, and assignment management.
  - Bulk operations (e.g. bulk feedback in submissions).
- `apps/lms`
  - Student-facing course list and detail pages.
  - Module view and assignment submission UI.
  - Premium Tailwind-based UI with consistent design system.
- `packages/constants` – shared enums and constants (e.g. `ROLE`, `ASSIGNMENT_STATUS`, `MODULE_STATUS`, `SUBMISSION_TYPE`).
- `packages/types` – shared TypeScript types used by backend and frontends.
- `docs/` – deployment and operational docs (e.g. `RAILWAY_DEPLOY.md`).

---

## 2. Environment variables

### Backend (`apps/backend/.env`)

Create `apps/backend/.env` from `apps/backend/.env.example`:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Then edit:

- `PORT` – local backend port (e.g. `38472`).
- `MONGO_URI` – your MongoDB Atlas connection string.
- `JWT_SECRET` – long random secret (min 32 chars).
- `JWT_EXPIRES_IN` – e.g. `7d`.
- `BACKEND_PUBLIC_URL` – backend base URL:
  - Local: `http://localhost:38473` (or whatever you use)
  - Production (Railway): `https://<your-backend>.up.railway.app`
- `SUPER_ADMIN_*` – seed Super Admin credentials (used only by reset/seed scripts).
- `RESET_CONFIRM` – keep `0` in normal use.

> Never commit real secrets. Only `.env.example` is committed with placeholder values.

### Admin (`apps/admin/.env.local`)

Create `apps/admin/.env.local` from `apps/admin/.env.local.example`:

```bash
cp apps/admin/.env.local.example apps/admin/.env.local
```

Set:

- `NEXT_PUBLIC_API_URL`
  - Local: `http://localhost:38472` (or your backend port)
  - Production: `https://<your-backend>.up.railway.app`

### LMS (`apps/lms/.env.local`)

Create `apps/lms/.env.local` from `apps/lms/.env.local.example`:

```bash
cp apps/lms/.env.local.example apps/lms/.env.local
```

Set:

- `NEXT_PUBLIC_API_URL`
  - Local: `http://localhost:38472`
  - Production: `https://<your-backend>.up.railway.app`

---

## 3. Local development

Install dependencies at the repo root:

```bash
cd D:\funt-platform
npm install
```

Then start backend + frontends via the dev helper script:

```bash
npm run dev
```

Or run apps individually:

- Backend: `npm run dev:backend`
- Admin: from `apps/admin` – `npm run dev`
- LMS: from `apps/lms` – `npm run dev`

---

## 4. Production deployment (high level)

### Backend on Railway

- Connect this repo in Railway.
- Build command at root: `npm ci && npm run build`.
- Start command (backend service): `npm run start:backend`.
- Configure env vars in Railway backend service:
  - `MONGO_URI`, `JWT_SECRET`, `BACKEND_PUBLIC_URL`, `FRONTEND_ADMIN_URL`, `FRONTEND_LMS_URL`, `CORS_ORIGINS`, Google OAuth, etc.
- See `docs/RAILWAY_DEPLOY.md` for a detailed guide, including running Admin and LMS as separate services if you want them on Railway too.

### Admin & LMS on Vercel

Create **two** Vercel projects from the same repo:

- **Admin project**
  - Root Directory: `apps/admin`
  - Build Command: `npm run build`
  - Output: `.next`
  - Env: `NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app`

- **LMS project**
  - Root Directory: `apps/lms`
  - Build Command: `npm run build`
  - Output: `.next`
  - Env: `NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app`

Then in Railway backend env:

- `FRONTEND_ADMIN_URL` = Admin Vercel URL
- `FRONTEND_LMS_URL` = LMS Vercel URL
- `CORS_ORIGINS` = `https://<admin-url>,https://<lms-url>`

Redeploy backend after updating these.

---

## 5. Cleaning and unused files

- Temporary reset/seed helpers and dev-only scripts have been removed or moved out of the main flow.
- Certificate layout files under `apps/backend/templates/` are kept because they are used for the certificate feature.

If you add new seed scripts or helpers in the future, keep them in clearly named folders (e.g. `apps/backend/scripts/`) and avoid wiring them into production runtime.

