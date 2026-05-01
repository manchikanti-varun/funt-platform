

import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { getMyEnrollments } from "./enrollment.service.js";
import { listCertificatesForStudent } from "./certificate.service.js";
import { getAttendanceSummaryForStudent, type StudentAttendanceSummaryItem } from "./attendance.service.js";
import { ModuleProgressModel } from "../models/ModuleProgress.model.js";
import { listCoinGrantHistoryForUser } from "./coinBalance.service.js";
import { listAchievements } from "./achievement.service.js";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function sanitizeUser(u: {
  _id: unknown;
  username: string;
  name: string;
  email?: string;
  mobile: string;
  roles: string[];
  status: string;
  grade?: string;
  schoolName?: string;
  city?: string;
  createdAt?: Date;
  updatedAt?: Date;
  linkedStudentUsernames?: string[];
}) {
  return {
    id: String(u._id),
    username: u.username,
    name: u.name,
    email: u.email ?? "",
    mobile: u.mobile,
    roles: u.roles,
    status: u.status,
    grade: u.grade ?? "",
    schoolName: u.schoolName ?? "",
    city: u.city ?? "",
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    linkedStudentUsernames: u.linkedStudentUsernames ?? [],
  };
}

/** Resolve query to user by MongoDB _id or username. Returns null if not found. */
export async function resolveUserByIdentifier(q: string) {
  const v = (q ?? "").trim();
  if (!v) return null;
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v)
      .select(
        "_id username name email mobile roles status grade schoolName city createdAt updatedAt linkedStudentUsernames"
      )
      .lean()
      .exec();
    return user
      ? {
          _id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          roles: user.roles,
          status: user.status,
          grade: user.grade,
          schoolName: user.schoolName,
          city: user.city,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          linkedStudentUsernames: user.linkedStudentUsernames,
        }
      : null;
  }
  const user = await UserModel.findOne({ username: v.toLowerCase() })
    .select(
      "_id username name email mobile roles status grade schoolName city createdAt updatedAt linkedStudentUsernames"
    )
    .lean()
    .exec();
  return user
    ? {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        roles: user.roles,
        status: user.status,
        grade: user.grade,
        schoolName: user.schoolName,
        city: user.city,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        linkedStudentUsernames: user.linkedStudentUsernames,
      }
    : null;
}

export interface ProfileEnrollment {
  batchId: string;
  batchName: string;
  batchStatus: string;
  courseNames: string[];
  status: string;
  enrolledAt: string;
  hasAccess: boolean;
}

export interface ProfileCertificate {
  certificateId: string;
  courseName: string;
  issuedAt: string;
}

export interface ProfileCoinGrant {
  id: string;
  amountOriginal: number;
  amountRemaining: number;
  grantedAt: string;
  expiresAt: string;
  source: string;
  sourceRef?: string;
}

export interface ProfileResult {
  user: ReturnType<typeof sanitizeUser>;
  enrollments?: ProfileEnrollment[];
  certificates?: ProfileCertificate[];
  coursesCount?: number;
  certificatesCount?: number;
  attendanceSummary?: StudentAttendanceSummaryItem[];
  coinGrants?: ProfileCoinGrant[];
  achievements?: Array<{
    id: string;
    badgeType: string;
    displayName: string;
    icon: string;
    awardedAt: string;
  }>;
  moduleProgressSummary?: {
    modulesCompleted: number;
    modulesPending: number;
    modulesTotal: number;
    completionPercent: number;
    courses: Array<{
      courseKey: string;
      batchName?: string;
      courseName: string;
      modules: Array<{
        order: number;
        title: string;
        completed: boolean;
      }>;
      modulesCompleted: number;
      modulesPending: number;
      modulesTotal: number;
      completionPercent: number;
    }>;
  };
}


