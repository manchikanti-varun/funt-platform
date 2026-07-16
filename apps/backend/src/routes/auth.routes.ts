
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema, studentSignupSchema, changePasswordSchema, setPasswordSchema, supportSignupSchema } from "../schemas/index.js";
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
import { parentMobileLookupRateLimiter, parentDelegateIssueRateLimiter, passwordChangeRateLimiter, signupRateLimiter, supportSignupRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/logout", logout);
router.post("/session", establishSession);
router.post("/login", validateBody(loginSchema), login);
router.post("/signup", signupRateLimiter, validateBody(studentSignupSchema), signupStudent);
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

// Support agent self-registration (creates a pending request for admin approval)
router.post("/support-signup", supportSignupRateLimiter, validateBody(supportSignupSchema), async (req, res, next) => {
  try {
    const { name, email, mobile, city, password } = req.body as {
      name: string;
      email: string;
      mobile: string;
      city?: string;
      password: string;
    };
    const { RegistrationRequestModel } = await import("../models/RegistrationRequest.model.js");
    const { hashPassword, validateStrongPassword } = await import("../services/auth.service.js");

    // Check if request already exists
    const existing = await RegistrationRequestModel.findOne({
      email: email.trim(), roleType: "SUPPORT_AGENT", status: "PENDING",
    }).lean().exec();
    if (existing) {
      res.status(400).json({ success: false, message: "A request with this email is already pending." });
      return;
    }

    validateStrongPassword(password);
    const passwordHash = await hashPassword(password);

    await RegistrationRequestModel.create({
      roleType: "SUPPORT_AGENT",
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      city: city?.trim() || undefined,
      passwordHash,
    });

    res.status(201).json({ success: true, message: "Request submitted. An admin will review and approve your account." });
  } catch (err) { next(err); }
});

export const authRoutes = router;
