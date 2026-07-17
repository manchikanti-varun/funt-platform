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

// ── Letter Template Settings (Super Admin) — must be before /:letterId ────────
router.get("/settings/template", requireRoles(ROLE.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const { getLetterSettings } = await import("../services/letterSettings.service.js");
    const { successRes } = await import("../utils/response.js");
    const data = await getLetterSettings();
    successRes(res, data);
  } catch (err) { next(err); }
});

router.put("/settings/template", requireRoles(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { updateLetterSettings } = await import("../services/letterSettings.service.js");
    const { successRes } = await import("../utils/response.js");
    const { AppError } = await import("../utils/AppError.js");
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Unauthorized", 401);
    const data = await updateLetterSettings(req.body ?? {}, userId);
    successRes(res, data, "Template settings updated");
  } catch (err) { next(err); }
});

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

// ── Extend Internship ────────────────────────────────────────────────────────
router.post("/:letterId/extend", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), async (req, res, next) => {
  try {
    const { extendInternship } = await import("../services/letter.service.js");
    const { AppError } = await import("../utils/AppError.js");
    const { successRes } = await import("../utils/response.js");
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Unauthorized", 401);
    const letterId = req.params.letterId;
    const { extensionMonths } = req.body ?? {};
    if (!letterId) throw new AppError("letterId is required", 400);
    if (!extensionMonths || extensionMonths < 1) throw new AppError("extensionMonths must be at least 1", 400);
    const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
    const data = await extendInternship(letterId, Number(extensionMonths), userId, isSuperAdmin);
    successRes(res, data, "Internship extended", 201);
  } catch (err) { next(err); }
});

export const letterRoutes = router;
