
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  login,
  parentLogin,
  changePassword,
  googleRedirect,
  googleCallback,
  googleRedirectUri,
  googleSignupPreview,
  googleSignupComplete,
  googleAdminSignupPreview,
  googleAdminSignupComplete,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", login);
router.post("/change-password", authMiddleware, changePassword);
router.post("/parent-login", parentLogin);
router.get("/google/redirect-uri", googleRedirectUri);
router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);
router.get("/google/signup-preview", googleSignupPreview);
router.post("/google/signup-complete", googleSignupComplete);
router.get("/google/admin-signup-preview", googleAdminSignupPreview);
router.post("/google/admin-signup-complete", googleAdminSignupComplete);

export const authRoutes = router;
