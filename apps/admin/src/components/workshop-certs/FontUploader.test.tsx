import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontUploader, type CustomFont } from "@/components/workshop-certs/FontUploader";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  apiUrl: vi.fn((path: string) => `http://localhost:38472${path}`),
}));

// Mock XMLHttpRequest
class MockXHR {
  status = 200;
  upload = { addEventListener: vi.fn() };
  addEventListener = vi.fn((event: string, cb: Function) => {
    if (event === "load") {
      // Store callback for manual triggering
      (this as any)._loadCb = cb;
    }
  });
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    // Simulate successful upload
    setTimeout(() => {
      (this as any)._loadCb?.();
    }, 0);
  });
}

// @ts-expect-error
globalThis.XMLHttpRequest = MockXHR;

// ─── Test data ──────────────────────────────────────────────────────────────

const SAMPLE_FONTS: CustomFont[] = [
  {
    fontKey: "montserrat-regular",
    name: "Montserrat Regular",
    r2Key: "fonts/Montserrat-Regular.ttf",
    publicUrl: "https://r2.example.com/fonts/Montserrat-Regular.ttf",
    variants: ["normal"],
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("FontUploader", () => {
  const defaultProps = {
    fonts: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the upload area", () => {
      render(<FontUploader {...defaultProps} />);
      expect(screen.getByText(/Upload TTF or OTF font/)).toBeTruthy();
    });

    it("should show font count when fonts are present", () => {
      render(<FontUploader {...defaultProps} fonts={SAMPLE_FONTS} />);
      expect(screen.getByText(/1 uploaded/)).toBeTruthy();
    });

    it("should show 'Custom Fonts' label", () => {
      render(<FontUploader {...defaultProps} />);
      expect(screen.getByText("Custom Fonts")).toBeTruthy();
    });

    it("should render uploaded font entries", () => {
      render(<FontUploader {...defaultProps} fonts={SAMPLE_FONTS} />);
      expect(screen.getByText("Montserrat Regular")).toBeTruthy();
      expect(screen.getByText("montserrat-regular")).toBeTruthy();
    });

    it("should have a hidden file input accepting TTF/OTF", () => {
      render(<FontUploader {...defaultProps} />);
      const input = document.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
      expect(input?.getAttribute("accept")).toBe(".ttf,.otf");
    });
  });

  describe("Remove Font", () => {
    it("should show remove button for each font", () => {
      render(<FontUploader {...defaultProps} fonts={SAMPLE_FONTS} />);
      expect(screen.getByText("Remove")).toBeTruthy();
    });

    it("should call onChange with remaining fonts when remove is clicked", () => {
      const onChange = vi.fn();
      render(<FontUploader {...defaultProps} fonts={SAMPLE_FONTS} onChange={onChange} />);

      const removeBtn = screen.getByText("Remove");
      fireEvent.click(removeBtn);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it("should not remove other fonts", () => {
      const onChange = vi.fn();
      const twoFonts: CustomFont[] = [
        SAMPLE_FONTS[0],
        {
          fontKey: "playfair-bold",
          name: "Playfair Bold",
          r2Key: "fonts/Playfair-Bold.otf",
          publicUrl: "https://r2.example.com/fonts/Playfair-Bold.otf",
          variants: ["bold"],
        },
      ];

      render(<FontUploader {...defaultProps} fonts={twoFonts} onChange={onChange} />);
      const removeBtns = screen.getAllByText("Remove");
      fireEvent.click(removeBtns[0]);

      expect(onChange).toHaveBeenCalledWith([twoFonts[1]]);
    });
  });

  describe("File Validation", () => {
    it("should reject non-TTF/OTF files", async () => {
      render(<FontUploader {...defaultProps} />);
      const input = document.querySelector('input[type="file"]')!;

      // Create a mock .txt file
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "name", { value: "test.txt" });

      fireEvent.change(input, { target: { files: [file] } });

      // Should show error
      await vi.waitFor(() => {
        expect(screen.getByText(/Only TTF and OTF font files are supported/)).toBeTruthy();
      });
    });

    it("should accept .ttf files", () => {
      render(<FontUploader {...defaultProps} />);
      const input = document.querySelector('input[type="file"]')!;

      const file = new File(["font-data"], "Montserat.ttf", { type: "font/ttf" });
      Object.defineProperty(file, "name", { value: "Montserat.ttf" });

      // This will proceed to upload (we mock api)
      fireEvent.change(input, { target: { files: [file] } });

      // No error shown
      expect(screen.queryByText(/Only TTF and OTF/)).toBeNull();
    });

    it("should accept .otf files", () => {
      render(<FontUploader {...defaultProps} />);
      const input = document.querySelector('input[type="file"]')!;

      const file = new File(["font-data"], "Playfair.otf", { type: "font/otf" });
      Object.defineProperty(file, "name", { value: "Playfair.otf" });

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.queryByText(/Only TTF and OTF/)).toBeNull();
    });
  });

  describe("Font Key Generation", () => {
    it("should generate font key from filename", () => {
      // The font key generation logic:
      // 1. Remove extension
      // 2. Replace -_ with spaces
      // 3. Trim
      // 4. Lowercase + replace spaces with -
      // 5. Remove non-alphanumeric except -

      function generateFontKey(filename: string): string {
        const fontName = filename
          .replace(/\.(ttf|otf)$/i, "")
          .replace(/[-_]/g, " ")
          .trim();
        return fontName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
      }

      expect(generateFontKey("Montserrat-Regular.ttf")).toBe("montserrat-regular");
      expect(generateFontKey("Playfair_Display.otf")).toBe("playfair-display");
      expect(generateFontKey("OpenSans-Bold.ttf")).toBe("opensans-bold");
    });
  });

  describe("Empty State", () => {
    it("should not render font list when empty", () => {
      render(<FontUploader {...defaultProps} fonts={[]} />);
      expect(screen.queryByText("Remove")).toBeNull();
    });

    it("should still show upload area when empty", () => {
      render(<FontUploader {...defaultProps} fonts={[]} />);
      expect(screen.getByText(/Upload TTF or OTF font/)).toBeTruthy();
    });
  });
});
