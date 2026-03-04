
import { RegistrationRequestModel } from "../models/RegistrationRequest.model.js";
import { UserModel } from "../models/User.model.js";
import { createAdminWithTemporaryPassword, createSuperAdminWithTemporaryPassword } from "./auth.service.js";
import { AppError } from "../utils/AppError.js";

export type RegistrationRequestRoleType = "ADMIN" | "SUPER_ADMIN";
export type RegistrationRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SubmitAdminRequestInput {
  name: string;
  email: string;
  mobile: string;
  city?: string;
  requestedBy?: string;
}

export interface SubmitSuperAdminRequestInput {
  name: string;
  email: string;
  mobile: string;
  city?: string;
  requestedBy: string;
}

export interface RegistrationRequestDto {
  id: string;
  roleType: RegistrationRequestRoleType;
  name: string;
  email: string;
  mobile: string;
  city?: string;
  status: RegistrationRequestStatus;
  requestedAt: Date;
  requestedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdUserId?: string;
  rejectionReason?: string;
}

type RequestDoc = {
  _id: unknown;
  roleType: string;
  name: string;
  email: string;
  mobile: string;
  city?: string | null;
  status: string;
  requestedAt: Date;
  requestedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  createdUserId?: string | null;
  rejectionReason?: string | null;
};

function toDto(doc: RequestDoc): RegistrationRequestDto {
  return {
    id: String(doc._id),
    roleType: doc.roleType as RegistrationRequestRoleType,
    name: doc.name,
    email: doc.email,
    mobile: doc.mobile,
    city: doc.city ?? undefined,
    status: doc.status as RegistrationRequestStatus,
    requestedAt: doc.requestedAt,
    requestedBy: doc.requestedBy ?? undefined,
    approvedBy: doc.approvedBy ?? undefined,
    approvedAt: doc.approvedAt ?? undefined,
    createdUserId: doc.createdUserId ?? undefined,
    rejectionReason: doc.rejectionReason ?? undefined,
  };
}

export async function submitAdminRequest(input: SubmitAdminRequestInput): Promise<RegistrationRequestDto> {
  const emailNorm = input.email.trim().toLowerCase();
  const existingUser = await UserModel.findOne({ email: emailNorm }).lean().exec();
  if (existingUser) {
    throw new AppError("A user with this email already exists.", 400);
  }
  const existingPending = await RegistrationRequestModel.findOne({
    email: emailNorm,
    roleType: "ADMIN",
    status: "PENDING",
  }).exec();
  if (existingPending) {
    throw new AppError("A pending Admin request for this email already exists.", 400);
  }
  const doc = await RegistrationRequestModel.create({
    roleType: "ADMIN",
    name: input.name.trim(),
    email: emailNorm,
    mobile: input.mobile.trim(),
    city: input.city?.trim() || undefined,
    status: "PENDING",
    requestedBy: input.requestedBy || undefined,
  });
  return toDto(doc.toObject());
}

export async function submitSuperAdminRequest(input: SubmitSuperAdminRequestInput): Promise<RegistrationRequestDto> {
  const emailNorm = input.email.trim().toLowerCase();
  const existingUser = await UserModel.findOne({ email: emailNorm }).lean().exec();
  if (existingUser) {
    throw new AppError("A user with this email already exists.", 400);
  }
  const existingPending = await RegistrationRequestModel.findOne({
    email: emailNorm,
    roleType: "SUPER_ADMIN",
    status: "PENDING",
  }).exec();
  if (existingPending) {
    throw new AppError("A pending Super Admin request for this email already exists.", 400);
  }
  const doc = await RegistrationRequestModel.create({
    roleType: "SUPER_ADMIN",
    name: input.name.trim(),
    email: emailNorm,
    mobile: input.mobile.trim(),
    city: input.city?.trim() || undefined,
    status: "PENDING",
    requestedBy: input.requestedBy,
  });
  return toDto(doc.toObject());
}

export interface ListRegistrationRequestsFilters {
  roleType?: RegistrationRequestRoleType;
  status?: RegistrationRequestStatus;
}

export async function listRegistrationRequests(
  filters: ListRegistrationRequestsFilters,
  limit = 100
): Promise<RegistrationRequestDto[]> {
  const query: Record<string, unknown> = {};
  if (filters.roleType) query.roleType = filters.roleType;
  if (filters.status) query.status = filters.status;
  const list = await RegistrationRequestModel.find(query)
    .sort({ requestedAt: -1 })
    .limit(limit)
    .lean()
    .exec();
  return list.map((d: unknown) => toDto(d as RequestDoc));
}

export async function approveRequest(requestId: string, approvedByUserId: string): Promise<{ funtId: string; message: string }> {
  const req = await RegistrationRequestModel.findById(requestId).exec();
  if (!req) throw new AppError("Request not found", 404);
  if (req.status !== "PENDING") {
    throw new AppError(`Request is already ${req.status}`, 400);
  }
  if (req.roleType === "ADMIN") {
    const { id, funtId } = await createAdminWithTemporaryPassword({
      name: req.name,
      email: req.email,
      mobile: req.mobile,
      city: req.city ?? undefined,
    });
    req.status = "APPROVED";
    req.approvedBy = approvedByUserId;
    req.approvedAt = new Date();
    req.createdUserId = id;
    await req.save();
    return {
      funtId,
      message: `Admin account created. FUNT ID: ${funtId}. Temporary password: ${funtId}. User must log in and change password.`,
    };
  }
  if (req.roleType === "SUPER_ADMIN") {
    const { id, funtId } = await createSuperAdminWithTemporaryPassword({
      name: req.name,
      email: req.email,
      mobile: req.mobile,
      city: req.city ?? undefined,
    });
    req.status = "APPROVED";
    req.approvedBy = approvedByUserId;
    req.approvedAt = new Date();
    req.createdUserId = id;
    await req.save();
    return {
      funtId,
      message: `Super Admin account created. FUNT ID: ${funtId}. Temporary password: ${funtId}. User must log in and change password.`,
    };
  }
  throw new AppError("Invalid role type", 400);
}

export async function rejectRequest(requestId: string, approvedByUserId: string, reason?: string): Promise<void> {
  const req = await RegistrationRequestModel.findById(requestId).exec();
  if (!req) throw new AppError("Request not found", 404);
  if (req.status !== "PENDING") {
    throw new AppError(`Request is already ${req.status}`, 400);
  }
  req.status = "REJECTED";
  req.approvedBy = approvedByUserId;
  req.approvedAt = new Date();
  if (reason?.trim()) req.rejectionReason = reason.trim();
  await req.save();
}
