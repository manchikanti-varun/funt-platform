import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "funt-platform-api",
  });
});

router.get("/ping", (_req, res) => {
  res.status(200).json({ ok: true });
});

export const healthRouter = router;
