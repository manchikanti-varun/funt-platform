import { Router } from "express";
import { parentDelegateAuthMiddleware } from "../middleware/parentDelegate.middleware.js";
import { getParentStudentProfile } from "../controllers/parent.controller.js";

const router = Router();

router.get("/student-profile", parentDelegateAuthMiddleware, getParentStudentProfile);

export const parentRoutes = router;
