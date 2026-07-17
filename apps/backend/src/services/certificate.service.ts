
import { CertificateModel } from "../models/Certificate.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { UserModel } from "../models/User.model.js";
import { grantCoinsWithExpiry } from "./coinBalance.service.js";
import { ENROLLMENT_STATUS, CERTIFICATE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { generateCertificateId } from "../utils/funtIdGenerator.js";
import { ensureFirstCourseCompletedBadge, awardBadge } from "./achievement.service.js";
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

  const completedCount = await ChapterProgressModel.countDocuments({
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

  // Check final quiz requirement (if configured on the course snapshot)
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const firstSnap = snapshots[0] as { finalQuizId?: string; finalQuizRequiredForCertificate?: boolean; courseId?: string } | undefined;
  if (firstSnap?.finalQuizRequiredForCertificate && firstSnap.finalQuizId) {
    const { hasStudentPassedQuiz } = await import("./quiz.service.js");
    const courseId = firstSnap.courseId ?? "";
    const passed = await hasStudentPassedQuiz(studentId, firstSnap.finalQuizId, batchMongoId, courseId);
    if (!passed) {
      return { eligible: false, reason: "Final quiz not passed" };
    }
  }

  return { eligible: true };
}

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
    const coinReward = c.coinReward ?? 0;
    const grantedAt = c.coinRewardGrantedAt ?? null;
    return {
      certificateId: c.certificateId,
      batchId: c.batchId,
      courseId: c.courseId,
      courseName,
      issuedAt: c.issuedAt,
      coinReward,
      coinRewardGrantedAt: grantedAt,
      coinRewardPending: coinReward > 0 && !grantedAt,
    };
  });
}

function getFirstSnapshotCourseId(batch: unknown): string {
  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const first = snapshots[0] as { courseId?: string } | undefined;
  return first?.courseId ?? "";
}

/** Completion coins live on each course snapshot in the batch (like fee). Legacy batches may only have root `completionRewardCoins` for the first course. */
function getCompletionRewardCoinsForCertificate(batch: unknown, certCourseId: string): number {
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  if (snaps.length === 0) return 0;
  const snap =
    (snaps.find((s) => String((s as { courseId?: string }).courseId ?? "") === String(certCourseId ?? "")) ??
      snaps[0]) as { courseId?: string; completionRewardCoins?: unknown };
  const raw = snap?.completionRewardCoins;
  if (raw !== undefined && raw !== null && String(raw) !== "") {
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n >= 0) return Math.min(1_000_000, n);
  }
  const legacy = Math.max(0, Math.floor(Number((batch as { completionRewardCoins?: number }).completionRewardCoins ?? 0)));
  const first = snaps[0] as { courseId?: string } | undefined;
  if (legacy > 0 && String(first?.courseId ?? "") === String(certCourseId)) return legacy;
  return 0;
}

function getCompletionBadgeTypesForCertificate(batch: unknown, certCourseId: string): string[] {
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  if (snaps.length === 0) return [];
  const snap =
    (snaps.find((s) => String((s as { courseId?: string }).courseId ?? "") === String(certCourseId ?? "")) ??
      snaps[0]) as { completionBadgeTypes?: unknown };
  const raw = (snap as { completionBadgeTypes?: unknown }).completionBadgeTypes;
  const arr = Array.isArray(raw) ? raw : [];
  return [...new Set(arr.map((x) => String(x ?? "").trim().toUpperCase()).filter(Boolean))];
}

