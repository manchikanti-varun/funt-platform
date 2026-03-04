# Google OAuth – redirect_uri_mismatch and "Access blocked"

## Fix Error 400: redirect_uri_mismatch

The redirect URI your app sends to Google must **exactly** match one of the URIs in Google Console. Follow these steps.

### Step 1: See what URI your backend is sending

1. Start your backend (e.g. `npm run dev` in `apps/backend`).
2. Open this URL in your browser (use the same host/port as your API):
   - If you use **localhost**: `http://localhost:38472/api/auth/google/redirect-uri`
   - If you use **127.0.0.1**: `http://127.0.0.1:38472/api/auth/google/redirect-uri`
3. You’ll get JSON like:
   ```json
   { "redirectUri": "http://localhost:38472/api/auth/google/callback", "hint": "..." }
   ```
4. **Copy the `redirectUri` value** (the full string).

### Step 2: Add that exact URI in Google Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs** click **+ ADD URI**.
4. Paste the **exact** `redirectUri` you copied (no trailing slash, same `http`/`https`, same host and port).
5. Click **Save**.

### Step 3: Force a single URI with BACKEND_PUBLIC_URL (recommended)

So the redirect URI doesn’t change when you use `localhost` vs `127.0.0.1`:

1. In backend **`.env`** add (adjust port if yours is different):
   ```env
   BACKEND_PUBLIC_URL=http://localhost:38472
   ```
   No trailing slash. Use `http://127.0.0.1:38472` only if you always open the API with 127.0.0.1.

2. Restart the backend.

3. Open `http://localhost:38472/api/auth/google/redirect-uri` again and confirm `redirectUri` is `http://localhost:38472/api/auth/google/callback`.

4. In Google Console, ensure **Authorized redirect URIs** contains exactly that value. Save.

### Step 4: Try sign-in again

Use “Sign in with Google” again (incognito/private window if needed).

---

## "Access blocked" or "This app sent an invalid request"

If the app is in **Testing** and your account is not a test user, Google blocks sign-in.

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Scroll to **Test users**.
3. Click **+ ADD USERS** and add the Google account you use to sign in (e.g. infovaluuhub@gmail.com).
4. Save.

Also ensure in **Credentials** → your OAuth client:

- **Authorized JavaScript origins** includes:
  - `http://localhost:3001` (LMS)
  - `http://localhost:38472` (backend)
- **Authorized redirect URIs** contains the exact value from `/api/auth/google/redirect-uri` (see above).

---

## Env checklist

In backend `.env`:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from your OAuth client.
- `BACKEND_PUBLIC_URL=http://localhost:38472` (so redirect URI is stable; no trailing slash).

Restart the backend after any `.env` change.
