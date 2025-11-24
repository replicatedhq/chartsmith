/**
 * Tests for AI Provider Factory
 */

// Mock the AI SDK providers
jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn((model: string) => ({ provider: 'anthropic', model })),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((model: string) => ({ provider: 'openai', model })),
}));

import {
  getProvider,
  getModelName,
  isApiKeyConfigured,
  getProviderInfo,
  validateProviderConfig,
  AVAILABLE_MODELS,
} from '../provider';

describe('AI Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getProvider', () => {
    it('returns anthropic by default', () => {
      delete process.env.LLM_PROVIDER;
      expect(getProvider()).toBe('anthropic');
    });

    it('returns anthropic when set', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      expect(getProvider()).toBe('anthropic');
    });

    it('returns openai when set', () => {
      process.env.LLM_PROVIDER = 'openai';
      expect(getProvider()).toBe('openai');
    });

    it('handles case insensitivity', () => {
      process.env.LLM_PROVIDER = 'OPENAI';
      expect(getProvider()).toBe('openai');
    });

    it('falls back to anthropic for unknown providers', () => {
      process.env.LLM_PROVIDER = 'unknown';
      expect(getProvider()).toBe('anthropic');
    });
  });

  describe('getModelName', () => {
    it('returns default anthropic model', () => {
      delete process.env.LLM_PROVIDER;
      delete process.env.LLM_MODEL;
      expect(getModelName()).toBe('claude-3-haiku-20240307');
    });

    it('returns default openai model', () => {
      process.env.LLM_PROVIDER = 'openai';
      delete process.env.LLM_MODEL;
      expect(getModelName()).toBe('gpt-4-turbo');
    });

    it('returns custom model when set', () => {
      process.env.LLM_MODEL = 'claude-3-opus-20240229';
      expect(getModelName()).toBe('claude-3-opus-20240229');
    });

    it('allows unknown models with warning', () => {
      process.env.LLM_MODEL = 'custom-model';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      expect(getModelName()).toBe('custom-model');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('isApiKeyConfigured', () => {
    it('returns true when anthropic key is set', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      expect(isApiKeyConfigured()).toBe(true);
    });

    it('returns false when anthropic key is missing', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      delete process.env.ANTHROPIC_API_KEY;
      expect(isApiKeyConfigured()).toBe(false);
    });

    it('returns true when openai key is set', () => {
      process.env.LLM_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'sk-test';
      expect(isApiKeyConfigured()).toBe(true);
    });

    it('returns false when openai key is missing', () => {
      process.env.LLM_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      expect(isApiKeyConfigured()).toBe(false);
    });
  });

  describe('getProviderInfo', () => {
    it('returns complete provider info', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      delete process.env.LLM_MODEL;

      const info = getProviderInfo();
      expect(info).toEqual({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        apiKeyConfigured: true,
      });
    });
  });

  describe('validateProviderConfig', () => {
    it('returns empty array when config is valid', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      delete process.env.LLM_MODEL;

      const issues = validateProviderConfig();
      expect(issues).toEqual([]);
    });

    it('returns issue when API key is missing', () => {
      process.env.LLM_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;

      const issues = validateProviderConfig();
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('OPENAI_API_KEY');
    });

    it('returns issue for unknown model', () => {
      process.env.LLM_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.LLM_MODEL = 'unknown-model';

      const issues = validateProviderConfig();
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('unknown-model');
    });
  });

  describe('AVAILABLE_MODELS', () => {
    it('has anthropic models', () => {
      expect(AVAILABLE_MODELS.anthropic).toContain('claude-3-haiku-20240307');
      expect(AVAILABLE_MODELS.anthropic).toContain('claude-3-sonnet-20240229');
      expect(AVAILABLE_MODELS.anthropic).toContain('claude-3-opus-20240229');
    });

    it('has openai models', () => {
      expect(AVAILABLE_MODELS.openai).toContain('gpt-4-turbo');
      expect(AVAILABLE_MODELS.openai).toContain('gpt-4o');
      expect(AVAILABLE_MODELS.openai).toContain('gpt-3.5-turbo');
    });
  });
});

