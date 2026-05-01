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
  moduleOrder: number;
  kind: MediaKind;
  expiresIn?: string;
}): string {
  const payload: Omit<MediaTokenPayload, "iat" | "exp"> = {
    uid: input.studentId,
    bid: input.batchId,
    cid: input.courseId,
    ord: input.moduleOrder,
    kind: input.kind,
  };
  return jwt.sign(payload, mediaSecret(), {
    algorithm: "HS256",
    expiresIn: input.expiresIn ?? "10m",
  } as jwt.SignOptions);
}

export function verifyMediaToken(token: string): MediaTokenPayload {
  return jwt.verify(token, mediaSecret(), { algorithms: ["HS256"] }) as MediaTokenPayload;
}
