import { z } from "zod";
import { TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS } from "@funt-platform/constants";

const allCategories = [...Object.values(TICKET_CATEGORY), "CUSTOM"] as unknown as [string, ...string[]];
const allPriorities = Object.values(TICKET_PRIORITY) as [string, ...string[]];
const allStatuses = Object.values(TICKET_STATUS) as [string, ...string[]];

export const createTicketSchema = z.object({
  category: z.enum(allCategories),
  customCategory: z.string().min(1).max(100).optional(),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(300),
  description: z.string().min(10, "Description must be at least 10 characters").max(10000),
  priority: z.enum(allPriorities).optional(),
  attachments: z.array(z.string().url().refine(
    (url) => /^https?:\/\//i.test(url),
    { message: "Attachment URLs must use https://" }
  )).optional().default([]),
  /** Parent-only: the linked student's userId or username they are raising on behalf of */
  studentId: z.string().optional(),
}).refine(
  (d) => d.category !== "CUSTOM" || (d.customCategory && d.customCategory.trim().length > 0),
  { message: "customCategory is required when category is CUSTOM", path: ["customCategory"] }
);

export const replyTicketSchema = z.object({
  message: z.string().min(1, "Message is required").max(10000),
  attachments: z.array(z.string().url().refine(
    (url) => /^https?:\/\//i.test(url),
    { message: "Attachment URLs must use https://" }
  )).optional().default([]),
  isInternalNote: z.boolean().optional().default(false),
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().min(1, "assignedTo userId is required"),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(allStatuses),
});

export const updateTicketPrioritySchema = z.object({
  priority: z.enum(allPriorities),
});

export const resolveTicketSchema = z.object({
  resolution: z.string().min(1, "Resolution note is required").max(5000),
});
