import { z } from "zod";

export const createShopProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  description: z.string().max(5000).optional().default(""),
  priceCoins: z.number().int().min(0),
  priceInPaise: z.number().int().min(0).optional().default(0),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  category: z.string().max(100).optional().default(""),
  active: z.boolean().optional().default(true),
});

export const updateShopProductSchema = createShopProductSchema.partial();

export const updateShopOrderStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
  note: z.string().max(1000).optional(),
});

export const createCouponSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").max(30).toUpperCase(),
  kind: z.enum(["COURSE", "SHOP"]),
  courseId: z.string().optional(),
  batchId: z.string().optional(),
  audience: z.enum(["ALL_STUDENTS", "BATCH_STUDENTS"]).optional(),
  shopScope: z.enum(["ALL_ORDERS", "FIRST_ORDER"]).optional().default("ALL_ORDERS"),
  discountType: z.enum(["PERCENT"]),
  discountValue: z.number().min(0).max(100),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  perStudentLimit: z.number().int().min(1).max(100).optional().default(1),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  active: z.boolean().optional().default(true),
  notes: z.string().max(500).optional().default(""),
});

export const updateCouponSchema = createCouponSchema.partial().extend({
  active: z.boolean().optional(),
});
