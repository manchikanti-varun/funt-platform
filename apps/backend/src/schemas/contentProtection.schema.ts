import { z } from "zod";

const protectionPolicySchema = z.object({
  disableRightClick: z.boolean().optional(),
  disableCopy: z.boolean().optional(),
  disableScreenshot: z.boolean().optional(),
  disablePrintScreen: z.boolean().optional(),
  disableDevTools: z.boolean().optional(),
  enableWatermark: z.boolean().optional(),
  blurOnTabSwitch: z.boolean().optional(),
}).optional();

const watermarkSettingsSchema = z.object({
  text: z.string().max(200).optional(),
  fontSize: z.number().min(8).max(72).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.number().min(-90).max(90).optional(),
  color: z.string().max(20).optional(),
  includeUsername: z.boolean().optional(),
  includeDateTime: z.boolean().optional(),
}).optional();

export const updateContentProtectionSchema = z.object({
  lmsProtection: protectionPolicySchema,
  adminProtection: protectionPolicySchema,
  watermark: watermarkSettingsSchema,
});