async function issueCertificateDocument(
  studentId: string,
  batchId: string,
  issuedBy: string,
  opts?: { coinReward?: number }
) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const courseId =
    getFirstSnapshotCourseId(batch) ||
    (batch.courseSnapshot as { courseId?: string } | undefined)?.courseId ||
    "";
  if (!courseId) throw new AppError("Batch has no course", 400);

  let coinReward = 0;
  if (opts?.coinReward != null) {
    const n = Math.floor(Number(opts.coinReward));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new AppError("coinReward must be 0–1,000,000", 400);
    coinReward = n;
  }

  const certificateId = await generateCertificateId();
  const doc = await CertificateModel.create({
    certificateId,
    studentId,
    courseId,
    batchId: batchMongoId,
    issuedAt: new Date(),
    issuedBy,
    status: CERTIFICATE_STATUS.ISSUED,
    coinReward,
  });

  const completionRewardCoins = getCompletionRewardCoinsForCertificate(batch, courseId);
  if (completionRewardCoins > 0) {
    await grantCoinsWithExpiry(studentId, completionRewardCoins, "BATCH_COMPLETION", doc.certificateId);
  }
  const completionBadges = getCompletionBadgeTypesForCertificate(batch, courseId);
  if (completionBadges.length > 0) {
    for (const bt of completionBadges) {
      await awardBadge(studentId, bt, { batchId: batchMongoId, courseId, certificateId: doc.certificateId }, "auto").catch(() => {});
    }
  }

  await createAuditLog("CERTIFICATE_GENERATED", issuedBy, "Certificate", String(doc._id));
  await ensureFirstCourseCompletedBadge(studentId, batchMongoId).catch(() => {});
  await UserModel.updateOne({ _id: studentId }, { $inc: { studentLevel: 1 } }).exec();

  // Notify student that their certificate has been issued
  const batchForNotif = await BatchModel.findById(batchMongoId).select("courseSnapshots courseSnapshot").lean().exec();
  const courseName = batchForNotif
    ? (getBatchCourseSnapshots(batchForNotif as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { title?: string } | undefined)?.title ?? "Course"
    : "Course";
  await createNotification({
    userId: studentId,
    title: "Certificate Issued! 🎉",
    body: `Congratulations! Your certificate for ${courseName} has been issued. View it in your certificates section.`,
    type: "CERTIFICATE_ISSUED",
    referenceId: String(doc._id),
  }).catch(() => {});

  return {
    id: String(doc._id),
    certificateId: doc.certificateId,
    studentId: doc.studentId,
    courseId: doc.courseId,
    batchId: doc.batchId,
    issuedAt: doc.issuedAt,
    issuedBy: doc.issuedBy,
    status: doc.status,
    coinReward: doc.coinReward ?? 0,
    coinRewardGrantedAt: doc.coinRewardGrantedAt ?? null,
  };
}

export async function generateCertificate(
  studentId: string,
  batchId: string,
  issuedBy: string,
  opts?: { coinReward?: number }
) {
  const { eligible, reason } = await checkEligibility(studentId, batchId);
  if (!eligible) throw new AppError(reason ?? "Not eligible for certificate", 400);
  return issueCertificateDocument(studentId, batchId, issuedBy, opts);
}

/**
 * Same persistence as {@link generateCertificate} but skips eligibility checks.
 * For local scripts that replace an existing issued row (e.g. PDF testing). Disabled in production.
 */
export async function reissueCertificateWithoutEligibilityDev(
  studentId: string,
  batchId: string,
  issuedBy: string,
  opts?: { coinReward?: number }
) {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") {
    throw new AppError("reissueCertificateWithoutEligibilityDev is disabled in production", 403);
  }
  return issueCertificateDocument(studentId, batchId, issuedBy, opts);
}

export async function setCertificateCoinReward(certificateId: string, coinReward: number, actorId: string) {
  const n = Math.floor(Number(coinReward));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new AppError("coinReward must be 0–1,000,000", 400);
  const cert = await CertificateModel.findOne({ certificateId, status: CERTIFICATE_STATUS.ISSUED }).exec();
  if (!cert) throw new AppError("Certificate not found", 404);
  if (cert.coinRewardGrantedAt) throw new AppError("Cannot change reward after coins were granted", 400);
  cert.coinReward = n;
  await cert.save();
  await createAuditLog("CERTIFICATE_COIN_REWARD_SET", actorId, "Certificate", certificateId);
  return { certificateId, coinReward: cert.coinReward };
}

export async function grantCertificateCoinReward(certificateId: string, grantedBy: string) {
  const cert = await CertificateModel.findOne({ certificateId, status: CERTIFICATE_STATUS.ISSUED }).exec();
  if (!cert) throw new AppError("Certificate not found", 404);
  if (cert.coinRewardGrantedAt) throw new AppError("Coin reward already granted", 400);
  const amount = cert.coinReward ?? 0;
  if (amount < 1) throw new AppError("Set a coin reward greater than 0 before granting", 400);
  await grantCoinsWithExpiry(cert.studentId, amount, "CERTIFICATE_GRANT", certificateId);
  cert.coinRewardGrantedAt = new Date();
  cert.coinRewardGrantedBy = grantedBy;
  await cert.save();
  await createAuditLog("CERTIFICATE_COINS_GRANTED", grantedBy, "Certificate", certificateId);
  return { certificateId, grantedCoins: amount, studentId: cert.studentId };
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
    BatchModel.findById(cert.batchId).select("courseSnapshot courseSnapshots startDate endDate").lean().exec(),
  ]);
  const courseName = batch
    ? (getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { title?: string } | undefined)?.title ?? "Course"
    : "Course";
  const snapshotDuration =
    batch
      ? String(
          ((getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0])[0] as { durationText?: string } | undefined)
            ?.durationText ?? "")
        ).trim()
      : "";
  const startDate = (batch as { startDate?: Date } | null)?.startDate;
  const endDate = (batch as { endDate?: Date } | null)?.endDate;
  const fallbackDuration =
    startDate && endDate
      ? `${Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} days`
      : startDate
        ? `From ${new Date(startDate).toLocaleDateString()}`
        : "—";
  const durationText = snapshotDuration || fallbackDuration;

  return {
    certificateId: cert.certificateId,
    studentName: student?.name ?? "Student",
    courseName,
    issuedAt: cert.issuedAt,
    durationText,
  };
}

