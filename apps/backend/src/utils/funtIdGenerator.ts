
import { CounterModel } from "../models/Counter.model.js";

const YY = () => String(new Date().getFullYear()).slice(-2);

export const STUDENT_ID_PREFIX = "FS";
export const TRAINER_ID_PREFIX = "TR";
export const ADMIN_ID_PREFIX = "AD";
export const SUPER_ADMIN_ID_PREFIX = "SAD";
export const PARENT_ID_SUFFIX = "PR";
export const CERTIFICATE_ID_PREFIX = "CERT";
export const BATCH_ID_PREFIX = "BT";
export const COURSE_ID_PREFIX = "CRS";
export const ASSIGNMENT_ID_PREFIX = "ASG";
export const MODULE_ID_PREFIX = "MOD";
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

export async function generateStudentId(): Promise<string> {
  const key = `student_${YY()}`;
  const seq = await nextSeq(key);
  return `${STUDENT_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export async function generateTrainerId(): Promise<string> {
  const key = `trainer_${YY()}`;
  const seq = await nextSeq(key);
  return `${TRAINER_ID_PREFIX}-${YY()}-${PAD(seq, 4)}`;
}

export async function generateAdminId(): Promise<string> {
  const key = `admin_${YY()}`;
  const seq = await nextSeq(key);
  return `${ADMIN_ID_PREFIX}-${YY()}-${PAD(seq, 4)}`;
}

export async function generateSuperAdminId(): Promise<string> {
  const key = `superadmin_${YY()}`;
  const seq = await nextSeq(key);
  return `${SUPER_ADMIN_ID_PREFIX}-${YY()}-${PAD(seq, 2)}`;
}

export function parentIdFromStudentId(studentFuntId: string): string {
  return studentFuntId + PARENT_ID_SUFFIX;
}

export async function generateCertificateId(): Promise<string> {
  const key = `cert_${YY()}`;
  const seq = await nextSeq(key);
  return `${CERTIFICATE_ID_PREFIX}-${YY()}-${PAD(seq, 6)}`;
}

export async function generateBatchId(): Promise<string> {
  const key = `batch_${YY()}`;
  const seq = await nextSeq(key);
  return `${BATCH_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export async function generateCourseId(): Promise<string> {
  const key = `course_${YY()}`;
  const seq = await nextSeq(key);
  return `${COURSE_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export async function generateAssignmentId(): Promise<string> {
  const key = `assignment_${YY()}`;
  const seq = await nextSeq(key);
  return `${ASSIGNMENT_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export async function generateModuleId(): Promise<string> {
  const key = `module_${YY()}`;
  const seq = await nextSeq(key);
  return `${MODULE_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export async function generateSubmissionId(): Promise<string> {
  const key = `submission_${YY()}`;
  const seq = await nextSeq(key);
  return `${SUBMISSION_ID_PREFIX}-${YY()}-${PAD(seq, 8)}`;
}
