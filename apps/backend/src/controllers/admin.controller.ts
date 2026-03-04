
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
  const { name, email, mobile, password } = req.body;
  if (!name || !mobile || !password) throw new AppError("name, mobile and password are required", 400);
  const result = await createStudent({ name, email, mobile, password });
  res.status(201).json(result);
});

export const createTrainerHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password) throw new AppError("name, email, mobile and password are required", 400);
  const result = await createTrainer({ name, email, mobile, password });
  res.status(201).json(result);
});

export const createAdminHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password) throw new AppError("name, email, mobile and password are required", 400);
  const result = await createAdmin({ name, email, mobile, password });
  res.status(201).json(result);
});

export const createParentHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, mobile, email, linkedStudentFuntIds } = req.body;
  if (!name || !mobile || !Array.isArray(linkedStudentFuntIds)) {
    throw new AppError("name, mobile and linkedStudentFuntIds (array) are required", 400);
  }
  const result = await createParent({ name, mobile, email, linkedStudentFuntIds });
  res.status(201).json(result);
});

export const resetLoginHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  if (!userId) throw new AppError("userId is required", 400);
  await resetLoginAttempts(userId);
  res.status(200).json({ message: "Login reset. Password is now the user's FUNT ID." });
});
