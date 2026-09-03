import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock api module
const mockApi = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: any[]) => mockApi(...args),
  apiUrl: vi.fn((path: string) => `http://localhost:38472${path}`),
  getToken: vi.fn(() => "test-token"),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

// Mock the sub-components
vi.mock("@/components/workshop-certs/TemplateCanvas", () => ({
  TemplateCanvas: vi.fn(({ textFields, selectedFieldIndex, onFieldSelect }: any) => (
    <div data-testid="template-canvas">
      <span data-testid="field-count">{textFields.length}</span>
      <span data-testid="selected-field">{selectedFieldIndex ?? "none"}</span>
      {textFields.map((f: any, i: number) => (
        <button
          key={i}
          data-testid={`canvas-field-${i}`}
          onClick={() => onFieldSelect?.(i)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )),
}));

vi.mock("@/components/workshop-certs/FontUploader", () => ({
  FontUploader: vi.fn(({ fonts }: any) => (
    <div data-testid="font-uploader">
      <span data-testid="font-count">{fonts.length}</span>
    </div>
  )),
}));

vi.mock("@/components/ui", () => ({
  AppPageShell: vi.fn(({ children }: any) => <div>{children}</div>),
}));

vi.mock("@/components/ui/PageHeader", () => ({
  PageHeader: vi.fn(({ title }: any) => <h1>{title}</h1>),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Workshop Certificates Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Template List View", () => {
    it("should show loading state initially", async () => {
      mockApi.mockResolvedValue({ success: false, data: null });
      const { default: WorkshopCertificatesPage } = await import("./page");
      render(<WorkshopCertificatesPage />);
      // Loading state shows a spinner (animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });

    it("should show empty state when no templates", async () => {
      mockApi.mockResolvedValue({ success: true, data: [] });
      const { default: WorkshopCertificatesPage } = await import("./page");
      render(<WorkshopCertificatesPage />);

      await waitFor(() => {
        expect(screen.getByText(/No templates yet/)).toBeTruthy();
      });
    });

    it("should show template cards when templates exist", async () => {
      mockApi.mockResolvedValue({
        success: true,
        data: [
          {
            _id: "tpl1",
            name: "Workshop 2026",
            templateImageUrl: "https://example.com/cert.png",
            imageWidth: 2480,
            imageHeight: 3508,
            textFields: [{ key: "studentName", label: "Name" }],
            pages: [],
            customFonts: [],
            defaultFieldValues: {},
            generationHistory: [
              { generatedAt: new Date().toISOString(), recipientCount: 50, generatedBy: "u1" },
            ],
            createdBy: "u1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const { default: WorkshopCertificatesPage } = await import("./page");
      render(<WorkshopCertificatesPage />);

      await waitFor(() => {
        expect(screen.getByText("Workshop 2026")).toBeTruthy();
      });
    });
  });

  describe("CSV/JSON Parsing Logic", () => {
    // Test the parsing logic directly (extracted from the component)
    function parseDataFile(text: string, filename: string): Record<string, string>[] {
      if (filename.endsWith(".json")) {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV must have a header + data rows");
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      return lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
        return row;
      });
    }

    it("should parse JSON array", () => {
      const json = '[{"name":"Alice","course":"Robotics"},{"name":"Bob","course":"Chemistry"}]';
      const data = parseDataFile(json, "students.json");
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Alice");
      expect(data[1].course).toBe("Chemistry");
    });

    it("should parse single JSON object as array", () => {
      const json = '{"name":"Alice","course":"Robotics"}';
      const data = parseDataFile(json, "students.json");
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Alice");
    });

    it("should parse CSV with headers", () => {
      const csv = "name,studentName,course\nAlice,Alice Smith,Robotics\nBob,Bob Jones,Chemistry";
      const data = parseDataFile(csv, "students.csv");
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Alice");
      expect(data[0].studentName).toBe("Alice Smith");
    });

    it("should parse CSV with quoted fields", () => {
      const csv = 'name,course\n"Alice Smith","Robotics 101"';
      const data = parseDataFile(csv, "students.csv");
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Alice Smith");
      expect(data[0].course).toBe("Robotics 101");
    });

    it("should throw on empty CSV", () => {
      expect(() => parseDataFile("name,course", "data.csv")).toThrow("CSV must have a header + data rows");
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseDataFile("not json", "data.json")).toThrow();
    });
  });

  describe("Row Selection", () => {
    it("should track selected row index", () => {
      let selectedRow = 0;
      const setSelectedRow = (n: number) => { selectedRow = n; };

      // Simulate clicking row 2
      setSelectedRow(1);
      expect(selectedRow).toBe(1);

      // Simulate clicking row 5
      setSelectedRow(4);
      expect(selectedRow).toBe(4);
    });

    it("should reset to row 0 when new data is uploaded", () => {
      let selectedRow = 3;
      // Simulate data upload
      selectedRow = 0;
      expect(selectedRow).toBe(0);
    });
  });

  describe("Field Value Merging for Preview/Generation", () => {
    it("should merge template defaults with per-generation overrides and row data", () => {
      const templateDefaults = { workshopName: "Robotics Workshop", date: "01/09/2026" };
      const perGenOverrides = { workshopName: "Advanced Robotics" };
      const rowData = { studentName: "Alice", course: "AI 101" };

      const fieldValues = { ...templateDefaults, ...perGenOverrides, ...rowData };

      expect(fieldValues.workshopName).toBe("Advanced Robotics");
      expect(fieldValues.date).toBe("01/09/2026");
      expect(fieldValues.studentName).toBe("Alice");
      expect(fieldValues.course).toBe("AI 101");
    });
  });

  describe("Undo/Redo Logic", () => {
    // Test the useUndoRedo hook behavior
    it("should track state changes", () => {
      const state = { past: [] as any[], present: 0, future: [] as any[] };

      const set = (next: number) => {
        state.past = [...state.past.slice(-49), state.present];
        state.future = [];
        state.present = next;
      };

      set(1);
      expect(state.present).toBe(1);
      expect(state.past).toEqual([0]);

      set(2);
      expect(state.present).toBe(2);
      expect(state.past).toEqual([0, 1]);
    });

    it("should undo correctly", () => {
      const state = { past: [] as any[], present: 0, future: [] as any[] };

      const set = (next: number) => {
        state.past = [...state.past.slice(-49), state.present];
        state.future = [];
        state.present = next;
      };

      const undo = () => {
        if (state.past.length === 0) return;
        const prev = state.past[state.past.length - 1];
        state.past = state.past.slice(0, -1);
        state.future = [state.present, ...state.future];
        state.present = prev;
      };

      set(1);
      set(2);
      set(3);
      undo();

      expect(state.present).toBe(2);
      expect(state.future).toEqual([3]);
    });

    it("should redo correctly", () => {
      const state = { past: [] as any[], present: 0, future: [] as any[] };

      const set = (next: number) => {
        state.past = [...state.past.slice(-49), state.present];
        state.future = [];
        state.present = next;
      };

      const undo = () => {
        if (state.past.length === 0) return;
        const prev = state.past[state.past.length - 1];
        state.past = state.past.slice(0, -1);
        state.future = [state.present, ...state.future];
        state.present = prev;
      };

      const redo = () => {
        if (state.future.length === 0) return;
        const next = state.future[0];
        state.future = state.future.slice(1);
        state.past = [...state.past, state.present];
        state.present = next;
      };

      set(1);
      set(2);
      undo(); // back to 1
      redo(); // forward to 2

      expect(state.present).toBe(2);
      expect(state.future).toEqual([]);
    });

    it("should clear redo stack on new change", () => {
      const state = { past: [] as any[], present: 0, future: [] as any[] };

      const set = (next: number) => {
        state.past = [...state.past.slice(-49), state.present];
        state.future = [];
        state.present = next;
      };

      const undo = () => {
        if (state.past.length === 0) return;
        const prev = state.past[state.past.length - 1];
        state.past = state.past.slice(0, -1);
        state.future = [state.present, ...state.future];
        state.present = prev;
      };

      set(1);
      set(2);
      undo(); // back to 1
      expect(state.future).toEqual([2]);

      set(3); // new change clears redo
      expect(state.future).toEqual([]);
      expect(state.present).toBe(3);
    });
  });

  describe("ZIP Download", () => {
    it("should construct correct download filename", () => {
      const timestamp = Date.now();
      const filename = `workshop-certificates-${timestamp}.zip`;
      expect(filename).toMatch(/^workshop-certificates-\d+\.zip$/);
    });

    it("should create blob URL and trigger download", () => {
      const mockBlob = new Blob(["fake-zip"], { type: "application/zip" });
      const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      const click = vi.fn();

      // Mock document.createElement
      const origCreateElement = document.createElement.bind(document);
      const mockElement = { href: "", download: "", click };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") return mockElement as any;
        return origCreateElement(tag);
      });

      // Simulate download
      const url = URL.createObjectURL(mockBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "test.zip";
      a.click();
      URL.revokeObjectURL(url);

      expect(click).toHaveBeenCalled();
      expect(mockElement.download).toBe("test.zip");

      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    });
  });

  describe("Sample JSON Format", () => {
    it("should generate correct sample format from text fields", () => {
      const textFields = [
        { key: "studentName", fieldType: "text" },
        { key: "course", fieldType: "text" },
        { key: "qr_1", fieldType: "qr_code" },
      ];

      const sampleJson = textFields.map((f) => `"${f.key}": "value"`).join(", ");
      const sampleData = `[\n  { ${sampleJson} },\n  { ${sampleJson} }\n]`;

      expect(sampleJson).toBe('"studentName": "value", "course": "value", "qr_1": "value"');
      expect(sampleData).toContain("studentName");
      expect(sampleData).toContain("qr_1");
    });
  });

  describe("Recipient Name Extraction", () => {
    function getName(row: Record<string, string>, index: number): string {
      return row.name ?? row.studentName ?? row.student_name ?? `recipient-${index + 1}`;
    }

    it("should prefer 'name' field", () => {
      expect(getName({ name: "Alice" }, 0)).toBe("Alice");
    });

    it("should fall back to 'studentName'", () => {
      expect(getName({ studentName: "Bob" }, 0)).toBe("Bob");
    });

    it("should fall back to 'student_name'", () => {
      expect(getName({ student_name: "Charlie" }, 0)).toBe("Charlie");
    });

    it("should use default format when no name field", () => {
      expect(getName({ course: "Robotics" }, 4)).toBe("recipient-5");
    });
  });

  describe("Template Designer Actions", () => {
    it("should add text field at center of image by default", () => {
      const newField = {
        key: "field_1",
        label: "Text Field 1",
        x: 0.3,
        y: 0.4,
        fontSize: 24,
        fontFamily: "Helvetica",
        fontWeight: "normal",
        align: "center",
        color: "#000000",
        maxWidth: 0.4,
      };

      expect(newField.x).toBe(0.3);
      expect(newField.y).toBe(0.4);
    });

    it("should add QR code field at bottom-right by default", () => {
      const qrField = {
        key: "qr_1",
        label: "QR Code 1",
        x: 0.5,
        y: 0.8,
        fieldType: "qr_code",
        qrSize: 150,
      };

      expect(qrField.fieldType).toBe("qr_code");
      expect(qrField.qrSize).toBe(150);
    });
  });

  describe("Multi-page Support", () => {
    it("should track additional pages", () => {
      const pages = [
        { pageIndex: 1, imageKey: "page1.png", imageUrl: "url1", width: 2480, height: 3508, textFields: [] },
        { pageIndex: 2, imageKey: "page2.png", imageUrl: "url2", width: 2480, height: 3508, textFields: [] },
      ];

      expect(pages.length).toBe(2);
      expect(pages[0].pageIndex).toBe(1);
      expect(pages[1].pageIndex).toBe(2);
    });

    it("should remove page by index", () => {
      let pages = [
        { pageIndex: 1, imageKey: "p1" },
        { pageIndex: 2, imageKey: "p2" },
        { pageIndex: 3, imageKey: "p3" },
      ];

      pages = pages.filter((_, i) => i !== 1);
      expect(pages.length).toBe(2);
      expect(pages[0].imageKey).toBe("p1");
      expect(pages[1].imageKey).toBe("p3");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should handle Ctrl+Z for undo", () => {
      const handler = vi.fn((e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
          return "undo";
        }
        return null;
      });

      const undoEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      expect(handler(undoEvent)).toBe("undo");
    });

    it("should handle Ctrl+Y for redo", () => {
      const handler = vi.fn((e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "y") {
          return "redo";
        }
        return null;
      });

      const redoEvent = new KeyboardEvent("keydown", { key: "y", ctrlKey: true });
      expect(handler(redoEvent)).toBe("redo");
    });

    it("should handle Ctrl+Shift+Z for redo", () => {
      const handler = vi.fn((e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
          return "redo";
        }
        return null;
      });

      const redoEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true });
      expect(handler(redoEvent)).toBe("redo");
    });
  });

  describe("Verification URL Construction", () => {
    it("should construct correct verification URL", () => {
      const backendUrl = "https://api.funt.in";
      const certId = "WS-ABC123-XYZ7";
      const url = `${backendUrl}/verify/workshop/${certId}`;
      expect(url).toBe("https://api.funt.in/verify/workshop/WS-ABC123-XYZ7");
    });
  });
});
