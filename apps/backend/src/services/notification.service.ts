/**
 * In-app notification service.
 * Fire-and-forget helpers — never throw so they don't interrupt main flows.
 */

import { NotificationModel } from "../models/Notification.model.js";

export type NotificationType =
  | "ENROLLMENT_APPROVED"
  | "ENROLLMENT_REJECTED"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "ASSIGNMENT_REVIEWED"
  | "CERTIFICATE_ISSUED"
  | "TICKET_UPDATED"
  | "TICKET_RESOLVED"
  | "TICKET_REPLIED"
  | "SHOP_ORDER_UPDATED"
  | "LICENSE_KEY_REDEEMED"
  | "LEAVE_APPLIED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED"
  | "LEAVE_PENDING_REVIEW"
  | "MILESTONE_UNLOCKED"
  | "MILESTONE_COMPLETED"
  | "MILESTONE_PAYMENT_DUE"
  | "MILESTONE_OVERDUE"
  | "GENERAL";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceId?: string;
}

/** Create a single in-app notification. */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await NotificationModel.create({
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      referenceId: input.referenceId,
    });
  } catch {
    // Notifications are non-critical — log but never throw
    console.error("[notification] Failed to create notification", input);
  }
}

/** Create notifications for multiple recipients. */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (!inputs.length) return;
  try {
    await NotificationModel.insertMany(inputs, { ordered: false });
  } catch {
    console.error("[notification] Failed to create bulk notifications");
  }
}

/** Get paginated notifications for a user. */
export async function getNotificationsForUser(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ notifications: object[]; total: number; unreadCount: number }> {
  const [notifications, total, unreadCount] = await Promise.all([
    NotificationModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    NotificationModel.countDocuments({ userId }).exec(),
    NotificationModel.countDocuments({ userId, read: false }).exec(),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body,
      type: n.type,
      referenceId: n.referenceId,
      read: n.read,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    total,
    unreadCount,
  };
}

/** Mark one notification as read. */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await NotificationModel.updateOne(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } }
  ).exec();
}

/** Mark all notifications as read for a user. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await NotificationModel.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  ).exec();
}
