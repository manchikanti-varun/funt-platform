import jwt from "jsonwebtoken";

const TYP = "parent_delegate" as const;

export interface ParentDelegatePayload {
  typ: typeof TYP;
  studentUserId: string;
  iat?: number;
  exp?: number;
}

export function signParentDelegateToken(studentUserId: string, secret: string, expiresIn: string): string {
  const payload: ParentDelegatePayload = { typ: TYP, studentUserId };
  return jwt.sign(payload, secret, { expiresIn, algorithm: "HS256" } as jwt.SignOptions);
}

export function verifyParentDelegateToken(token: string, secret: string): ParentDelegatePayload {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as ParentDelegatePayload;
  if (decoded.typ !== TYP || !decoded.studentUserId?.trim()) {
    throw new Error("Invalid parent delegate token");
  }
  return decoded;
}
