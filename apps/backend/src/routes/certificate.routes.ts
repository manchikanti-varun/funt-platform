
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  checkEligibility,
  generateCertificate,
  downloadCertificatePdf,
  listBatchCertificateStatus,
  bulkGenerateBatchCertificates,
  downloadBatchCertificatesZip,
} from "../controllers/certificate.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/eligibility", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.STUDENT), checkEligibility);
router.post("/generate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), generateCertificate);

router.get("/batch/:batchId/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listBatchCertificateStatus);
router.post("/batch/:batchId/generate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkGenerateBatchCertificates);
router.get("/batch/:batchId/zip", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), downloadBatchCertificatesZip);
router.get("/:certificateId/pdf", downloadCertificatePdf);

export const certificateRoutes = router;
