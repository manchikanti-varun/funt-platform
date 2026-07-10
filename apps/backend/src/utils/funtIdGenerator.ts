
import { CounterModel } from "../models/Counter.model.js";

const YY = () => String(new Date().getFullYear()).slice(-2);

export const CERTIFICATE_ID_PREFIX = "CERT";
export const BATCH_ID_PREFIX = "BT";
export const COURSE_ID_PREFIX = "CRS";
export const ASSIGNMENT_ID_PREFIX = "ASG";
export const MODULE_ID_PREFIX = "MOD";
export const SUBMISSION_ID_PREFIX = "SUB";
export const USER_ID_PREFIX = "USR";

const PAD = (n: number, len: number) => String(n).padStart(len, "0");

async function nextSeq(key: string): Promise<number> {
  const doc = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).exec();
  if (!doc || typeof doc.seq !== "number") {
    throw new Error(`Counter missing or invalid for key: ${key}`);
  }
  return doc.seq;
}

export async function generateCertificateId(): Promise<string> {
  const key = `cert_${YY()}`;
  const seq = await nextSeq(key);
  return `${CERTIFICATE_ID_PREFIX}-${YY()}-${PAD(seq, 6)}`;
}

export async function generateBatchId(): Promise<string> {
  const key = "batch_global";
  const seq = await nextSeq(key);
  return `${BATCH_ID_PREFIX}-${PAD(seq, 6)}`;
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

export const MILESTONE_ID_PREFIX = "MS";

export async function generateUserFuntId(): Promise<string> {
  const key = `user_${YY()}`;
  const seq = await nextSeq(key);
  return `${USER_ID_PREFIX}-${YY()}-${PAD(seq, 8)}`;
}

export async function generateMilestoneId(): Promise<string> {
  const key = `milestone_${YY()}`;
  const seq = await nextSeq(key);
  return `${MILESTONE_ID_PREFIX}-${YY()}-${PAD(seq, 6)}`;
}

export const PROMISE_ID_PREFIX = "PRM";

export async function generatePromiseId(): Promise<string> {
  const key = `promise_${YY()}`;
  const seq = await nextSeq(key);
  return `${PROMISE_ID_PREFIX}-${YY()}-${PAD(seq, 6)}`;
}

export const QUIZ_ID_PREFIX = "QZ";

export async function generateQuizId(): Promise<string> {
  const key = `quiz_${YY()}`;
  const seq = await nextSeq(key);
  return `${QUIZ_ID_PREFIX}-${YY()}-${PAD(seq, 5)}`;
}

export const QUIZ_ATTEMPT_ID_PREFIX = "QA";

export async function generateQuizAttemptId(): Promise<string> {
  const key = `quiz_attempt_${YY()}`;
  const seq = await nextSeq(key);
  return `${QUIZ_ATTEMPT_ID_PREFIX}-${YY()}-${PAD(seq, 8)}`;
}

export const LETTER_ID_PREFIX = "LTR";

export async function generateLetterId(): Promise<string> {
  const key = "letter_global";
  const seq = await nextSeq(key);
  return `${LETTER_ID_PREFIX}-${PAD(seq, 6)}`;
}
