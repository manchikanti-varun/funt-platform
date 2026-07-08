/**
 * Chat Analytics Service — metrics for live support conversations.
 */

import { TicketModel } from "../models/Ticket.model.js";
import { UserModel } from "../models/User.model.js";

interface DateRange { start: Date; end: Date }

function getDateRange(period: "today" | "week" | "month"): DateRange {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end: now };
}

export async function getChatAnalytics(period: "today" | "week" | "month" = "week") {
  const { start, end } = getDateRange(period);

  const filter = {
    isLiveChat: true,
    createdAt: { $gte: start, $lte: end },
  };

  const tickets = await TicketModel.find(filter)
    .select("createdAt firstResponseAt resolvedAt assignedTo chatRating liveChatStatus")
    .lean()
    .exec();

  const totalChats = tickets.length;
  const resolvedChats = tickets.filter((t) => (t as { liveChatStatus?: string }).liveChatStatus === "CLOSED").length;
  const ratedChats = tickets.filter((t) => (t as { chatRating?: number }).chatRating);
  const avgRating = ratedChats.length > 0
    ? ratedChats.reduce((sum, t) => sum + ((t as { chatRating?: number }).chatRating ?? 0), 0) / ratedChats.length
    : 0;

  // Average response time (time from creation to firstResponseAt)
  let totalResponseMs = 0;
  let responseCount = 0;
  for (const t of tickets) {
    const created = (t as { createdAt?: Date }).createdAt;
    const firstResp = t.firstResponseAt;
    if (created && firstResp) {
      totalResponseMs += new Date(firstResp).getTime() - new Date(created).getTime();
      responseCount++;
    }
  }
  const avgResponseSeconds = responseCount > 0 ? Math.round(totalResponseMs / responseCount / 1000) : 0;

  // Average resolution time
  let totalResolutionMs = 0;
  let resolutionCount = 0;
  for (const t of tickets) {
    const created = (t as { createdAt?: Date }).createdAt;
    const resolved = t.resolvedAt;
    if (created && resolved) {
      totalResolutionMs += new Date(resolved).getTime() - new Date(created).getTime();
      resolutionCount++;
    }
  }
  const avgResolutionMinutes = resolutionCount > 0 ? Math.round(totalResolutionMs / resolutionCount / 60000) : 0;

  // Chats per agent
  const agentMap = new Map<string, number>();
  for (const t of tickets) {
    if (t.assignedTo) {
      agentMap.set(t.assignedTo, (agentMap.get(t.assignedTo) ?? 0) + 1);
    }
  }
  const agentIds = [...agentMap.keys()];
  const agents = agentIds.length > 0
    ? await UserModel.find({ _id: { $in: agentIds } }).select("name username").lean().exec()
    : [];
  const agentNameMap = new Map(agents.map((a) => [String(a._id), (a as { name?: string }).name ?? ""]));

  const chatsPerAgent = [...agentMap.entries()]
    .map(([id, count]) => ({ agentId: id, agentName: agentNameMap.get(id) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count);

  // Peak hours (hour of day distribution)
  const hourCounts = new Array(24).fill(0);
  for (const t of tickets) {
    const created = (t as { createdAt?: Date }).createdAt;
    if (created) hourCounts[new Date(created).getHours()]++;
  }
  const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

  return {
    period,
    totalChats,
    resolvedChats,
    resolutionRate: totalChats > 0 ? Math.round((resolvedChats / totalChats) * 100) : 0,
    avgRating: Math.round(avgRating * 10) / 10,
    ratedCount: ratedChats.length,
    avgResponseSeconds,
    avgResolutionMinutes,
    chatsPerAgent,
    peakHours,
  };
}
