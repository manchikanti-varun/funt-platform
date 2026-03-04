
import type { MODULE_STATUS } from "@funt-platform/constants";

export interface GlobalModule {
  id: string;
  title: string;
  description: string;
  content: string;
  youtubeUrl?: string;
  version: number;
  linkedAssignmentId?: string;
  status: MODULE_STATUS;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
