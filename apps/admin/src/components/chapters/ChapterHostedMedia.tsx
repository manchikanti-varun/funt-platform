"use client";

import { toGoogleDrivePreviewUrl } from "@funt-platform/rich-text-editor";

function parseYoutubeId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      return u.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function hostedVideoSrc(url: string): string {
  const t = url.trim();
  if (!t) return "";
  if (t.startsWith("data:video/") || t.startsWith("blob:")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

interface ChapterHostedMediaProps {
  youtubeUrl?: string;
  videoUrl?: string;
}

/** Matches LMS Learn tab: inline YouTube + hosted video players (not plain links). */
export function ChapterHostedMedia({ youtubeUrl, videoUrl }: ChapterHostedMediaProps) {
  const yt = parseYoutubeId(youtubeUrl ?? "");
  const videoSrc = hostedVideoSrc(videoUrl ?? "");
  const drivePreview =
    videoSrc && /drive\.google\.com|docs\.google\.com/i.test(videoSrc)
      ? toGoogleDrivePreviewUrl(videoSrc)
      : "";

  if (!yt && !videoSrc) return null;

  return (
    <div className="space-y-6">
      {yt ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">YouTube</p>
          <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
            <iframe
              title="YouTube preview"
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0&modestbranding=1&playsinline=1`}
              className="h-full w-full min-h-[220px]"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
      {videoSrc ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Hosted video</p>
          {drivePreview ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
              <iframe
                title="Video preview"
                src={drivePreview}
                className="h-full w-full min-h-[220px]"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black shadow-sm">
              <video src={videoSrc} controls playsInline preload="metadata" className="h-full w-full" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
