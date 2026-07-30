/**
 * Trainer Auto-Assignment Service
 * Round-robin assignment of trainers to new enrollments.
 * Tracks assignment count per trainer and assigns to the one with fewest active students.
 */

import { UserModel } from "../models/User.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { ROLE, ENROLLMENT_STATUS } from "@funt-platform/constants";

/**
 * Get the next trainer to assign via load-balanced round-robin.
 * Returns the trainer with the fewest active enrollments in the given batch.
 * If no trainers are available, returns the batch's default trainer.
 */
export async function getNextTrainerForBatch(batchId: string): Promise<string | null> {
  const batch = await BatchModel.findById(batchId).select("trainerId franchiseId").lean().exec();
  if (!batch) return null;

  const defaultTrainerId = String((batch as { trainerId?: string }).trainerId ?? "").trim();
  const franchiseId = (batch as { franchiseId?: string }).franchiseId;

  // Find all trainers (same franchise if applicable)
  const trainerQuery: Record<string, unknown> = {
    roles: ROLE.TRAINER,
    status: "ACTIVE",
  };
  if (franchiseId) trainerQuery.franchiseId = franchiseId;

  const trainers = await UserModel.find(trainerQuery)
    .select("_id")
    .lean()
    .exec();

  if (trainers.length === 0) return defaultTrainerId || null;

  const trainerIds = trainers.map((t) => String(t._id));

  // Count active enrollments per trainer's batches
  const enrollmentCounts = await EnrollmentModel.aggregate([
    {
      $match: {
        status: { $in: [ENROLLMENT_STATUS.ACTIVE] },
      },
    },
    {
      $lookup: {
        from: "batches",
        localField: "batchId",
        foreignField: "_id",
        as: "batch",
        pipeline: [{ $project: { trainerId: 1 } }],
      },
    },
    { $unwind: "$batch" },
    { $match: { "batch.trainerId": { $in: trainerIds } } },
    {
      $group: {
        _id: "$batch.trainerId",
        count: { $sum: 1 },
      },
    },
  ]).exec();

  // Build count map
  const countMap = new Map<string, number>();
  for (const tid of trainerIds) countMap.set(tid, 0);
  for (const row of enrollmentCounts) {
    countMap.set(String(row._id), row.count);
  }

  // Find trainer with fewest students
  let minTrainer = defaultTrainerId || trainerIds[0];
  let minCount = Infinity;
  for (const [tid, count] of countMap) {
    if (count < minCount) {
      minCount = count;
      minTrainer = tid;
    }
  }

  return minTrainer;
}
