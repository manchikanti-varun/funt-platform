/**
 * Google OAuth: authorization URL, token exchange, profile, and login by email.
 */

import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.model.js";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { signToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import type { LoginResult } from "./auth.service.js";

const GOOGLE_SIGNUP_TOKEN_EXPIRY = "15m";

export interface GoogleSignupTokenPayload {
  purpose: "google_signup";
  email: string;
  name?: string;
}

export function createGoogleSignupToken(
  email: string,
  name: string | undefined,
  jwtSecret: string
): string {
  return jwt.sign(
    { purpose: "google_signup", email, name } as GoogleSignupTokenPayload,
    jwtSecret,
    { expiresIn: GOOGLE_SIGNUP_TOKEN_EXPIRY }
  );
}

export function verifyGoogleSignupToken(
  token: string,
  jwtSecret: string
): GoogleSignupTokenPayload {
  const decoded = jwt.verify(token, jwtSecret) as GoogleSignupTokenPayload;
  if (decoded.purpose !== "google_signup" || !decoded.email) {
    throw new AppError("Invalid signup token", 400);
  }
  return decoded;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = ["openid", "email", "profile"].join(" ");

export interface GoogleState {
  app: "admin" | "lms";
  redirect?: string;
}

export function getGoogleAuthUrl(redirectUri: string, state: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "online",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`Google token exchange failed: ${err}`, 401);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new AppError("Google did not return access token", 401);
  return { access_token: data.access_token };
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; name?: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new AppError("Failed to fetch Google profile", 401);
  const data = (await res.json()) as { email?: string; name?: string };
  if (!data.email) throw new AppError("Google profile has no email", 400);
  return { email: data.email, name: data.name };
}

/** Find user by email, validate status, record login, return JWT and user. */
export async function loginWithGoogleEmail(
  email: string,
  jwtSecret: string,
  expiresIn: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<LoginResult> {
  const user = await UserModel.findOne({ email })
    .select("+loginHistory")
    .exec();
  if (!user) {
    throw new AppError("No account is linked to this Google email. Sign up with email first or ask an admin.", 403);
  }
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Account is suspended or archived", 403);
  }
  await UserModel.updateOne(
    { _id: user._id },
    {
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), userAgent: meta?.userAgent, ip: meta?.ip }],
          $slice: -20,
        },
      },
    }
  ).exec();
  const token = signToken(
    { userId: String(user._id), funtId: user.funtId, roles: user.roles as ROLE[] },
    jwtSecret,
    expiresIn
  );
  return {
    token,
    user: {
      id: String(user._id),
      funtId: user.funtId,
      name: user.name,
      roles: user.roles,
      status: user.status,
    },
  };
}
