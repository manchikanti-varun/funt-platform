import { UserModel } from "../models/User.model.js";
import { CoinGrantModel } from "../models/CoinGrant.model.js";
import { AppError } from "../utils/AppError.js";
import type { ClientSession } from "mongoose";

/** FUNT coins expire 30 days after each grant (per tranche). */
export const COIN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

function addYearsFrom(d: Date): Date {
  return new Date(d.getTime() + COIN_VALIDITY_MS);
}

export async function expireGrantsForUser(userId: string, session?: ClientSession): Promise<void> {
  const now = new Date();
  const expired = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $lte: now },
  })
    .select("_id amountRemaining")
    .lean()
    .session(session ?? null)
    .exec();
  if (expired.length === 0) return;
  let totalLost = 0;
  for (const g of expired) {
    totalLost += (g as { amountRemaining: number }).amountRemaining;
  }
  await CoinGrantModel.updateMany(
    { _id: { $in: expired.map((x) => (x as { _id: unknown })._id) } },
    { $set: { amountRemaining: 0 } }
  ).session(session ?? null).exec();
  if (totalLost > 0) {
    await UserModel.updateOne({ _id: userId }, { $inc: { funtCoins: -totalLost } }, session ? { session } : undefined).exec();
    const u = await UserModel.findById(userId).select("funtCoins").session(session ?? null).lean().exec();
    const bal = (u as { funtCoins?: number } | null)?.funtCoins ?? 0;
    if (bal < 0) await UserModel.updateOne({ _id: userId }, { $set: { funtCoins: 0 } }, session ? { session } : undefined).exec();
  }
}

/** Backfill: if wallet balance exceeds sum of non-expired grant remainings, create a legacy tranche (same validity as {@link COIN_VALIDITY_MS}). */
export async function syncLegacyGrants(userId: string, session?: ClientSession): Promise<void> {
  const now = new Date();
  const user = await UserModel.findById(userId).select("funtCoins").session(session ?? null).lean().exec();
  const wallet = Math.max(0, Math.floor((user as { funtCoins?: number } | null)?.funtCoins ?? 0));

  const active = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .select("amountRemaining")
    .lean()
    .session(session ?? null)
    .exec();
  const sumGrants = active.reduce((s, g) => s + (g as { amountRemaining: number }).amountRemaining, 0);

  if (wallet > sumGrants) {
    const gap = wallet - sumGrants;
    await CoinGrantModel.create(
      [
        {
          userId,
          amountOriginal: gap,
          amountRemaining: gap,
          grantedAt: now,
          expiresAt: addYearsFrom(now),
          source: "LEGACY_SYNC",
        },
      ],
      session ? { session } : undefined
    );
  } else if (wallet < sumGrants) {
    await UserModel.updateOne({ _id: userId }, { $set: { funtCoins: sumGrants } }, session ? { session } : undefined).exec();
  }
}

export async function getSpendableBalance(userId: string): Promise<number> {
  await expireGrantsForUser(userId);
  await syncLegacyGrants(userId);
  const u = await UserModel.findById(userId).select("funtCoins").lean().exec();
  return Math.max(0, Math.floor((u as { funtCoins?: number } | null)?.funtCoins ?? 0));
}

export type CoinGrantSource = "CERTIFICATE_GRANT" | "BATCH_COMPLETION" | "ADMIN_ADJUST";

export async function grantCoinsWithExpiry(
  userId: string,
  amount: number,
  source: CoinGrantSource,
  sourceRef?: string,
  session?: ClientSession
): Promise<void> {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) throw new AppError("Invalid coin amount", 400);
  const now = new Date();
  await expireGrantsForUser(userId, session);
  await syncLegacyGrants(userId, session);
  await CoinGrantModel.create(
    [
      {
        userId,
        amountOriginal: n,
        amountRemaining: n,
        grantedAt: now,
        expiresAt: addYearsFrom(now),
        source,
        sourceRef,
      },
    ],
    session ? { session } : undefined
  );
  await UserModel.updateOne({ _id: userId }, { $inc: { funtCoins: n } }, session ? { session } : undefined).exec();
}

export interface CoinGrantHistoryRow {
  id: string;
  amountOriginal: number;
  amountRemaining: number;
  grantedAt: string;
  expiresAt: string;
  source: string;
  sourceRef?: string;
}

/** Ledger rows for grants (excludes pure expiry bookkeeping; shows tranches as stored). */
export async function listCoinGrantHistoryForUser(userId: string, limit = 200): Promise<CoinGrantHistoryRow[]> {
  await expireGrantsForUser(userId);
  await syncLegacyGrants(userId);
  const rows = await CoinGrantModel.find({ userId })
    .sort({ grantedAt: -1 })
    .limit(Math.min(500, Math.max(1, Math.floor(Number(limit)) || 200)))
    .lean()
    .exec();
  return rows.map((g) => {
    const r = g as {
      _id: unknown;
      amountOriginal: number;
      amountRemaining: number;
      grantedAt: Date;
      expiresAt: Date;
      source: string;
      sourceRef?: string;
    };
    return {
      id: String(r._id),
      amountOriginal: r.amountOriginal,
      amountRemaining: r.amountRemaining,
      grantedAt: new Date(r.grantedAt).toISOString(),
      expiresAt: new Date(r.expiresAt).toISOString(),
      source: r.source,
      sourceRef: r.sourceRef,
    };
  });
}

export async function spendCoins(userId: string, amount: number, session?: ClientSession): Promise<void> {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) throw new AppError("Invalid spend amount", 400);
  await expireGrantsForUser(userId, session);
  await syncLegacyGrants(userId, session);

  const user = await UserModel.findById(userId).select("funtCoins").session(session ?? null).lean().exec();
  const wallet = Math.max(0, Math.floor((user as { funtCoins?: number } | null)?.funtCoins ?? 0));
  if (wallet < n) throw new AppError("Not enough FUNT coins", 400);

  const now = new Date();
  const grants = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: 1 })
    .session(session ?? null)
    .exec();

  let left = n;
  for (const g of grants) {
    if (left <= 0) break;
    const rem = g.amountRemaining;
    const take = Math.min(rem, left);
    g.amountRemaining = rem - take;
    left -= take;
    await g.save(session ? { session } : undefined);
  }

  if (left > 0) throw new AppError("Not enough FUNT coins", 400);

  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, funtCoins: { $gte: n } },
    { $inc: { funtCoins: -n } },
    { new: true, ...(session ? { session } : {}) }
  )
    .select("funtCoins")
    .exec();
  if (!updated) throw new AppError("Not enough FUNT coins", 400);
}
