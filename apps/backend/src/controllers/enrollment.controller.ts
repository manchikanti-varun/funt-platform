
import type { Request, Response } from "express";
import * as enrollmentService from "../services/enrollment.service.js";
import { getBatchCourseForStudent, getCourseForStudentByCourseId, getMyCoursesForStudent, listCoursesForExplore, markChapterComplete, markChapterPartComplete, type ChapterPart } from "../services/studentCourse.service.js";
import * as batchService from "../services/batch.service.js";
import * as globalAssignmentService from "../services/globalAssignment.service.js";
import { submitGlobalAssignment, listGeneralSubmissionsByStudentId } from "../services/globalAssignmentSubmission.service.js";
import { listChapterSubmissionsByStudentId } from "../services/assignmentSubmission.service.js";
import * as enrollmentRequestService from "../services/enrollmentRequest.service.js";
import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { signMediaToken, verifyMediaToken } from "../utils/mediaToken.js";
import { findBatchByParam, getBatchCourseSnapshots } from "../services/batch.service.js";
import { parseYoutubeVideoId } from "../utils/youtubeId.js";
import { isEmbeddableHostedVideoUrl, isGoogleDriveUrl, toGoogleDrivePreviewUrl } from "../utils/googleDriveUrl.js";

function signChapterMedia(
  studentId: string,
  batchId: string,
  courseId: string,
  chapters: Array<{ order?: number; videoUrl?: string; youtubeUrl?: string; [k: string]: unknown }>
) {
  return chapters.map((m, idx) => {
    const order = Number(m.order ?? idx);
    const out: Record<string, unknown> = { ...m };
    if (typeof m.videoUrl === "string" && m.videoUrl.trim()) {
      const token = signMediaToken({
        studentId,
        batchId,
        courseId,
        chapterOrder: order,
        kind: "VIDEO",
      });
      out.videoPlaybackUrl = `/api/student/media/play?token=${encodeURIComponent(token)}`;
      if (isEmbeddableHostedVideoUrl(m.videoUrl)) {
        out.videoIsEmbed = true;
      }
    }
    if (typeof m.youtubeUrl === "string" && m.youtubeUrl.trim()) {
      const ytId = parseYoutubeVideoId(m.youtubeUrl);
      if (ytId) {
        const token = signMediaToken({
          studentId,
          batchId,
          courseId,
          chapterOrder: order,
          kind: "YOUTUBE",
        });
        out.youtubeEmbedUrl = `/api/student/media/play?token=${encodeURIComponent(token)}`;
        out.youtubeVideoId = ytId;
      }
    }
    delete out.videoUrl;
    delete out.youtubeUrl;
    return out;
  });
}

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createEnrollment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { studentId, batchId } = req.body ?? {};
  const data = await enrollmentService.createEnrollment({ studentId, batchId, createdBy });
  successRes(res, data, "Enrollment created", 201);
});

export const postBulkEnrollment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { batchId, studentUsernames } = req.body ?? {};
  if (!batchId) throw new AppError("batchId is required", 400);
  const ids = Array.isArray(studentUsernames) ? studentUsernames : [];
  const data = await enrollmentService.bulkEnroll(batchId, ids, createdBy);
  successRes(res, data, "Bulk enrollment completed", 200);
});

export const getMyEnrollments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await enrollmentService.getMyEnrollments(studentId);
  successRes(res, data);
});

export const getBatchCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const batchId = req.params.batchId;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await getBatchCourseForStudent(studentId, batchId);
  const chapters =
    (data.courseSnapshot?.modules as Array<{ order?: number; videoUrl?: string; youtubeUrl?: string; [k: string]: unknown }> | undefined) ?? [];
  const signedChapters = signChapterMedia(studentId, data.batchId, data.courseId ?? "", chapters);
  successRes(res, {
    ...data,
    courseSnapshot: {
      ...data.courseSnapshot,
      chapters: signedChapters,
      modules: signedChapters,
    },
  });
});

export const getMyCourses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await getMyCoursesForStudent(studentId);
  successRes(res, data);
});

export const getCourseByCourseId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const courseId = req.params.courseId;
  const batchId = req.query.batchId as string | undefined;
  if (!courseId) throw new AppError("courseId is required", 400);
  const data = await getCourseForStudentByCourseId(studentId, courseId, batchId);
  const chapters =
    (data.courseSnapshot?.modules as Array<{ order?: number; videoUrl?: string; youtubeUrl?: string; [k: string]: unknown }> | undefined) ?? [];
  const signedChapters = signChapterMedia(studentId, data.batchId, data.courseId ?? courseId, chapters);
  const safeData = {
    ...data,
    courseSnapshot: {
      ...data.courseSnapshot,
      chapters: signedChapters,
      modules: signedChapters,
    },
  };
  successRes(res, safeData);
});

