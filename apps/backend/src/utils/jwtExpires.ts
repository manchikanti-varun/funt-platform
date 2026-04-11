/** Parse JWT_EXPIRES_IN values like "7d", "24h", "15m" into milliseconds. */
export function jwtExpiresInToMs(expiresIn: string): number {
  const s = expiresIn.trim();
  const m = /^(\d+)([dhms])$/i.exec(s);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "d") return n * 24 * 60 * 60 * 1000;
  if (u === "h") return n * 60 * 60 * 1000;
  if (u === "m") return n * 60 * 1000;
  return n * 1000;
}
