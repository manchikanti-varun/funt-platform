
import type { Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  login as loginService,
  parentLogin as parentLoginService,
  getParentLinkedStudentsByMobile,
  assertParentStudentLinked,
  createStudent,
  createSuperAdmin,
  changePassword as changePasswordService,
  setInitialPassword as setInitialPasswordService,
  lookupStudentUsernameByEmail,
  validateStrongPassword,
} from "../services/auth.service.js";
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleProfile,
  loginWithGoogleEmail,
  createGoogleSignupToken,
  verifyGoogleSignupToken,
  createSetPasswordToken,
  verifySetPasswordToken,
  type GoogleState,
} from "../services/auth.google.service.js";
import { UserModel } from "../models/User.model.js";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { getEnv } from "../config/env.js";
import { signToken, verifyToken } from "../utils/jwt.js";
import { normalizeStudentUsername, validateAdminUsername, validateStudentUsername } from "../utils/username.js";
import {
  setAuthCookie,
  setIdleCookie,
  clearAuthCookie,
  clearLegacyAuthCookie,
  clearAllAuthCookies,
  clearParentDelegateCookie,
  setParentDelegateCookie,
  type AuthPortal,
} from "../utils/authCookie.js";
import { signParentDelegateToken } from "../utils/parentDelegateJwt.js";
import { inferPortalFromRoles, portalFromRequestOrigin, resolveAuthToken } from "../utils/authTokenResolve.js";
import { jwtExpiresInToMs } from "../utils/jwtExpires.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { OAuthNonceModel } from "../models/OAuthNonce.model.js";

const OAUTH_NONCE_COOKIE = "funt_oauth_nonce";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function authExpiryForPortal(portal: AuthPortal): { expiresIn: string; maxAgeMs: number } {
  const { jwtExpiresInAdmin, jwtExpiresInLms } = getEnv();
  const expiresIn = portal === "admin" ? jwtExpiresInAdmin : jwtExpiresInLms;
  return { expiresIn, maxAgeMs: jwtExpiresInToMs(expiresIn) };
}

function resolveOauthBackendBaseUrl(req: Request): string {
  const { backendPublicUrl, isProduction } = getEnv();
  const configured = backendPublicUrl.trim();
  const requestBase = `${req.protocol}://${req.get("host")}`;
  if (!configured) return requestBase;
  if (isProduction) return configured;
  try {
    const cfg = new URL(configured);
    const inc = new URL(requestBase);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    if (localHosts.has(cfg.hostname) && localHosts.has(inc.hostname)) {
      return requestBase;
    }
  } catch {
    return requestBase;
  }
  return configured;
}

export const forgotStudentUsername = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) throw new AppError("Email is required", 400);
  const data = await lookupStudentUsernameByEmail(email);
  res.status(200).json({ success: true, data });
});

export const checkUsernameAvailability = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const usernameRaw = String(req.query.username ?? "").trim();
  if (!usernameRaw) throw new AppError("username is required", 400);
  const roleHint = String(req.query.role ?? "")
    .trim()
    .toLowerCase();
  const isManagementRole =
    roleHint === "trainer" ||
    roleHint === "admin" ||
    roleHint === "super_admin" ||
    roleHint === "super-admin" ||
    roleHint === "management" ||
    roleHint === "staff";
  const validationError = isManagementRole
    ? validateAdminUsername(usernameRaw)
    : validateStudentUsername(usernameRaw);
  if (validationError) {
    res.status(200).json({ success: true, available: false, message: validationError });
    return;
  }
  const username = isManagementRole ? usernameRaw.trim().toLowerCase() : normalizeStudentUsername(usernameRaw);
  const excludeUserIdRaw = String(req.query.excludeUserId ?? "").trim();
  let excludeUserId: string | null = null;
  if (excludeUserIdRaw) {
    const token = resolveAuthToken(req);
    if (token) {
      try {
        const { jwtSecret } = getEnv();
        const payload = verifyToken(token, jwtSecret);
        if (String(payload.userId) === excludeUserIdRaw) {
          excludeUserId = excludeUserIdRaw;
        }
      } catch {
        excludeUserId = null;
      }
    }
  }
  const existing = await UserModel.findOne({
    username,
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  })
    .select("_id")
    .lean()
    .exec();
  const available = !existing;
  res.status(200).json({
    success: true,
    available,
    message: available ? "Username available" : "Username already taken",
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as { user?: { userId?: string } }).user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  await changePasswordService(userId, currentPassword ?? "", newPassword ?? "");
  const { jwtSecret } = getEnv();
  const user = await UserModel.findById(userId).select("username roles").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const userRoles = (user as { roles: ROLE[] }).roles;
  const portal: AuthPortal = portalFromRequestOrigin(req) ?? inferPortalFromRoles(userRoles);
  const { expiresIn, maxAgeMs } = authExpiryForPortal(portal);
  const token = signToken(
    {
      userId,
      username: (user as { username?: string }).username?.trim() ?? "",
      roles: userRoles,
      tokenVersion: Number((user as { tokenVersion?: number }).tokenVersion ?? 0) + 1,
    },
    jwtSecret,
    expiresIn
  );
  setAuthCookie(res, token, maxAgeMs, portal);
  setIdleCookie(res, portal, maxAgeMs);
  clearLegacyAuthCookie(res);
  res.status(200).json({ message: "Password updated", data: { sessionRotated: true } });
});

