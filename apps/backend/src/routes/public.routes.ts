import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getExploreCourses } from "../controllers/enrollment.controller.js";

const router = Router();

// Public catalog endpoint for websites/landing pages.
// Uses the same explore source as LMS student view.
router.get(
  "/courses/explore",
  (_req: Request, res: Response, next: NextFunction) => {
    // Short CDN/browser cache for public catalog reads.
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    next();
  },
  getExploreCourses
);

export const publicRoutes = router;
