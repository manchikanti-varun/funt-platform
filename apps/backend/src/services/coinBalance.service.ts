import { UserModel } from "../models/User.model.js";
import { CoinGrantModel } from "../models/CoinGrant.model.js";
import { AppError } from "../utils/AppError.js";

/** FUNT coins expire 365 days after each grant. */
export const COIN_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

function addYearsFrom(d: Date): Date {
  return new Date(d.getTime() + COIN_VALIDITY_MS);
}

export async function expireGrantsForUser(userId: string): Promise<void> {
  const now = new Date();
  const expired = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $lte: now },
  })
    .select("_id amountRemaining")
    .lean()
    .exec();
  if (expired.length === 0) return;
  let totalLost = 0;
  for (const g of expired) {
    totalLost += (g as { amountRemaining: number }).amountRemaining;
  }
  await CoinGrantModel.updateMany(
    { _id: { $in: expired.map((x) => (x as { _id: unknown })._id) } },
    { $set: { amountRemaining: 0 } }
  ).exec();
  if (totalLost > 0) {
    await UserModel.updateOne({ _id: userId }, { $inc: { funtCoins: -totalLost } }).exec();
    const u = await UserModel.findById(userId).select("funtCoins").lean().exec();
    const bal = (u as { funtCoins?: number } | null)?.funtCoins ?? 0;
    if (bal < 0) await UserModel.updateOne({ _id: userId }, { $set: { funtCoins: 0 } }).exec();
  }
}

/** Backfill: if wallet balance exceeds sum of non-expired grant remainings, create a legacy tranche (expires in 1 year). */
export async function syncLegacyGrants(userId: string): Promise<void> {
  const now = new Date();
  const user = await UserModel.findById(userId).select("funtCoins").lean().exec();
  const wallet = Math.max(0, Math.floor((user as { funtCoins?: number } | null)?.funtCoins ?? 0));

  const active = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .select("amountRemaining")
    .lean()
    .exec();
  const sumGrants = active.reduce((s, g) => s + (g as { amountRemaining: number }).amountRemaining, 0);

  if (wallet > sumGrants) {
    const gap = wallet - sumGrants;
    await CoinGrantModel.create({
      userId,
      amountOriginal: gap,
      amountRemaining: gap,
      grantedAt: now,
      expiresAt: addYearsFrom(now),
      source: "LEGACY_SYNC",
    });
  } else if (wallet < sumGrants) {
    await UserModel.updateOne({ _id: userId }, { $set: { funtCoins: sumGrants } }).exec();
  }
}

export async function getSpendableBalance(userId: string): Promise<number> {
  await expireGrantsForUser(userId);
  await syncLegacyGrants(userId);
  const u = await UserModel.findById(userId).select("funtCoins").lean().exec();
  return Math.max(0, Math.floor((u as { funtCoins?: number } | null)?.funtCoins ?? 0));
}

export async function grantCoinsWithExpiry(
  userId: string,
  amount: number,
  source: "CERTIFICATE_GRANT" | "ADMIN_ADJUST",
  sourceRef?: string
): Promise<void> {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) throw new AppError("Invalid coin amount", 400);
  const now = new Date();
  await expireGrantsForUser(userId);
  await syncLegacyGrants(userId);
  await CoinGrantModel.create({
    userId,
    amountOriginal: n,
    amountRemaining: n,
    grantedAt: now,
    expiresAt: addYearsFrom(now),
    source,
    sourceRef,
  });
  await UserModel.updateOne({ _id: userId }, { $inc: { funtCoins: n } }).exec();
}

export async function spendCoins(userId: string, amount: number): Promise<void> {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < 1) throw new AppError("Invalid spend amount", 400);
  await expireGrantsForUser(userId);
  await syncLegacyGrants(userId);

  const user = await UserModel.findById(userId).select("funtCoins").lean().exec();
  const wallet = Math.max(0, Math.floor((user as { funtCoins?: number } | null)?.funtCoins ?? 0));
  if (wallet < n) throw new AppError("Not enough FUNT coins", 400);

  const now = new Date();
  const grants = await CoinGrantModel.find({
    userId,
    amountRemaining: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: 1 })
    .exec();

  let left = n;
  for (const g of grants) {
    if (left <= 0) break;
    const rem = g.amountRemaining;
    const take = Math.min(rem, left);
    g.amountRemaining = rem - take;
    left -= take;
    await g.save();
  }

  if (left > 0) throw new AppError("Not enough FUNT coins", 400);

  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, funtCoins: { $gte: n } },
    { $inc: { funtCoins: -n } },
    { new: true }
  )
    .select("funtCoins")
    .exec();
  if (!updated) throw new AppError("Not enough FUNT coins", 400);
}
