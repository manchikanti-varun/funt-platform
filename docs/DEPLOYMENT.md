# FUNT Production Deployment Checklist

This runbook is the source of truth for deploying:
- Backend API (`apps/backend`) on Railway (or equivalent Node host)
- Admin (`apps/admin`) on Vercel
- LMS (`apps/lms`) on Vercel

## 1) Pre-deploy checks (local/CI)

From repo root:

```bash
npm ci
npm run predeploy:check
```

Expected:
- TypeScript checks pass for backend/admin/lms
- Production builds succeed for all apps

## 2) Backend deployment (Railway)

Service settings:
- Root: repo root
- Build command: `npm ci && npm run build`
- Start command: `npm run start:backend`

Required environment variables:
- `NODE_ENV=production`
- `MONGO_URI=<production mongodb uri>`
- `JWT_SECRET=<min 32 char random secret>`
- `CORS_ORIGINS=https://<admin-domain>,https://<lms-domain>`
- `BACKEND_PUBLIC_URL=https://<backend-domain>`
- `FRONTEND_ADMIN_URL=https://<admin-domain>`
- `FRONTEND_LMS_URL=https://<lms-domain>`

Current production target (this project):
- `BACKEND_PUBLIC_URL=https://api.funt.in`
- `FRONTEND_ADMIN_URL=https://admin.funt.in`
- `FRONTEND_LMS_URL=https://learn.funt.in`
- `CORS_ORIGINS=https://admin.funt.in,https://learn.funt.in`

Optional but recommended:
- `JWT_EXPIRES_IN_ADMIN=8h`
- `JWT_EXPIRES_IN_LMS=12h`
- `IDLE_TIMEOUT_MINUTES_ADMIN=20`
- `IDLE_TIMEOUT_MINUTES_LMS=45`
- Google OAuth keys (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) if OAuth login is enabled
- Payment keys / UPI settings if payment flows are enabled

Important guardrails enforced by backend in production:
- `CORS_ORIGINS` must be set
- `JWT_SECRET` must be >= 32 and not placeholder
- `BACKEND_PUBLIC_URL`, `FRONTEND_ADMIN_URL`, `FRONTEND_LMS_URL` must be absolute URLs
- Those URLs must be HTTPS and not localhost (unless `CORS_ALLOW_LOCALHOST=1` for temporary testing only)

## 3) Admin deployment (Vercel)

Project settings:
- Root Directory: `apps/admin`
- Build Command: `npm run build`
- Start Command: `npm run start` (if self-hosted; Vercel handles automatically)

Environment variables:
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

Current production target:
- `NEXT_PUBLIC_API_URL=https://api.funt.in`

Notes:
- Admin now uses `proxy.ts` (Next proxy convention), not `middleware.ts`.
- In production, `NEXT_PUBLIC_API_URL` is required.

## 4) LMS deployment (Vercel)

Project settings:
- Root Directory: `apps/lms`
- Build Command: `npm run build`
- Start Command: `npm run start` (if self-hosted; Vercel handles automatically)

Environment variables:
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

Current production target:
- `NEXT_PUBLIC_API_URL=https://api.funt.in`

Notes:
- LMS uses `proxy.ts` for auth gating.
- In production, `NEXT_PUBLIC_API_URL` is required.

## 5) Cross-service wiring

After frontends are deployed:
1. Put final frontend domains into backend:
   - `FRONTEND_ADMIN_URL`
   - `FRONTEND_LMS_URL`
   - `CORS_ORIGINS` (comma-separated exact origins)
2. Redeploy backend.

If OAuth is enabled:
- In Google Console, callback must match:
  - `https://<backend-domain>/api/auth/google/callback`

## 6) Post-deploy smoke test

Backend:
- `GET /health` returns `status: ok`
- `GET /health/ping` returns `{ ok: true }`

Admin smoke:
- Open `/login`
- Successful login and redirect to `/dashboard`
- Create/edit one low-risk entity (e.g., coupon) and verify API success

LMS smoke:
- Open `/login`
- Login and open `/dashboard`
- Open course list and shop page

Critical flows smoke:
- Course coupon create and apply
- Shop checkout quote and submit
- Admin shop order status update

## 7) Rollback plan

- Keep previous Railway deployment revision available
- Keep previous Vercel deployment for both admin and LMS
- On incident:
  1. Roll back backend first
  2. Roll back frontends if contract mismatch persists
  3. Re-run smoke tests

## 8) Release notes template

Before shipping, capture:
- Commit SHA(s)
- DB-impacting changes (models/indexes)
- New env vars
- Breaking API changes
- Manual migration actions
