
import jwt from "jsonwebtoken";
import type { ROLE } from "@funt-platform/constants";

export interface JwtPayload {
  userId: string;
  funtId: string;
  roles: ROLE[];
  iat?: number;
  exp?: number;
}

export function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  expiresIn: string
): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
