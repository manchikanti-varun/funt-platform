/**
 * General (event) attendance – create event, mark present by FUNT IDs, list events.
 */

import { GeneralAttendanceModel } from "../models/GeneralAttendance.model.js";
import { UserModel } from "../models/User.model.js";
import { resolveFuntIdsToStudentIds } from "./attendance.service.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";

export interface CreateGeneralAttendanceInput {
  eventDate: string | Date;
  title?: string;
  funtIdsOrUserIds: string[];
  markedBy: string;
}

export async function createGeneralAttendance(input: CreateGeneralAttendanceInput) {
  if (!input.eventDate) throw new AppError("eventDate is required", 400);
  const { studentIds, notFound } = await resolveFuntIdsToStudentIds(input.funtIdsOrUserIds);
  if (studentIds.length === 0) throw new AppError("No valid FUNT IDs or user IDs found", 400);
  const d = new Date(input.eventDate);
  const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const doc = await GeneralAttendanceModel.create({
    eventDate,
    title: input.title?.trim() || undefined,
    markedBy: input.markedBy,
    presentStudentIds: studentIds,
  });
  await createAuditLog("GENERAL_ATTENDANCE_CREATED", input.markedBy, "GeneralAttendance", String(doc._id));
  return {
    id: String(doc._id),
    eventDate: doc.eventDate,
    title: doc.title,
    markedBy: doc.markedBy,
    presentCount: doc.presentStudentIds.length,
    notFound: notFound.length ? notFound : undefined,
    createdAt: doc.createdAt,
  };
}

export async function listGeneralAttendance() {
  const list = await GeneralAttendanceModel.find({}).sort({ eventDate: -1 }).lean().exec();
  return list.map((d) => ({
    id: String(d._id),
    eventDate: d.eventDate,
    title: d.title,
    markedBy: d.markedBy,
    presentCount: d.presentStudentIds.length,
    createdAt: d.createdAt,
  }));
}

export async function getGeneralAttendanceById(id: string) {
  const doc = await GeneralAttendanceModel.findById(id).lean().exec();
  if (!doc) throw new AppError("Event not found", 404);
  const userIds = doc.presentStudentIds;
  const users = await UserModel.find({ _id: { $in: userIds } }).select("_id funtId name").lean().exec();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const presentStudents = doc.presentStudentIds.map((id) => {
    const u = userMap.get(id);
    return {
      studentId: id,
      funtId: (u as { funtId?: string } | undefined)?.funtId ?? "",
      name: (u as { name?: string } | undefined)?.name ?? "",
    };
  });
  return {
    id: String(doc._id),
    eventDate: doc.eventDate,
    title: doc.title,
    markedBy: doc.markedBy,
    presentStudents,
    createdAt: doc.createdAt,
  };
}

/** Add more students as present to an existing event. No duplicates for already-marked. */
export async function addPresentToGeneralAttendance(
  eventId: string,
  funtIdsOrUserIds: string[],
  _performedBy: string
) {
  const doc = await GeneralAttendanceModel.findById(eventId).exec();
  if (!doc) throw new AppError("Event not found", 404);
  const { studentIds, notFound } = await resolveFuntIdsToStudentIds(funtIdsOrUserIds);
  const existingSet = new Set(doc.presentStudentIds.map((id) => String(id)));
  const alreadyMarkedCount = studentIds.filter((id) => existingSet.has(id)).length;
  const toAdd = studentIds.filter((id) => !existingSet.has(id));
  if (toAdd.length > 0) {
    const merged = [...doc.presentStudentIds, ...toAdd];
    doc.presentStudentIds = merged;
    await doc.save();
  }
  return {
    id: String(doc._id),
    eventDate: doc.eventDate,
    title: doc.title,
    markedBy: doc.markedBy,
    presentCount: doc.presentStudentIds.length,
    addedCount: toAdd.length,
    alreadyMarkedCount,
    notFound: notFound.length ? notFound : undefined,
  };
}

/** List events where the given student was present (for student-facing "my general attendance"). */
export async function getMyGeneralAttendance(studentId: string) {
  const list = await GeneralAttendanceModel.find({ presentStudentIds: studentId })
    .sort({ eventDate: -1 })
    .lean()
    .exec();
  return list.map((d) => ({
    id: String(d._id),
    eventDate: d.eventDate,
    title: d.title,
  }));
}
