/**
 * Attendance service – mark session, list by batch, student's own stats.
 */

import { AttendanceModel } from "../models/Attendance.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { UserModel } from "../models/User.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { findBatchByParam } from "./batch.service.js";
import { listEnrollmentsByBatch } from "./enrollment.service.js";
import { ATTENDANCE_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/** Resolve FUNT IDs or user IDs to a list of user IDs. Returns { resolvedIds, notFound }. */
export async function resolveFuntIdsToStudentIds(
  identifiers: string[]
): Promise<{ studentIds: string[]; notFound: string[] }> {
  const trimmed = [...new Set(identifiers.map((s) => s.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { studentIds: [], notFound: [] };
  const objectIds = trimmed.filter((id) => OBJECT_ID_REGEX.test(id));
  const funtIds = trimmed.filter((id) => !OBJECT_ID_REGEX.test(id));
  const users = await UserModel.find({
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(funtIds.length ? [{ funtId: { $in: funtIds } }] : []),
    ].filter(Boolean),
  })
    .select("_id funtId")
    .lean()
    .exec();
  const resolved = new Set(users.map((u) => String(u._id)));
  const notFound = trimmed.filter((id) => {
    if (OBJECT_ID_REGEX.test(id)) return !resolved.has(id);
    return !users.some((u) => (u as { funtId?: string }).funtId === id);
  });
  return { studentIds: Array.from(resolved), notFound };
}

export interface MarkAttendanceInput {
  batchId: string;
  sessionDate: string | Date;
  attendanceRecords: Array<{ studentId: string; status: "PRESENT" | "ABSENT" }>;
  markedBy: string;
  /** If true, allow editing even when session was created by another user (Super Admin override). */
  isSuperAdminOverride?: boolean;
}

export async function markAttendance(input: MarkAttendanceInput) {
  if (!input.batchId || !input.sessionDate) throw new AppError("batchId and sessionDate are required", 400);
  if (!Array.isArray(input.attendanceRecords) || input.attendanceRecords.length === 0) {
    throw new AppError("attendanceRecords must be a non-empty array", 400);
  }

  const batch = await findBatchByParam(input.batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const validStatuses = Object.values(ATTENDANCE_STATUS);
  const records = input.attendanceRecords.map((r) => {
    if (!validStatuses.includes(r.status as ATTENDANCE_STATUS)) throw new AppError(`Invalid status: ${r.status}`, 400);
    return { studentId: r.studentId, status: r.status as ATTENDANCE_STATUS };
  });

  const d = new Date(input.sessionDate);
  const sessionDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const existing = await AttendanceModel.findOne({ batchId: batchMongoId, sessionDate }).lean().exec();
  if (existing && existing.markedBy !== input.markedBy && !input.isSuperAdminOverride) {
    throw new AppError("Only the session creator or Super Admin can edit this attendance session", 403);
  }
  const doc = await AttendanceModel.findOneAndUpdate(
    { batchId: batchMongoId, sessionDate },
    { $set: { batchId: batchMongoId, sessionDate, markedBy: input.markedBy, attendanceRecords: records } },
    { new: true, upsert: true }
  ).exec();
  if (!doc) throw new AppError("Failed to save attendance", 500);
  await createAuditLog("ATTENDANCE_MARKED", input.markedBy, "Attendance", String(doc._id));
  return {
    id: String(doc._id),
    batchId: doc.batchId,
    sessionDate: doc.sessionDate,
    markedBy: doc.markedBy,
    attendanceRecords: doc.attendanceRecords,
    createdAt: doc.createdAt,
  };
}

export async function getAttendanceForBatch(batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const list = await AttendanceModel.find({ batchId: batchMongoId }).sort({ sessionDate: -1 }).lean().exec();
  return list.map((d) => ({
    id: String(d._id),
    batchId: d.batchId,
    sessionDate: d.sessionDate,
    markedBy: d.markedBy,
    attendanceRecords: d.attendanceRecords,
    createdAt: d.createdAt,
  }));
}

export async function getMyAttendance(studentId: string) {
  const enrollments = await EnrollmentModel.find({ studentId }).lean().exec();
  const batchIds = enrollments.map((e) => e.batchId);
  const sessions = await AttendanceModel.find({ batchId: { $in: batchIds } })
    .sort({ sessionDate: -1 })
    .lean()
    .exec();

  const byBatch = new Map<string, { attendedDates: string[]; totalSessions: number; presentCount: number }>();

  for (const s of sessions) {
    const key = s.batchId;
    if (!byBatch.has(key)) {
      byBatch.set(key, { attendedDates: [], totalSessions: 0, presentCount: 0 });
    }
    const stat = byBatch.get(key)!;
    stat.totalSessions += 1;
    const record = s.attendanceRecords.find((r) => r.studentId === studentId);
    if (record) {
      stat.attendedDates.push(new Date(s.sessionDate).toISOString().slice(0, 10));
      if (record.status === ATTENDANCE_STATUS.PRESENT) stat.presentCount += 1;
    }
  }

  const batchIdKeys = Array.from(byBatch.keys());
  const batchDocs = await BatchModel.find({ _id: { $in: batchIdKeys } })
    .select("_id name batchId")
    .lean()
    .exec();
  const batchMeta = new Map(
    batchDocs.map((b) => [
      String(b._id),
      {
        name: (b as { name?: string }).name ?? "",
        code: (b as { batchId?: string }).batchId ?? "",
      },
    ])
  );

  return Array.from(byBatch.entries()).map(([batchId, stat]) => {
    const meta = batchMeta.get(batchId) ?? { name: "", code: "" };
    return {
      batchId,
      batchName: meta.name || undefined,
      batchCode: meta.code || undefined,
      attendedDates: stat.attendedDates,
      totalSessions: stat.totalSessions,
      presentCount: stat.presentCount,
      percentage: stat.totalSessions > 0 ? Math.round((stat.presentCount / stat.totalSessions) * 100) : 0,
    };
  });
}

/** Mark batch attendance by pasting FUNT IDs (or user IDs). Only listed students are marked PRESENT. */
export async function markBatchAttendanceByFuntIds(
  batchId: string,
  sessionDate: string | Date,
  funtIdsOrUserIds: string[],
  markedBy: string,
  isSuperAdminOverride?: boolean
) {
  const { studentIds, notFound } = await resolveFuntIdsToStudentIds(funtIdsOrUserIds);
  if (studentIds.length === 0) throw new AppError("No valid FUNT IDs or user IDs found", 400);
  const attendanceRecords = studentIds.map((studentId) => ({
    studentId,
    status: ATTENDANCE_STATUS.PRESENT as const,
  }));
  const result = await markAttendance({
    batchId,
    sessionDate,
    attendanceRecords,
    markedBy,
    isSuperAdminOverride,
  });
  return { ...result, notFound: notFound.length ? notFound : undefined };
}

/** Add more students as present to an existing batch session. No duplicates for already-marked. */
export async function addPresentToBatchSession(
  batchId: string,
  sessionDate: string | Date,
  funtIdsOrUserIds: string[],
  markedBy: string,
  isSuperAdminOverride?: boolean
) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  const d = new Date(sessionDate);
  const sessionDateNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const existing = await AttendanceModel.findOne({ batchId: batchMongoId, sessionDate: sessionDateNorm }).lean().exec();
  if (!existing) throw new AppError("No attendance session for this date. Mark attendance first, then use Edit to add more.", 404);
  if (existing.markedBy !== markedBy && !isSuperAdminOverride) {
    throw new AppError("Only the session creator or Super Admin can add to this session", 403);
  }
  const { studentIds, notFound } = await resolveFuntIdsToStudentIds(funtIdsOrUserIds);
  const existingPresentSet = new Set(
    existing.attendanceRecords.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).map((r) => r.studentId)
  );
  const alreadyMarkedCount = studentIds.filter((id) => existingPresentSet.has(id)).length;
  const toAdd = studentIds.filter((id) => !existingPresentSet.has(id));
  if (toAdd.length === 0 && notFound.length === 0) {
    return {
      id: String(existing._id),
      batchId: existing.batchId,
      sessionDate: existing.sessionDate,
      markedBy: existing.markedBy,
      attendanceRecords: existing.attendanceRecords,
      createdAt: existing.createdAt,
      addedCount: 0,
      alreadyMarkedCount,
      notFound: undefined,
    };
  }
  const byStudent = new Map<string, { studentId: string; status: ATTENDANCE_STATUS }>(
    existing.attendanceRecords.map((r) => [r.studentId, { studentId: r.studentId, status: r.status as ATTENDANCE_STATUS }])
  );
  for (const studentId of toAdd) {
    byStudent.set(studentId, { studentId, status: ATTENDANCE_STATUS.PRESENT });
  }
  const mergedRecords = Array.from(byStudent.values());
  const result = await markAttendance({
    batchId,
    sessionDate: sessionDateNorm,
    attendanceRecords: mergedRecords,
    markedBy,
    isSuperAdminOverride,
  });
  return {
    ...result,
    addedCount: toAdd.length,
    alreadyMarkedCount,
    notFound: notFound.length ? notFound : undefined,
  };
}

export interface StudentAttendanceSummary {
  studentId: string;
  funtId: string;
  name: string;
  sessions: Array<{ date: string; status: string }>;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

/** Get per-student attendance for a batch (for "individual student attendance" view). */
export async function getAttendanceByStudentsForBatch(batchId: string): Promise<StudentAttendanceSummary[]> {
  const [enrollments, sessions] = await Promise.all([
    listEnrollmentsByBatch(batchId),
    getAttendanceForBatch(batchId),
  ]);
  const studentIds = enrollments.map((e) => e.studentId);
  const byStudent = new Map<
    string,
    { funtId: string; name: string; sessions: Array<{ date: string; status: string }>; presentCount: number }
  >();
  for (const e of enrollments) {
    byStudent.set(e.studentId, {
      funtId: e.funtId,
      name: e.name,
      sessions: [],
      presentCount: 0,
    });
  }
  for (const s of sessions) {
    const dateStr = new Date(s.sessionDate).toISOString().slice(0, 10);
    for (const studentId of studentIds) {
      const rec = s.attendanceRecords.find((r) => r.studentId === studentId);
      const status = rec?.status ?? "ABSENT";
      const row = byStudent.get(studentId);
      if (row) {
        row.sessions.push({ date: dateStr, status });
        if (status === ATTENDANCE_STATUS.PRESENT) row.presentCount += 1;
      }
    }
  }
  const totalSessions = sessions.length;
  return Array.from(byStudent.entries()).map(([studentId, row]) => ({
    studentId,
    funtId: row.funtId,
    name: row.name,
    sessions: row.sessions.sort((a, b) => b.date.localeCompare(a.date)),
    presentCount: row.presentCount,
    totalSessions,
    percentage: totalSessions > 0 ? Math.round((row.presentCount / totalSessions) * 100) : 0,
  }));
}

export interface StudentAttendanceSummaryItem {
  batchId: string;
  batchName: string;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

/** Get attendance summary for a student across all their enrolled batches (for admin profile). */
export async function getAttendanceSummaryForStudent(studentId: string): Promise<StudentAttendanceSummaryItem[]> {
  const { BatchModel } = await import("../models/Batch.model.js");
  const enrollments = await EnrollmentModel.find({ studentId }).select("batchId").lean().exec();
  if (enrollments.length === 0) return [];
  const batchIds = [...new Set(enrollments.map((e) => e.batchId))];
  const batches = await BatchModel.find({ _id: { $in: batchIds } }).select("_id name").lean().exec();
  const batchNameMap = new Map(batches.map((b) => [String(b._id), b.name]));
  const sessionsByBatch = await AttendanceModel.find({ batchId: { $in: batchIds } })
    .select("batchId sessionDate attendanceRecords")
    .lean()
    .exec();
  const byBatch = new Map<string, { present: number; total: number }>();
  for (const batchId of batchIds) {
    byBatch.set(batchId, { present: 0, total: 0 });
  }
  for (const s of sessionsByBatch) {
    const bid = String(s.batchId);
    const row = byBatch.get(bid);
    if (!row) continue;
    row.total += 1;
    const rec = (s.attendanceRecords as Array<{ studentId: string; status: string }>).find((r) => r.studentId === studentId);
    if (rec?.status === ATTENDANCE_STATUS.PRESENT) row.present += 1;
  }
  return batchIds.map((batchId) => {
    const row = byBatch.get(batchId) ?? { present: 0, total: 0 };
    return {
      batchId,
      batchName: batchNameMap.get(batchId) ?? "—",
      presentCount: row.present,
      totalSessions: row.total,
      percentage: row.total > 0 ? Math.round((row.present / row.total) * 100) : 0,
    };
  });
}
