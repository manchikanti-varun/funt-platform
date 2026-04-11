const STUDENT_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/i;
const ADMIN_SUFFIX = "@funt";

export function normalizeStudentUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateStudentUsername(raw: string): string | null {
  const v = normalizeStudentUsername(raw);
  if (v.length < 4 || v.length > 32) return "Username must be 4–32 characters";
  if (!STUDENT_USERNAME.test(v)) return "Use letters, numbers, . _ - only (e.g. srikar.ch)";
  if (v.endsWith(ADMIN_SUFFIX)) return "This username is reserved";
  return null;
}

export function validateAdminUsername(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v.endsWith(ADMIN_SUFFIX)) return `Admin username must end with ${ADMIN_SUFFIX}`;
  const local = v.slice(0, -ADMIN_SUFFIX.length);
  if (local.length < 1 || local.length > 48) return "Invalid admin username length";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(local)) return "Invalid characters in admin username";
  return null;
}

export function buildAdminUsernameBase(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 20)
    .toLowerCase();
  const base = slug || "admin";
  return `${base}${ADMIN_SUFFIX}`;
}