export async function generateCertificatePdfBuffer(certificateId: string): Promise<Buffer | null> {
  const data = await getCertificateDataForPdf(certificateId);
  if (!data) return null;
  const { generateCertificatePdf } = await import("../utils/pdfCertificate.js");
  return generateCertificatePdf({
    certificateId: data.certificateId,
    studentName: data.studentName,
    courseName: data.courseName,
    issuedAt: data.issuedAt,
    durationText: data.durationText,
  });
}

export async function listStudentsWithCertificateStatus(batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const modules = getFirstSnapshotModules(batch);
  const totalModules = modules.length;
  const { listEnrollmentsByBatch } = await import("./enrollment.service.js");
  const [enrollmentResult, certs, progressDocs] = await Promise.all([
    listEnrollmentsByBatch(batchId, 1, 10000),
    CertificateModel.find({ batchId: batchMongoId, status: CERTIFICATE_STATUS.ISSUED })
      .select("studentId certificateId coinReward coinRewardGrantedAt")
      .lean()
      .exec(),
    ChapterProgressModel.find({ batchId: batchMongoId })
      .select("studentId completedAt")
      .lean()
      .exec(),
  ]);
  const enrollments = enrollmentResult.rows;
  const completedByStudent = new Map<string, number>();
  for (const p of progressDocs) {
    if (p.completedAt != null) {
      completedByStudent.set(p.studentId, (completedByStudent.get(p.studentId) ?? 0) + 1);
    }
  }
  const certMetaByStudent = new Map(
    certs.map((c) => [
      c.studentId,
      {
        certificateId: c.certificateId as string,
        coinReward: (c as { coinReward?: number }).coinReward ?? 0,
        coinRewardGrantedAt: (c as { coinRewardGrantedAt?: Date | null }).coinRewardGrantedAt ?? null,
      },
    ])
  );

  const result: Array<{
    studentId: string;
    username: string;
    name: string;
    certificateId: string | null;
    coinReward: number;
    coinRewardGrantedAt: Date | null;
    coinRewardPending: boolean;
    eligible: boolean;
    reason?: string;
    modulesCompleted: number;
    totalModules: number;
    progressPercent: number;
  }> = [];
  for (const e of enrollments) {
    const meta = certMetaByStudent.get(e.studentId);
    const certId = meta?.certificateId ?? null;
    const coinReward = meta?.coinReward ?? 0;
    const coinRewardGrantedAt = meta?.coinRewardGrantedAt ?? null;
    const { eligible, reason } = await checkEligibility(e.studentId, batchId);
    const modulesCompleted = completedByStudent.get(e.studentId) ?? 0;
    const progressPercent = totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 100) : 0;
    result.push({
      studentId: e.studentId,
      username: e.username,
      name: e.name,
      certificateId: certId,
      coinReward,
      coinRewardGrantedAt,
      coinRewardPending: certId !== null && coinReward > 0 && !coinRewardGrantedAt,
      eligible: certId !== null ? true : eligible,
      reason: certId === null && !eligible ? reason : undefined,
      modulesCompleted,
      totalModules,
      progressPercent,
    });
  }
  return result;
}

export async function bulkGenerateCertificates(
  batchId: string,
  studentIds: string[],
  issuedBy: string,
  opts?: { coinReward?: number }
): Promise<{ generated: Array<{ studentId: string; certificateId: string }>; errors: Array<{ studentId: string; message: string }> }> {
  const generated: Array<{ studentId: string; certificateId: string }> = [];
  const errors: Array<{ studentId: string; message: string }> = [];
  for (const studentId of studentIds) {
    try {
      const data = await generateCertificate(studentId, batchId, issuedBy, opts);
      generated.push({ studentId, certificateId: data.certificateId });
    } catch (err) {
      errors.push({ studentId, message: err instanceof Error ? err.message : "Failed to generate" });
    }
  }
  return { generated, errors };
}

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
