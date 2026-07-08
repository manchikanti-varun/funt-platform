
import type { Request, Response } from "express";
import { ENROLLMENT_STATUS, CERTIFICATE_STATUS } from "@funt-platform/constants";
import {
  createStudent,
  createTrainer,
  createAdmin,
  createSuperAdmin,
  resetLoginAttemptsByUsername,
  updateUserIdentityByAdmin,
} from "../services/auth.service.js";
import { createAuditLog } from "../services/audit.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import { UserModel } from "../models/User.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { CertificateModel } from "../models/Certificate.model.js";
import { FranchiseCenterModel } from "../models/FranchiseCenter.model.js";

type PeopleRole = "STUDENT" | "ADMIN" | "TRAINER" | "SUPER_ADMIN";

type PersonRow = {
  id: string;
  funtId: string;
  name: string;
  username: string;
  email: string;
  mobile: string;
  city: string;
  status: string;
  role: PeopleRole;
  joinedAt: string;
  studentXp?: number;
  studentLevel?: number;
  coursesCompletedCount?: number;
  activeEnrollments?: number;
  certificatesIssued?: number;
  franchiseCode?: string;
};

type PeopleQueryOptions = {
  userIds?: string[];
  search?: string;
  joinedFrom?: string;
  joinedTo?: string;
  page?: number;
  limit?: number;
  disablePagination?: boolean;
};

function normalizePeopleRole(value: unknown): PeopleRole {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "STUDENT" || v === "ADMIN" || v === "TRAINER" || v === "SUPER_ADMIN") return v;
  throw new AppError("role is required and must be one of STUDENT, ADMIN, TRAINER, SUPER_ADMIN", 400);
}

function toCsv(rows: PersonRow[]): string {
  const head = [
    "id",
    "funtId",
    "role",
    "name",
    "username",
    "email",
    "mobile",
    "city",
    "status",
    "joinedAt",
    "studentXp",
    "studentLevel",
    "coursesCompletedCount",
    "activeEnrollments",
    "certificatesIssued",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.funtId,
        r.role,
        r.name,
        r.username,
        r.email,
        r.mobile,
        r.city,
        r.status,
        r.joinedAt,
        r.studentXp ?? "",
        r.studentLevel ?? "",
        r.coursesCompletedCount ?? "",
        r.activeEnrollments ?? "",
        r.certificatesIssued ?? "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}

async function buildPeopleRows(role: PeopleRole, opts: PeopleQueryOptions = {}): Promise<{ rows: PersonRow[]; total: number }> {
  const query: Record<string, unknown> = { roles: role };
  if (Array.isArray(opts.userIds) && opts.userIds.length > 0) query._id = { $in: opts.userIds };
  const q = String(opts.search ?? "").trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: re }, { username: re }, { email: re }, { mobile: re }, { funtId: re }];
  }
  const joinedFrom = String(opts.joinedFrom ?? "").trim();
  const joinedTo = String(opts.joinedTo ?? "").trim();
  if (joinedFrom || joinedTo) {
    const range: Record<string, Date> = {};
    if (joinedFrom) {
      const d = new Date(joinedFrom);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (joinedTo) {
      const d = new Date(joinedTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length > 0) query.createdAt = range;
  }
  const total = await UserModel.countDocuments(query).exec();
  const page = Math.max(1, Number(opts.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(opts.limit ?? 25)));
  const userQuery = UserModel.find(query)
    .select("funtId name username email mobile city status roles createdAt studentXp studentLevel coursesCompletedCount franchiseId")
    .sort({ createdAt: -1 });
  if (!opts.disablePagination && !(Array.isArray(opts.userIds) && opts.userIds.length > 0)) {
    userQuery.skip((page - 1) * limit).limit(limit);
  }
  const users = await userQuery.lean().exec();
  const ids = users.map((u) => String((u as { _id: unknown })._id));

  let activeEnrollmentsByStudent = new Map<string, number>();
  let certificatesByStudent = new Map<string, number>();
  if (role === "STUDENT" && ids.length > 0) {
    const [enrollAgg, certAgg] = await Promise.all([
      EnrollmentModel.aggregate<{ _id: string; count: number }>([
        { $match: { studentId: { $in: ids }, status: ENROLLMENT_STATUS.ACTIVE } },
        { $group: { _id: "$studentId", count: { $sum: 1 } } },
      ]),
      CertificateModel.aggregate<{ _id: string; count: number }>([
        { $match: { studentId: { $in: ids }, status: CERTIFICATE_STATUS.ISSUED } },
        { $group: { _id: "$studentId", count: { $sum: 1 } } },
      ]),
    ]);
    activeEnrollmentsByStudent = new Map(enrollAgg.map((x) => [String(x._id), Number(x.count || 0)]));
    certificatesByStudent = new Map(certAgg.map((x) => [String(x._id), Number(x.count || 0)]));
  }

  // Resolve franchise codes for users with franchiseId
  const franchiseIds = [...new Set(
    users.map((u) => (u as { franchiseId?: string }).franchiseId).filter((f): f is string => !!f)
  )];
  const franchiseCodeMap = new Map<string, string>();
  if (franchiseIds.length > 0) {
    const centers = await FranchiseCenterModel.find({ _id: { $in: franchiseIds } })
      .select("franchiseCode")
      .lean()
      .exec();
    for (const c of centers) {
      franchiseCodeMap.set(String(c._id), c.franchiseCode);
    }
  }

  const rows = users.map((u) => {
    const id = String((u as { _id: unknown })._id);
    const createdAt = (u as { createdAt?: Date }).createdAt;
    const userFranchiseId = (u as { franchiseId?: string }).franchiseId;
    const base: PersonRow = {
      id,
      funtId: String((u as { funtId?: string }).funtId ?? ""),
      name: String((u as { name?: string }).name ?? ""),
      username: String((u as { username?: string }).username ?? ""),
      email: String((u as { email?: string }).email ?? ""),
      mobile: String((u as { mobile?: string }).mobile ?? ""),
      city: String((u as { city?: string }).city ?? ""),
      status: String((u as { status?: string }).status ?? ""),
      role,
      joinedAt: createdAt ? new Date(createdAt).toISOString() : "",
      franchiseCode: userFranchiseId ? (franchiseCodeMap.get(userFranchiseId) ?? undefined) : undefined,
    };
    if (role === "STUDENT") {
      base.studentXp = Number((u as { studentXp?: number }).studentXp ?? 0);
      base.studentLevel = Number((u as { studentLevel?: number }).studentLevel ?? 1);
      base.coursesCompletedCount = Number((u as { coursesCompletedCount?: number }).coursesCompletedCount ?? 0);
      base.activeEnrollments = activeEnrollmentsByStudent.get(id) ?? 0;
      base.certificatesIssued = certificatesByStudent.get(id) ?? 0;
    }
    return base;
  });
  return { rows, total };
}

export const createStudentHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password, username, age, address, grade, gradeOther, schoolName, city } = req.body as Record<
    string,
    unknown
  >;
  if (!name || !mobile || !password || !username || age == null) {
    throw new AppError("name, mobile, password, username, and age are required", 400);
  }
  const result = await createStudent({
    name: String(name),
    email: email != null ? String(email) : undefined,
    mobile: String(mobile),
    password: String(password),
    username: String(username),
    age: Number(age),
    address: address != null ? String(address) : undefined,
    grade: grade != null ? String(grade) : undefined,
    gradeOther: gradeOther != null ? String(gradeOther) : undefined,
    schoolName: schoolName != null ? String(schoolName) : undefined,
    city: city != null ? String(city) : undefined,
  });
  const performedBy = req.user?.userId ?? "unknown";
  await createAuditLog("USER_CREATED", performedBy, "User", result.id, { role: "STUDENT", username: String(username) }).catch(() => {});
  successRes(res, result, "Student created", 201);
});

