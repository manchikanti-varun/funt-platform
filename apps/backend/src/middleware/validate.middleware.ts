import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";

/**
 * Express middleware that validates `req.body` against a Zod schema.
 * On success, replaces `req.body` with the parsed (coerced/stripped) value.
 * On failure, returns 400 with structured validation errors.
 *
 * Usage:
 *   import { z } from "zod";
 *   import { validateBody } from "../middleware/validate.middleware.js";
 *
 *   const schema = z.object({ title: z.string().min(1), email: z.string().email() });
 *   router.post("/items", validateBody(schema), createItem);
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: errors[0] ?? "Validation failed",
        errors,
      });
      return;
    }
    // Replace body with parsed value (applies defaults, strips unknown keys, coerces types)
    req.body = result.data;
    next();
  };
}

/**
 * Validates `req.query` against a Zod schema.
 * Useful for GET endpoints with structured query parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: errors[0] ?? "Invalid query parameters",
        errors,
      });
      return;
    }
    // Store parsed query on request for handlers to use
    (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
    next();
  };
}

/**
 * Validates `req.params` against a Zod schema.
 * Useful for enforcing param formats (e.g., MongoDB ObjectId pattern).
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: errors[0] ?? "Invalid URL parameters",
        errors,
      });
      return;
    }
    next();
  };
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}