/**
 * Set an initial password using a fresh Google re-auth.
 *
 * Required auth: caller must be signed in (their session JWT identifies them).
 * Body: { setPasswordToken: string, newPassword: string }
 *
 * The set-password token is issued only by the Google callback when the
 * caller successfully re-authenticates with the same email that's already on
 * the account. We additionally verify here that the token's userId matches
 * the authenticated user and that the account does NOT already have a
 * password set (passwordless Google-only accounts).
 */
export const setPasswordWithGoogle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as { user?: { userId?: string } }).user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { setPasswordToken, newPassword } = req.body as {
    setPasswordToken?: string;
    newPassword?: string;
  };
  if (!setPasswordToken?.trim()) throw new AppError("setPasswordToken is required", 400);
  if (!newPassword?.trim()) throw new AppError("New password is required", 400);

  const { jwtSecret } = getEnv();
  let payload: { userId: string; email: string };
  try {
    payload = verifySetPasswordToken(setPasswordToken.trim(), jwtSecret);
  } catch {
    throw new AppError(
      "Set-password link is invalid or has expired. Please verify with Google again.",
      400
    );
  }
  if (payload.userId !== userId) {
    throw new AppError("Set-password token does not belong to the signed-in user.", 403);
  }

  await setInitialPasswordService(userId, newPassword.trim());

  const user = await UserModel.findById(userId).select("username roles tokenVersion").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const userRoles = (user as { roles: ROLE[] }).roles;
  const portal: AuthPortal = portalFromRequestOrigin(req) ?? inferPortalFromRoles(userRoles);
  const { expiresIn, maxAgeMs } = authExpiryForPortal(portal);
  const token = signToken(
    {
      userId,
      username: (user as { username?: string }).username?.trim() ?? "",
      roles: userRoles,
      tokenVersion: Number((user as { tokenVersion?: number }).tokenVersion ?? 0),
    },
    jwtSecret,
    expiresIn
  );
  setAuthCookie(res, token, maxAgeMs, portal);
  setIdleCookie(res, portal, maxAgeMs);
  clearLegacyAuthCookie(res);
  res.status(200).json({ message: "Password set", data: { sessionRotated: true } });
});

/** One-time: exchange a Bearer JWT (e.g. from OAuth redirect URL) for an httpOnly session cookie. */
export const establishSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { token?: string; portal?: string };
  const raw = body.token?.trim();
  if (!raw) throw new AppError("token is required", 400);
  const { jwtSecret } = getEnv();
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
  const expectedTokenVersion = Number((user as { tokenVersion?: number }).tokenVersion ?? 0);
  const payloadTokenVersion = Number(payload.tokenVersion ?? 0);
  if (payloadTokenVersion !== expectedTokenVersion) {
    clearAllAuthCookies(res);
    throw new AppError("Session expired. You logged in from another device.", 401);
  }
  const passwordChangedAt = (user as { passwordChangedAt?: Date }).passwordChangedAt;
  if (passwordChangedAt && payload.iat && payload.iat * 1000 < passwordChangedAt.getTime()) {
    throw new AppError("Session expired after password change. Please sign in again.", 401);
  }
  const hint = body.portal?.trim().toLowerCase();
  let portal: AuthPortal;
  if (hint === "lms" || hint === "admin") {
    portal = hint;
  } else {
    portal = inferPortalFromRoles(payload.roles);
  }
  const { maxAgeMs } = authExpiryForPortal(portal);
  setAuthCookie(res, raw, maxAgeMs, portal);
  setIdleCookie(res, portal, maxAgeMs);
  clearLegacyAuthCookie(res);
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

