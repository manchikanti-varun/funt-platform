import { LetterSettingsModel } from "../models/LetterSettings.model.js";

export type LetterSettingsDoc = Record<string, unknown>;

/**
 * Get or create the global letter settings document.
 */
export async function getLetterSettings(): Promise<LetterSettingsDoc> {
  let settings = await LetterSettingsModel.findById("global").lean().exec();
  if (!settings) {
    const created = await LetterSettingsModel.create({ _id: "global" });
    settings = created.toObject();
  }
  return settings as unknown as LetterSettingsDoc;
}

/**
 * Update letter settings. Increments version on every save.
 */
export async function updateLetterSettings(updates: Record<string, unknown>, _updatedBy: string): Promise<LetterSettingsDoc> {
  const current = await LetterSettingsModel.findById("global").exec();
  if (!current) {
    const created = await LetterSettingsModel.create({ _id: "global", ...updates, version: 1 });
    return created.toJSON() as LetterSettingsDoc;
  }

  const safeFields = [
    "companyName", "companyAddress", "companyEmail", "companyWeb", "hrEmail", "companyLogoUrl",
    "offerIntro", "offerDuration", "offerReporting", "offerStipend", "offerAcceptanceNote",
    "offerCompletionNote", "offerClosing", "offerAcceptanceBlock",
    "page2Intro", "page2Welcome", "page2Contact", "annexureItems",
    "experienceTitle", "experienceIntro", "experienceDuties", "experienceClosing",
    "defaultSignatoryName", "defaultSignatoryRole", "defaultSignatoryImageUrl", "defaultStampImageUrl",
  ];

  for (const field of safeFields) {
    if (updates[field] !== undefined) {
      (current as unknown as Record<string, unknown>)[field] = updates[field];
    }
  }

  current.version = (current.version ?? 0) + 1;
  await current.save();
  return current.toJSON() as LetterSettingsDoc;
}

/**
 * Create a snapshot of current settings to embed in a letter document.
 * This ensures the letter always renders with the template that was active at creation time.
 */
export async function createSettingsSnapshot(): Promise<{ snapshot: LetterSettingsDoc; version: number }> {
  const settings = await getLetterSettings();
  const version = (settings.version as number) ?? 1;
  // Remove metadata fields from snapshot
  const { _id, createdAt, updatedAt, __v, ...snapshot } = settings;
  return { snapshot: snapshot as LetterSettingsDoc, version };
}
