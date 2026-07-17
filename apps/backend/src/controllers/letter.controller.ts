import type { Request, Response } from "express";
import * as service from "../services/letter.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function isSuperAdmin(req: Request): boolean {
  return req.user?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
}

export const createLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const issuedBy = getUserId(req);
  const body = req.body ?? {};

  if (!body.type) throw new AppError("type is required", 400);
  if (!body.recipientName?.trim()) throw new AppError("recipientName is required", 400);
  if (!body.employmentType) throw new AppError("employmentType is required", 400);
  if (!body.department) throw new AppError("department is required", 400);
  if (!body.designation?.trim()) throw new AppError("designation is required", 400);
  if (!body.joiningDate) throw new AppError("joiningDate is required", 400);

  const data = await service.createLetter({
    type: body.type,
    recipientName: body.recipientName,
    recipientEmail: body.recipientEmail,
    recipientMobile: body.recipientMobile,
    recipientGender: body.recipientGender,
    employmentType: body.employmentType,
    department: body.department,
    designation: body.designation,
    joiningDate: new Date(body.joiningDate),
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    duration: body.duration,
    stipend: body.stipend,
    stipendAmount: body.stipendAmount != null ? Number(body.stipendAmount) : undefined,
    ctc: body.ctc,
    location: body.location,
    reportingTo: body.reportingTo,
    responsibilities: body.responsibilities,
    performanceSummary: body.performanceSummary,
    dutiesDescription: body.dutiesDescription,
    signatoryName: body.signatoryName,
    signatoryRole: body.signatoryRole,
    signatoryImageUrl: body.signatoryImageUrl,
    stampImageUrl: body.stampImageUrl,
    linkedLetterId: body.linkedLetterId,
    issuedBy,
    autoApprove: isSuperAdmin(req),
  });

  successRes(res, data, "Letter created", 201);
});

export const listLetters = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const approvalStatus = req.query.approvalStatus as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const data = await service.listLetters({ type, status, approvalStatus, search });
  successRes(res, data);
});

export const getLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.getLetterById(letterId);
  successRes(res, data);
});

export const updateLetterHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const updatedBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  // letterId here is the mongo _id (for drafts) or the letterId string
  const data = await service.updateLetter(letterId, req.body ?? {}, updatedBy);
  successRes(res, data, "Letter updated");
});

export const submitForApprovalHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const submittedBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.submitForApproval(letterId, submittedBy);
  successRes(res, data, "Submitted for approval");
});

export const approveLetterHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const approvedBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.approveLetter(letterId, approvedBy);
  successRes(res, data, "Letter approved and ID assigned");
});

export const rejectApprovalHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rejectedBy = getUserId(req);
  const letterId = req.params.letterId;
  const { reason } = req.body ?? {};
  if (!letterId) throw new AppError("letterId is required", 400);
  if (!reason?.trim()) throw new AppError("reason is required", 400);
  const data = await service.rejectLetterApproval(letterId, rejectedBy, reason);
  successRes(res, data, "Approval rejected");
});

export const acceptLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const acceptedBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.internAcceptLetter(letterId, acceptedBy);
  successRes(res, data, "Letter accepted by intern");
});

export const internRejectHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rejectedBy = getUserId(req);
  const letterId = req.params.letterId;
  const { reason } = req.body ?? {};
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.internRejectLetter(letterId, rejectedBy, reason);
  successRes(res, data, "Intern rejected the offer");
});

export const withdrawLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const withdrawnBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.withdrawLetter(letterId, withdrawnBy);
  successRes(res, data, "Letter withdrawn");
});

export const revokeLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const revokedBy = getUserId(req);
  const letterId = req.params.letterId;
  const { reason } = req.body ?? {};
  if (!letterId) throw new AppError("letterId is required", 400);
  if (!reason?.trim()) throw new AppError("reason is required", 400);
  const data = await service.revokeLetter(letterId, revokedBy, reason);
  successRes(res, data, "Letter revoked");
});

export const downloadLetterPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const pdf = await service.generateLetterPdf(letterId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${letterId}.pdf"`);
  res.send(pdf);
});

export const createExperienceFromOfferHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const issuedBy = getUserId(req);
  const offerLetterId = req.params.letterId;
  const body = req.body ?? {};
  if (!offerLetterId) throw new AppError("Offer letter ID is required", 400);
  if (!body.endDate) throw new AppError("endDate is required for experience letter", 400);
  if (!body.dutiesDescription?.trim()) throw new AppError("dutiesDescription is required", 400);

  const data = await service.createExperienceFromOffer(offerLetterId, {
    endDate: new Date(body.endDate),
    dutiesDescription: body.dutiesDescription,
    performanceSummary: body.performanceSummary,
    signatoryName: body.signatoryName,
    signatoryRole: body.signatoryRole,
    signatoryImageUrl: body.signatoryImageUrl,
    stampImageUrl: body.stampImageUrl,
    issuedBy,
    autoApprove: isSuperAdmin(req),
  });

  successRes(res, data, "Experience letter created", 201);
});

export const listPendingApprovalsHandler = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listPendingApprovals();
  successRes(res, data);
});

// ── Public Verification (no auth — called from verify routes) ─────────────────

export const verifyLetterPublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.verifyLetterPublic(letterId);
  if (!data) {
    res.status(404).json({ success: false, message: "Letter not found or invalid" });
    return;
  }
  successRes(res, data);
});
