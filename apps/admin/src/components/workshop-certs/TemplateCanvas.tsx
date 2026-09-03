"use client";

/**
 * TemplateCanvas — interactive Canvas 2D component for the workshop certificate designer.
 *
 * Features implemented:
 *   1. Drag-and-drop text field positioning
 *   2. Live text preview on canvas (Canvas 2D API)
 *   4. QR code rendering on canvas
 *   11. Image zoom controls
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface TextFieldConfig {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
  maxWidth: number;
  fieldType?: "text" | "qr_code";
  qrSize?: number;
}

interface TemplateCanvasProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  textFields: TextFieldConfig[];
  selectedFieldIndex: number | null;
  /** Sample values to render live preview */
  sampleValues?: Record<string, string>;
  onFieldMove?: (index: number, x: number, y: number) => void;
  onFieldSelect?: (index: number | null) => void;
}

export function TemplateCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  textFields,
  selectedFieldIndex,
  sampleValues = {},
  onFieldMove,
  onFieldSelect,
}: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Compute display size
  const maxCanvasWidth = 900;
  const scale = maxCanvasWidth / imageWidth;
  const displayWidth = imageWidth * scale * zoom;
  const displayHeight = imageHeight * scale * zoom;

  // Canvas coordinates from mouse event
  const canvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { cx: 0, cy: 0, fx: 0, fy: 0 };
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Convert to image fraction
      const fx = cx / displayWidth;
      const fy = cy / displayHeight;
      return { cx, cy, fx, fy };
    },
    [displayWidth, displayHeight]
  );

  // Find field under cursor
  const fieldAtPoint = useCallback(
    (fx: number, fy: number): number | null => {
      for (let i = textFields.length - 1; i >= 0; i--) {
        const f = textFields[i];
        const hitRadius = 0.04;
        const dx = Math.abs(f.x - fx);
        const dy = Math.abs(f.y - fy);
        if (dx < hitRadius && dy < hitRadius) return i;
      }
      return null;
    },
    [textFields]
  );

  // Mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { fx, fy } = canvasCoords(e);
      const hitIdx = fieldAtPoint(fx, fy);

      if (hitIdx !== null) {
        // Start dragging field
        setIsDragging(true);
        setDragFieldIndex(hitIdx);
        setDragOffset({ x: fx - textFields[hitIdx].x, y: fy - textFields[hitIdx].y });
        onFieldSelect?.(hitIdx);
      } else if (e.shiftKey) {
        // Start panning with shift+drag
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        onFieldSelect?.(null);
      } else {
        onFieldSelect?.(null);
      }
    },
    [canvasCoords, fieldAtPoint, textFields, onFieldSelect, pan]
  );

  // Mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragFieldIndex !== null && onFieldMove) {
        const { fx, fy } = canvasCoords(e);
        const newX = Math.max(0, Math.min(1, fx - dragOffset.x));
        const newY = Math.max(0, Math.min(1, fy - dragOffset.y));
        onFieldMove(dragFieldIndex, newX, newY);
      } else if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      } else {
        // Show cursor hint
        const { fx, fy } = canvasCoords(e);
        const hitIdx = fieldAtPoint(fx, fy);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.cursor = hitIdx !== null ? "grab" : "crosshair";
        }
      }
    },
    [isDragging, dragFieldIndex, dragOffset, isPanning, panStart, canvasCoords, fieldAtPoint, onFieldMove]
  );

  // Mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragFieldIndex(null);
    setIsPanning(false);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.25, Math.min(3, z + delta)));
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageLoaded || !imageRef.current) return;

    canvas.width = displayWidth * window.devicePixelRatio;
    canvas.height = displayHeight * window.devicePixelRatio;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw template image
    ctx.drawImage(imageRef.current, 0, 0, displayWidth, displayHeight);

    // Draw text fields
    for (let i = 0; i < textFields.length; i++) {
      const field = textFields[i];
      const fx = field.x * displayWidth;
      const fy = field.y * displayHeight;
      const isSelected = i === selectedFieldIndex;
      const maxWPx = field.maxWidth * displayWidth;

      if (field.fieldType === "qr_code") {
        // Draw QR placeholder
        const qrSize = (field.qrSize ?? 150) * scale * zoom;
        const qrX = fx - qrSize / 2;
        const qrY = fy - qrSize / 2;

        // QR code background
        ctx.fillStyle = isSelected ? "rgba(139, 92, 246, 0.15)" : "rgba(59, 130, 246, 0.1)";
        ctx.strokeStyle = isSelected ? "#8b5cf6" : "#3b82f6";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash(isSelected ? [] : [4, 4]);
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.strokeRect(qrX, qrY, qrSize, qrSize);
        ctx.setLineDash([]);

        // QR icon placeholder
        ctx.fillStyle = isSelected ? "#8b5cf6" : "#3b82f6";
        ctx.font = `${Math.max(10, qrSize * 0.2)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("QR", fx, fy);

        // Label
        ctx.font = `bold 11px sans-serif`;
        ctx.fillStyle = isSelected ? "#8b5cf6" : "#3b82f6";
        ctx.textAlign = "center";
        ctx.fillText(field.label, fx, qrY - 8);
        continue;
      }

      // Text field — live preview
      const value = sampleValues[field.key] ?? field.label;
      const fontSizePx = field.fontSize * scale * zoom * 0.75; // pt to px approximation

      // Font
      let fontWeight = field.fontWeight === "bold" ? "bold " : "";
      let fontFamily = field.fontFamily;
      if (fontFamily === "Times") fontFamily = "Times New Roman, serif";
      else if (fontFamily === "Courier") fontFamily = "Courier New, monospace";
      else fontFamily = "Helvetica, Arial, sans-serif";
      ctx.font = `${fontWeight}${fontSizePx}px ${fontFamily}`;

      // Measure text width for selection box
      const measuredWidth = ctx.measureText(value).width;
      const textWidth = Math.min(measuredWidth, maxWPx);

      // Selection highlight
      if (isSelected) {
        const highlightX = field.align === "center" ? fx - textWidth / 2 - 4 : field.align === "right" ? fx - textWidth - 4 : fx - 4;
        const highlightY = fy - fontSizePx / 2 - 4;
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.fillRect(highlightX, highlightY, textWidth + 8, fontSizePx + 8);
        ctx.strokeRect(highlightX, highlightY, textWidth + 8, fontSizePx + 8);
      }

      // Draw anchor crosshair
      ctx.fillStyle = isSelected ? "#8b5cf6" : "#3b82f6";
      ctx.beginPath();
      ctx.arc(fx, fy, isSelected ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw text
      ctx.fillStyle = field.color;
      ctx.textBaseline = "middle";
      if (field.align === "center") ctx.textAlign = "center";
      else if (field.align === "right") ctx.textAlign = "right";
      else ctx.textAlign = "left";

      const textX = field.align === "center" ? fx : field.align === "right" ? fx : fx;
      ctx.fillText(value, textX, fy, maxWPx);

      // Reset alignment
      ctx.textAlign = "left";

      // Label above (always visible)
      ctx.font = `bold 10px sans-serif`;
      ctx.fillStyle = isSelected ? "#8b5cf6" : "rgba(59, 130, 246, 0.8)";
      ctx.textAlign = "left";
      const labelX = field.align === "center" ? fx - textWidth / 2 : field.align === "right" ? fx - textWidth : fx;
      ctx.fillText(field.key, labelX, fy - fontSizePx / 2 - 8);
    }
  }, [imageLoaded, displayWidth, displayHeight, textFields, selectedFieldIndex, sampleValues, scale, zoom]);

  return (
    <div className="space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Zoom out"
        >
          −
        </button>
        <span className="min-w-[60px] text-center text-xs text-slate-500">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Reset zoom"
        >
          Reset
        </button>
        <span className="ml-2 text-[10px] text-slate-400">
          Scroll to zoom · Shift+drag to pan · Drag fields to reposition
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-slate-200 bg-slate-100"
        style={{ maxHeight: "700px" }}
      >
        <div
          className="inline-block"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="block"
            style={{ cursor: isDragging ? "grabbing" : "crosshair" }}
          />
        </div>
      </div>
    </div>
  );
}
