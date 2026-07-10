import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createLetter,
  listLetters,
  getLetter,
  revokeLetter,
  downloadLetterPdf,
} from "../controllers/letter.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN), createLetter);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listLetters);
router.get("/:letterId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getLetter);
router.get("/:letterId/pdf", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), downloadLetterPdf);
router.patch("/:letterId/revoke", requireRoles(ROLE.SUPER_ADMIN), revokeLetter);

export const letterRoutes = router;
