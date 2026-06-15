import mongoose, { Schema } from "mongoose";

const PAYMENT_STATUS = ["PENDING", "VERIFIED", "REJECTED"] as const;
const PAYMENT_KIND = ["COURSE", "SHOP"] as const;

const PAYMENT_METHOD = ["UPI_MANUAL", "RAZORPAY"] as const;

const paymentSubmissionSchema = new Schema(
  {
    kind: { type: String, required: true, enum: PAYMENT_KIND, default: "COURSE" },
    studentId: { type: String, required: true },
    batchId: { type: String, required: false },
    courseId: { type: String, required: false },
    productId: { type: String, required: false },
    transactionId: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: false, unique: true, sparse: true, index: true },
    paidAt: { type: Date, required: true },
    status: { type: String, required: true, enum: PAYMENT_STATUS, default: "PENDING" },
    verifiedBy: { type: String, required: false },
    verifiedAt: { type: Date, required: false },
    rejectReason: { type: String, required: false },
    paymentMethod: { type: String, required: false, enum: PAYMENT_METHOD, default: "UPI_MANUAL" },
    /** Amount student declared or gateway charged (INR paise). */
    amountPaise: { type: Number, required: false },
    /** Payer name as on UPI/bank (UPI_MANUAL). */
    payerName: { type: String, required: false },
    razorpayOrderId: { type: String, required: false },
    /** True after server verifies Razorpay signature (admin still confirms enrollment). */
    razorpayVerified: { type: Boolean, required: false, default: false },
    /** List price (paise) before enrollment coupon; optional when coupon used. */
    enrollmentListPaise: { type: Number, required: false },
    enrollmentDiscountPaise: { type: Number, required: false },
    couponId: { type: String, required: false },
    couponCode: { type: String, required: false, uppercase: true, trim: true },
    submitterIp: { type: String, required: false },
    deviceId: { type: String, required: false },
    riskFlags: { type: [String], required: false, default: [] },
    riskEscalatedAt: { type: Date, required: false },
    // ── Learning Plan extension ──────────────────────────────────────────
    /** When set, this payment is for a specific Learning Plan milestone (not the full course) */
    milestoneId:    { type: String, required: false },
    milestoneTitle: { type: String, required: false },
    shopCheckout: {
      items: {
        type: [
          new Schema(
            {
              productId: { type: String, required: true },
              productName: { type: String, required: true },
              quantity: { type: Number, required: true, min: 1 },
              unitPriceCoins: { type: Number, required: true, min: 0 },
              lineTotalCoins: { type: Number, required: true, min: 0 },
            },
            { _id: false }
          ),
        ],
        required: false,
        default: [],
      },
      couponCode: { type: String, required: false, uppercase: true, trim: true },
      couponDiscountCoins: { type: Number, required: false, min: 0 },
      totalCoinsAfterDiscount: { type: Number, required: false, min: 0 },
      coinsToRedeem: { type: Number, required: false, min: 0 },
      payablePaise: { type: Number, required: false, min: 0 },
      stockReserved: { type: Boolean, required: false, default: false },
      stockReservedUntil: { type: Date, required: false },
      address: {
        fullName: { type: String, required: false },
        phone: { type: String, required: false },
        line1: { type: String, required: false },
        line2: { type: String, required: false },
        city: { type: String, required: false },
        state: { type: String, required: false },
        postalCode: { type: String, required: false },
      },
    },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, required: true },
            note: { type: String, required: false },
            actorId: { type: String, required: false },
            at: { type: Date, required: true, default: Date.now },
          },
          { _id: false }
        ),
      ],
      required: false,
      default: [],
    },
  },
  { timestamps: true }
);

paymentSubmissionSchema.index({ studentId: 1, batchId: 1, courseId: 1, status: 1 });
paymentSubmissionSchema.index({ studentId: 1, productId: 1, status: 1 });
paymentSubmissionSchema.index({ milestoneId: 1, status: 1 }, { sparse: true });

export const PaymentSubmissionModel = mongoose.model("PaymentSubmission", paymentSubmissionSchema);
