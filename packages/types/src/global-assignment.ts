/**
 * Global assignment entity – reusable assignment template.
 */

import type { ASSIGNMENT_STATUS, SKILL_TAG } from "@funt-platform/constants";

export type SubmissionType = "file" | "text" | "link";

export interface GlobalAssignment {
  id: string;
  title: string;
  instructions: string;
  submissionType: SubmissionType;
  skillTags: SKILL_TAG[];
  status: ASSIGNMENT_STATUS;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