export function logout(req: Request, res: Response): void {
  const { jwtSecret } = getEnv();
  const token = resolveAuthToken(req);
  if (token) {
    try {
      const payload = verifyToken(token, jwtSecret);
      void UserModel.updateOne({ _id: payload.userId }, { $inc: { tokenVersion: 1 } }).exec();
    } catch {
      // Ignore token parsing failures on logout.
    }
  }
  const portal = portalFromRequestOrigin(req);
  if (portal) {
    clearAuthCookie(res, portal);
    clearLegacyAuthCookie(res);
  } else {
    clearAllAuthCookies(res);
  }
  clearParentDelegateCookie(res);
  res.status(200).json({ success: true });
}

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, password, portal } = req.body as { username?: string; password: string; portal?: string };
  const ident = (username ?? "").trim();
  if (!password || !ident) {
    throw new AppError("Username and password are required", 400);
  }
  const { jwtSecret } = getEnv();
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const portalLower = portal?.trim().toLowerCase();
  const cookiePortal: AuthPortal = portalLower === "lms" ? "lms" : "admin";
  const { expiresIn, maxAgeMs } = authExpiryForPortal(cookiePortal);
  const result = await loginService(
    { username: ident, password },
    jwtSecret,
    expiresIn,
    { userAgent, ip }
  );
  const roles = result.user.roles ?? [];
  if (portalLower === "lms") {
    const allowed = roles.includes(ROLE.STUDENT) || roles.includes(ROLE.PARENT);
    if (!allowed) {
      throw new AppError("FUNT Learn is for student and parent accounts only. Use the Admin app for staff.", 403);
    }
  } else {
    const staffAllowed =
      roles.includes(ROLE.ADMIN) || roles.includes(ROLE.SUPER_ADMIN) || roles.includes(ROLE.TRAINER);
    if (!staffAllowed) {
      throw new AppError(
        "FUNT Admin is for staff (Admin, Super Admin, or Trainer). Use FUNT Learn for students and parents.",
        403
      );
    }
  }
  setAuthCookie(res, result.token, maxAgeMs, cookiePortal);
  setIdleCookie(res, cookiePortal, maxAgeMs);
  clearLegacyAuthCookie(res);
  res.status(200).json({ data: { user: result.user } });
});

export const signupStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { jwtSecret } = getEnv();
  const { expiresIn, maxAgeMs } = authExpiryForPortal("lms");
  const body = req.body as {
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

  const username = body.username?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const mobile = body.mobile?.trim();
  const address = body.address?.trim();
  const schoolName = body.schoolName?.trim();
  const password = body.password ?? "";
  const ageNum = Number(body.age);

  if (!username) throw new AppError("Username is required", 400);
  if (!name) throw new AppError("Full name is required", 400);
  if (!email) throw new AppError("Email is required", 400);
  if (!mobile) throw new AppError("Parent phone number is required", 400);
  if (!Number.isFinite(ageNum) || ageNum < 7) throw new AppError("Age is required (minimum 7 years)", 400);
  if (!address) throw new AppError("Address is required", 400);
  if (!schoolName) throw new AppError("School / college name is required", 400);
  validateSignupPassword(password);

  const gradeVal = body.class?.trim();
  const gradeOther = body.gradeOther?.trim();
  const validGrades = ["6", "7", "8", "9", "10", "11", "12", "other"];
  if (gradeVal && !validGrades.includes(gradeVal)) throw new AppError("Invalid class selection", 400);
  if (gradeVal === "other" && !gradeOther) throw new AppError("Please enter your grade or program details", 400);

  try {
    const result = await createStudent({
      username,
      name,
      email,
      mobile,
      password,
      age: ageNum,
      address,
      grade: gradeVal && gradeVal !== "other" ? gradeVal : gradeVal === "other" ? "other" : undefined,
      gradeOther: gradeVal === "other" ? gradeOther : undefined,
      schoolName,
      city: body.city?.trim() || undefined,
    });
    const token = signToken(
      { userId: result.id, username: result.username, roles: [ROLE.STUDENT], tokenVersion: 0 },
      jwtSecret,
      expiresIn
    );
    setAuthCookie(res, token, maxAgeMs, "lms");
    setIdleCookie(res, "lms", maxAgeMs);
    clearLegacyAuthCookie(res);
    res.status(201).json({
      data: {
        user: {
          id: result.id,
          username: result.username,
          name,
          roles: [ROLE.STUDENT],
          status: ACCOUNT_STATUS.ACTIVE,
        },
      },
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr?.code === 11000) {
      if ((mongoErr.message ?? "").toLowerCase().includes("username")) {
        throw new AppError("Username already taken", 400);
      }
      if ((mongoErr.message ?? "").toLowerCase().includes("email")) {
        throw new AppError("An account with this email already exists. Please sign in.", 400);
      }
      throw new AppError("Account already exists with provided details", 400);
    }
    throw err;
  }
});

