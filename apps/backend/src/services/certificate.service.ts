/**
 * Certificate service – eligibility, generate, public verify.
 */

import { CertificateModel } from "../models/Certificate.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { ModuleProgressModel } from "../models/ModuleProgress.model.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { UserModel } from "../models/User.model.js";
import { ENROLLMENT_STATUS, CERTIFICATE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { generateCertificateId } from "../utils/funtIdGenerator.js";
import { ensureFirstCourseCompletedBadge } from "./achievement.service.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { AppError } from "../utils/AppError.js";

function getFirstSnapshotModules(batch: unknown): Array<{ linkedAssignmentId?: string }> {
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const first = snapshots[0] as { modules?: Array<{ linkedAssignmentId?: string }> } | undefined;
  return first?.modules ?? [];
}

export async function checkEligibility(
  studentId: string,
  batchId: string
): Promise<{ eligible: boolean; reason?: string }> {
  const batch = await findBatchByParam(batchId);
  if (!batch) return { eligible: false, reason: "Batch not found" };
  const batchMongoId = String((batch as { _id: unknown })._id);

  const enrollment = await EnrollmentModel.findOne({ studentId, batchId: batchMongoId }).exec();
  if (!enrollment) return { eligible: false, reason: "Not enrolled in this batch" };
  if (
    enrollment.status !== ENROLLMENT_STATUS.ACTIVE &&
    enrollment.status !== ENROLLMENT_STATUS.COMPLETED
  ) {
    return { eligible: false, reason: "Enrollment is not active or completed" };
  }

  const modules = getFirstSnapshotModules(batch);
  if (modules.length === 0) return { eligible: false, reason: "Batch has no modules" };

  const completedCount = await ModuleProgressModel.countDocuments({
    studentId,
    batchId: batchMongoId,
    completedAt: { $exists: true, $ne: null },
  }).exec();
  if (completedCount < modules.length) {
    return { eligible: false, reason: "Not all modules completed" };
  }

  for (let order = 0; order < modules.length; order++) {
    const mod = modules[order];
    if (mod?.linkedAssignmentId) {
      const approved = await AssignmentSubmissionModel.findOne({
        studentId,
        batchId: batchMongoId,
        moduleOrder: order,
        status: "APPROVED",
      }).exec();
      if (!approved)
        return { eligible: false, reason: `Assignment for module ${order} not approved` };
    }
  }

  const existing = await CertificateModel.findOne({ studentId, batchId: batchMongoId }).exec();
  if (existing) return { eligible: false, reason: "Certificate already issued for this batch" };

  return { eligible: true };
}

/** List issued certificates for a student (for LMS "My certificates"). */
export async function listCertificatesForStudent(studentId: string) {
  const certs = await CertificateModel.find({ studentId, status: CERTIFICATE_STATUS.ISSUED })
    .sort({ issuedAt: -1 })
    .lean()
    .exec();
  const batchIds = [...new Set(certs.map((c) => c.batchId))];
  const batches = await BatchModel.find({ _id: { $in: batchIds } })
    .select("courseSnapshot courseSnapshots")
    .lean()
    .exec();
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));
  return certs.map((c) => {
    const batch = batchMap.get(c.batchId);
    const firstSnap = batch ? (getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { title?: string } | undefined) : undefined;
    const courseName = firstSnap?.title ?? "Course";
    return {
      certificateId: c.certificateId,
      batchId: c.batchId,
      courseId: c.courseId,
      courseName,
      issuedAt: c.issuedAt,
    };
  });
}

function getFirstSnapshotCourseId(batch: unknown): string {
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const first = snapshots[0] as { courseId?: string } | undefined;
  return first?.courseId ?? "";
}

export async function generateCertificate(studentId: string, batchId: string, issuedBy: string) {
  const { eligible, reason } = await checkEligibility(studentId, batchId);
  if (!eligible) throw new AppError(reason ?? "Not eligible for certificate", 400);

  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const courseId =
    getFirstSnapshotCourseId(batch) ||
    (batch.courseSnapshot as { courseId?: string } | undefined)?.courseId ||
    "";
  if (!courseId) throw new AppError("Batch has no course", 400);

  const certificateId = await generateCertificateId();
  const doc = await CertificateModel.create({
    certificateId,
    studentId,
    courseId,
    batchId: batchMongoId,
    issuedAt: new Date(),
    issuedBy,
    status: CERTIFICATE_STATUS.ISSUED,
  });

  await createAuditLog("CERTIFICATE_GENERATED", issuedBy, "Certificate", String(doc._id));
  await ensureFirstCourseCompletedBadge(studentId, batchMongoId).catch(() => {});

  return {
    id: String(doc._id),
    certificateId: doc.certificateId,
    studentId: doc.studentId,
    courseId: doc.courseId,
    batchId: doc.batchId,
    issuedAt: doc.issuedAt,
    issuedBy: doc.issuedBy,
    status: doc.status,
  };
}

export async function verifyCertificatePublic(certificateId: string) {
  const cert = await CertificateModel.findOne({
    certificateId,
    status: CERTIFICATE_STATUS.ISSUED,
  })
    .lean()
    .exec();
  if (!cert) return null;

  await createAuditLog("VERIFY_ACCESSED", "public", "Certificate", certificateId);

  const [student, batch] = await Promise.all([
    UserModel.findById(cert.studentId).select("name").lean().exec(),
    BatchModel.findById(cert.batchId).select("courseSnapshot courseSnapshots").lean().exec(),
  ]);

  const courseName = batch
    ? (getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { title?: string } | undefined)?.title ?? "Course"
    : "Course";

  return {
    certificateId: cert.certificateId,
    studentName: student?.name ?? "Student",
    courseName,
    issuedAt: cert.issuedAt,
  };
}

