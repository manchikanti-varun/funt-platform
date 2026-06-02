/** 11-char YouTube video id from watch / embed / short / bare id string. */
export function parseYoutubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match =
    trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
    trimmed.match(/^([a-zA-Z0-9_-]{11})$/);
  const id = match?.[1] ?? "";
  return id || null;
}