export async function getProfileForAdmin(identifier: string, isSuperAdmin: boolean): Promise<ProfileResult> {
  const user = await resolveUserByIdentifier(identifier);
  if (!user) throw new AppError("User not found", 404);

  const isStudent = (user.roles as string[]).includes(ROLE.STUDENT);
  if (!isSuperAdmin && !isStudent) {
    throw new AppError("Only student profiles can be viewed. Use a student ID or username.", 403);
  }

  const result: ProfileResult = {
    user: sanitizeUser(user as Parameters<typeof sanitizeUser>[0]),
  };

  if (isStudent) {
    const studentId = String(user._id);
    const [enrollments, certs, attendanceSummary, coinGrants, achievements] = await Promise.all([
      getMyEnrollments(studentId),
      listCertificatesForStudent(studentId),
      getAttendanceSummaryForStudent(studentId),
      listCoinGrantHistoryForUser(studentId, 200),
      listAchievements(studentId),
    ]);

    // Module progress for parents/students:
    // We build module-level completion using `ModuleProgressModel` (completedAt != null)
    // matched against the module snapshots found in each enrolled batch.
    const batchIds = enrollments.map((e) => String(e.batchId)).filter(Boolean);

    // Map: `${batchId}|${courseIdKey}` -> Map(moduleOrder -> completed)
    const completedByCourseOrder = new Map<string, Map<number, boolean>>();
    const progressDocs =
      batchIds.length > 0
        ? await ModuleProgressModel.find({
            studentId,
            batchId: { $in: batchIds },
          })
            .select("batchId courseId moduleOrder completedAt")
            .lean()
            .exec()
        : [];

    for (const d of progressDocs) {
      const batchId = String((d as { batchId: string }).batchId);
      const courseIdKey = (d as { courseId?: string }).courseId ?? batchId;
      const courseKey = `${batchId}|${String(courseIdKey)}`;
      const order = (d as { moduleOrder: number }).moduleOrder;
      const completed = (d as { completedAt?: Date | null }).completedAt != null;

      const inner = completedByCourseOrder.get(courseKey) ?? new Map<number, boolean>();
      inner.set(order, completed);
      completedByCourseOrder.set(courseKey, inner);
    }

    const courses: Array<{
      courseKey: string;
      courseName: string;
      batchName?: string;
      modules: Array<{ order: number; title: string; completed: boolean }>;
      modulesCompleted: number;
      modulesPending: number;
      modulesTotal: number;
      completionPercent: number;
    }> = [];

    let modulesTotal = 0;
    let modulesCompleted = 0;

    for (const e of enrollments) {
      const batchId = String(e.batchId);
      const batchAny = e.batch as unknown as {
        name?: string;
        // Some enrollment/batch shapes may contain `courseSnapshot` instead of `courseSnapshots`.
        courseSnapshots?: Array<{
          courseId?: string;
          title?: string;
          modules?: Array<{ order?: number; title?: string }>;
        }>;
        courseSnapshot?: {
          courseId?: string;
          title?: string;
          modules?: Array<{ order?: number; title?: string }>;
        } | null;
      } | null | undefined;

      const batchName = batchAny?.name ?? "—";
      const courseSnapshots = batchAny?.courseSnapshots?.length
        ? batchAny.courseSnapshots
        : batchAny?.courseSnapshot
          ? [batchAny.courseSnapshot]
          : [];

      for (const s of courseSnapshots) {
        const courseIdKey = s.courseId ?? batchId;
        const courseKey = `${batchId}|${String(courseIdKey)}`;
        const courseName = s.title ?? "Course";
        const rawModules = Array.isArray(s.modules) ? s.modules : [];

        const modules = rawModules.map((m, idx) => {
          const order = typeof m.order === "number" ? m.order : idx;
          const title = (m.title ?? `Module ${order + 1}`) as string;
          const inner = completedByCourseOrder.get(courseKey);
          const completed = inner?.get(order) ?? false;
          return { order, title, completed };
        });

        const completedCount = modules.reduce((sum, m) => sum + (m.completed ? 1 : 0), 0);
        const totalCount = modules.length;
        const pendingCount = Math.max(0, totalCount - completedCount);
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        courses.push({
          courseKey,
          courseName,
          batchName,
          modules,
          modulesCompleted: completedCount,
          modulesPending: pendingCount,
          modulesTotal: totalCount,
          completionPercent: percent,
        });

        modulesTotal += totalCount;
        modulesCompleted += completedCount;
      }
    }

    // Keep most-progressed courses on top.
    courses.sort((a, b) => b.completionPercent - a.completionPercent);

    const modulesPending = Math.max(0, modulesTotal - modulesCompleted);
    const completionPercent = modulesTotal > 0 ? Math.round((modulesCompleted / modulesTotal) * 100) : 0;
    const courseIds = new Set<string>();
    result.enrollments = enrollments.map((e) => {
      const batch = e.batch;
      const snap = batch?.courseSnapshot as { title?: string } | undefined;
      const courseNames = batch?.courseSnapshots
        ? (batch.courseSnapshots as Array<{ title?: string }>).map((s) => s.title ?? "Course")
        : snap?.title
          ? [snap.title]
          : ["Course"];
      (batch?.courseSnapshots as Array<{ courseId?: string }> | undefined)?.forEach((s) => s.courseId && courseIds.add(s.courseId));
      if (batch?.courseSnapshot && typeof batch.courseSnapshot === "object" && "courseId" in batch.courseSnapshot) {
        courseIds.add((batch.courseSnapshot as { courseId: string }).courseId);
      }
      return {
        batchId: e.batchId,
        batchName: batch?.name ?? "—",
        batchStatus: batch?.status ?? "—",
        courseNames,
        status: e.status,
        enrolledAt: new Date(e.enrolledAt).toISOString(),
        hasAccess: true,
      };
    });
    result.certificates = certs.map((c) => ({
      certificateId: c.certificateId,
      courseName: c.courseName,
      issuedAt: new Date(c.issuedAt).toISOString(),
    }));
    result.coursesCount = courseIds.size;
    result.certificatesCount = certs.length;
    result.attendanceSummary = attendanceSummary;
    result.coinGrants = coinGrants;
    result.achievements = achievements.map((a) => ({
      id: a.id,
      badgeType: a.badgeType,
      displayName: a.displayName,
      icon: a.icon,
      awardedAt: new Date(a.awardedAt).toISOString(),
    }));
    result.moduleProgressSummary = {
      modulesCompleted,
      modulesPending,
      modulesTotal,
      completionPercent,
      courses,
    };
  }

  return result;
}
