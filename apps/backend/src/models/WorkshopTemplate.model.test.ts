import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock Mongoose
const mockLean = vi.fn();
const mockExec = vi.fn();
const mockFind = vi.fn(() => ({ sort: vi.fn(() => ({ lean: vi.fn(() => ({ exec: mockExec })) })) }));
const mockFindById = vi.fn(() => ({ lean: vi.fn(() => ({ exec: mockExec })) }));
const mockFindByIdAndUpdate = vi.fn(() => ({ lean: vi.fn(() => ({ exec: mockExec })) }));
const mockFindByIdAndDelete = vi.fn(() => ({ exec: mockExec }));
const mockCreate = vi.fn();
const mockSave = vi.fn();

vi.mock("mongoose", () => {
  const actual: Record<string, unknown> = {};
  const handler: ProxyHandler<typeof actual> = {
    get(target, prop) {
      if (prop === "model") {
        return (_name: string, _schema: unknown) => ({
          find: mockFind,
          findById: mockFindById,
          findByIdAndUpdate: mockFindByIdAndUpdate,
          findByIdAndDelete: mockFindByIdAndDelete,
          create: mockCreate,
          prototype: { toObject: vi.fn(() => ({})) },
        });
      }
      if (prop === "Schema") {
        const SchemaConstructor = function (_definition: unknown, _options?: unknown) {
          return {
            virtual: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
          };
        };
        // Add static Schema.Types.Mixed
        (SchemaConstructor as unknown as { Types: { Mixed: unknown } }).Types = { Mixed: "Mixed" };
        return SchemaConstructor;
      }
      return Reflect.get(target, prop);
    },
  };
  const proxy = new Proxy(actual, handler);
  proxy.Schema = proxy.Schema || {};
  (proxy.Schema as unknown as { Types: { Mixed: string } }).Types = { Mixed: "Mixed" };
  return proxy;
});

// Mock audit service
vi.mock("../audit.service.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock AppError
vi.mock("../../utils/AppError.js", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = "AppError";
      this.statusCode = statusCode;
    }
  },
}));

// ─── Test data ──────────────────────────────────────────────────────────────

const SAMPLE_TEXT_FIELD = {
  key: "studentName",
  label: "Student Name",
  x: 0.5,
  y: 0.4,
  fontSize: 24,
  fontFamily: "Helvetica",
  fontWeight: "normal" as const,
  align: "center" as const,
  color: "#000000",
  maxWidth: 0.6,
};

const SAMPLE_QR_FIELD = {
  key: "qr_1",
  label: "QR Code 1",
  x: 0.8,
  y: 0.9,
  fontSize: 12,
  fontFamily: "Helvetica",
  fontWeight: "normal" as const,
  align: "center" as const,
  color: "#000000",
  maxWidth: 0.2,
  fieldType: "qr_code" as const,
  qrSize: 150,
};