export const parentLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentUsername, mobile } = req.body as { studentUsername: string; mobile: string };
  if (!studentUsername || !mobile) {
    throw new AppError("Student username and mobile are required", 400);
  }
  const { jwtSecret } = getEnv();
  const { expiresIn, maxAgeMs } = authExpiryForPortal("lms");
  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  const result = await parentLoginService(
    { studentUsername, mobile },
    jwtSecret,
    expiresIn,
    { userAgent, ip }
  );
  setAuthCookie(res, result.token, maxAgeMs, "lms");
  setIdleCookie(res, "lms", maxAgeMs);
  clearLegacyAuthCookie(res);
  res.status(200).json({ data: { user: result.user } });
});

export const parentLinkedStudents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { mobile } = req.body as { mobile?: string };
  const data = await getParentLinkedStudentsByMobile(mobile ?? "");
  res.status(200).json({ data });
});

export const establishParentDelegateSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { mobile, studentUsername } = req.body as { mobile?: string; studentUsername?: string };
  if (!mobile?.trim() || !studentUsername?.trim()) {
    throw new AppError("mobile and studentUsername are required", 400);
  }
  await assertParentStudentLinked(mobile, studentUsername);
  const normalizedStudent = normalizeStudentUsername(studentUsername);
  const student = await UserModel.findOne({
    username: normalizedStudent,
    roles: ROLE.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select("_id")
    .lean()
    .exec();
  if (!student) {
    throw new AppError("Student not found", 404);
  }
  const { jwtSecret } = getEnv();
  const token = signParentDelegateToken(String(student._id), jwtSecret, "8h");
  setParentDelegateCookie(res, token, 8 * 60 * 60 * 1000);
  res.status(200).json({ success: true });
});

export function parentDelegateLogout(_req: Request, res: Response): void {
  clearParentDelegateCookie(res);
  res.status(200).json({ success: true });
}

export const googleRedirectUri = (req: Request, res: Response): void => {
  const baseUrl = resolveOauthBackendBaseUrl(req);
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  res.status(200).json({
    redirectUri,
    hint: "Add this EXACT value in Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs. If it differs (e.g. 127.0.0.1 vs localhost), set BACKEND_PUBLIC_URL in .env to the base URL you want (e.g. http://localhost:38472) and restart the backend.",
  });
};

export const googleRedirect = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { googleClientId, jwtSecret, isProduction } = getEnv();
  if (!googleClientId) {
    res.status(501).json({ success: false, message: "Google login is not configured" });
    return;
  }
  const app = (req.query.app as string) === "lms" ? "lms" : "admin";
  const redirect = (req.query.redirect as string) || undefined;
  const intent: GoogleState["intent"] =
    (req.query.intent as string) === "set_password" ? "set_password" : "login";
  const nonce = crypto.randomBytes(24).toString("base64url");
  const stateObj: GoogleState & { purpose: "google_oauth_state"; nonce: string } = {
    app,
    redirect,
    intent,
    purpose: "google_oauth_state",
    nonce,
  };
  const state = jwt.sign(stateObj, jwtSecret, { algorithm: "HS256", expiresIn: OAUTH_STATE_TTL_SECONDS });
  await OAuthNonceModel.create({
    nonce,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000),
  });
  res.cookie(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
    path: "/",
  });
  const baseUrl = resolveOauthBackendBaseUrl(req);
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const url = getGoogleAuthUrl(redirectUri, state, googleClientId);
  res.redirect(302, url);
});

