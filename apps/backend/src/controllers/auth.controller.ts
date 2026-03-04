/**
 * Auth controller: login, parent login, Google OAuth.
 */

import type { Request, Response } from "express";
import { login as loginService, parentLogin as parentLoginService, createStudent, changePassword as changePasswordService } from "../services/auth.service.js";
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleProfile,
  loginWithGoogleEmail,
  createGoogleSignupToken,
  verifyGoogleSignupToken,
  type GoogleState,
} from "../services/auth.google.service.js";
import { UserModel } from "../models/User.model.js";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { getEnv } from "../config/env.js";
import { signToken } from "../utils/jwt.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as { user?: { userId?: string } }).user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  await changePasswordService(userId, currentPassword ?? "", newPassword ?? "");
  res.status(200).json({ message: "Password updated" });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { funtId, password } = req.body as { funtId?: string; password: string };
  if (!password || !funtId?.trim()) {
    throw new AppError("FUNT ID and password are required", 400);
  }
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const result = await loginService(
    { funtId: funtId.trim(), password },
    jwtSecret,
    jwtExpiresIn,
    { userAgent, ip }
  );
  res.status(200).json(result);
});

export const parentLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentFuntId, mobile } = req.body as { studentFuntId: string; mobile: string };
  if (!studentFuntId || !mobile) {
    throw new AppError("Student FUNT ID and mobile are required", 400);
  }
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const result = await parentLoginService(
    { studentFuntId, mobile },
    jwtSecret,
    jwtExpiresIn,
    { userAgent, ip }
  );
  res.status(200).json(result);
});

/** Returns the exact redirect_uri this app sends to Google. Use this to add the same URI in Google Console. */
export const googleRedirectUri = (req: Request, res: Response): void => {
  const { backendPublicUrl } = getEnv();
  const baseUrl = backendPublicUrl.trim() || req.protocol + "://" + req.get("host");
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  res.status(200).json({
    redirectUri,
    hint: "Add this EXACT value in Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs. If it differs (e.g. 127.0.0.1 vs localhost), set BACKEND_PUBLIC_URL in .env to the base URL you want (e.g. http://localhost:38472) and restart the backend.",
  });
};

/** Redirect to Google consent. Query: app=admin|lms, redirect=optional path. */
export const googleRedirect = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { googleClientId, backendPublicUrl } = getEnv();
  if (!googleClientId) {
    res.status(501).json({ success: false, message: "Google login is not configured" });
    return;
  }
  const app = (req.query.app as string) === "lms" ? "lms" : "admin";
  const redirect = (req.query.redirect as string) || undefined;
  const stateObj: GoogleState = { app, redirect };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
  const baseUrl = backendPublicUrl.trim() || req.protocol + "://" + req.get("host");
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const url = getGoogleAuthUrl(redirectUri, state, googleClientId);
  res.redirect(302, url);
});

/** Google OAuth callback: exchange code, find user by email, redirect to frontend with token. */
export const googleCallback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { googleClientId, googleClientSecret, jwtSecret, jwtExpiresIn, frontendAdminUrl, frontendLmsUrl, backendPublicUrl } = getEnv();
  if (!googleClientId || !googleClientSecret) {
    res.redirect(frontendAdminUrl + "/login?error=google_not_configured");
    return;
  }
  const code = req.query.code as string;
  const stateB64 = req.query.state as string;
  if (!code || !stateB64) {
    res.redirect(frontendAdminUrl + "/login?error=missing_code_or_state");
    return;
  }
  let state: GoogleState;
  try {
    state = JSON.parse(Buffer.from(stateB64, "base64url").toString()) as GoogleState;
  } catch {
    res.redirect(frontendAdminUrl + "/login?error=invalid_state");
    return;
  }
  const baseUrl = backendPublicUrl.trim() || req.protocol + "://" + req.get("host");
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const { access_token } = await exchangeCodeForTokens(code, redirectUri, googleClientId, googleClientSecret);
  const profile = await getGoogleProfile(access_token);
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  let result;
  try {
    result = await loginWithGoogleEmail(profile.email, jwtSecret, jwtExpiresIn, { userAgent, ip });
  } catch (err) {
    if (state.app === "lms" && err instanceof AppError && err.message.includes("No account is linked")) {
      const signupToken = createGoogleSignupToken(profile.email, profile.name, jwtSecret);
      const base = frontendLmsUrl.replace(/\/$/, "");
      res.redirect(302, `${base}/signup?token=${encodeURIComponent(signupToken)}`);
      return;
    }
    if (state.app === "admin" && err instanceof AppError && err.message.includes("No account is linked")) {
      const signupToken = createGoogleSignupToken(profile.email, profile.name, jwtSecret);
      const base = frontendAdminUrl.replace(/\/$/, "");
      res.redirect(302, `${base}/admin-signup?token=${encodeURIComponent(signupToken)}`);
      return;
    }
    const msg = err instanceof AppError ? err.message : "Login failed";
    const frontBase = (state.app === "lms" ? frontendLmsUrl : frontendAdminUrl).replace(/\/$/, "");
    res.redirect(302, `${frontBase}/login?error=${encodeURIComponent(msg)}`);
    return;
  }
  const frontBase = (state.app === "lms" ? frontendLmsUrl : frontendAdminUrl).replace(/\/$/, "");
  const callbackPath = state.app === "lms" ? "/auth/callback" : "/login";
  const callbackUrl = `${frontBase}${callbackPath}?token=${encodeURIComponent(result.token)}`;
  res.redirect(302, callbackUrl);
});

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};

function validateSignupPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError("Password must be at least 8 characters", 400);
  }
  if (!PASSWORD_REGEX.upper.test(password)) {
    throw new AppError("Password must contain at least one uppercase letter", 400);
  }
  if (!PASSWORD_REGEX.lower.test(password)) {
    throw new AppError("Password must contain at least one lowercase letter", 400);
  }
  if (!PASSWORD_REGEX.number.test(password)) {
    throw new AppError("Password must contain at least one number", 400);
  }
  if (!PASSWORD_REGEX.special.test(password)) {
    throw new AppError("Password must contain at least one special character", 400);
  }
}

/** Preview signup: verify signup token and return email/name for the form (read-only email). */
export const googleSignupPreview = (req: Request, res: Response): void => {
  const { jwtSecret } = getEnv();
  const token = (req.query.token as string)?.trim();
  if (!token) {
    res.status(400).json({ success: false, message: "token is required" });
    return;
  }
  try {
    const payload = verifyGoogleSignupToken(token, jwtSecret);
    res.status(200).json({ email: payload.email, name: payload.name ?? "" });
  } catch {
    res.status(400).json({ success: false, message: "Invalid or expired signup link. Please sign in with Google again." });
  }
};

/** Complete Google sign-up (student): verify signup token, create student, return JWT. */
export const googleSignupComplete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const body = req.body as {
    signupToken?: string;
    name?: string;
    email?: string;
    mobile?: string;
    class?: string;
    schoolName?: string;
    city?: string;
    password?: string;
  };
  const {
    signupToken,
    name,
    email,
    mobile,
    class: grade,
    schoolName,
    city,
    password,
  } = body;

  if (!signupToken?.trim()) throw new AppError("signupToken is required", 400);
  const payload = verifyGoogleSignupToken(signupToken.trim(), jwtSecret);
  if (!name?.trim()) throw new AppError("Full name is required", 400);
  if (!email?.trim()) throw new AppError("Email is required", 400);
  if (email.trim().toLowerCase() !== payload.email.toLowerCase()) {
    throw new AppError("Email must match the Google account you signed in with", 400);
  }
  if (!mobile?.trim()) throw new AppError("Parent phone number is required", 400);
  if (!schoolName?.trim()) throw new AppError("School name is required", 400);
  if (!password) throw new AppError("Password is required", 400);
  validateSignupPassword(password);

  const validGrades = ["6", "7", "8", "9", "10", "11", "12"];
  const gradeVal = grade?.trim();
  if (gradeVal && !validGrades.includes(gradeVal)) {
    throw new AppError("Class must be between 6 and 12", 400);
  }

  const existing = await UserModel.findOne({ email: email.trim().toLowerCase() }).exec();
  if (existing) {
    throw new AppError("An account with this email already exists. Please sign in.", 400);
  }

  const { id, funtId } = await createStudent({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    mobile: mobile.trim(),
    password,
    grade: gradeVal || undefined,
    schoolName: schoolName.trim(),
    city: city?.trim() || undefined,
  });

  const token = signToken(
    { userId: id, funtId, roles: [ROLE.STUDENT] },
    jwtSecret,
    jwtExpiresIn
  );
  const user = {
    id,
    funtId,
    name: name.trim(),
    roles: [ROLE.STUDENT],
    status: ACCOUNT_STATUS.ACTIVE,
  };
  res.status(201).json({ token, user });
});

/** Preview admin signup: reuse same signup token payload (email, name). */
export const googleAdminSignupPreview = (req: Request, res: Response): void => {
  const { jwtSecret } = getEnv();
  const token = (req.query.token as string)?.trim();
  if (!token) {
    res.status(400).json({ success: false, message: "token is required" });
    return;
  }
  try {
    const payload = verifyGoogleSignupToken(token, jwtSecret);
    res.status(200).json({ email: payload.email, name: payload.name ?? "" });
  } catch {
    res.status(400).json({ success: false, message: "Invalid or expired signup link. Please sign in with Google again." });
  }
};

/** Complete Google sign-up (admin): verify signup token, submit Admin registration request (no account yet). A Super Admin must approve; then user sets password. */
export const googleAdminSignupComplete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { jwtSecret } = getEnv();
  const body = req.body as {
    signupToken?: string;
    name?: string;
    email?: string;
    mobile?: string;
    city?: string;
  };
  const { signupToken, name, email, mobile, city } = body;

  if (!signupToken?.trim()) throw new AppError("signupToken is required", 400);
  const payload = verifyGoogleSignupToken(signupToken.trim(), jwtSecret);
  if (!name?.trim()) throw new AppError("Full name is required", 400);
  if (!email?.trim()) throw new AppError("Email is required", 400);
  if (email.trim().toLowerCase() !== payload.email.toLowerCase()) {
    throw new AppError("Email must match the Google account you signed in with", 400);
  }
  if (!mobile?.trim()) throw new AppError("Phone number is required", 400);

  const { submitAdminRequest } = await import("../services/registrationRequest.service.js");
  await submitAdminRequest({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    mobile: mobile.trim(),
    city: city?.trim() || undefined,
  });

  res.status(201).json({
    message: "Admin registration request submitted. A Super Admin will review it. You will be notified when your account is approved; then you can set your password and log in.",
  });
});