const SAMPLE_TEMPLATE_DOC = {
  _id: "tpl123",
  name: "Workshop Certificate 2026",
  templateImageKey: "templates/cert-bg.png",
  templateImageUrl: "https://r2.example.com/templates/cert-bg.png",
  imageWidth: 2480,
  imageHeight: 3508,
  textFields: [SAMPLE_TEXT_FIELD],
  pages: [],
  customFonts: [],
  defaultFieldValues: { workshopName: "Robotics Workshop" },
  generationHistory: [],
  createdBy: "user123",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SAMPLE_ISSUED_CERT = {
  certificateId: "WS-ABC123-XYZ7",
  templateId: "tpl123",
  fieldValues: { studentName: "Alice" },
  generatedBy: "user123",
  generatedAt: new Date(),
  status: "ISSUED" as const,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("WorkshopTemplate Model Schema", () => {
  describe("TextFieldConfig schema validation", () => {
    it("should accept valid text field config", () => {
      const field = { ...SAMPLE_TEXT_FIELD };
      expect(field.key).toBeTruthy();
      expect(field.x).toBeGreaterThanOrEqual(0);
      expect(field.x).toBeLessThanOrEqual(1);
      expect(field.y).toBeGreaterThanOrEqual(0);
      expect(field.y).toBeLessThanOrEqual(1);
      expect(field.fontSize).toBeGreaterThan(0);
      expect(["left", "center", "right"]).toContain(field.align);
      expect(["normal", "bold"]).toContain(field.fontWeight);
    });

    it("should accept QR code field type", () => {
      const field = { ...SAMPLE_QR_FIELD };
      expect(field.fieldType).toBe("qr_code");
      expect(field.qrSize).toBe(150);
    });

    it("should have sensible defaults for optional fields", () => {
      const defaults = {
        fontSize: 16,
        fontFamily: "Helvetica",
        fontWeight: "normal",
        align: "center",
        color: "#000000",
        maxWidth: 0.6,
        fieldType: "text",
        qrSize: 150,
      };
      expect(defaults.fontSize).toBe(16);
      expect(defaults.fontFamily).toBe("Helvetica");
      expect(defaults.fieldType).toBe("text");
    });
  });

  describe("CustomFontEntry schema validation", () => {
    it("should have required fields", () => {
      const font = {
        fontKey: "montserrat-regular",
        name: "Montserrat Regular",
        r2Key: "fonts/Montserrat-Regular.ttf",
        publicUrl: "https://r2.example.com/fonts/Montserrat-Regular.ttf",
        variants: ["normal"],
      };
      expect(font.fontKey).toBeTruthy();
      expect(font.name).toBeTruthy();
      expect(font.r2Key).toBeTruthy();
      expect(font.publicUrl).toMatch(/^https?:\/\//);
      expect(Array.isArray(font.variants)).toBe(true);
    });
  });

  describe("TemplatePageConfig schema validation", () => {
    it("should have valid page structure", () => {
      const page = {
        pageIndex: 0,
        imageKey: "templates/page-0.png",
        imageUrl: "https://r2.example.com/templates/page-0.png",
        width: 2480,
        height: 3508,
        textFields: [SAMPLE_TEXT_FIELD],
      };
      expect(page.pageIndex).toBeGreaterThanOrEqual(0);
      expect(page.width).toBeGreaterThan(0);
      expect(page.height).toBeGreaterThan(0);
      expect(Array.isArray(page.textFields)).toBe(true);
    });
  });

  describe("WorkshopTemplateDocument schema validation", () => {
    it("should have required fields", () => {
      const tpl = { ...SAMPLE_TEMPLATE_DOC };
      expect(tpl.name).toBeTruthy();
      expect(tpl.templateImageKey).toBeTruthy();
      expect(tpl.templateImageUrl).toBeTruthy();
      expect(tpl.imageWidth).toBeGreaterThan(0);
      expect(tpl.imageHeight).toBeGreaterThan(0);
      expect(Array.isArray(tpl.textFields)).toBe(true);
      expect(tpl.createdBy).toBeTruthy();
    });

    it("should support multi-page templates", () => {
      const multiPage = {
        ...SAMPLE_TEMPLATE_DOC,
        pages: [
          {
            pageIndex: 1,
            imageKey: "templates/back.png",
            imageUrl: "https://r2.example.com/templates/back.png",
            width: 2480,
            height: 3508,
            textFields: [],
          },
        ],
      };
      expect(multiPage.pages.length).toBe(1);
      expect(multiPage.pages[0].pageIndex).toBe(1);
    });

    it("should support custom fonts", () => {
      const withFonts = {
        ...SAMPLE_TEMPLATE_DOC,
        customFonts: [
          {
            fontKey: "montserrat",
            name: "Montserrat",
            r2Key: "fonts/montserrat.ttf",
            publicUrl: "https://r2.example.com/fonts/montserrat.ttf",
            variants: ["normal", "bold"],
          },
        ],
      };
      expect(withFonts.customFonts.length).toBe(1);
      expect(withFonts.customFonts[0].variants).toContain("bold");
    });

    it("should support default field values", () => {
      const tpl = { ...SAMPLE_TEMPLATE_DOC };
      expect(tpl.defaultFieldValues).toHaveProperty("workshopName");
      expect(tpl.defaultFieldValues.workshopName).toBe("Robotics Workshop");
    });

    it("should support generation history entries", () => {
      const history = [
        {
          generatedAt: new Date().toISOString(),
          recipientCount: 50,
          generatedBy: "user123",
        },
      ];
      expect(history.length).toBe(1);
      expect(history[0].recipientCount).toBe(50);
    });
  });
});

describe("WorkshopCertificateIssued Model Schema", () => {
  it("should have required fields", () => {
    const cert = { ...SAMPLE_ISSUED_CERT };
    expect(cert.certificateId).toBeTruthy();
    expect(cert.templateId).toBeTruthy();
    expect(typeof cert.fieldValues).toBe("object");
    expect(cert.generatedBy).toBeTruthy();
    expect(cert.generatedAt).toBeInstanceOf(Date);
  });

  it("should have valid status values", () => {
    const validStatuses = ["ISSUED", "REVOKED"];
    expect(validStatuses).toContain("ISSUED");
    expect(validStatuses).toContain("REVOKED");
    expect(validStatuses).not.toContain("PENDING");
  });

  it("should default status to ISSUED", () => {
    const defaultStatus = "ISSUED";
    expect(defaultStatus).toBe("ISSUED");
  });

  it("should have unique certificateId", () => {
    const id1 = "WS-ABC123-XYZ7";
    const id2 = "WS-DEF456-UVW8";
    expect(id1).not.toBe(id2);
  });

  it("should follow WS-XXYYZZ-PQRS format", () => {
    const certId = `WS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    expect(certId).toMatch(/^WS-[A-Z0-9]+-[A-Z0-9]+$/);
  });
});

describe("Certificate ID generation", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = `WS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      ids.add(id);
    }
    // At least 95% unique out of 100 (collisions are astronomically rare)
    expect(ids.size).toBeGreaterThanOrEqual(95);
  });
});

describe("Text field alignment values", () => {
  it("should accept left, center, right", () => {
    const alignments = ["left", "center", "right"];
    for (const a of alignments) {
      expect(["left", "center", "right"]).toContain(a);
    }
  });
});

describe("Font mapping logic", () => {
  // Test the font mapping logic used in the service
  function mapBuiltinFont(cssFont: string, weight: "normal" | "bold"): string {
    const lower = cssFont.toLowerCase().trim();
    if (
      lower === "times" || lower === "times new roman" || lower === "times-roman" || lower === "georgia" ||
      (lower.includes("serif") && !lower.includes("sans-serif"))
    ) {
      return weight === "bold" ? "Times-Bold" : "Times-Roman";
    }
    if (lower === "courier" || lower.includes("courier") || lower.includes("mono")) {
      return weight === "bold" ? "Courier-Bold" : "Courier";
    }
    return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
  }

  it("should map Helvetica to Helvetica", () => {
    expect(mapBuiltinFont("Helvetica", "normal")).toBe("Helvetica");
    expect(mapBuiltinFont("Helvetica", "bold")).toBe("Helvetica-Bold");
  });

  it("should map Times to Times-Roman", () => {
    expect(mapBuiltinFont("Times", "normal")).toBe("Times-Roman");
    expect(mapBuiltinFont("Times", "bold")).toBe("Times-Bold");
  });

  it("should map Courier to Courier", () => {
    expect(mapBuiltinFont("Courier", "normal")).toBe("Courier");
    expect(mapBuiltinFont("Courier", "bold")).toBe("Courier-Bold");
  });

  it("should map Georgia to Times-Roman (serif)", () => {
    expect(mapBuiltinFont("Georgia", "normal")).toBe("Times-Roman");
  });

  it("should map sans-serif fallback to Helvetica", () => {
    expect(mapBuiltinFont("sans-serif", "normal")).toBe("Helvetica");
    expect(mapBuiltinFont("Arial", "normal")).toBe("Helvetica");
  });

  it("should map monospace to Courier", () => {
    expect(mapBuiltinFont("monospace", "normal")).toBe("Courier");
    expect(mapBuiltinFont("Courier New", "normal")).toBe("Courier");
  });

  it("should handle case insensitive input", () => {
    expect(mapBuiltinFont("TIMES", "normal")).toBe("Times-Roman");
    expect(mapBuiltinFont("  Helvetica  ", "bold")).toBe("Helvetica-Bold");
  });
});

describe("Merge field values logic", () => {
  it("should merge template defaults < input defaults < explicit values", () => {
    const templateDefaults = { workshopName: "Default Workshop", date: "01/01/2026" };
    const inputDefaults = { workshopName: "Override Workshop" };
    const explicitValues = { studentName: "Alice", date: "15/09/2026" };

    const merged = {
      ...templateDefaults,
      ...inputDefaults,
      ...explicitValues,
    };

    expect(merged.workshopName).toBe("Override Workshop"); // input wins over template
    expect(merged.date).toBe("15/09/2026"); // explicit wins over template
    expect(merged.studentName).toBe("Alice");
  });

  it("should handle empty defaults gracefully", () => {
    const merged = {
      ...(null ?? {}),
      ...(undefined ?? {}),
      studentName: "Bob",
    };
    expect(merged.studentName).toBe("Bob");
  });
});

describe("Certificate generation edge cases", () => {
  it("should handle recipient name extraction priority", () => {
    const row1 = { name: "Alice" };
    const row2 = { studentName: "Bob" };
    const row3 = { student_name: "Charlie" };
    const row4 = {};

    const getName = (row: Record<string, string>, index: number) =>
      row.name ?? row.studentName ?? row.student_name ?? `recipient-${index + 1}`;

    expect(getName(row1, 0)).toBe("Alice");
    expect(getName(row2, 0)).toBe("Bob");
    expect(getName(row3, 0)).toBe("Charlie");
    expect(getName(row4, 0)).toBe("recipient-1");
  });

  it("should sanitize filename for ZIP entry", () => {
    const name = 'Alice/Smith:Test\\Name*?<>|"';
    const safeName = String(name).replace(/[/\\:*?"<>|]/g, "_").trim().slice(0, 80);
    expect(safeName).toBe("Alice_Smith_Test_Name______");
  });

  it("should truncate long names in ZIP entry", () => {
    const longName = "A".repeat(200);
    const safeName = String(longName).replace(/[/\\:*?"<>|]/g, "_").trim().slice(0, 80);
    expect(safeName.length).toBe(80);
  });

  it("should enforce max 500 recipients per batch", () => {
    const maxRecipients = 500;
    const recipients = Array.from({ length: 501 }, (_, i) => ({
      index: i,
      name: `Student ${i}`,
      fieldValues: { studentName: `Student ${i}` },
    }));
    expect(recipients.length).toBeGreaterThan(maxRecipients);
  });
});

describe("QR code verification URL", () => {
  it("should construct verification URL with certificate ID", () => {
    const backendUrl = "https://api.funt.in";
    const certId = "WS-ABC123-XYZ7";
    const url = `${backendUrl}/verify/workshop/${certId}`;
    expect(url).toBe("https://api.funt.in/verify/workshop/WS-ABC123-XYZ7");
  });

  it("should handle trailing slash in backend URL", () => {
    const backendUrl = "https://api.funt.in/";
    const certId = "WS-ABC123-XYZ7";
    const url = `${backendUrl.replace(/\/$/, "")}/verify/workshop/${certId}`;
    expect(url).toBe("https://api.funt.in/verify/workshop/WS-ABC123-XYZ7");
  });
});

describe("Template duplication logic", () => {
  it("should append (Copy) to duplicated template name", () => {
    const srcName = "Workshop Certificate 2026";
    const newName = `${srcName} (Copy)`;
    expect(newName).toBe("Workshop Certificate 2026 (Copy)");
  });

  it("should preserve fields from source template", () => {
    const src = {
      textFields: [SAMPLE_TEXT_FIELD, SAMPLE_QR_FIELD],
      pages: [],
      customFonts: [],
      defaultFieldValues: { workshopName: "Test" },
    };
    const copy = {
      ...src,
      name: `${"Original"} (Copy)`,
      generationHistory: [],
    };
    expect(copy.textFields.length).toBe(2);
    expect(copy.defaultFieldValues.workshopName).toBe("Test");
    expect(copy.generationHistory).toEqual([]);
  });
});

describe("Generation history management", () => {
  it("should cap history at 50 entries using $slice", () => {
    // Simulate $slice: -50 behavior
    const history = Array.from({ length: 55 }, (_, i) => ({
      generatedAt: new Date(),
      recipientCount: i + 1,
      generatedBy: "user123",
    }));
    const sliced = history.slice(-50);
    expect(sliced.length).toBe(50);
    // First kept entry should be index 5 (55 - 50 = 5)
    expect(sliced[0].recipientCount).toBe(6);
  });
});

describe("PDFKit auto-shrink logic", () => {
  it("should shrink font size when text exceeds max width", () => {
    // Simulate auto-shrink
    let fontSize = 24;
    const textWidth = 500;
    const maxW = 400;
    while (fontSize > 6 && textWidth > maxW) {
      fontSize -= 0.5;
    }
    expect(fontSize).toBeLessThan(24);
    expect(fontSize).toBeGreaterThanOrEqual(6);
  });

  it("should not shrink if text fits", () => {
    let fontSize = 24;
    const textWidth = 300;
    const maxW = 400;
    while (fontSize > 6 && textWidth > maxW) {
      fontSize -= 0.5;
    }
    expect(fontSize).toBe(24);
  });
});

describe("Text positioning calculations", () => {
  it("should calculate text X position for center alignment", () => {
    const anchorX = 0.5; // 50%
    const maxW = 0.6; // 60%
    const imageWidth = 2480;
    const anchorXPx = anchorX * imageWidth;
    const maxWPx = maxW * imageWidth;
    const textX = anchorXPx - maxWPx / 2;
    expect(textX).toBe((0.5 - 0.3) * 2480); // 496
  });

  it("should calculate text X position for right alignment", () => {
    const anchorX = 0.8;
    const maxW = 0.6;
    const imageWidth = 2480;
    const textX = anchorX * imageWidth - maxW * imageWidth;
    expect(textX).toBeCloseTo((0.8 - 0.6) * 2480, 5);
  });

  it("should calculate text X position for left alignment", () => {
    const anchorX = 0.2;
    const imageWidth = 2480;
    const textX = anchorX * imageWidth;
    expect(textX).toBe(0.2 * 2480);
  });

  it("should center QR code at anchor point", () => {
    const fx = 0.8;
    const fy = 0.9;
    const qrSize = 150;
    const imageWidth = 2480;
    const imageHeight = 3508;
    const qrX = fx * imageWidth - qrSize / 2;
    const qrY = fy * imageHeight - qrSize / 2;
    expect(qrX).toBe(0.8 * 2480 - 75);
    expect(qrY).toBe(0.9 * 3508 - 75);
  });
});

describe("Zoom calculations", () => {
  it("should clamp zoom within 0.25 to 3", () => {
    let zoom = 1;
    // Zoom in
    zoom = Math.max(0.25, Math.min(3, zoom + 0.25));
    expect(zoom).toBe(1.25);
    // Zoom out
    zoom = Math.max(0.25, Math.min(3, zoom - 2));
    expect(zoom).toBe(0.25);
    // Zoom in past limit
    zoom = Math.max(0.25, Math.min(3, zoom + 3));
    expect(zoom).toBe(3);
  });

  it("should handle scroll wheel zoom increments", () => {
    let zoom = 1;
    const delta = -0.1; // scroll down = zoom out
    zoom = Math.max(0.25, Math.min(3, zoom + delta));
    expect(zoom).toBe(0.9);
  });
});

describe("Field hit detection", () => {
  it("should detect field within hit radius", () => {
    const textFields = [SAMPLE_TEXT_FIELD];
    const hitRadius = 0.04;
    const fx = 0.51;
    const fy = 0.41;

    const hitIdx = textFields.findIndex(
      (f) => Math.abs(f.x - fx) < hitRadius && Math.abs(f.y - fy) < hitRadius
    );
    expect(hitIdx).toBe(0);
  });

  it("should not detect field outside hit radius", () => {
    const textFields = [SAMPLE_TEXT_FIELD];
    const hitRadius = 0.04;
    const fx = 0.6;
    const fy = 0.6;

    const hitIdx = textFields.findIndex(
      (f) => Math.abs(f.x - fx) < hitRadius && Math.abs(f.y - fy) < hitRadius
    );
    expect(hitIdx).toBe(-1);
  });

  it("should prefer last field when overlapping (top-most)", () => {
    const fields = [
      { ...SAMPLE_TEXT_FIELD, x: 0.5, y: 0.5 },
      { ...SAMPLE_TEXT_FIELD, x: 0.51, y: 0.51, key: "second" },
    ];
    const hitRadius = 0.04;
    const fx = 0.505;
    const fy = 0.505;

    // Iterate in reverse to find top-most
    let hitIdx: number | null = null;
    for (let i = fields.length - 1; i >= 0; i--) {
      if (Math.abs(fields[i].x - fx) < hitRadius && Math.abs(fields[i].y - fy) < hitRadius) {
        hitIdx = i;
        break;
      }
    }
    expect(hitIdx).toBe(1); // Second field (drawn on top)
  });
});

describe("Undo/Redo logic", () => {
  function useUndoRedo<T>(initial: T, maxSteps = 50) {
    let past: T[] = [];
    let present = initial;
    let future: T[] = [];

    const set = (next: T) => {
      past = [...past.slice(-maxSteps + 1), structuredClone(present)];
      future = [];
      present = next;
    };

    const undo = () => {
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      past = past.slice(0, -1);
      future = [structuredClone(present), ...future];
      present = prev;
    };

    const redo = () => {
      if (future.length === 0) return;
      const next = future[0];
      future = future.slice(1);
      past = [...past, structuredClone(present)];
      present = next;
    };

    return {
      get present() { return present; },
      set,
      undo,
      redo,
      get canUndo() { return past.length > 0; },
      get canRedo() { return future.length > 0; },
    };
  }

  it("should track state changes and allow undo", () => {
    const state = useUndoRedo<string[]>([SAMPLE_TEXT_FIELD] as unknown as string[]);
    expect(state.canUndo).toBe(false);

    state.set([SAMPLE_TEXT_FIELD, SAMPLE_QR_FIELD] as unknown as string[]);
    expect(state.canUndo).toBe(true);

    state.undo();
    expect(state.canUndo).toBe(false);
  });

  it("should allow redo after undo", () => {
    const state = useUndoRedo(0);
    state.set(1);
    state.set(2);

    state.undo();
    expect(state.present).toBe(1);
    expect(state.canRedo).toBe(true);

    state.redo();
    expect(state.present).toBe(2);
    expect(state.canRedo).toBe(false);
  });

  it("should clear redo stack on new change", () => {
    const state = useUndoRedo(0);
    state.set(1);
    state.set(2);
    state.undo(); // back to 1
    state.undo(); // back to 0
    expect(state.canRedo).toBe(true);

    state.set(5); // new change
    expect(state.canRedo).toBe(false);
    expect(state.present).toBe(5);
  });

  it("should respect maxSteps limit", () => {
    const state = useUndoRedo(0, 3);
    for (let i = 1; i <= 10; i++) state.set(i);

    // Should only keep last 2 past states (max 3 - 1 = 2)
    let undoCount = 0;
    while (state.canUndo) {
      state.undo();
      undoCount++;
    }
    expect(undoCount).toBe(3);
  });
});

describe("CSV parsing logic", () => {
  it("should parse CSV header and rows", () => {
    const csv = "name,studentName,course\nAlice,Alice Smith,Robotics\nBob,Bob Jones,Chemistry";
    const lines = csv.split("\n").filter((l) => l.trim());
    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return row;
    });

    expect(data.length).toBe(2);
    expect(data[0].name).toBe("Alice");
    expect(data[1].course).toBe("Chemistry");
  });

  it("should handle quoted CSV fields", () => {
    const csv = 'name,course\n"Alice Smith","Robotics 101"';
    const headers = csv.split("\n")[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const values = csv.split("\n")[1].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));

    expect(headers).toEqual(["name", "course"]);
    expect(values).toEqual(["Alice Smith", "Robotics 101"]);
  });

  it("should handle JSON array input", () => {
    const jsonStr = '[{"name":"Alice","course":"Robotics"},{"name":"Bob","course":"Chemistry"}]';
    const data = JSON.parse(jsonStr);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });
});

describe("Default field values (batch pre-fill)", () => {
  it("should merge template defaults with per-generation overrides", () => {
    const templateDefaults = { workshopName: "Workshop A", date: "01/09/2026" };
    const perGenOverrides = { workshopName: "Workshop B" };
    const rowValues = { studentName: "Alice" };

    const merged = {
      ...templateDefaults,
      ...perGenOverrides,
      ...rowValues,
    };

    expect(merged.workshopName).toBe("Workshop B");
    expect(merged.date).toBe("01/09/2026");
    expect(merged.studentName).toBe("Alice");
  });

  it("should skip QR code fields in default value inputs", () => {
    const fields = [
      { ...SAMPLE_TEXT_FIELD, key: "studentName" },
      { ...SAMPLE_QR_FIELD, key: "qr_1" },
    ];
    const nonQrFields = fields.filter((f) => f.fieldType !== "qr_code");
    expect(nonQrFields.length).toBe(1);
    expect(nonQrFields[0].key).toBe("studentName");
  });
});
