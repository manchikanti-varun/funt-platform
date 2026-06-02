
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { getEnv } from "../config/env.js";

/**
 * Centralized error handler.
 *
 * Goal: never return the unhelpful "Internal server error" if we can recognise
 * the failure. Most application code throws `AppError` directly; this handler
 * additionally maps common library errors (Mongo / Mongoose / JWT / Express
 * body-parser) to a meaningful 4xx response with a clear message, so the
 * frontend can show something useful and we don't have to grep logs for every
 * misconfiguration.
 *
 * Anything we can't classify still falls through to 500 — but with the
 * actual error name + message exposed (still safe: it's already in the logs).
 */

interface MaybeMongoError {
  name?: string;
  message?: string;
  code?: number;
  errors?: Record<string, { path?: string; message?: string; kind?: string }>;
  path?: string;
  value?: unknown;
  kind?: string;
  keyValue?: Record<string, unknown>;
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

function formatValidationError(err: MaybeMongoError): string {
  const fields = err.errors ?? {};
  const messages = Object.values(fields)
    .map((e) => {
      const path = e?.path ? `${e.path}: ` : "";
      const msg = e?.message ?? "invalid value";
      return `${path}${msg}`;
    })
    .filter(Boolean);
  if (messages.length === 0) return err.message ?? "Validation failed";
  return messages.join("; ");
}

function formatCastError(err: MaybeMongoError): string {
  const path = err.path ? `\`${err.path}\`` : "field";
  const kind = err.kind ?? "value";
  // Avoid echoing the raw value back unless it's a safe primitive.
  const raw = typeof err.value === "string" || typeof err.value === "number" || typeof err.value === "boolean"
    ? String(err.value)
    : "(complex value)";
  return `Invalid ${kind} for ${path}: ${raw}`;
}

function formatDuplicateKeyError(err: MaybeMongoError): string {
  const entries = Object.entries(err.keyValue ?? {});
  if (entries.length === 0) return "Duplicate value violates a unique constraint";
  const [field, value] = entries[0] as [string, unknown];
  const safeValue = typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "(value)";
  return `An entry with ${field} "${safeValue}" already exists`;
}

interface ClassifiedError {
  statusCode: number;
  message: string;
}

function classify(err: unknown): ClassifiedError | null {
  if (!err || typeof err !== "object") return null;
  const e = err as MaybeMongoError;
  const name = e.name ?? "";

  // Mongoose document validation failure.
  if (name === "ValidationError") {
    return { statusCode: 400, message: formatValidationError(e) };
  }

  // Mongoose ObjectId / number cast failures.
  if (name === "CastError") {
    return { statusCode: 400, message: formatCastError(e) };
  }

  // MongoDB duplicate-key on a unique index.
  if (e.code === 11000 || name === "MongoServerError" && e.code === 11000) {
    return { statusCode: 409, message: formatDuplicateKeyError(e) };
  }

  // JWT verification failures (jsonwebtoken).
  if (name === "TokenExpiredError") {
    return { statusCode: 401, message: "Your session has expired. Please sign in again." };
  }
  if (name === "JsonWebTokenError" || name === "NotBeforeError") {
    return { statusCode: 401, message: "Invalid authentication token." };
  }

  // Body-parser JSON parse failure (express.json).
  if (name === "SyntaxError" && e.type === "entity.parse.failed") {
    return { statusCode: 400, message: "Request body is not valid JSON." };
  }
  // Body too large.
  if (e.type === "entity.too.large") {
    return { statusCode: 413, message: "Request body is too large." };
  }

  // Some libraries throw plain errors with `status`/`statusCode` set; respect those if they're 4xx.
  const declaredStatus = e.statusCode ?? e.status;
  if (typeof declaredStatus === "number" && declaredStatus >= 400 && declaredStatus < 500 && e.expose !== false && e.message) {
    return { statusCode: declaredStatus, message: e.message };
  }

  return null;
}

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

  const classified = classify(err);
  if (classified) {
    const e = err as { name?: string; message?: string };
    // Still log the original error so we can trace it; don't leak stack to client.
    console.warn(
      "[error]",
      e?.name ?? "Error",
      "→",
      `${classified.statusCode}`,
      classified.message,
      e?.message && e.message !== classified.message ? `(raw: ${e.message})` : ""
    );
    res.status(classified.statusCode).json({ success: false, message: classified.message });
    return;
  }

  const e = err as Error | undefined;
  console.error("[error]", e?.name ?? "Error", e?.message ?? String(err));
  if (e?.stack) console.error(e.stack);
  // In production, never leak internal error details to the client.
  // In development, surface the error for easier debugging.
  const { isProduction } = getEnv();
  const message = isProduction
    ? "An unexpected error occurred. Please try again later."
    : e?.message?.trim()
      ? `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message.trim()}`
      : "Unexpected server error";
  res.status(500).json({ success: false, message });
}
