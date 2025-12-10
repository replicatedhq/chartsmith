/**
 * Unit tests for AI SDK tool functions
 * Run with: npm run test:unit
 */

import {
  executeKubernetesVersion,
  executeSubchartVersion,
  kubernetesVersionSchema,
  subchartVersionSchema,
} from '../tools';

describe('executeKubernetesVersion', () => {
  it('should return major version', async () => {
    const result = await executeKubernetesVersion({ semver_field: 'major' });
    expect(result).toEqual({ version: '1', semver_field: 'major' });
  });

  it('should return minor version', async () => {
    const result = await executeKubernetesVersion({ semver_field: 'minor' });
    expect(result).toEqual({ version: '1.32', semver_field: 'minor' });
  });

  it('should return patch version', async () => {
    const result = await executeKubernetesVersion({ semver_field: 'patch' });
    expect(result).toEqual({ version: '1.32.1', semver_field: 'patch' });
  });
});

describe('executeSubchartVersion', () => {
  it('should return chart info from ArtifactHub', async () => {
    const result = await executeSubchartVersion({ chart_name: 'nginx' });

    // Should have required fields
    expect(result.chart_name).toBe('nginx');
    expect(result.version).toBeDefined();
    expect(result.source).toBeDefined();
  });

  it('should handle non-existent chart', async () => {
    const result = await executeSubchartVersion({ chart_name: 'nonexistent-chart-xyz123' });

    expect(result.chart_name).toBe('nonexistent-chart-xyz123');
    expect(result.version).toBeDefined();
    // Should fall back to mock
    expect(['mock', 'artifacthub']).toContain(result.source);
  });
});

describe('Zod schemas', () => {
  describe('kubernetesVersionSchema', () => {
    it('should validate major field', () => {
      const result = kubernetesVersionSchema.safeParse({ semver_field: 'major' });
      expect(result.success).toBe(true);
    });

    it('should validate minor field', () => {
      const result = kubernetesVersionSchema.safeParse({ semver_field: 'minor' });
      expect(result.success).toBe(true);
    });

    it('should validate patch field', () => {
      const result = kubernetesVersionSchema.safeParse({ semver_field: 'patch' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid field', () => {
      const result = kubernetesVersionSchema.safeParse({ semver_field: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('subchartVersionSchema', () => {
    it('should validate chart_name', () => {
      const result = subchartVersionSchema.safeParse({ chart_name: 'nginx' });
      expect(result.success).toBe(true);
    });

    it('should reject missing chart_name', () => {
      const result = subchartVersionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
