# Deployment Checklist – FUNT Platform

Backend on **Railway**, Admin and LMS on **Vercel**. Use this checklist when deploying from scratch.

---

## 1. Backend (Railway)

- **New Project** → Deploy from GitHub repo (this monorepo).
- **Service**: one service for the backend.
- **Settings**:
  - **Root Directory**: *(empty)* (repo root).
  - **Build Command**: `npm ci && npm run build`
  - **Start Command**: `npm run start:backend`
  - **Do not set** `PORT` (Railway sets it automatically).

- **Variables** (in Railway dashboard):

| Variable | Example / Note |
|----------|----------------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string (e.g. 64 hex chars) |
| `JWT_EXPIRES_IN` | `7d` |
| `BACKEND_PUBLIC_URL` | `https://<your-backend>.up.railway.app` (no trailing slash) |
| `FRONTEND_ADMIN_URL` | `https://<admin-vercel-url>` (no trailing slash) |
| `FRONTEND_LMS_URL` | `https://<lms-vercel-url>` (no trailing slash) |
| `CORS_ORIGINS` | `https://<admin-url>,https://<lms-url>` (comma-separated, no trailing slash) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

- After deploy, open `https://<your-backend>.up.railway.app/` or `https://<your-backend>.up.railway.app/health` – you should get JSON (e.g. `{"status":"ok",...}`).

---

## 2. Admin (Vercel)

- **New Project** → Import same GitHub repo.
- **Settings**:
  - **Root Directory**: `apps/admin`
  - **Framework**: Next.js (auto-detected).
  - **Build Command**: `npm run build` (default).
  - **Install Command**: `cd ../.. && npm ci` (so workspace packages are installed).
  - **Node.js Version**: 20.x (or set `engines.node` in `apps/admin/package.json` – already set).

- **Environment Variables**:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend>.up.railway.app` (no trailing slash) |

- Deploy. After deploy, set **Production URL** in Railway backend: `FRONTEND_ADMIN_URL` and add it to `CORS_ORIGINS` if not already there, then redeploy backend.

---

## 3. LMS (Vercel)

- **New Project** → Import same GitHub repo.
- **Settings**:
  - **Root Directory**: `apps/lms`
  - **Framework**: Next.js (auto-detected).
  - **Build Command**: `npm run build` (default).
  - **Install Command**: `cd ../.. && npm ci`
  - **Node.js Version**: 20.x (already in `apps/lms/package.json`).

- **Environment Variables**:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend>.up.railway.app` (no trailing slash) |

- Deploy. Set **Production URL** in Railway: `FRONTEND_LMS_URL` and add to `CORS_ORIGINS`, then redeploy backend.

---

## 4. Google OAuth (if using Google sign-in)

In **Google Cloud Console** → APIs & Services → Credentials → your OAuth 2.0 Client:

- **Authorized JavaScript origins**:  
  `https://<admin-vercel-url>`  
  `https://<lms-vercel-url>`

- **Authorized redirect URIs**:  
  `https://<your-backend>.up.railway.app/api/auth/google/callback`

---

## 5. Final check

- [ ] Backend: `https://<backend>/` or `https://<backend>/health` returns 200 + JSON.
- [ ] Admin: Login page loads; Sign in with Google links to `https://<backend>/api/auth/google?app=admin` (not localhost).
- [ ] LMS: Login page loads; Sign in with Google links to `https://<backend>/api/auth/google?app=lms`.
- [ ] Railway backend has no custom `PORT`; `CORS_ORIGINS` and `FRONTEND_*_URL` use the real Vercel URLs (no trailing slash).
