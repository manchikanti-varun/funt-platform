import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

type MediaKind = "VIDEO" | "YOUTUBE";

interface MediaTokenPayload {
  uid: string;
  bid: string;
  cid: string;
  ord: number;
  kind: MediaKind;
  iat?: number;
  exp?: number;
}

function mediaSecret(): string {
  return (process.env.MEDIA_LINK_SECRET?.trim() || getEnv().jwtSecret).trim();
}

export function signMediaToken(input: {
  studentId: string;
  batchId: string;
  courseId: string;
  chapterOrder?: number;
  moduleOrder?: number;
  kind: MediaKind;
  expiresIn?: string;
}): string {
  const resolvedOrder =
    input.chapterOrder != null ? Number(input.chapterOrder) : input.moduleOrder != null ? Number(input.moduleOrder) : NaN;
  if (!Number.isFinite(resolvedOrder)) {
    throw new Error("chapterOrder or moduleOrder is required");
  }
  const payload: Omit<MediaTokenPayload, "iat" | "exp"> = {
    uid: input.studentId,
    bid: input.batchId,
    cid: input.courseId,
    ord: resolvedOrder,
    kind: input.kind,
  };
  return jwt.sign(payload, mediaSecret(), {
    algorithm: "HS256",
    expiresIn: input.expiresIn ?? "30m",
  } as jwt.SignOptions);
}

export function verifyMediaToken(token: string): MediaTokenPayload {
  return jwt.verify(token, mediaSecret(), { algorithms: ["HS256"] }) as MediaTokenPayload;
}