/** Get certificate doc by certificateId (for auth check). */
export async function getCertificateByCertificateId(certificateId: string) {
  const cert = await CertificateModel.findOne({
    certificateId,
    status: CERTIFICATE_STATUS.ISSUED,
  })
    .select("studentId")
    .lean()
    .exec();
  return cert;
}

/** Get certificate data for PDF (by certificateId). Returns null if not found or revoked. */
export async function getCertificateDataForPdf(certificateId: string) {
  const cert = await CertificateModel.findOne({
    certificateId,
    status: CERTIFICATE_STATUS.ISSUED,
  })
    .lean()
    .exec();
  if (!cert) return null;
  const [student, batch] = await Promise.all([
    UserModel.findById(cert.studentId).select("name").lean().exec(),
    BatchModel.findById(cert.batchId).select("courseSnapshot courseSnapshots").lean().exec(),
  ]);
  const courseName = batch
    ? (getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { title?: string } | undefined)?.title ?? "Course"
    : "Course";
  return {
    certificateId: cert.certificateId,
    studentName: student?.name ?? "Student",
    courseName,
    issuedAt: cert.issuedAt,
  };
}

/** Generate PDF buffer for certificate. */
export async function generateCertificatePdfBuffer(certificateId: string): Promise<Buffer | null> {
  const data = await getCertificateDataForPdf(certificateId);
  if (!data) return null;
  const { generateCertificatePdf } = await import("../utils/pdfCertificate.js");
  return generateCertificatePdf({
    certificateId: data.certificateId,
    studentName: data.studentName,
    courseName: data.courseName,
    issuedAt: data.issuedAt,
  });
}

/** List enrolled students for a batch with certificate status and progress (for admin batch certificates page). */
export async function listStudentsWithCertificateStatus(batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const modules = getFirstSnapshotModules(batch);
  const totalModules = modules.length;
  const { listEnrollmentsByBatch } = await import("./enrollment.service.js");
  const [enrollments, certs, progressDocs] = await Promise.all([
    listEnrollmentsByBatch(batchId),
    CertificateModel.find({ batchId: batchMongoId, status: CERTIFICATE_STATUS.ISSUED })
      .select("studentId certificateId")
      .lean()
      .exec(),
    ModuleProgressModel.find({ batchId: batchMongoId })
      .select("studentId completedAt")
      .lean()
      .exec(),
  ]);
  const certByStudent = new Map(certs.map((c) => [c.studentId, c.certificateId]));
  const completedByStudent = new Map<string, number>();
  for (const p of progressDocs) {
    if (p.completedAt != null) {
      completedByStudent.set(p.studentId, (completedByStudent.get(p.studentId) ?? 0) + 1);
    }
  }
  const result: Array<{
    studentId: string;
    funtId: string;
    name: string;
    certificateId: string | null;
    eligible: boolean;
    reason?: string;
    modulesCompleted: number;
    totalModules: number;
    progressPercent: number;
  }> = [];
  for (const e of enrollments) {
    const certId = certByStudent.get(e.studentId) ?? null;
    const { eligible, reason } = await checkEligibility(e.studentId, batchId);
    const modulesCompleted = completedByStudent.get(e.studentId) ?? 0;
    const progressPercent = totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 100) : 0;
    result.push({
      studentId: e.studentId,
      funtId: e.funtId,
      name: e.name,
      certificateId: certId,
      eligible: certId !== null ? true : eligible,
      reason: certId === null && !eligible ? reason : undefined,
      modulesCompleted,
      totalModules,
      progressPercent,
    });
  }
  return result;
}

/** Bulk generate certificates for a batch. Returns generated and errors. */
export async function bulkGenerateCertificates(
  batchId: string,
  studentIds: string[],
  issuedBy: string
): Promise<{ generated: Array<{ studentId: string; certificateId: string }>; errors: Array<{ studentId: string; message: string }> }> {
  const generated: Array<{ studentId: string; certificateId: string }> = [];
  const errors: Array<{ studentId: string; message: string }> = [];
  for (const studentId of studentIds) {
    try {
      const data = await generateCertificate(studentId, batchId, issuedBy);
      generated.push({ studentId, certificateId: data.certificateId });
    } catch (err) {
      errors.push({ studentId, message: err instanceof Error ? err.message : "Failed to generate" });
    }
  }
  return { generated, errors };
}

/** Get PDF buffers for certificates that belong to the batch (for zip download). */
export async function getCertificatePdfBuffersForBatch(
  batchId: string,
  certificateIds: string[]
): Promise<Array<{ certificateId: string; buffer: Buffer }>> {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const certs = await CertificateModel.find({
    certificateId: { $in: certificateIds },
    batchId: batchMongoId,
    status: CERTIFICATE_STATUS.ISSUED,
  })
    .select("certificateId")
    .lean()
    .exec();
  const result: Array<{ certificateId: string; buffer: Buffer }> = [];
  for (const c of certs) {
    const buffer = await generateCertificatePdfBuffer(c.certificateId);
    if (buffer) result.push({ certificateId: c.certificateId, buffer });
  }
  return result;
}
