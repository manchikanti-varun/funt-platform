import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import { listStaffForPickers } from "../services/staffPicker.service.js";

function uid(req: Request): string | undefined {
  return req.user?.userId ?? undefined;
}

/** GET ?variant=moderators|trainer&excludeSelf=true — staff rows for dropdowns / checklists */
export const getStaffPickersList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const variantRaw = String(req.query.variant ?? "trainer").toLowerCase();
  const variant = variantRaw === "moderators" ? "moderators" : "trainer";
  const excludeSelf =
    req.query.excludeSelf === "1" ||
    req.query.excludeSelf === "true" ||
    String(req.query.excludeSelf ?? "").toLowerCase() === "yes";

  let excludeUserId: string | undefined;
  if (excludeSelf) {
    const id = uid(req);
    if (!id) throw new AppError("Unauthorized", 401);
    excludeUserId = id;
  }

  const rows = await listStaffForPickers({ variant, excludeUserId });
  successRes(res, rows);
});
