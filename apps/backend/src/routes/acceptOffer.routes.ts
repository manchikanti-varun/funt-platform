import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import * as service from "../services/letter.service.js";

const router = Router();

// All routes here are PUBLIC (no auth) — token-based access

// GET /accept-offer/:token — get offer details
router.get("/:token", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  if (!token) throw new AppError("Token is required", 400);
  const data = await service.getOfferByToken(token);
  if (!data) {
    res.status(404).json({ success: false, message: "Invalid or expired acceptance link." });
    return;
  }
  successRes(res, data);
}));

// POST /accept-offer/:token/upload — register uploaded document (after presigned upload)
router.post("/:token/upload", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { docType, filename, fileKey, fileSize } = req.body ?? {};
  if (!token) throw new AppError("Token is required", 400);
  if (!docType || !filename || !fileKey) throw new AppError("docType, filename, and fileKey are required", 400);
  const data = await service.uploadDocumentByToken(token, docType, filename, fileKey, fileSize ?? 0);
  successRes(res, data, "Document uploaded");
}));

// POST /accept-offer/:token/presign — get presigned upload URL
router.post("/:token/presign", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { docType, filename, mimeType } = req.body ?? {};
  if (!token) throw new AppError("Token is required", 400);
  if (!docType || !filename) throw new AppError("docType and filename are required", 400);

  // Verify token is valid before issuing presigned URL
  const offer = await service.getOfferByToken(token);
  if (!offer) throw new AppError("Invalid or expired link", 404);
  if (offer.expired) throw new AppError("This acceptance link has expired", 400);
  if (offer.alreadyResponded) throw new AppError("This offer has already been responded to", 400);

  const { generatePresignedFileUploadUrl } = await import("../services/r2File.service.js");
  const { uploadUrl, fileKey } = await generatePresignedFileUploadUrl(
    "offer-documents",
    token.slice(0, 8),
    filename,
    mimeType || "application/octet-stream"
  );
  successRes(res, { uploadUrl, fileKey, docType, filename }, "Presigned URL generated");
}));

// DELETE /accept-offer/:token/upload/:fileKey — remove uploaded document
router.delete("/:token/upload/:fileKey", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token, fileKey } = req.params;
  if (!token || !fileKey) throw new AppError("Token and fileKey are required", 400);
  const data = await service.removeDocumentByToken(token, decodeURIComponent(fileKey));
  successRes(res, data, "Document removed");
}));

// POST /accept-offer/:token/accept — accept the offer
router.post("/:token/accept", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { digitalSignatureName } = req.body ?? {};
  if (!token) throw new AppError("Token is required", 400);
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress;
  const data = await service.acceptOfferByToken(token, digitalSignatureName, ip);
  successRes(res, data, "Offer accepted successfully");
}));

// POST /accept-offer/:token/decline — decline the offer
router.post("/:token/decline", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { reason } = req.body ?? {};
  if (!token) throw new AppError("Token is required", 400);
  const data = await service.declineOfferByToken(token, reason);
  successRes(res, data, "Offer declined");
}));

export const acceptOfferRoutes = router;
