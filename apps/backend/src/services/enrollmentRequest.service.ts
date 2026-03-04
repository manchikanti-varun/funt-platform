
import { EnrollmentRequestModel } from "../models/EnrollmentRequest.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { UserModel } from "../models/User.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import * as enrollmentService from "./enrollment.service.js";
import { ENROLLMENT_STATUS } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

export async function resolveBatchForRequest(batchId?: string, courseId?: string): Promise<string> {
  if (batchId?.trim()) {
    const batch = await findBatchByParam(batchId.trim());
    if (!batch) throw new AppError("Batch not found", 404);
    return String((batch as { _id: unknown })._id);
  }
  if (courseId?.trim()) {
    const cid = courseId.trim();
    const batches = await BatchModel.find({
      $or: [{ "courseSnapshot.courseId": cid }, { "courseSnapshots.courseId": cid }],
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!batches.length) throw new AppError("Course not found", 404);
    const withCreator = batches.find((b) => (b as { createdBy?: string }).createdBy);
    return String((withCreator ?? batches[0])._id);
  }
  throw new AppError("batchId or courseId is required", 400);
}

export async function createEnrollmentRequest(studentId: string, batchIdOrCourseId: { batchId?: string; courseId?: string }) {
  const batchMongoId = await resolveBatchForRequest(batchIdOrCourseId.batchId, batchIdOrCourseId.courseId);

  const batch = await BatchModel.findById(batchMongoId).lean().exec();
  if (!batch) throw new AppError("Batch not found", 404);

  const existingEnrollment = await EnrollmentModel.findOne({
    studentId,
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).exec();
  if (existingEnrollment) throw new AppError("You are already enrolled in this course", 400);

  const existing = await EnrollmentRequestModel.findOne({ studentId, batchId: batchMongoId }).exec();
  if (existing) {
    if (existing.status === "PENDING") {
      return { id: String(existing._id), status: "PENDING", message: "Request already sent" };
    }
    existing.status = "PENDING";
    existing.requestedAt = new Date();
    existing.respondedAt = undefined;
    existing.respondedBy = undefined;
    await existing.save();
    return {
      id: String(existing._id),
      status: "PENDING",
      message: "Enrollment request sent. The course admin will be notified.",
    };
  }

  const doc = await EnrollmentRequestModel.create({
    studentId,
    batchId: batchMongoId,
    status: "PENDING",
    requestedAt: new Date(),
  });

  return {
    id: String(doc._id),
    status: doc.status,
    message: "Enrollment request sent. The course admin will be notified.",
  };
}

export async function listEnrollmentRequestsForAdmin(adminId: string, batchId?: string) {
  const batches = await BatchModel.find({ createdBy: adminId }).lean().exec();
  let batchIds = batches.map((b) => String(b._id));
  if (batchId?.trim()) {
    const batch = await findBatchByParam(batchId.trim());
    const targetId = batch ? String((batch as { _id: unknown })._id) : batchId.trim();
    if (!batchIds.includes(targetId)) return [];
    batchIds = [targetId];
  }
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));

  const requests = await EnrollmentRequestModel.find({
    batchId: { $in: batchIds },
    status: "PENDING",
  })
    .sort({ requestedAt: -1 })
    .lean()
    .exec();

  const studentIds = [...new Set(requests.map((r) => r.studentId))];
  const students = await UserModel.find({ _id: { $in: studentIds } })
    .select("_id funtId name email")
    .lean()
    .exec();
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  return requests.map((r) => {
    const batch = batchMap.get(r.batchId);
    const student = studentMap.get(r.studentId);
    const snapshots = batch ? getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]) : [];
    const firstSnap = snapshots[0] as { title?: string } | undefined;
    const courseTitle = firstSnap?.title ?? "Course";
    return {
      id: String(r._id),
      batchId: r.batchId,
      batchName: (batch as { name?: string })?.name,
      batchFuntId: (batch as { batchId?: string })?.batchId,
      courseTitle,
      studentId: r.studentId,
      studentFuntId: (student as { funtId?: string })?.funtId,
      studentName: (student as { name?: string })?.name,
      studentEmail: (student as { email?: string })?.email,
      requestedAt: r.requestedAt,
    };
  });
}

export async function respondToEnrollmentRequest(
  requestId: string,
  action: "APPROVE" | "REJECT",
  performedBy: string
) {
  const request = await EnrollmentRequestModel.findById(requestId).exec();
  if (!request) throw new AppError("Enrollment request not found", 404);
  if (request.status !== "PENDING") throw new AppError("Request was already processed", 400);

  const batch = await BatchModel.findById(request.batchId).lean().exec();
  if (!batch) throw new AppError("Batch not found", 404);
  const createdBy = (batch as { createdBy?: string }).createdBy ?? "";
  const moderatorIds = (batch as { moderatorIds?: string[] }).moderatorIds ?? [];
  if (createdBy !== performedBy && !moderatorIds.includes(performedBy)) {
    throw new AppError("Only the batch creator or a moderator can approve or reject this request", 403);
  }

  const now = new Date();
  if (action === "APPROVE") {
    await enrollmentService.createEnrollment({
      studentId: request.studentId,
      batchId: request.batchId,
      createdBy: performedBy,
    });
  }
  request.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
  request.respondedAt = now;
  request.respondedBy = performedBy;
  await request.save();

  return {
    id: String(request._id),
    status: request.status,
    message: action === "APPROVE" ? "Enrollment approved" : "Enrollment request rejected",
  };
}
