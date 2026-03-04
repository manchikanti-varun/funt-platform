

import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";
import { getMyEnrollments } from "./enrollment.service.js";
import { listCertificatesForStudent } from "./certificate.service.js";
import { getAttendanceSummaryForStudent, type StudentAttendanceSummaryItem } from "./attendance.service.js";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function sanitizeUser(u: { _id: unknown; funtId: string; name: string; email?: string; mobile: string; roles: string[]; status: string; grade?: string; schoolName?: string; city?: string; createdAt?: Date; updatedAt?: Date; linkedStudentFuntIds?: string[] }) {
  return {
    id: String(u._id),
    funtId: u.funtId,
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
    linkedStudentFuntIds: u.linkedStudentFuntIds ?? [],
  };
}

/** Resolve query to user by MongoDB _id or funtId. Returns null if not found. */
export async function resolveUserByIdentifier(q: string) {
  const v = (q ?? "").trim();
  if (!v) return null;
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).select("_id funtId name email mobile roles status grade schoolName city createdAt updatedAt linkedStudentFuntIds").lean().exec();
    return user ? { _id: user._id, funtId: user.funtId, name: user.name, email: user.email, mobile: user.mobile, roles: user.roles, status: user.status, grade: user.grade, schoolName: user.schoolName, city: user.city, createdAt: user.createdAt, updatedAt: user.updatedAt, linkedStudentFuntIds: user.linkedStudentFuntIds } : null;
  }
  const user = await UserModel.findOne({ funtId: v }).select("_id funtId name email mobile roles status grade schoolName city createdAt updatedAt linkedStudentFuntIds").lean().exec();
  return user ? { _id: user._id, funtId: user.funtId, name: user.name, email: user.email, mobile: user.mobile, roles: user.roles, status: user.status, grade: user.grade, schoolName: user.schoolName, city: user.city, createdAt: user.createdAt, updatedAt: user.updatedAt, linkedStudentFuntIds: user.linkedStudentFuntIds } : null;
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

export interface ProfileResult {
  user: ReturnType<typeof sanitizeUser>;
  enrollments?: ProfileEnrollment[];
  certificates?: ProfileCertificate[];
  coursesCount?: number;
  certificatesCount?: number;
  attendanceSummary?: StudentAttendanceSummaryItem[];
}


export async function getProfileForAdmin(identifier: string, isSuperAdmin: boolean): Promise<ProfileResult> {
  const user = await resolveUserByIdentifier(identifier);
  if (!user) throw new AppError("User not found", 404);

  const isStudent = (user.roles as string[]).includes(ROLE.STUDENT);
  if (!isSuperAdmin && !isStudent) {
    throw new AppError("Only student profiles can be viewed. Use a student ID or FUNT ID.", 403);
  }

  const result: ProfileResult = {
    user: sanitizeUser(user as Parameters<typeof sanitizeUser>[0]),
  };

  if (isStudent) {
    const studentId = String(user._id);
    const [enrollments, certs, attendanceSummary] = await Promise.all([
      getMyEnrollments(studentId),
      listCertificatesForStudent(studentId),
      getAttendanceSummaryForStudent(studentId),
    ]);
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
  }

  return result;
}
