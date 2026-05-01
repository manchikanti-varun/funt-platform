import { Router } from "express";
import mongoose from "mongoose";

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

router.get("/ready", (_req, res) => {
  const state = mongoose.connection.readyState;
  // 1 = connected, 2 = connecting
  const ready = state === 1 || state === 2;
  const stateLabel =
    state === 0 ? "disconnected" :
    state === 1 ? "connected" :
    state === 2 ? "connecting" :
    state === 3 ? "disconnecting" :
    "unknown";
  if (!ready) {
    res.status(503).json({
      ok: false,
      service: "funt-platform-api",
      db: stateLabel,
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.status(200).json({
    ok: true,
    service: "funt-platform-api",
    db: stateLabel,
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
