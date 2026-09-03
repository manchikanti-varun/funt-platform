import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  previewCertificate,
  generateSingle,
  generateBulk,
  getRegistry,
  verifyCertificate,
  revokeCertificate,
} from "../controllers/workshopCertificate.controller.js";

const router = Router();

router.use(authMiddleware);

// All workshop certificate endpoints require admin or super_admin role
router.use(requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN));

// Template CRUD
router.get("/templates", listTemplates);
router.get("/templates/:templateId", getTemplate);
router.post("/templates", createTemplate);
router.put("/templates/:templateId", updateTemplate);
router.delete("/templates/:templateId", deleteTemplate);
router.post("/templates/:templateId/duplicate", duplicateTemplate);

// Certificate generation
router.post("/preview", previewCertificate);
router.post("/generate", generateSingle);
router.post("/generate-bulk", generateBulk);

// Certificate registry & verification
router.get("/templates/:templateId/registry", getRegistry);
router.get("/verify/:certificateId", verifyCertificate);
router.post("/revoke/:certificateId", revokeCertificate);

export const workshopCertificateRoutes = router;
