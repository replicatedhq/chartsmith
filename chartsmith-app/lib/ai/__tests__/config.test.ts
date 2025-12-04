/**
 * AI Configuration Tests
 * 
 * Tests for AI SDK configuration constants.
 */

import {
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  MAX_STREAMING_DURATION,
  CHARTSMITH_SYSTEM_PROMPT,
  STREAMING_THROTTLE_MS,
} from '../config';

describe('AI Configuration', () => {
  describe('DEFAULT_PROVIDER', () => {
    it('should default to anthropic', () => {
      // Note: This test may be affected by env vars in CI
      expect(DEFAULT_PROVIDER).toBe('anthropic');
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('should default to claude-sonnet-4', () => {
      expect(DEFAULT_MODEL).toBe('anthropic/claude-sonnet-4-20250514');
    });
  });

  describe('MAX_STREAMING_DURATION', () => {
    it('should be a reasonable value for streaming', () => {
      expect(MAX_STREAMING_DURATION).toBeGreaterThanOrEqual(30);
      expect(MAX_STREAMING_DURATION).toBeLessThanOrEqual(120);
    });
  });

  describe('CHARTSMITH_SYSTEM_PROMPT', () => {
    it('should mention Helm charts', () => {
      expect(CHARTSMITH_SYSTEM_PROMPT).toContain('Helm');
    });

    it('should mention Kubernetes', () => {
      expect(CHARTSMITH_SYSTEM_PROMPT).toContain('Kubernetes');
    });

    it('should define the assistant identity', () => {
      expect(CHARTSMITH_SYSTEM_PROMPT).toContain('ChartSmith');
    });

    it('should be non-empty and substantial', () => {
      expect(CHARTSMITH_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });
  });

  describe('STREAMING_THROTTLE_MS', () => {
    it('should be a reasonable throttle value', () => {
      expect(STREAMING_THROTTLE_MS).toBeGreaterThanOrEqual(10);
      expect(STREAMING_THROTTLE_MS).toBeLessThanOrEqual(200);
    });
  });
});

