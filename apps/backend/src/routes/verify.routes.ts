
import { Router } from "express";
import { verifyCertificatePublic } from "../controllers/certificate.controller.js";
import { verifyInvoicePublic } from "../controllers/invoice.controller.js";
import { verifyLetterPublic } from "../controllers/letter.controller.js";

const router = Router();

router.get("/invoice/:invoiceNumber", verifyInvoicePublic);
router.get("/letter/:letterId", verifyLetterPublic);
router.get("/:certificateId", verifyCertificatePublic);

export const verifyRoutes = router;
