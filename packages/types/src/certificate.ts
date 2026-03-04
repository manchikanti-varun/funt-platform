/**
 * Certificate entity – issued completion certificate.
 */

export interface Certificate {
  id: string;
  certificateId: string;
  studentId: string;
  courseId: string;
  issuedAt: Date;
}
