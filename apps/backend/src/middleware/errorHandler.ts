
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

const isProduction = process.env.NODE_ENV === "production";

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
  if (isProduction) {
    const e = err as Error | undefined;
    console.error("[error]", e?.name ?? "Error", e?.message ?? String(err));
  } else {
    console.error("[error]", err);
  }
  res.status(500).json({ success: false, message: "Internal server error" });
}
