/**
 * Standardized API response format.
 */

import type { Response } from "express";

export function successRes(
  res: Response,
  data?: unknown,
  message?: string,
  statusCode = 200
): Response {
  const body: { success: true; message?: string; data?: unknown } = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}
