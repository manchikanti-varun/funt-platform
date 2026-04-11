
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }
  const e = err as Error | undefined;
  console.error("[error]", e?.name ?? "Error", e?.message ?? String(err));
  if (e?.stack) console.error(e.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
}