export const getStudentMediaPlaybackRedirect = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) throw new AppError("token is required", 400);
  const decoded = verifyMediaToken(token);
  if (decoded.uid !== studentId) throw new AppError("Invalid media token", 403);
  const enrollmentData = await getCourseForStudentByCourseId(studentId, decoded.cid, decoded.bid);
  if (!enrollmentData.hasAccess || enrollmentData.accessBlocked) {
    throw new AppError("No access to this media", 403);
  }
  const batch = await findBatchByParam(decoded.bid);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === decoded.cid) ?? (snaps.length === 1 ? snaps[0] : null);
  if (!snap) throw new AppError("Course not found", 404);
  const chapters = Array.isArray((snap as { modules?: unknown[] }).modules) ? (snap as { modules: unknown[] }).modules : [];
  const mod = chapters.find((m, idx) => Number((m as { order?: number }).order ?? idx) === decoded.ord) as
    | { videoUrl?: string; youtubeUrl?: string }
    | undefined;
  if (!mod) throw new AppError("Chapter not found", 404);
  if (decoded.kind === "VIDEO") {
    const src = (mod.videoUrl ?? "").trim();
    if (!src) throw new AppError("Video URL missing", 404);
    const target = isGoogleDriveUrl(src) ? toGoogleDrivePreviewUrl(src) : src;
    res.redirect(302, target);
    return;
  }
  const id = parseYoutubeVideoId(mod.youtubeUrl ?? "");
  if (!id) throw new AppError("YouTube URL invalid", 400);
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
  });
  res.redirect(302, `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`);
});

export const getExploreCourses = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await listCoursesForExplore();
  successRes(res, data);
});

export const getExploreBatches = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await batchService.listAllBatchesForExplore();
  successRes(res, data);
});

export const getGeneralAssignments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await globalAssignmentService.listPublishedForStudent(studentId);
  successRes(res, data);
});

export const getAssignmentForStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assignmentId = req.params.assignmentId;
  const batchId = req.query.batchId as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  const chapterOrderParam = (req.query.chapterOrder as string | undefined) ?? (req.query.moduleOrder as string | undefined);
  if (!assignmentId) throw new AppError("Assignment ID is required", 400);
  let data = await globalAssignmentService.getAssignmentById(assignmentId);
  if (batchId && chapterOrderParam != null) {
    const chapterOrder = parseInt(chapterOrderParam, 10);
    if (!Number.isNaN(chapterOrder)) {
      const overrides = await batchService.getModuleAssignmentOverrides(batchId, courseId ?? undefined, chapterOrder);
      if (overrides) {
        data = {
          ...data,
          title: overrides.title ?? data.title,
          instructions: overrides.instructions ?? data.instructions,
          ...(overrides.submissionType && { submissionType: overrides.submissionType }),
          ...(overrides.skillTags && { skillTags: overrides.skillTags }),
        };
      }
    }
  }
  successRes(res, data);
});

export const postMarkChapterComplete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const batchId = req.params.batchId;
  const chapterOrder = Number(req.body?.chapterOrder ?? req.body?.moduleOrder);
  const part = req.body?.part as ChapterPart | undefined;
  const courseId = req.body?.courseId as string | undefined;
  if (!batchId) throw new AppError("batchId is required", 400);
  if (chapterOrder === undefined || Number.isNaN(chapterOrder) || chapterOrder < 0) {
    throw new AppError("chapterOrder is required and must be a non-negative number", 400);
  }
  const validParts: ChapterPart[] = ["content", "video", "youtube"];
  if (part != null && validParts.includes(part)) {
    const data = await markChapterPartComplete(studentId, batchId, chapterOrder, part, courseId);
    successRes(res, { ...data, chapterOrder: data.moduleOrder }, "Part marked as complete");
    return;
  }
  const data = await markChapterComplete(studentId, batchId, chapterOrder, courseId);
  successRes(res, { ...data, chapterOrder: data.moduleOrder }, "Chapter marked as complete");
});

export const postMarkModuleComplete = postMarkChapterComplete;

export const getTrainers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const list = await UserModel.find({ roles: ROLE.TRAINER }).select("username name").lean().exec();
  const data = list.map((u) => ({
    id: String(u._id),
    username: (u as { username?: string }).username ?? "",
    name: u.name,
  }));
  successRes(res, data);
});

export const postEnrollmentRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, courseId } = req.body ?? {};
  const data = await enrollmentRequestService.createEnrollmentRequest(studentId, { batchId, courseId });
  successRes(res, data, data.message, 201);
});

export const getEnrollmentRequestsForAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = getUserId(req);
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const isSuperAdmin = !!req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  const data = await enrollmentRequestService.listEnrollmentRequestsForAdmin(adminId, batchId, isSuperAdmin);
  successRes(res, data);
});

export const respondToEnrollmentRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = getUserId(req);
  const requestId = req.params.id;
  const { action } = req.body ?? {};
  if (!requestId) throw new AppError("Request ID is required", 400);
  const normalizedAction = String(action).toUpperCase() === "REJECT" ? "REJECT" : "APPROVE";
  const isSuperAdmin = !!req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  const data = await enrollmentRequestService.respondToEnrollmentRequest(requestId, normalizedAction, adminId, isSuperAdmin);
  successRes(res, data, data.message, 200);
});

export const postSubmitGlobalAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { assignmentId, submissionType, submissionContent } = req.body ?? {};
  if (!assignmentId || !submissionType || submissionContent == null) {
    throw new AppError("assignmentId, submissionType, and submissionContent are required", 400);
  }
  const data = await submitGlobalAssignment({
    studentId,
    assignmentId: String(assignmentId),
    submissionType: String(submissionType),
    submissionContent: String(submissionContent),
  });
  successRes(res, data, "Successfully submitted", 201);
});

export const getMySubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const [chapterSubmissions, generalSubmissions] = await Promise.all([
    listChapterSubmissionsByStudentId(studentId),
    listGeneralSubmissionsByStudentId(studentId),
  ]);
  successRes(res, {
    chapterSubmissions,
    generalSubmissions,
  });
});
