/**
 * Tests for Subchart Version Tool
 */

import {
  executeSubchartVersion,
  createSubchartVersionTool,
  subchartVersionInputSchema,
} from "../subchart-version";

// Mock fetch globally
const originalFetch = global.fetch;

describe("subchart-version tool", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("subchartVersionInputSchema", () => {
    it("should accept valid chart names", () => {
      expect(subchartVersionInputSchema.parse({ chart_name: "postgresql" })).toEqual({
        chart_name: "postgresql",
      });
      expect(subchartVersionInputSchema.parse({ chart_name: "redis" })).toEqual({
        chart_name: "redis",
      });
    });

    it("should reject empty chart names", () => {
      expect(() => subchartVersionInputSchema.parse({ chart_name: "" })).toThrow();
    });

    it("should reject missing chart_name", () => {
      expect(() => subchartVersionInputSchema.parse({})).toThrow();
    });
  });

  describe("executeSubchartVersion", () => {
    it("should return version from exact match", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            packages: [
              { name: "postgresql-ha", version: "11.0.0", repository: { name: "bitnami", url: "" } },
              { name: "postgresql", version: "12.5.6", repository: { name: "bitnami", url: "" } },
            ],
          }),
      });

      const result = await executeSubchartVersion({ chart_name: "postgresql" });
      expect(result).toBe("12.5.6");
    });

    it("should return first result when no exact match", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            packages: [
              { name: "redis-cluster", version: "8.0.0", repository: { name: "bitnami", url: "" } },
              { name: "redis-ha", version: "7.0.0", repository: { name: "stable", url: "" } },
            ],
          }),
      });

      const result = await executeSubchartVersion({ chart_name: "redis" });
      expect(result).toBe("8.0.0");
    });

    it("should return ? when API returns no packages", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ packages: [] }),
      });

      const result = await executeSubchartVersion({ chart_name: "nonexistent" });
      expect(result).toBe("?");
    });

    it("should return ? when API returns error status", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await executeSubchartVersion({ chart_name: "postgresql" });
      expect(result).toBe("?");
    });

    it("should return ? when fetch throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const result = await executeSubchartVersion({ chart_name: "postgresql" });
      expect(result).toBe("?");
    });

    it("should handle case-insensitive matching", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            packages: [
              { name: "PostgreSQL", version: "15.0.0", repository: { name: "bitnami", url: "" } },
            ],
          }),
      });

      const result = await executeSubchartVersion({ chart_name: "postgresql" });
      expect(result).toBe("15.0.0");
    });
  });

  describe("createSubchartVersionTool", () => {
    it("should create a tool with correct description", () => {
      const tool = createSubchartVersionTool();
      expect(tool.description).toContain("subchart");
      expect(tool.description).toContain("Artifact Hub");
    });

    it("should have an execute function", () => {
      const tool = createSubchartVersionTool();
      expect(typeof tool.execute).toBe("function");
    });

    it("should execute and return version", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            packages: [
              { name: "nginx", version: "13.2.1", repository: { name: "bitnami", url: "" } },
            ],
          }),
      });

      const tool = createSubchartVersionTool();
      const result = await tool.execute(
        { chart_name: "nginx" },
        { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal }
      );
      expect(result).toBe("13.2.1");
    });
  });
});
