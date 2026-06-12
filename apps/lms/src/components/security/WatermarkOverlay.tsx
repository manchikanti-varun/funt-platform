"use client";

/**
 * WatermarkOverlay
 *
 * Renders a full-viewport repeating watermark overlay containing the
 * student's name, email, username, and the current time.
 *
 * - pointer-events: none → does not block any clicks
 * - user-select: none   → text can't be selected
 * - z-index: 9000       → above all content, below modals
 * - Position shifts slightly every refreshIntervalSeconds (configurable)
 *   to defeat static-crop screenshot stripping
 * - Rendered in a React portal so it escapes any overflow:hidden parents
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProtection } from "./ProtectionContext";

function formatTime(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function WatermarkOverlay() {
  const { policy, watermark, student, ready, activeCourseId } = useProtection();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(() => formatTime(new Date()));
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-resolve the container whenever activeCourseId changes — the course content
  // div (#course-content-area) only exists when a course page is mounted.
  useEffect(() => {
    const resolve = () => {
      const courseEl = document.getElementById("course-content-area");
      setContainer(courseEl ?? document.getElementById("lms-main-content"));
    };
    resolve();
    // Small delay to let React paint the course page before querying the DOM
    const t = setTimeout(resolve, 100);
    return () => clearTimeout(t);
  }, [activeCourseId, mounted]);

  // Tick the clock every second
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // Shift watermark position every refreshIntervalSeconds
  useEffect(() => {
    if (!ready || !policy.enableWatermark) return;
    const ms = (watermark.refreshIntervalSeconds ?? 8) * 1000;
    intervalRef.current = setInterval(() => {
      setOffset({
        x: Math.random() * 0.15 - 0.075,
        y: Math.random() * 0.15 - 0.075,
      });
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ready, policy.enableWatermark, watermark.refreshIntervalSeconds]);

  if (!mounted || !ready || !policy.enableWatermark || !student || !container) return null;

  const { opacity, fontSize, rotation } = watermark;

  const studentLine1 = student.name || student.username;
  const studentLine2 = student.email || student.id.slice(0, 16);
  const timeLine = time;
  const idLine = `ID: ${student.id.slice(-8).toUpperCase()}`;

  const cellW = 320;
  const cellH = 160;
  const cx = cellW / 2;
  const cy = cellH / 2;

  const lines = [studentLine1, studentLine2, timeLine, idLine];
  const lineHeight = fontSize * 1.55;
  const totalHeight = lines.length * lineHeight;
  const startY = cy - totalHeight / 2 + lineHeight / 2;

  const svgLines = lines
    .map(
      (l, i) =>
        `<text x="${cx}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle"
          font-family="monospace" font-size="${fontSize}" fill="rgba(0,0,0,${opacity})"
          transform="rotate(${rotation},${cx},${cy})">${escapeXml(l)}</text>`
    )
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW}" height="${cellH}">${svgLines}</svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const bgX = `${(offset.x * cellW).toFixed(1)}px`;
  const bgY = `${(offset.y * cellH).toFixed(1)}px`;

  const overlay = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9000,
        pointerEvents: "none",
        userSelect: "none",
        backgroundImage: `url("${dataUrl}")`,
        backgroundRepeat: "repeat",
        backgroundSize: `${cellW}px ${cellH}px`,
        backgroundPosition: `${bgX} ${bgY}`,
      }}
    />
  );

  return createPortal(overlay, container);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
