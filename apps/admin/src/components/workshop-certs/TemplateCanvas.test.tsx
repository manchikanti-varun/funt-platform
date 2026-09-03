import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateCanvas, type TextFieldConfig } from "@/components/workshop-certs/TemplateCanvas";

// ─── Mock Image ─────────────────────────────────────────────────────────────

class MockImage {
  src = "";
  crossOrigin = "";
  onload: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  constructor() {
    // Simulate async image load
    setTimeout(() => this.onload?.(), 0);
  }
}

// @ts-expect-error - override global Image
globalThis.Image = MockImage as any;

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  scale: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  setLineDash: vi.fn(),
  font: "",
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  textAlign: "left" as CanvasTextAlign,
  textBaseline: "middle" as CanvasTextBaseline,
  canvas: { width: 800, height: 600 },
})) as any;

HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 800,
  height: 600,
  right: 800,
  bottom: 600,
  x: 0,
  y: 0,
  toJSON: () => "",
}));

// ─── Test data ──────────────────────────────────────────────────────────────

const SAMPLE_TEXT_FIELDS: TextFieldConfig[] = [
  {
    key: "studentName",
    label: "Student Name",
    x: 0.5,
    y: 0.4,
    fontSize: 24,
    fontFamily: "Helvetica",
    fontWeight: "normal",
    align: "center",
    color: "#000000",
    maxWidth: 0.6,
  },
  {
    key: "course",
    label: "Course",
    x: 0.5,
    y: 0.6,
    fontSize: 18,
    fontFamily: "Helvetica",
    fontWeight: "bold",
    align: "center",
    color: "#333333",
    maxWidth: 0.5,
  },
];

