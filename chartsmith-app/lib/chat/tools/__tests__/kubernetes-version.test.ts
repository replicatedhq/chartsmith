/**
 * Tests for Kubernetes Version Tool
 */

import {
  executeKubernetesVersion,
  createKubernetesVersionTool,
  kubernetesVersionInputSchema,
  type KubernetesVersionInput,
} from "../kubernetes-version";

describe("kubernetes-version tool", () => {
  describe("executeKubernetesVersion", () => {
    it("should return major version", () => {
      const result = executeKubernetesVersion({ semver_field: "major" });
      expect(result).toBe("1");
    });

    it("should return minor version", () => {
      const result = executeKubernetesVersion({ semver_field: "minor" });
      expect(result).toBe("1.32");
    });

    it("should return patch version", () => {
      const result = executeKubernetesVersion({ semver_field: "patch" });
      expect(result).toBe("1.32.1");
    });
  });

  describe("kubernetesVersionInputSchema", () => {
    it("should accept valid semver fields", () => {
      expect(kubernetesVersionInputSchema.parse({ semver_field: "major" })).toEqual({
        semver_field: "major",
      });
      expect(kubernetesVersionInputSchema.parse({ semver_field: "minor" })).toEqual({
        semver_field: "minor",
      });
      expect(kubernetesVersionInputSchema.parse({ semver_field: "patch" })).toEqual({
        semver_field: "patch",
      });
    });

    it("should reject invalid semver fields", () => {
      expect(() =>
        kubernetesVersionInputSchema.parse({ semver_field: "invalid" })
      ).toThrow();
    });

    it("should reject missing semver_field", () => {
      expect(() => kubernetesVersionInputSchema.parse({})).toThrow();
    });
  });

  describe("createKubernetesVersionTool", () => {
    it("should create a tool with correct description", () => {
      const tool = createKubernetesVersionTool();
      expect(tool.description).toContain("Kubernetes");
      expect(tool.description).toContain("apiVersion");
    });

    it("should have an execute function", () => {
      const tool = createKubernetesVersionTool();
      expect(typeof tool.execute).toBe("function");
    });

    it("should execute and return version", async () => {
      const tool = createKubernetesVersionTool();
      const result = await tool.execute(
        { semver_field: "patch" },
        { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal }
      );
      expect(result).toBe("1.32.1");
    });
  });
});
