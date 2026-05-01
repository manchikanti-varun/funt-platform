
import jwt from "jsonwebtoken";
import type { ROLE } from "@funt-platform/constants";

export interface JwtPayload {
  userId: string;
  username: string;
  roles: ROLE[];
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  expiresIn: string
): string {
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret, { algorithms: ["HS256"] }) as JwtPayload;
}
