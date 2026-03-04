/**
 * Course entity – curriculum container with snapshotted modules.
 */

import type { COURSE_STATUS } from "@funt-platform/constants";

export interface Course {
  id: string;
  title: string;
  description: string;
  /** Snapshotted module IDs (references to module versions at course creation) */
  modules: string[];
  version: number;
  status: COURSE_STATUS;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
