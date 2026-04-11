
import type { Request, Response } from "express";
import {
  login as loginService,
  parentLogin as parentLoginService,
  createStudent,
  changePassword as changePasswordService,
  lookupStudentUsernameByEmail,
} from "../services/auth.service.js";
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
import { signToken, verifyToken } from "../utils/jwt.js";
import { setAuthCookie, clearAuthCookie } from "../utils/authCookie.js";
import { jwtExpiresInToMs } from "../utils/jwtExpires.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const forgotStudentUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) throw new AppError("Email is required", 400);
  const data = await lookupStudentUsernameByEmail(email);
  res.status(200).json({ success: true, data });
});

export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as { user?: { userId?: string } }).user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  await changePasswordService(userId, currentPassword ?? "", newPassword ?? "");
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const user = await UserModel.findById(userId).select("username roles").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const token = signToken(
    {
      userId,
      username: (user as { username?: string }).username?.trim() ?? "",
      roles: (user as { roles: ROLE[] }).roles,
    },
    jwtSecret,
    jwtExpiresIn
  );
  setAuthCookie(res, token, jwtExpiresInToMs(jwtExpiresIn));
  res.status(200).json({ message: "Password updated", data: { sessionRotated: true } });
});

/** One-time: exchange a Bearer JWT (e.g. from OAuth redirect URL) for an httpOnly session cookie. */
export const establishSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const raw = (req.body as { token?: string })?.token?.trim();
  if (!raw) throw new AppError("token is required", 400);
  const { jwtSecret, jwtExpiresIn } = getEnv();
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(raw, jwtSecret);
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
  const user = await UserModel.findById(payload.userId).exec();
  if (!user) throw new AppError("User not found", 401);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Account is suspended or archived", 403);
  }
  const maxAge = jwtExpiresInToMs(jwtExpiresIn);
  setAuthCookie(res, raw, maxAge);
  res.status(200).json({
    data: {
      user: {
        id: String(user._id),
        username: user.username?.trim() ?? "",
        name: user.name,
        roles: user.roles,
        status: user.status,
      },
    },
  });
});

export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.status(200).json({ success: true });
}

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password: string };
  const ident = (username ?? "").trim();
  if (!password || !ident) {
    throw new AppError("Username and password are required", 400);
  }
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const result = await loginService(
    { username: ident, password },
    jwtSecret,
    jwtExpiresIn,
    { userAgent, ip }
  );
  const maxAge = jwtExpiresInToMs(jwtExpiresIn);
  setAuthCookie(res, result.token, maxAge);
  res.status(200).json({ data: { user: result.user } });
});

export const parentLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentUsername, mobile } = req.body as { studentUsername: string; mobile: string };
  if (!studentUsername || !mobile) {
    throw new AppError("Student username and mobile are required", 400);
  }
  const { jwtSecret, jwtExpiresIn } = getEnv();
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const result = await parentLoginService(
    { studentUsername, mobile },
    jwtSecret,
    jwtExpiresIn,
    { userAgent, ip }
  );
  const maxAge = jwtExpiresInToMs(jwtExpiresIn);
  setAuthCookie(res, result.token, maxAge);
  res.status(200).json({ data: { user: result.user } });
});

export const googleRedirectUri = (req: Request, res: Response): void => {
  const { backendPublicUrl } = getEnv();
  const baseUrl = backendPublicUrl.trim() || req.protocol + "://" + req.get("host");
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  res.status(200).json({
    redirectUri,
    hint: "Add this EXACT value in Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs. If it differs (e.g. 127.0.0.1 vs localhost), set BACKEND_PUBLIC_URL in .env to the base URL you want (e.g. http://localhost:38472) and restart the backend.",
  });
};

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
  const callbackUrl = `${frontBase}/auth/callback?token=${encodeURIComponent(result.token)}`;
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
    username?: string;
    name?: string;
    email?: string;
    mobile?: string;
    age?: number;
    address?: string;
    class?: string;
    gradeOther?: string;
    schoolName?: string;
    city?: string;
    password?: string;
  };
  const {
    signupToken,
    username,
    name,
    email,
    mobile,
    age,
    address,
    class: grade,
    gradeOther,
    schoolName,
    city,
    password,
  } = body;

  if (!signupToken?.trim()) throw new AppError("signupToken is required", 400);
  let payload: { email: string; name?: string };
  try {
    payload = verifyGoogleSignupToken(signupToken.trim(), jwtSecret);
  } catch {
    throw new AppError("Invalid or expired signup link. Please sign in with Google again.", 400);
  }
  if (!username?.trim()) throw new AppError("Username is required", 400);
  if (!name?.trim()) throw new AppError("Full name is required", 400);
  if (!email?.trim()) throw new AppError("Email is required", 400);
  if (email.trim().toLowerCase() !== payload.email.toLowerCase()) {
    throw new AppError("Email must match the Google account you signed in with", 400);
  }
  if (!mobile?.trim()) throw new AppError("Parent phone number is required", 400);
  if (age == null || Number.isNaN(Number(age)) || Number(age) < 7) {
    throw new AppError("Age is required (minimum 7 years)", 400);
  }
  if (!address?.trim()) throw new AppError("Address is required", 400);
  if (!schoolName?.trim()) throw new AppError("School / college name is required", 400);
  if (!password) throw new AppError("Password is required", 400);
  validateSignupPassword(password);

  const validGrades = ["6", "7", "8", "9", "10", "11", "12", "other"];
  const gradeVal = grade?.trim();
  if (gradeVal && !validGrades.includes(gradeVal)) {
    throw new AppError("Invalid class selection", 400);
  }
  if (gradeVal === "other" && !gradeOther?.trim()) {
    throw new AppError("Please enter your grade or program details", 400);
  }

  const existing = await UserModel.findOne({ email: email.trim().toLowerCase() }).exec();
  if (existing) {
    throw new AppError("An account with this email already exists. Please sign in.", 400);
  }

  let id: string;
  let createdUsername: string;
  try {
    const result = await createStudent({
      username: username.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      password,
      age: Number(age),
      address: address.trim(),
      grade: gradeVal && gradeVal !== "other" ? gradeVal : gradeVal === "other" ? "other" : undefined,
      gradeOther: gradeVal === "other" ? gradeOther!.trim() : undefined,
      schoolName: schoolName.trim(),
      city: city?.trim() || undefined,
    });
    id = result.id;
    createdUsername = result.username;
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) {
      throw new AppError("An account with this email already exists. Please sign in.", 400);
    }
    throw err;
  }

  const token = signToken(
    { userId: id, username: createdUsername, roles: [ROLE.STUDENT] },
    jwtSecret,
    jwtExpiresIn
  );
  const user = {
    id,
    username: createdUsername,
    name: name.trim(),
    roles: [ROLE.STUDENT],
    status: ACCOUNT_STATUS.ACTIVE,
  };
  const maxAge = jwtExpiresInToMs(jwtExpiresIn);
  setAuthCookie(res, token, maxAge);
  res.status(201).json({ data: { user } });
});

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
