
import type { Request, Response } from "express";
import {
  createStudent,
  createTrainer,
  createAdmin,
  createParent,
  resetLoginAttempts,
} from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

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
  res.status(201).json(result);
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
  res.status(201).json(result);
});

export const createAdminHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password) throw new AppError("name, email, mobile and password are required", 400);
  const result = await createAdmin({ name, email, mobile, password });
  res.status(201).json(result);
});

export const createParentHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, mobile, email, linkedStudentUsernames } = req.body as {
    name?: string;
    mobile?: string;
    email?: string;
    linkedStudentUsernames?: string[];
  };
  if (!name || !mobile || !Array.isArray(linkedStudentUsernames)) {
    throw new AppError("name, mobile and linkedStudentUsernames (array) are required", 400);
  }
  const result = await createParent({ name, mobile, email, linkedStudentUsernames });
  res.status(201).json(result);
});

export const resetLoginHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  if (!userId) throw new AppError("userId is required", 400);
  const { temporaryPassword } = await resetLoginAttempts(userId);
  res.status(200).json({
    message: "Login reset. Share the temporary password with the user; they should sign in and change it.",
    temporaryPassword,
  });
});
