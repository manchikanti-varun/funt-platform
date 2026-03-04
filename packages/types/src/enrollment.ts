
import type { ENROLLMENT_STATUS } from "@funt-platform/constants";

export interface Enrollment {
  id: string;
  studentId: string;
  batchId: string;
  status: ENROLLMENT_STATUS;
  enrolledAt: Date;
}
