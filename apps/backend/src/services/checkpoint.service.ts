import { VideoCheckpointModel } from "../models/VideoCheckpoint.model.js";
import { VideoCheckpointProgressModel } from "../models/VideoCheckpointProgress.model.js";
import { UserModel } from "../models/User.model.js";
import { AppError } from "../utils/AppError.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckpointType = "mcq" | "true_false" | "multi_select" | "fill_blank" | "code_output";

interface CheckpointInput {
  moduleId: string;
  videoKey: string;
  questionTimestamp: number;
  reviewTimestamp: number;
  question: string;
  type: CheckpointType;
  options?: { optionId: string; text: string }[];
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctText?: string;
  acceptableAnswers?: string[];
  codeSnippet?: string;
  codeLanguage?: string;
  explanation?: string;
  bonusXp?: number;
  createdBy: string;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export async function createCheckpoint(input: CheckpointInput) {
  const doc = await VideoCheckpointModel.create({
    ...input,
    isActive: true,
    order: input.questionTimestamp,
  });
  return doc.toJSON();
}

export async function updateCheckpoint(
  checkpointId: string,
  input: Partial<Omit<CheckpointInput, "moduleId" | "videoKey" | "createdBy">> & { isActive?: boolean }
) {
  const doc = await VideoCheckpointModel.findById(checkpointId);
  if (!doc) throw new AppError("Checkpoint not found", 404);

  const newQT = input.questionTimestamp ?? doc.questionTimestamp;
  const newRT = input.reviewTimestamp ?? doc.reviewTimestamp;
  if (newRT >= newQT) {
    throw new AppError("reviewTimestamp must be less than questionTimestamp", 400);
  }

  Object.assign(doc, input);
  if (input.questionTimestamp !== undefined) {
    doc.order = input.questionTimestamp;
  }
  await doc.save();
  return doc.toJSON();
}

export async function deleteCheckpoint(checkpointId: string) {
  const doc = await VideoCheckpointModel.findByIdAndDelete(checkpointId);
  if (!doc) throw new AppError("Checkpoint not found", 404);
  return { deleted: true };
}

export async function listCheckpoints(moduleId: string) {
  return VideoCheckpointModel.find({ moduleId })
    .sort({ questionTimestamp: 1 })
    .lean()
    .exec();
}

export async function getCheckpointById(checkpointId: string) {
  const doc = await VideoCheckpointModel.findById(checkpointId).lean().exec();
  if (!doc) throw new AppError("Checkpoint not found", 404);
  return doc;
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export async function bulkImportCheckpoints(
  moduleId: string,
  videoKey: string,
  checkpoints: Omit<CheckpointInput, "moduleId" | "videoKey" | "createdBy">[],
  createdBy: string
) {
  const docs = checkpoints.map((cp) => ({
    ...cp,
    moduleId,
    videoKey,
    createdBy,
    isActive: true,
    order: cp.questionTimestamp,
  }));
  const result = await VideoCheckpointModel.insertMany(docs);
  return { imported: result.length };
}

// ─── Duplicate from another module ────────────────────────────────────────────

export async function duplicateCheckpoints(
  sourceModuleId: string,
  targetModuleId: string,
  targetVideoKey: string,
  createdBy: string
) {
  const sources = await VideoCheckpointModel.find({ moduleId: sourceModuleId }).lean().exec();
  if (sources.length === 0) throw new AppError("No checkpoints found in source module", 404);

  const docs = sources.map((cp) => ({
    moduleId: targetModuleId,
    videoKey: targetVideoKey,
    questionTimestamp: cp.questionTimestamp,
    reviewTimestamp: cp.reviewTimestamp,
    question: cp.question,
    type: cp.type,
    options: cp.options,
    correctOptionId: cp.correctOptionId,
    correctOptionIds: (cp as { correctOptionIds?: string[] }).correctOptionIds ?? [],
    correctText: (cp as { correctText?: string }).correctText,
    acceptableAnswers: (cp as { acceptableAnswers?: string[] }).acceptableAnswers ?? [],
    codeSnippet: (cp as { codeSnippet?: string }).codeSnippet,
    codeLanguage: (cp as { codeLanguage?: string }).codeLanguage ?? "",
    explanation: cp.explanation,
    bonusXp: (cp as { bonusXp?: number }).bonusXp ?? 5,
    isActive: cp.isActive,
    order: cp.order,
    createdBy,
  }));

  const result = await VideoCheckpointModel.insertMany(docs);
  return { duplicated: result.length };
}

// ─── Export checkpoints as JSON ───────────────────────────────────────────────

export async function exportCheckpoints(moduleId: string) {
  const checkpoints = await VideoCheckpointModel.find({ moduleId })
    .sort({ questionTimestamp: 1 })
    .lean()
    .exec();

  return checkpoints.map((cp) => ({
    questionTimestamp: cp.questionTimestamp,
    reviewTimestamp: cp.reviewTimestamp,
    question: cp.question,
    type: cp.type,
    options: cp.options,
    correctOptionId: cp.correctOptionId,
    correctOptionIds: (cp as { correctOptionIds?: string[] }).correctOptionIds ?? [],
    correctText: (cp as { correctText?: string }).correctText,
    acceptableAnswers: (cp as { acceptableAnswers?: string[] }).acceptableAnswers ?? [],
    codeSnippet: (cp as { codeSnippet?: string }).codeSnippet,
    codeLanguage: (cp as { codeLanguage?: string }).codeLanguage ?? "",
    explanation: cp.explanation ?? "",
    bonusXp: (cp as { bonusXp?: number }).bonusXp ?? 5,
  }));
}

// ─── Student: get checkpoints for a module (without correct answer) ───────────

export async function getStudentCheckpoints(moduleId: string) {
  const checkpoints = await VideoCheckpointModel.find({ moduleId, isActive: true })
    .sort({ questionTimestamp: 1 })
    .lean()
    .exec();

  // Strip all answer fields — student must submit to backend for validation
  return checkpoints.map((cp) => ({
    _id: cp._id,
    moduleId: cp.moduleId,
    questionTimestamp: cp.questionTimestamp,
    reviewTimestamp: cp.reviewTimestamp,
    question: cp.question,
    type: cp.type,
    options: cp.options,
    codeSnippet: (cp as { codeSnippet?: string }).codeSnippet,
    codeLanguage: (cp as { codeLanguage?: string }).codeLanguage ?? "",
    bonusXp: (cp as { bonusXp?: number }).bonusXp ?? 5,
    // NO correctOptionId, correctOptionIds, correctText, acceptableAnswers
  }));
}

// ─── Student: submit answer ───────────────────────────────────────────────────

export async function submitAnswer(input: {
  userId: string;
  checkpointId: string;
  moduleId: string;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}) {
  const checkpoint = await VideoCheckpointModel.findById(input.checkpointId).lean().exec();
  if (!checkpoint) throw new AppError("Checkpoint not found", 404);
  if (checkpoint.moduleId !== input.moduleId) {
    throw new AppError("Checkpoint does not belong to this module", 400);
  }

  // Validate answer based on type
  const isCorrect = validateAnswer(checkpoint, input);

  // Upsert progress
  let progressDoc = await VideoCheckpointProgressModel.findOne({
    userId: input.userId,
    moduleId: input.moduleId,
  });

  if (!progressDoc) {
    progressDoc = new VideoCheckpointProgressModel({
      userId: input.userId,
      moduleId: input.moduleId,
      checkpoints: [],
      currentStreak: 0,
      bestStreak: 0,
      totalXpEarned: 0,
    });
  }

  // Find or create the entry for this checkpoint
  let entry = progressDoc.checkpoints.find(
    (c) => c.checkpointId === input.checkpointId
  );
  if (!entry) {
    progressDoc.checkpoints.push({
      checkpointId: input.checkpointId,
      attempts: 0,
      completed: false,
      firstAttemptCorrect: false,
    });
    entry = progressDoc.checkpoints[progressDoc.checkpoints.length - 1];
  }

  entry.attempts += 1;

  let xpAwarded = 0;

  if (isCorrect) {
    entry.completed = true;
    entry.completedAt = new Date();

    // Streak tracking
    progressDoc.currentStreak = (progressDoc.currentStreak ?? 0) + 1;
    if (progressDoc.currentStreak > (progressDoc.bestStreak ?? 0)) {
      progressDoc.bestStreak = progressDoc.currentStreak;
    }

    // First-attempt bonus
    const bonusXp = (checkpoint as { bonusXp?: number }).bonusXp ?? 5;
    if (entry.attempts === 1) {
      entry.firstAttemptCorrect = true;
      xpAwarded = bonusXp;
    } else {
      // Partial XP for eventually getting it right
      xpAwarded = Math.max(1, Math.floor(bonusXp / 2));
    }

    progressDoc.totalXpEarned = (progressDoc.totalXpEarned ?? 0) + xpAwarded;

    // Award XP to user
    if (xpAwarded > 0) {
      await UserModel.updateOne({ _id: input.userId }, { $inc: { studentXp: xpAwarded } }).exec();
    }
  } else {
    // Reset streak on wrong answer
    progressDoc.currentStreak = 0;
  }

  await progressDoc.save();

  return {
    correct: isCorrect,
    attempts: entry.attempts,
    completed: entry.completed,
    reviewTimestamp: isCorrect ? undefined : checkpoint.reviewTimestamp,
    explanation: checkpoint.explanation || undefined,
    xpAwarded,
    currentStreak: progressDoc.currentStreak,
    bestStreak: progressDoc.bestStreak,
    totalXpEarned: progressDoc.totalXpEarned,
  };
}

// ─── Answer validation logic ──────────────────────────────────────────────────

function validateAnswer(
  checkpoint: Record<string, unknown>,
  input: { selectedOptionId?: string; selectedOptionIds?: string[]; textAnswer?: string }
): boolean {
  const type = checkpoint.type as CheckpointType;

  switch (type) {
    case "mcq":
    case "true_false":
      return input.selectedOptionId === checkpoint.correctOptionId;

    case "multi_select": {
      const correct = (checkpoint.correctOptionIds as string[]) ?? [];
      const selected = input.selectedOptionIds ?? [];
      if (selected.length !== correct.length) return false;
      const sortedCorrect = [...correct].sort();
      const sortedSelected = [...selected].sort();
      return sortedCorrect.every((id, i) => id === sortedSelected[i]);
    }

    case "fill_blank":
    case "code_output": {
      const answer = (input.textAnswer ?? "").trim().toLowerCase();
      if (!answer) return false;
      const correctText = ((checkpoint.correctText as string) ?? "").trim().toLowerCase();
      if (answer === correctText) return true;
      const acceptable = (checkpoint.acceptableAnswers as string[]) ?? [];
      return acceptable.some((alt) => alt.trim().toLowerCase() === answer);
    }

    default:
      return false;
  }
}

// ─── Student: get progress for a module ───────────────────────────────────────

export async function getStudentProgress(userId: string, moduleId: string) {
  const doc = await VideoCheckpointProgressModel.findOne({ userId, moduleId }).lean().exec();
  if (!doc) {
    return { checkpoints: [], lastPosition: 0, currentStreak: 0, bestStreak: 0, totalXpEarned: 0 };
  }
  return {
    checkpoints: doc.checkpoints,
    lastPosition: doc.lastPosition ?? 0,
    currentStreak: (doc as { currentStreak?: number }).currentStreak ?? 0,
    bestStreak: (doc as { bestStreak?: number }).bestStreak ?? 0,
    totalXpEarned: (doc as { totalXpEarned?: number }).totalXpEarned ?? 0,
  };
}

// ─── Student: save video position ─────────────────────────────────────────────

export async function saveVideoPosition(userId: string, moduleId: string, position: number) {
  await VideoCheckpointProgressModel.findOneAndUpdate(
    { userId, moduleId },
    { $set: { lastPosition: position }, $setOnInsert: { checkpoints: [], currentStreak: 0, bestStreak: 0, totalXpEarned: 0 } },
    { upsert: true }
  );
}

// ─── Admin: Migrate checkpoints from temp module ID to real ID ────────────────

export async function migrateCheckpoints(tempModuleId: string, realModuleId: string) {
  const result = await VideoCheckpointModel.updateMany(
    { moduleId: tempModuleId },
    { $set: { moduleId: realModuleId } }
  );
  return { migrated: result.modifiedCount };
}
