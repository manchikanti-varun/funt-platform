
import { Router } from "express";
import type { User } from "@funt-platform/types";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";

const router = Router();

router.get("/", (_req, res) => {
  const systemUser: User = {
    id: "system",
    funtId: "FS-00-00000",
    name: "API",
    email: "api@funt.in",
    mobile: "",
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: systemUser,
  });
});

export const healthRouter = router;
