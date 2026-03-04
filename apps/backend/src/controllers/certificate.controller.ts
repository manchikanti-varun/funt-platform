
import type { Request, Response } from "express";
import * as service from "../services/certificate.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const checkEligibility = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studentId, batchId } = req.query;
  if (!studentId || !batchId) throw new AppError("studentId and batchId are required", 400);
  const result = await service.checkEligibility(String(studentId), String(batchId));
  successRes(res, result);
});

export const generateCertificate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const issuedBy = getUserId(req);
  const { studentId, batchId } = req.body ?? {};
  if (!studentId || !batchId) throw new AppError("studentId and batchId are required", 400);
  const isStudent = req.user?.roles?.includes(ROLE.STUDENT);
  if (isStudent && req.user?.userId !== studentId) {
    throw new AppError("Students cannot generate certificates for others", 403);
  }
  const data = await service.generateCertificate(studentId, batchId, issuedBy);
  successRes(res, data, "Certificate generated", 201);
});

export const verifyCertificatePublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const certificateId = req.params.certificateId;
  if (!certificateId) throw new AppError("certificateId is required", 400);
  const data = await service.verifyCertificatePublic(certificateId);
  if (!data) {
    res.status(404).json({ success: false, message: "Certificate not found or revoked" });
    return;
  }
  successRes(res, { valid: true, ...data });
});

export const downloadCertificatePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const certificateId = req.params.certificateId;
  if (!certificateId) throw new AppError("certificateId is required", 400);
  const isAdmin = req.user?.roles?.includes(ROLE.ADMIN) || req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  const data = await service.getCertificateDataForPdf(certificateId);
  if (!data) throw new AppError("Certificate not found or revoked", 404);
  const cert = await service.getCertificateByCertificateId(certificateId);
  if (!cert) throw new AppError("Certificate not found", 404);
  if (!isAdmin && cert.studentId !== userId) {
    throw new AppError("You can only download your own certificate", 403);
  }
  const buffer = await service.generateCertificatePdfBuffer(certificateId);
  if (!buffer) throw new AppError("Failed to generate PDF", 500);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate-${certificateId}.pdf"`);
  res.send(buffer);
});

export const getMyCertificates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await service.listCertificatesForStudent(studentId);
  successRes(res, data);
});

export const postGenerateMyCertificate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId } = req.body ?? {};
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await service.generateCertificate(studentId, batchId, studentId);
  successRes(res, data, "Certificate generated", 201);
});

export const listBatchCertificateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = req.params.batchId;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await service.listStudentsWithCertificateStatus(batchId);
  successRes(res, data);
});

export const bulkGenerateBatchCertificates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = req.params.batchId;
  const issuedBy = getUserId(req);
  const { studentIds } = req.body ?? {};
  if (!batchId) throw new AppError("batchId is required", 400);
  const ids = Array.isArray(studentIds) ? studentIds.filter((id: unknown) => typeof id === "string") : [];
  const result = await service.bulkGenerateCertificates(batchId, ids, issuedBy);
  successRes(res, result, "Bulk generate completed");
});

export const downloadBatchCertificatesZip = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = req.params.batchId;
  const raw = (req.query.certificateIds as string) ?? "";
  const certificateIds = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!batchId) throw new AppError("batchId is required", 400);
  if (certificateIds.length === 0) throw new AppError("certificateIds query is required", 400);
  const buffers = await service.getCertificatePdfBuffersForBatch(batchId, certificateIds);
  if (buffers.length === 0) throw new AppError("No certificates found for download", 404);
  const archiver = (await import("archiver")).default;
  const archive = archiver("zip", { zlib: { level: 9 } });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="certificates-${batchId}.zip"`);
  archive.pipe(res);
  for (const { certificateId, buffer } of buffers) {
    archive.append(buffer, { name: `certificate-${certificateId}.pdf` });
  }
  await new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
    archive.finalize();
  });
});
