"use client";

import { useEffect, useState } from "react";
import { toGoogleDrivePreviewUrl, toEmbeddableIframeSrc } from "@funt-platform/rich-text-editor";
import { api } from "@/lib/api";

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
  if (t.startsWith("r2://")) return t; // handled separately
  if (t.startsWith("data:video/") || t.startsWith("blob:")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isEmbedOnlyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("vimeo.com") || host.includes("drive.google.com") || host.includes("docs.google.com");
  } catch {
    return false;
  }
}

interface ChapterHostedMediaProps {
  youtubeUrl?: string;
  videoUrl?: string;
}

export function ChapterHostedMedia({ youtubeUrl, videoUrl }: ChapterHostedMediaProps) {
  const yt = parseYoutubeId(youtubeUrl ?? "");
  const rawVideo = (videoUrl ?? "").trim();
  const isR2 = rawVideo.startsWith("r2://");

  // For R2 videos — fetch a short-lived presigned GET URL from the admin preview endpoint
  const [r2PreviewUrl, setR2PreviewUrl] = useState<string | null>(null);
  const [r2Loading, setR2Loading] = useState(false);

  useEffect(() => {
    if (!isR2) return;
    setR2Loading(true);
    api<{ previewUrl: string }>(`/api/admin/videos/preview?key=${encodeURIComponent(rawVideo)}`)
      .then((r) => {
        if (r.success && r.data?.previewUrl) setR2PreviewUrl(r.data.previewUrl);
      })
      .finally(() => setR2Loading(false));
  }, [rawVideo, isR2]);

  const videoSrc = isR2 ? (r2PreviewUrl ?? "") : hostedVideoSrc(rawVideo);
  const drivePreview =
    videoSrc && /drive\.google\.com|docs\.google\.com/i.test(videoSrc)
      ? toGoogleDrivePreviewUrl(videoSrc)
      : "";
  const embedSrc = videoSrc && !drivePreview && isEmbedOnlyUrl(videoSrc)
    ? toEmbeddableIframeSrc(videoSrc)
    : "";

  if (!yt && !rawVideo) return null;

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

      {rawVideo ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Hosted video</p>

          {/* R2 video — wait for presigned URL */}
          {isR2 ? (
            r2Loading ? (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-slate-200 bg-slate-100">
                <div className="spinner spinner--inline" />
              </div>
            ) : r2PreviewUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black shadow-sm">
                <video
                  src={r2PreviewUrl}
                  controls
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  preload="metadata"
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                Could not load video preview.
              </div>
            )
          ) : drivePreview ? (
            <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
              <iframe
                title="Video preview"
                src={drivePreview}
                className="h-full w-full min-h-[220px]"
                sandbox="allow-scripts allow-same-origin"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
              <div className="absolute top-0 right-0 w-[80px] h-[80px] z-10 bg-transparent pointer-events-auto" />
            </div>
          ) : embedSrc ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
              <iframe
                title="Video preview"
                src={embedSrc}
                className="h-full w-full min-h-[220px]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : videoSrc ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black shadow-sm">
              <video
                src={videoSrc}
                controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                playsInline
                preload="metadata"
                className="h-full w-full"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
