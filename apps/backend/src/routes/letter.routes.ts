import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createLetterSchema } from "../schemas/index.js";
import {
  createLetter,
  listLetters,
  getLetter,
  revokeLetter,
  acceptLetter,
  withdrawLetter,
  downloadLetterPdf,
  submitForApprovalHandler,
  approveLetterHandler,
  rejectApprovalHandler,
  internRejectHandler,
  updateLetterHandler,
  createExperienceFromOfferHandler,
  listPendingApprovalsHandler,
} from "../controllers/letter.controller.js";

const router = Router();

router.use(authMiddleware);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(createLetterSchema), createLetter);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listLetters);
router.get("/pending-approvals", requireRoles(ROLE.SUPER_ADMIN), listPendingApprovalsHandler);
router.get("/:letterId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getLetter);
router.patch("/:letterId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateLetterHandler);
router.get("/:letterId/pdf", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), downloadLetterPdf);

// ── Approval Workflow ─────────────────────────────────────────────────────────
router.post("/:letterId/submit-approval", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), submitForApprovalHandler);
router.post("/:letterId/approve", requireRoles(ROLE.SUPER_ADMIN), approveLetterHandler);
router.post("/:letterId/reject-approval", requireRoles(ROLE.SUPER_ADMIN), rejectApprovalHandler);

// ── Intern Response ───────────────────────────────────────────────────────────
router.patch("/:letterId/accept", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), acceptLetter);
router.patch("/:letterId/intern-reject", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), internRejectHandler);
router.patch("/:letterId/withdraw", requireRoles(ROLE.SUPER_ADMIN), withdrawLetter);
router.patch("/:letterId/revoke", requireRoles(ROLE.SUPER_ADMIN), revokeLetter);

// ── Experience Letter from Offer ──────────────────────────────────────────────
router.post("/:letterId/experience", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createExperienceFromOfferHandler);

export const letterRoutes = router;