export const googleCallback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { googleClientId, googleClientSecret, jwtSecret, frontendAdminUrl, frontendLmsUrl } = getEnv();
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
  let state: GoogleState & { purpose: "google_oauth_state"; nonce: string };
  try {
    state = jwt.verify(stateB64, jwtSecret, { algorithms: ["HS256"] }) as GoogleState & {
      purpose: "google_oauth_state";
      nonce: string;
    };
    if (state.purpose !== "google_oauth_state" || !state.nonce?.trim()) throw new Error("Invalid state payload");
  } catch {
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: "/" });
    res.redirect(frontendAdminUrl + "/login?error=invalid_state");
    return;
  }
  const nonceCookie = (req.cookies?.[OAUTH_NONCE_COOKIE] as string | undefined)?.trim();
  if (!nonceCookie || nonceCookie !== state.nonce) {
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: "/" });
    res.redirect(frontendAdminUrl + "/login?error=state_nonce_mismatch");
    return;
  }
  const consumed = await OAuthNonceModel.findOneAndUpdate(
    { nonce: state.nonce, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true }
  ).exec();
  if (!consumed) {
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: "/" });
    res.redirect(frontendAdminUrl + "/login?error=state_expired_or_reused");
    return;
  }
  res.clearCookie(OAUTH_NONCE_COOKIE, { path: "/" });
  const baseUrl = resolveOauthBackendBaseUrl(req);
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const { access_token } = await exchangeCodeForTokens(code, redirectUri, googleClientId, googleClientSecret);
  const profile = await getGoogleProfile(access_token);

  // "Set password" re-auth flow: do NOT log the user in or rotate tokenVersion.
  // Verify that the Google email matches an existing user, then redirect to the
  // /profile/set-password page with a short-lived set-password token.
  if (state.intent === "set_password") {
    const normalizedEmail = profile.email.toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail })
      .select("_id email")
      .lean()
      .exec();
    const frontBaseSp = (state.app === "lms" ? frontendLmsUrl : frontendAdminUrl).replace(/\/$/, "");
    if (!user) {
      res.redirect(
        302,
        `${frontBaseSp}/profile?error=${encodeURIComponent("No account found for that Google email.")}`
      );
      return;
    }
    const setPasswordToken = createSetPasswordToken(String(user._id), normalizedEmail, jwtSecret);
    res.redirect(
      302,
      `${frontBaseSp}/profile/set-password?token=${encodeURIComponent(setPasswordToken)}`
    );
    return;
  }

  const userAgent = req.headers["user-agent"];
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress;
  let result;
  try {
    const requestedPortal: AuthPortal = state.app === "lms" ? "lms" : "admin";
    const { expiresIn } = authExpiryForPortal(requestedPortal);
    result = await loginWithGoogleEmail(profile.email, jwtSecret, expiresIn, { userAgent, ip });
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
  if (state.app === "lms") {
    const roles = result.user.roles ?? [];
    if (!roles.includes(ROLE.STUDENT) && !roles.includes(ROLE.PARENT)) {
      const base = frontendLmsUrl.replace(/\/$/, "");
      res.redirect(
        302,
        `${base}/login?error=${encodeURIComponent("FUNT Learn is for students only. Use the Admin app for staff accounts.")}`
      );
      return;
    }
  }
  const frontBase = (state.app === "lms" ? frontendLmsUrl : frontendAdminUrl).replace(/\/$/, "");
  const callbackUrl = `${frontBase}/auth/callback?token=${encodeURIComponent(result.token)}`;
  res.redirect(302, callbackUrl);
});

