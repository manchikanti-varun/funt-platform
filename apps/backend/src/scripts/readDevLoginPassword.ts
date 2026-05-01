/**
 * Password for local dev seed accounts — set only in apps/backend/.env (never commit real values).
 */
export function readDevLoginPassword(): string {
  const p = process.env.DEV_LOGIN_PASSWORD?.trim();
  if (!p) {
    console.error(
      "Set DEV_LOGIN_PASSWORD in apps/backend/.env (same password is used for all local dev accounts created by seed scripts)."
    );
    process.exit(1);
  }
  return p;
}
