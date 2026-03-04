# Deploy FUNT Platform on Railway

This monorepo has **3 runnable apps**. On Railway you deploy each as a **separate service** from the same repo.

## 1. Create a Railway project and connect the repo

- New Project → **Deploy from GitHub** → select `funt-platform` (or your repo).
- You will create **3 services** in that project (Backend, Admin, LMS).

---

## 2. Service 1: Backend (API)

- **New** → **GitHub Repo** → same repo.
- **Settings**:
  - **Root Directory:** *(leave empty – use repo root)*
  - **Build Command:** `npm ci && npm run build`
  - **Start Command:** `npm run start:backend`
- **Variables:** Add all backend env vars (e.g. `MONGO_URI`, `JWT_SECRET`, `PORT`, `CORS_ORIGINS`, `BACKEND_PUBLIC_URL`, `FRONTEND_ADMIN_URL`, `FRONTEND_LMS_URL`, Google OAuth if used).
- **Deploy.** Copy the backend URL (e.g. `https://your-backend.up.railway.app`) for `BACKEND_PUBLIC_URL` and CORS.

---

## 3. Service 2: Admin (Next.js)

- In the same project: **New** → **GitHub Repo** → same repo (second service).
- **Settings**:
  - **Root Directory:** *(empty)*
  - **Build Command:** `npm ci && npm run build`
  - **Start Command:** `npm run start:admin`
- **Variables:**  
  - `PORT` (Railway sets this; Next.js reads it).  
  - `NEXT_PUBLIC_API_URL` = your backend URL (e.g. `https://your-backend.up.railway.app`).
- **Deploy.** Copy the admin URL for `FRONTEND_ADMIN_URL` in backend vars.

---

## 4. Service 3: LMS (Next.js)

- In the same project: **New** → **GitHub Repo** → same repo (third service).
- **Settings**:
  - **Root Directory:** *(empty)*
  - **Build Command:** `npm ci && npm run build`
  - **Start Command:** `npm run start:lms`
- **Variables:**  
  - `PORT` (Railway sets this).  
  - `NEXT_PUBLIC_API_URL` = your backend URL.
- **Deploy.** Copy the LMS URL for `FRONTEND_LMS_URL` in backend vars.

---

## 5. Wire URLs and CORS

- In **Backend** service variables set:
  - `BACKEND_PUBLIC_URL` = backend’s Railway URL
  - `FRONTEND_ADMIN_URL` = admin’s Railway URL
  - `FRONTEND_LMS_URL` = LMS’s Railway URL
  - `CORS_ORIGINS` = `https://admin-url,https://lms-url` (comma-separated, no spaces)
- Redeploy backend after changing these.

---

## Summary

| Service  | Build command           | Start command        |
|----------|-------------------------|------------------------|
| Backend  | `npm ci && npm run build` | `npm run start:backend` |
| Admin    | `npm ci && npm run build` | `npm run start:admin`   |
| LMS      | `npm ci && npm run build` | `npm run start:lms`     |

All three use the **repo root** (no root directory). One build produces backend + admin + LMS; each service only runs its own start command.
