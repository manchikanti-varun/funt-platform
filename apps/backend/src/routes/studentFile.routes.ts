/**
 * Student file download route — mounted under /api/student/files
 *
 * GET /api/student/files/download?key=r2file://...&name=filename.pdf
 * → 302 redirect to presigned GET URL
 *
 * Requires authentication (any enrolled student).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { downloadFile } from "../controllers/r2File.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/download", downloadFile);

export const studentFileRoutes = router;
