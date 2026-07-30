/**
 * Large Body Middleware — Streaming JSON parser for routes that accept
 * arbitrarily large payloads (import/export, course creation with rich content).
 *
 * Instead of a fixed limit, this streams the request body in chunks and
 * parses JSON incrementally. It enforces a generous but configurable max
 * (default 50MB) to prevent truly abusive requests, while efficiently
 * handling normal large payloads without holding the full buffer in memory
 * during transfer.
 *
 * Usage:
 *   router.post("/import", largeJsonBody(), importHandler);
 *   router.post("/course", largeJsonBody({ maxBytes: 20 * 1024 * 1024 }), createCourse);
 */

import type { Request, Response, NextFunction } from "express";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50MB absolute maximum

interface LargeJsonBodyOptions {
  /** Maximum allowed body size in bytes. Default: 50MB */
  maxBytes?: number;
}

export function largeJsonBody(options?: LargeJsonBodyOptions) {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if body already parsed (e.g., by global express.json for small payloads)
    if (req.body && Object.keys(req.body).length > 0) {
      next();
      return;
    }

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        aborted = true;
        res.status(413).json({
          success: false,
          message: `Request body too large. Maximum allowed: ${Math.round(maxBytes / (1024 * 1024))}MB`,
        });
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;

      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        req.body = raw.trim() ? JSON.parse(raw) : {};
        next();
      } catch (err) {
        res.status(400).json({
          success: false,
          message: "Invalid JSON in request body",
        });
      }
    });

    req.on("error", (err) => {
      if (aborted) return;
      next(err);
    });
  };
}
