
import type { BATCH_STATUS } from "@funt-platform/constants";

export interface Batch {
  id: string;
  name: string;
  courseId: string;
  trainerId: string;
  startDate: Date;
  endDate?: Date;
  zoomLink?: string;
  status: BATCH_STATUS;
  createdAt: Date;
  updatedAt: Date;
}
