/**
 * Public verification – no auth. GET /verify/:certificateId
 */

import { Router } from "express";
import { verifyCertificatePublic } from "../controllers/certificate.controller.js";

const router = Router();

router.get("/:certificateId", verifyCertificatePublic);

export const verifyRoutes = router;