function validateSignupPassword(password: string): void {
  validateStrongPassword(password);
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
  const { jwtSecret } = getEnv();
  const { expiresIn, maxAgeMs } = authExpiryForPortal("lms");
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
  // Password is optional for Google sign-up: users may sign in via Google only
  // and set a password later through the secure set-password flow.
  if (password != null && password !== "") {
    validateSignupPassword(password);
  }

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
      ...(password != null && password !== "" && { password }),
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
    { userId: id, username: createdUsername, roles: [ROLE.STUDENT], tokenVersion: 0 },
    jwtSecret,
    expiresIn
  );
  const user = {
    id,
    username: createdUsername,
    name: name.trim(),
    roles: [ROLE.STUDENT],
    status: ACCOUNT_STATUS.ACTIVE,
  };
  setAuthCookie(res, token, maxAgeMs, "lms");
  setIdleCookie(res, "lms", maxAgeMs);
  clearLegacyAuthCookie(res);
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

/** Complete Admin/Super Admin onboarding from Google token. */
export const googleAdminSignupComplete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { jwtSecret, jwtExpiresInAdmin } = getEnv();
  const body = req.body as {
    signupToken?: string;
    roleType?: "ADMIN" | "SUPER_ADMIN";
    name?: string;
    email?: string;
    mobile?: string;
    city?: string;
    password?: string;
  };
  const { signupToken, roleType, name, email, mobile, city, password } = body;

  if (!signupToken?.trim()) throw new AppError("signupToken is required", 400);
  const role = roleType === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
  const payload = verifyGoogleSignupToken(signupToken.trim(), jwtSecret);
  if (!name?.trim()) throw new AppError("Full name is required", 400);
  if (!email?.trim()) throw new AppError("Email is required", 400);
  if (email.trim().toLowerCase() !== payload.email.toLowerCase()) {
    throw new AppError("Email must match the Google account you signed in with", 400);
  }
  if (!mobile?.trim()) throw new AppError("Phone number is required", 400);

  const emailNorm = email.trim().toLowerCase();
  const mobileNorm = mobile.trim();
  const cityNorm = city?.trim() || undefined;
  const nameNorm = name.trim();
  const { submitAdminRequest, submitSuperAdminRequest } = await import("../services/registrationRequest.service.js");

  if (role === "SUPER_ADMIN") {
    const existingSuperAdmin = await UserModel.findOne({ roles: ROLE.SUPER_ADMIN }).select("_id").lean().exec();
    if (!existingSuperAdmin) {
      if (!password) throw new AppError("Password is required for first Super Admin setup", 400);
      validateSignupPassword(password);
      const result = await createSuperAdmin({
        name: nameNorm,
        email: emailNorm,
        mobile: mobileNorm,
        password,
      });
      const token = signToken(
        {
          userId: result.id,
          username: result.username,
          roles: [ROLE.SUPER_ADMIN],
          tokenVersion: 0,
        },
        jwtSecret,
        jwtExpiresInAdmin
      );
      const maxAgeMs = jwtExpiresInToMs(jwtExpiresInAdmin);
      setAuthCookie(res, token, maxAgeMs, "admin");
      setIdleCookie(res, "admin", maxAgeMs);
      clearLegacyAuthCookie(res);
      res.status(201).json({
        data: {
          user: {
            id: result.id,
            username: result.username,
            name: nameNorm,
            roles: [ROLE.SUPER_ADMIN],
            status: ACCOUNT_STATUS.ACTIVE,
          },
          bootstrap: true,
        },
        message: "First Super Admin account created.",
      });
      return;
    }

    await submitSuperAdminRequest({
      name: nameNorm,
      email: emailNorm,
      mobile: mobileNorm,
      city: cityNorm,
    });
    res.status(201).json({
      message:
        "Super Admin profile submitted for approval. An existing Super Admin must approve this request before you can access Admin.",
    });
    return;
  }

  if (!password) throw new AppError("Password is required to complete Admin signup", 400);
  validateSignupPassword(password);

  await submitAdminRequest({
    name: nameNorm,
    email: emailNorm,
    mobile: mobileNorm,
    city: cityNorm,
    password,
  });

  res.status(201).json({
    message:
      "Admin profile submitted for approval. A Super Admin will review and approve before you can access Admin.",
  });
});
