/**
 * FUNT ID generation using database counter (except Parent).
 * Formats: Student FS-YY-XXXXX | Trainer TR-YY-XXXX | Admin AD-YY-XXXX
 *          Super Admin SAD-YY-XX | Parent = student ID + "PR" | Certificate CERT-YY-XXXXXX
 *          Batch BT-YY-XXXX
 * IDs are unique, not editable, and never reused.
 */

import { CounterModel } from "../models/Counter.model.js";

const YY = () => String(new Date().getFullYear()).slice(-2);

/** Prefix for student IDs: FS-YY-XXXXX */
export const STUDENT_ID_PREFIX = "FS";
/** Prefix for trainer IDs: TR-YY-XXXX */
export const TRAINER_ID_PREFIX = "TR";
/** Prefix for admin IDs: AD-YY-XXXX */
export const ADMIN_ID_PREFIX = "AD";
/** Prefix for super admin IDs: SAD-YY-XX */
export const SUPER_ADMIN_ID_PREFIX = "SAD";
/** Parent ID = student FUNT ID + this suffix. No counter. */
export const PARENT_ID_SUFFIX = "PR";
/** Prefix for certificate IDs: CERT-YY-XXXXXX */
export const CERTIFICATE_ID_PREFIX = "CERT";
/** Prefix for batch IDs: BT-YY-XXXXX */
export const BATCH_ID_PREFIX = "BT";
/** Prefix for course IDs: CRS-YY-XXXXX */
export const COURSE_ID_PREFIX = "CRS";
/** Prefix for global assignment IDs: ASG-YY-XXXXX */
export const ASSIGNMENT_ID_PREFIX = "ASG";
/** Prefix for global module IDs: MOD-YY-XXXXX */
export const MODULE_ID_PREFIX = "MOD";
/** Prefix for assignment submission IDs: SUB-YY-XXXXXXXX */
export const SUBMISSION_ID_PREFIX = "SUB";

const PAD = (n: number, len: number) => String(n).padStart(len, "0");

async function nextSeq(key: string): Promise<number> {
  const doc = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).exec();
  return doc.seq;
}

/** Student → FS-YY-XXXXX */
export async function generateStudentId(): Promise<string> {
  const key = `student_${YY()}`;
  const seq = await nextSeq(key);
  return `${STUDENT_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

/** Trainer → TR-YY-XXXX */
export async function generateTrainerId(): Promise<string> {
  const key = `trainer_${YY()}`;
  const seq = await nextSeq(key);
  return `${TRAINER_ID_PREFIX}-${YY()}-${PAD(seq, 4)}`;
}

/** Admin → AD-YY-XXXX */
export async function generateAdminId(): Promise<string> {
  const key = `admin_${YY()}`;
  const seq = await nextSeq(key);
  return `${ADMIN_ID_PREFIX}-${YY()}-${PAD(seq, 4)}`;
}

/** Super Admin → SAD-YY-XX */
export async function generateSuperAdminId(): Promise<string> {
  const key = `superadmin_${YY()}`;
  const seq = await nextSeq(key);
  return `${SUPER_ADMIN_ID_PREFIX}-${YY()}-${PAD(seq, 2)}`;
}

/** Parent ID = student FUNT ID + "PR". No other logic. */
export function parentIdFromStudentId(studentFuntId: string): string {
  return studentFuntId + PARENT_ID_SUFFIX;
}

/** Certificate → CERT-YY-XXXXXX */
export async function generateCertificateId(): Promise<string> {
  const key = `cert_${YY()}`;
  const seq = await nextSeq(key);
  return `${CERTIFICATE_ID_PREFIX}-${YY()}-${PAD(seq, 6)}`;
}

/** Batch → BT-YY-XXXXX (unique batch ID, like student FUNT ID) */
export async function generateBatchId(): Promise<string> {
  const key = `batch_${YY()}`;
  const seq = await nextSeq(key);
  return `${BATCH_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

/** Course → CRS-YY-XXXXX (global course) */
export async function generateCourseId(): Promise<string> {
  const key = `course_${YY()}`;
  const seq = await nextSeq(key);
  return `${COURSE_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

/** Global assignment → ASG-YY-XXXXX */
export async function generateAssignmentId(): Promise<string> {
  const key = `assignment_${YY()}`;
  const seq = await nextSeq(key);
  return `${ASSIGNMENT_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

/** Global module → MOD-YY-XXXXX */
export async function generateModuleId(): Promise<string> {
  const key = `module_${YY()}`;
  const seq = await nextSeq(key);
  return `${MODULE_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

/** Assignment submission → SUB-YY-XXXXXXXX */
export async function generateSubmissionId(): Promise<string> {
  const key = `submission_${YY()}`;
  const seq = await nextSeq(key);
  return `${SUBMISSION_ID_PREFIX}-${YY()}-${PAD(seq, 8)}`;
}
