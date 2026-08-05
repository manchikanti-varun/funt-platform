import { Router } from "express";
import type { Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { InstagramPostModel } from "../models/InstagramPost.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// ─── Public: Get active posts (used by marketing site) ───────────────────────
router.get(
  "/public",
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    const posts = await InstagramPostModel.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .select("postUrl label order")
      .lean()
      .exec();
    successRes(res, posts);
  })
);

// ─── Admin: List all posts ───────────────────────────────────────────────────
router.get(
  "/",
  authMiddleware,
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const posts = await InstagramPostModel.find()
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();
    successRes(res, posts);
  })
);

// ─── Admin: Add a post ───────────────────────────────────────────────────────
router.post(
  "/",
  authMiddleware,
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { postUrl, label, order } = req.body;
    if (!postUrl || typeof postUrl !== "string") {
      throw new AppError("postUrl is required", 400);
    }
    // Validate it looks like an Instagram URL
    const trimmed = postUrl.trim();
    if (!trimmed.includes("instagram.com/")) {
      throw new AppError("Must be a valid Instagram URL", 400);
    }
    const userId = (req as { user?: { userId?: string } }).user?.userId ?? "unknown";
    const post = await InstagramPostModel.create({
      postUrl: trimmed,
      label: (label ?? "").trim(),
      order: typeof order === "number" ? order : 0,
      active: true,
      addedBy: userId,
    });
    successRes(res, post, "Post added");
  })
);

// ─── Admin: Update a post ────────────────────────────────────────────────────
router.put(
  "/:id",
  authMiddleware,
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { postUrl, label, order, active } = req.body;
    const post = await InstagramPostModel.findById(id).exec();
    if (!post) throw new AppError("Post not found", 404);
    if (postUrl !== undefined) post.postUrl = postUrl.trim();
    if (label !== undefined) post.label = label.trim();
    if (order !== undefined) post.order = order;
    if (active !== undefined) post.active = active;
    await post.save();
    successRes(res, post, "Post updated");
  })
);

// ─── Admin: Delete a post ────────────────────────────────────────────────────
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await InstagramPostModel.findByIdAndDelete(id).exec();
    if (!result) throw new AppError("Post not found", 404);
    successRes(res, null, "Post deleted");
  })
);

export const instagramPostRoutes = router;