export const createTrainerHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, name, email, mobile, password } = req.body as Record<string, unknown>;
  if (!username || !name || !email || !mobile || !password) {
    throw new AppError("username, name, email, mobile and password are required", 400);
  }
  const result = await createTrainer({
    username: String(username),
    name: String(name),
    email: String(email),
    mobile: String(mobile),
    password: String(password),
  });
  const performedBy = req.user?.userId ?? "unknown";
  await createAuditLog("USER_CREATED", performedBy, "User", result.id, { role: "TRAINER", username: String(username) }).catch(() => {});
  successRes(res, result, "Trainer created", 201);
});

export const createSupportAgentHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, name, email, mobile, password } = req.body as Record<string, unknown>;
  if (!username || !name || !email || !mobile || !password) {
    throw new AppError("username, name, email, mobile and password are required", 400);
  }
  const { createSupportAgent } = await import("../services/auth.service.js");
  const result = await createSupportAgent({
    username: String(username),
    name: String(name),
    email: String(email),
    mobile: String(mobile),
    password: String(password),
  });
  const performedBy = req.user?.userId ?? "unknown";
  await createAuditLog("USER_CREATED", performedBy, "User", result.id, { role: "SUPPORT_AGENT", username: String(username) }).catch(() => {});
  successRes(res, result, "Support agent created", 201);
});

export const createAdminHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password) throw new AppError("name, email, mobile and password are required", 400);
  const result = await createAdmin({ name, email, mobile, password });
  successRes(res, result, "Admin created", 201);
});

export const createSuperAdminHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password) throw new AppError("name, email, mobile and password are required", 400);
  const result = await createSuperAdmin({ name, email, mobile, password });
  successRes(res, result, "Super Admin created", 201);
});

