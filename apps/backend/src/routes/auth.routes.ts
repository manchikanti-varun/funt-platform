
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema, studentSignupSchema, changePasswordSchema, setPasswordSchema } from "../schemas/index.js";
import {
  login,
  parentLogin,
  changePassword,
  setPasswordWithGoogle,
  establishSession,
  logout,
  googleRedirect,
  googleCallback,
  googleRedirectUri,
  googleSignupPreview,
  googleSignupComplete,
  googleAdminSignupPreview,
  googleAdminSignupComplete,
  forgotStudentUsername,
  checkUsernameAvailability,
  signupStudent,
  parentLinkedStudents,
  establishParentDelegateSession,
  parentDelegateLogout,
} from "../controllers/auth.controller.js";
import { parentMobileLookupRateLimiter, parentDelegateIssueRateLimiter, passwordChangeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/logout", logout);
router.post("/session", establishSession);
router.post("/login", validateBody(loginSchema), login);
router.post("/signup", validateBody(studentSignupSchema), signupStudent);
router.get("/username-availability", checkUsernameAvailability);
router.post("/forgot-username", forgotStudentUsername);
router.post("/change-password", authMiddleware, passwordChangeRateLimiter, validateBody(changePasswordSchema), changePassword);
router.post("/set-password-google", authMiddleware, validateBody(setPasswordSchema), setPasswordWithGoogle);
router.post("/parent-login", parentLogin);
router.post("/parent-linked-students", parentMobileLookupRateLimiter, parentLinkedStudents);
router.post("/parent-delegate-session", parentDelegateIssueRateLimiter, establishParentDelegateSession);
router.post("/parent-delegate-logout", parentDelegateLogout);
router.get("/google/redirect-uri", googleRedirectUri);
router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);
router.get("/google/signup-preview", googleSignupPreview);
router.post("/google/signup-complete", googleSignupComplete);
router.get("/google/admin-signup-preview", googleAdminSignupPreview);
router.post("/google/admin-signup-complete", googleAdminSignupComplete);

export const authRoutes = router;
