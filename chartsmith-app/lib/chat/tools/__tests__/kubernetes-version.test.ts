/**
 * Tests for Kubernetes Version Tool
 *
 * Tests the actual business logic - semver field extraction.
 * Schema validation is handled by Zod at runtime.
 */

import { executeKubernetesVersion } from "../kubernetes-version";

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
});