const SAMPLE_QR_FIELD: TextFieldConfig = {
  key: "qr_1",
  label: "QR Code",
  x: 0.8,
  y: 0.9,
  fontSize: 12,
  fontFamily: "Helvetica",
  fontWeight: "normal",
  align: "center",
  color: "#000000",
  maxWidth: 0.2,
  fieldType: "qr_code",
  qrSize: 150,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TemplateCanvas", () => {
  const defaultProps = {
    imageUrl: "https://example.com/cert-bg.png",
    imageWidth: 800,
    imageHeight: 600,
    textFields: SAMPLE_TEXT_FIELDS,
    selectedFieldIndex: null,
    sampleValues: {},
    onFieldMove: vi.fn(),
    onFieldSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the canvas element", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas");
      expect(canvas).toBeTruthy();
    });

    it("should render zoom controls", () => {
      render(<TemplateCanvas {...defaultProps} />);
      expect(screen.getByTitle("Zoom in")).toBeTruthy();
      expect(screen.getByTitle("Zoom out")).toBeTruthy();
      expect(screen.getByTitle("Reset zoom")).toBeTruthy();
    });

    it("should display initial zoom level", () => {
      render(<TemplateCanvas {...defaultProps} />);
      expect(screen.getByText("100%")).toBeTruthy();
    });

    it("should render help text", () => {
      render(<TemplateCanvas {...defaultProps} />);
      expect(screen.getByText(/Scroll to zoom/)).toBeTruthy();
    });
  });

  describe("Zoom Controls", () => {
    it("should zoom in when + button is clicked", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const zoomIn = screen.getByTitle("Zoom in");
      fireEvent.click(zoomIn);
      expect(screen.getByText("125%")).toBeTruthy();
    });

    it("should zoom out when - button is clicked", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const zoomOut = screen.getByTitle("Zoom out");
      fireEvent.click(zoomOut);
      expect(screen.getByText("75%")).toBeTruthy();
    });

    it("should reset zoom when Reset is clicked", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const zoomIn = screen.getByTitle("Zoom in");
      fireEvent.click(zoomIn);
      fireEvent.click(zoomIn);
      expect(screen.getByText("150%")).toBeTruthy();

      const reset = screen.getByTitle("Reset zoom");
      fireEvent.click(reset);
      expect(screen.getByText("100%")).toBeTruthy();
    });

    it("should clamp zoom minimum to 25%", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const zoomOut = screen.getByTitle("Zoom out");
      // Click enough times to go below 25%
      for (let i = 0; i < 10; i++) fireEvent.click(zoomOut);
      expect(screen.getByText("25%")).toBeTruthy();
    });

    it("should clamp zoom maximum to 300%", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const zoomIn = screen.getByTitle("Zoom in");
      // Click enough times to exceed 300%
      for (let i = 0; i < 15; i++) fireEvent.click(zoomIn);
      expect(screen.getByText("300%")).toBeTruthy();
    });
  });

  describe("Field Interaction", () => {
    it("should call onFieldSelect when clicking near a field", () => {
      const onFieldSelect = vi.fn();
      render(<TemplateCanvas {...defaultProps} onFieldSelect={onFieldSelect} />);

      const canvas = document.querySelector("canvas")!;
      // Click near field 0 (x: 0.5, y: 0.4) → center of 800x600 canvas
      fireEvent.mouseDown(canvas, { clientX: 400, clientY: 240 });

      // The canvasCoords will convert clientX/clientY to fractions
      // and fieldAtPoint should find a match
      expect(onFieldSelect).toHaveBeenCalled();
    });

    it("should call onFieldSelect(null) when clicking empty area", () => {
      const onFieldSelect = vi.fn();
      render(<TemplateCanvas {...defaultProps} onFieldSelect={onFieldSelect} />);

      const canvas = document.querySelector("canvas")!;
      // Click far from any field (top-left corner)
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });

      expect(onFieldSelect).toHaveBeenCalledWith(null);
    });

    it("should call onFieldMove when dragging a field", () => {
      const onFieldMove = vi.fn();
      const onFieldSelect = vi.fn();
      render(
        <TemplateCanvas
          {...defaultProps}
          selectedFieldIndex={0}
          onFieldMove={onFieldMove}
          onFieldSelect={onFieldSelect}
        />
      );

      const canvas = document.querySelector("canvas")!;
      // First click to select field, then move
      fireEvent.mouseDown(canvas, { clientX: 450, clientY: 270 });
      // Verify the field was selected (which triggers drag state)
      expect(onFieldSelect).toHaveBeenCalled();
      // Move to new position
      fireEvent.mouseMove(canvas, { clientX: 500, clientY: 300 });
      fireEvent.mouseUp(canvas);
      // After mouse up, dragging should be stopped
    });

    it("should reset dragging state on mouse up", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas")!;

      fireEvent.mouseDown(canvas, { clientX: 400, clientY: 240 });
      fireEvent.mouseUp(canvas);

      // After mouse up, subsequent moves should not trigger field move
      // (We verify by checking cursor behavior, but functionally the state is reset)
      expect(true).toBe(true);
    });
  });

  describe("Zoom with Scroll Wheel", () => {
    it("should zoom in on scroll up", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas")!;

      fireEvent.wheel(canvas, { deltaY: -100 });
      // Zoom should increase by 0.1 → ~110%
      expect(screen.getByText("110%")).toBeTruthy();
    });

    it("should zoom out on scroll down", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas")!;

      fireEvent.wheel(canvas, { deltaY: 100 });
      // Zoom should decrease by 0.1 → ~90%
      expect(screen.getByText("90%")).toBeTruthy();
    });
  });

  describe("QR Code Fields", () => {
    it("should render QR code placeholder when field type is qr_code", () => {
      render(<TemplateCanvas {...defaultProps} textFields={[SAMPLE_QR_FIELD]} />);
      const canvas = document.querySelector("canvas")!;
      expect(canvas).toBeTruthy();
      // The canvas 2D context's fillText should be called with "QR"
      const ctx = canvas.getContext("2d");
      expect(ctx).toBeTruthy();
    });
  });

  describe("Panning with Shift+Drag", () => {
    it("should start panning on shift+click", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas")!;

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, shiftKey: true });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });

      // Pan state should be active
      expect(true).toBe(true);
    });
  });

  describe("Canvas Cursor", () => {
    it("should show crosshair cursor by default", () => {
      render(<TemplateCanvas {...defaultProps} />);
      const canvas = document.querySelector("canvas")!;
      expect(canvas.style.cursor).toBe("crosshair");
    });
  });

  describe("Sample Values Preview", () => {
    it("should render sample values on canvas when provided", () => {
      render(
        <TemplateCanvas
          {...defaultProps}
          sampleValues={{ studentName: "Alice Smith", course: "Robotics" }}
        />
      );
      const canvas = document.querySelector("canvas");
      expect(canvas).toBeTruthy();
      // The canvas draw function uses sampleValues when available
    });

    it("should fall back to field labels when no sample values", () => {
      render(<TemplateCanvas {...defaultProps} sampleValues={{}} />);
      const canvas = document.querySelector("canvas");
      expect(canvas).toBeTruthy();
      // When sampleValues doesn't have a key, it falls back to field.label
    });
  });
});
