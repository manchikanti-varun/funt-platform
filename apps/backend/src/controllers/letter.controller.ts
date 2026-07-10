import type { Request, Response } from "express";
import * as service from "../services/letter.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const issuedBy = getUserId(req);
  const {
    type, recipientName, recipientEmail, employmentType, department,
    designation, joiningDate, endDate, duration, stipend, ctc, location, reportingTo,
    responsibilities, performanceSummary,
  } = req.body ?? {};

  if (!type) throw new AppError("type is required", 400);
  if (!recipientName?.trim()) throw new AppError("recipientName is required", 400);
  if (!employmentType) throw new AppError("employmentType is required", 400);
  if (!department) throw new AppError("department is required", 400);
  if (!designation?.trim()) throw new AppError("designation is required", 400);
  if (!joiningDate) throw new AppError("joiningDate is required", 400);

  const data = await service.createLetter({
    type,
    recipientName,
    recipientEmail,
    employmentType,
    department,
    designation,
    joiningDate: new Date(joiningDate),
    endDate: endDate ? new Date(endDate) : undefined,
    duration,
    stipend,
    ctc,
    location,
    reportingTo,
    responsibilities,
    performanceSummary,
    issuedBy,
  });

  successRes(res, data, "Letter created", 201);
});

export const listLetters = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const data = await service.listLetters({ type, status, search });
  successRes(res, data);
});

export const getLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.getLetterById(letterId);
  successRes(res, data);
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

export const acceptLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const acceptedBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.acceptLetter(letterId, acceptedBy);
  successRes(res, data, "Letter accepted");
});

export const withdrawLetter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const withdrawnBy = getUserId(req);
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const data = await service.withdrawLetter(letterId, withdrawnBy);
  successRes(res, data, "Letter withdrawn");
});

export const downloadLetterPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const letterId = req.params.letterId;
  if (!letterId) throw new AppError("letterId is required", 400);
  const pdf = await service.generateLetterPdf(letterId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${letterId}.pdf"`);
  res.send(pdf);
});

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
