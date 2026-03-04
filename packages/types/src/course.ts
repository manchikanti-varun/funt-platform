
import type { COURSE_STATUS } from "@funt-platform/constants";

export interface Course {
  id: string;
  title: string;
  description: string;
    modules: string[];
  version: number;
  status: COURSE_STATUS;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
