/**
 * Revenue Analytics Service
 * Monthly revenue, payment method breakdown, coupon usage, franchise split.
 */

import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";
import { CouponRedemptionModel } from "../models/CouponRedemption.model.js";

export async function getRevenueAnalytics(options?: { months?: number }) {
  const monthsBack = Math.min(24, Math.max(1, options?.months ?? 6));
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Monthly revenue from verified payments
  const monthlyRevenue = await PaymentSubmissionModel.aggregate([
    {
      $match: {
        status: "VERIFIED",
        verifiedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$verifiedAt" },
          month: { $month: "$verifiedAt" },
        },
        totalPaise: { $sum: "$amountInPaise" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]).exec();

  // Payment method breakdown
  const methodBreakdown = await PaymentSubmissionModel.aggregate([
    {
      $match: {
        status: "VERIFIED",
        verifiedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        totalPaise: { $sum: "$amountInPaise" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalPaise: -1 } },
  ]).exec();

  // Coupon usage stats
  const couponUsage = await CouponRedemptionModel.aggregate([
    {
      $match: {
        redeemedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$couponCode",
        count: { $sum: 1 },
        totalDiscountPaise: { $sum: "$discountAmountPaise" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).exec();

  // Total summary
  const totalVerified = await PaymentSubmissionModel.countDocuments({
    status: "VERIFIED",
    verifiedAt: { $gte: startDate },
  }).exec();

  const totalRevenuePaise = monthlyRevenue.reduce((s, m) => s + (m.totalPaise ?? 0), 0);

  // Pending payments
  const pendingCount = await PaymentSubmissionModel.countDocuments({ status: "PENDING" }).exec();

  return {
    period: { months: monthsBack, startDate: startDate.toISOString() },
    summary: {
      totalRevenuePaise,
      totalRevenueRupees: Math.round(totalRevenuePaise / 100),
      totalPayments: totalVerified,
      pendingPayments: pendingCount,
    },
    monthlyRevenue: monthlyRevenue.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      totalPaise: m.totalPaise,
      totalRupees: Math.round(m.totalPaise / 100),
      count: m.count,
    })),
    paymentMethods: methodBreakdown.map((m) => ({
      method: m._id ?? "UNKNOWN",
      totalPaise: m.totalPaise,
      totalRupees: Math.round(m.totalPaise / 100),
      count: m.count,
    })),
    topCoupons: couponUsage.map((c) => ({
      code: c._id,
      redemptions: c.count,
      totalDiscountRupees: Math.round((c.totalDiscountPaise ?? 0) / 100),
    })),
  };
}
