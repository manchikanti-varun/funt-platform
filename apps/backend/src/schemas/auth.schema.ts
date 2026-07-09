import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  email: z.string().email().max(200).optional(),
  password: z.string().min(1, "Password is required").max(200),
  portal: z.enum(["admin", "lms"]).optional(),
});

/** Mobile: 10 digits (local) or + followed by 11-14 digits (international, e.g. +916305930640) */
const mobileSchema = z.string()
  .regex(/^\+?\d{10,14}$/, "Mobile must be 10 digits or +countrycode followed by digits (e.g. +916305930640)")
  .refine((v) => {
    const digits = v.replace(/^\+/, "");
    return digits.length === 10 || (v.startsWith("+") && digits.length >= 11 && digits.length <= 14);
  }, "Mobile must be exactly 10 digits or + followed by 11-14 digits");

export const studentSignupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobile: mobileSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
  age: z.coerce.number().int().min(7, "Minimum age is 7 years").max(100),
  address: z.string({ message: "Address is required" }).min(1, "Address is required").max(500),
  class: z.string().max(50).optional(),
  gradeOther: z.string().max(100).optional(),
  schoolName: z.string({ message: "School / college name is required" }).min(1, "School / college name is required").max(200),
  city: z.string().max(100).optional(),
  signupToken: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