export const resetLoginHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { newPassword } = req.body as { newPassword?: string };
  if (!username?.trim()) throw new AppError("username is required", 400);
  if (!newPassword?.trim()) throw new AppError("newPassword is required", 400);
  await resetLoginAttemptsByUsername(username, newPassword, req.user?.roles);
  const performedBy = req.user?.userId ?? "unknown";
  await createAuditLog("USER_PASSWORD_RESET", performedBy, "User", username, { username }).catch(() => {});
  successRes(res, null, "Login reset. Account lockout cleared and password updated.");
});

export const patchUserIdentityHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  if (!userId) throw new AppError("userId is required", 400);
  const { username, email, mobile, status } = req.body as {
    username?: string;
    email?: string;
    mobile?: string;
    status?: string;
  };

  // Handle status change separately with audit logging
  if (status && ["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
    const user = await UserModel.findById(userId).select("status").lean().exec();
    if (!user) throw new AppError("User not found", 404);
    const oldStatus = (user as { status?: string }).status;
    if (oldStatus !== status) {
      await UserModel.updateOne({ _id: userId }, { $set: { status } }).exec();
      const performedBy = req.user?.userId ?? "unknown";
      const auditAction: "USER_SUSPENDED" | "USER_ARCHIVED" | "USER_ACTIVATED" =
        status === "SUSPENDED" ? "USER_SUSPENDED" :
        status === "ARCHIVED" ? "USER_ARCHIVED" : "USER_ACTIVATED";
      await createAuditLog(auditAction, performedBy, "User", userId, { oldStatus, newStatus: status }).catch(() => {});
    }
  }

  // Handle identity field changes
  if (username || email || mobile) {
    await updateUserIdentityByAdmin(userId, { username, email, mobile }, req.user?.roles);
  }

  successRes(res, null, "User identity updated");
});

export const listPeopleByRoleHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const role = normalizePeopleRole(req.query.role);
  const format = String(req.query.format ?? "json").trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 25)));
  const search = String(req.query.q ?? "").trim();
  const joinedFrom = String(req.query.joinedFrom ?? "").trim();
  const joinedTo = String(req.query.joinedTo ?? "").trim();
  const disablePagination = format === "csv" || format === "json-file";
  const { rows, total } = await buildPeopleRows(role, {
    page,
    limit,
    search,
    joinedFrom,
    joinedTo,
    disablePagination,
  });
  if (format === "csv") {
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${role.toLowerCase()}-people.csv"`);
    res.send(csv);
    return;
  }
  if (format === "json-file") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${role.toLowerCase()}-people.json"`);
    res.send(JSON.stringify(rows, null, 2));
    return;
  }
  res.status(200).json({
    success: true,
    data: {
      rows,
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
});

export const getPersonDetailsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  if (!userId) throw new AppError("userId is required", 400);
  const user = await UserModel.findById(userId)
    .select("funtId name username email mobile city status roles createdAt studentXp studentLevel coursesCompletedCount")
    .lean()
    .exec();
  if (!user) throw new AppError("User not found", 404);
  const roles = ((user as { roles?: string[] }).roles ?? []).map((r) => String(r).toUpperCase());
  const role = (roles.find((r) => r === "STUDENT" || r === "ADMIN" || r === "TRAINER" || r === "SUPER_ADMIN") ??
    "STUDENT") as PeopleRole;
  const { rows } = await buildPeopleRows(role, { userIds: [userId], disablePagination: true });
  if (rows.length === 0) throw new AppError("User not found", 404);
  res.status(200).json({ success: true, data: rows[0] });
});

export const downloadPersonDetailsHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  if (!userId) throw new AppError("userId is required", 400);
  const user = await UserModel.findById(userId).select("roles").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const roles = ((user as { roles?: string[] }).roles ?? []).map((r) => String(r).toUpperCase());
  const role = (roles.find((r) => r === "STUDENT" || r === "ADMIN" || r === "TRAINER" || r === "SUPER_ADMIN") ??
    "STUDENT") as PeopleRole;
  const { rows } = await buildPeopleRows(role, { userIds: [userId], disablePagination: true });
  if (rows.length === 0) throw new AppError("User not found", 404);
  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="person-${userId}.csv"`);
  res.send(csv);
});

export const bulkDownloadPeopleHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const role = normalizePeopleRole((req.body ?? {}).role);
  const rawIds = (req.body ?? {}).userIds;
  const format = String((req.body ?? {}).format ?? "csv").trim().toLowerCase();
  const userIds = Array.isArray(rawIds) ? rawIds.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : undefined;
  const { rows } = await buildPeopleRows(role, { userIds, disablePagination: true });
  if (format === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${role.toLowerCase()}-people-bulk.json"`);
    res.send(JSON.stringify(rows, null, 2));
    return;
  }
  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${role.toLowerCase()}-people-bulk.csv"`);
  res.send(csv);
});
