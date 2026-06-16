/**
 * Re-exports from @funt-platform/auth-utils for backward compatibility.
 * New code should import directly from "@funt-platform/auth-utils".
 */
export {
  type JwtPayload,
  parseJwtPayload,
  isTokenExpired,
} from "@funt-platform/auth-utils";
