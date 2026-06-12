/**
 * Content Protection controller.
 *
 * GET  /api/config/content-protection          — get global settings (admin)
 * PUT  /api/config/content-protection          — update global settings (super admin)
 * GET  /api/student/content-protection         — effective policy for current student session
 * POST /api/student/content-protection/events  — log a security event from the LMS
 */

import type { Request, Response } from "express";
import {
  getContentProtectionSettings,
  updateContentProtectionSettings,
  logProtectionEvent,
  resolveEffectivePolicy,
  type ContentProtectionPolicy,
} from "../services/contentProtection.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// ── Admin: get global settings ───────────────────────────────────────────────
export const getGlobalContentProtection = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await getContentProtectionSettings();
    successRes(res, data);
  }
);

// ── Admin: update global settings (super admin only) ─────────────────────────
export const updateGlobalContentProtection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const updatedBy = getUserId(req);
    const { lmsProtection, adminProtection, watermark } = req.body ?? {};
    const data = await updateContentProtectionSettings(
      {
        lmsProtection: lmsProtection ?? undefined,
        adminProtection: adminProtection ?? undefined,
        watermark: watermark ?? undefined,
      },
      updatedBy
    );
    successRes(res, data, "Content protection settings updated");
  }
);

// ── Student: get effective policy for their session ───────────────────────────
export const getStudentContentProtection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const studentId = getUserId(req);

    const { UserModel } = await import("../models/User.model.js");
    const student = await UserModel.findById(studentId)
      .select("name email username")
      .lean()
      .exec();

    if (!student) throw new AppError("Student not found", 404);

    const settings = await getContentProtectionSettings();

    // Apply course-level watermark override when courseId is provided
    let courseWatermarkOverride: Partial<ContentProtectionPolicy> | null = null;
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId.trim() : "";
    if (courseId) {
      const { CourseModel } = await import("../models/Course.model.js");
      const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
      const course = await CourseModel.findOne(
        OBJECT_ID_RE.test(courseId)
          ? { _id: courseId }
          : { courseId }
      )
        .select("enableWatermark")
        .lean()
        .exec();

      // Only override if the course explicitly sets enableWatermark (not null/undefined)
      const courseWm = (course as { enableWatermark?: boolean | null } | null)?.enableWatermark;
      if (courseWm === true || courseWm === false) {
        courseWatermarkOverride = { enableWatermark: courseWm };
      }
    }

    const effectivePolicy = resolveEffectivePolicy(
      settings.lmsProtection,
      courseWatermarkOverride
    );

    successRes(res, {
      policy: effectivePolicy,
      watermark: settings.watermark,
      student: {
        name: (student as { name?: string }).name ?? "",
        email: (student as { email?: string }).email ?? "",
        username: (student as { username?: string }).username ?? "",
        id: studentId,
      },
    });
  }
);

// ── Student: log a security event from LMS ────────────────────────────────────
export const postProtectionEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const studentId = getUserId(req);
    const { action, courseId, batchId, event } = req.body ?? {};

    if (!action || typeof action !== "string") {
      throw new AppError("action is required", 400);
    }

    // Get real IP for audit
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket?.remoteAddress ??
      "unknown";
    const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 256);

    await logProtectionEvent(action, studentId, {
      courseId: typeof courseId === "string" ? courseId : undefined,
      batchId: typeof batchId === "string" ? batchId : undefined,
      event: typeof event === "string" ? event : undefined,
      ip,
      userAgent,
    });

    successRes(res, { logged: true });
  }
);
