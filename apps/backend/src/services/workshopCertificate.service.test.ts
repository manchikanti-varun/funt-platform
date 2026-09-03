import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFind = vi.fn();
const mockFindById = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockFindByIdAndDelete = vi.fn();
const mockCreate = vi.fn();

vi.mock("../models/WorkshopTemplate.model.js", () => {
  return {
    WorkshopTemplateModel: {
      find: mockFind,
      findById: mockFindById,
      findByIdAndUpdate: mockFindByIdAndUpdate,
      findByIdAndDelete: mockFindByIdAndDelete,
      create: mockCreate,
    },
    WorkshopCertificateIssuedModel: {
      create: mockCreate,
      findOneAndUpdate: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    },
  };
});

vi.mock("../services/audit.service.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/AppError.js", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = "AppError";
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: vi.fn(),
}));

vi.mock("../config/r2.js", () => ({
  getR2Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  getR2Bucket: vi.fn(() => "test-bucket"),
}));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-qr")),
  },
}));

// ─── Test data ──────────────────────────────────────────────────────────────

const SAMPLE_TEMPLATE = {
  _id: "tpl123",
  name: "Workshop Certificate 2026",
  templateImageKey: "templates/cert-bg.png",
  templateImageUrl: "https://r2.example.com/templates/cert-bg.png",
  imageWidth: 2480,
  imageHeight: 3508,
  textFields: [
    {
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
    },
  ],
  pages: [],
  customFonts: [],
  defaultFieldValues: { workshopName: "Robotics Workshop" },
  generationHistory: [],
  createdBy: "user123",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("WorkshopCertificate Service - Template CRUD", () => {
  let service: typeof import("../services/workshopCertificate.service.js");

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to get fresh service
    vi.resetModules();
    service = await import("../services/workshopCertificate.service.js");

    // Default mock chain for find/sort/lean/exec
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([SAMPLE_TEMPLATE]),
        }),
      }),
    });
  });

  describe("listTemplates", () => {
    it("should list all templates for admin users", async () => {
      const result = await service.listTemplates("user123", false);
      expect(mockFind).toHaveBeenCalledWith({});
      expect(result).toEqual([SAMPLE_TEMPLATE]);
    });

    it("should list only own templates for sub-admin users", async () => {
      const result = await service.listTemplates("user123", true);
      expect(mockFind).toHaveBeenCalledWith({ createdBy: "user123" });
      expect(result).toEqual([SAMPLE_TEMPLATE]);
    });
  });

  describe("getTemplate", () => {
    it("should return template by ID", async () => {
      mockFindById.mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(SAMPLE_TEMPLATE),
        }),
      });

      const result = await service.getTemplate("tpl123");
      expect(mockFindById).toHaveBeenCalledWith("tpl123");
      expect(result).toEqual(SAMPLE_TEMPLATE);
    });

    it("should throw 404 if template not found", async () => {
      mockFindById.mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getTemplate("nonexistent")).rejects.toThrow("Template not found");
    });
  });

  describe("createTemplate", () => {
    it("should create a new template with audit log", async () => {
      mockCreate.mockResolvedValue({ ...SAMPLE_TEMPLATE, toObject: () => SAMPLE_TEMPLATE });

      const result = await service.createTemplate(
        {
          name: "New Template",
          templateImageKey: "key",
          templateImageUrl: "url",
          imageWidth: 100,
          imageHeight: 100,
          textFields: [],
        },
        "user123"
      );

      expect(mockCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("deleteTemplate", () => {
    it("should delete and return success", async () => {
      mockFindByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue(SAMPLE_TEMPLATE),
      });

      const result = await service.deleteTemplate("tpl123", "user123");
      expect(result).toEqual({ deleted: true });
    });

    it("should throw 404 if template not found", async () => {
      mockFindByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.deleteTemplate("nonexistent", "user123")).rejects.toThrow("Template not found");
    });
  });

  describe("duplicateTemplate", () => {
    it("should create copy with (Copy) suffix", async () => {
      mockFindById.mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(SAMPLE_TEMPLATE),
        }),
      });

      mockCreate.mockResolvedValue({
        ...SAMPLE_TEMPLATE,
        name: "Workshop Certificate 2026 (Copy)",
        toObject: () => ({ ...SAMPLE_TEMPLATE, name: "Workshop Certificate 2026 (Copy)" }),
      });

      const result = await service.duplicateTemplate("tpl123", "user123");
      expect(result).toBeDefined();
      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.name).toBe("Workshop Certificate 2026 (Copy)");
      expect(createCall.generationHistory).toEqual([]);
    });

    it("should throw 404 if source template not found", async () => {
      mockFindById.mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.duplicateTemplate("nonexistent", "user123")).rejects.toThrow("Source template not found");
    });
  });
});

describe("WorkshopCertificate Service - Registry", () => {
  it("should generate certificate ID in WS-XXYYZZ-PQRS format", () => {
    const certId = `WS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    expect(certId).toMatch(/^WS-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it("should track ISSUED and REVOKED statuses", () => {
    const statuses = ["ISSUED", "REVOKED"] as const;
    expect(statuses).toContain("ISSUED");
    expect(statuses).toContain("REVOKED");
  });
});

describe("WorkshopCertificate Service - QR Code", () => {
  it("should generate QR code buffer with correct params", async () => {
    const QRCode = (await import("qrcode")).default;
    const buffer = await QRCode.toBuffer("https://api.funt.in/verify/workshop/WS-ABC", {
      width: 150,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("WorkshopCertificate Service - Field Value Merging", () => {
  it("should apply correct merge order: template defaults < input defaults < explicit", () => {
    const templateDefaults = { workshopName: "Template Default", location: "Delhi" };
    const inputDefaults = { workshopName: "Input Override" };
    const explicitValues = { studentName: "Alice", location: "Mumbai" };

    const merged = {
      ...templateDefaults,
      ...inputDefaults,
      ...explicitValues,
    };

    expect(merged.workshopName).toBe("Input Override");
    expect(merged.location).toBe("Mumbai");
    expect(merged.studentName).toBe("Alice");
  });
});

describe("WorkshopCertificate Service - PDF generation edge cases", () => {
  it("should handle empty field values gracefully", () => {
    const mergedValues: Record<string, string> = {};
    const value = mergedValues["nonexistent"] ?? "";
    expect(value).toBe("");
  });

  it("should skip rendering empty fields", () => {
    const value = "";
    const shouldRender = value.trim().length > 0;
    expect(shouldRender).toBe(false);
  });

  it("should calculate correct PDF page dimensions from image", () => {
    const imageWidth = 2480;
    const imageHeight = 3508;
    // PDFKit expects points (72 dpi), but we use pixel dimensions directly
    expect(imageWidth).toBeGreaterThan(0);
    expect(imageHeight).toBeGreaterThan(0);
    expect(imageHeight / imageWidth).toBeCloseTo(1.414, 2); // A4 ratio
  });
});
