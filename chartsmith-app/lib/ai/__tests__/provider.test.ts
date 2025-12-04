/**
 * Provider Factory Tests
 * 
 * Tests for the AI provider factory that powers the new /api/chat route.
 * These tests verify that providers are correctly configured without making API calls.
 */

import {
  getModel,
  getDefaultProvider,
  isValidProvider,
  isValidModel,
  InvalidProviderError,
  InvalidModelError,
  AVAILABLE_PROVIDERS,
  AVAILABLE_MODELS,
} from '../provider';

describe('Provider Factory', () => {
  describe('AVAILABLE_PROVIDERS', () => {
    it('should have anthropic as the first (default) provider', () => {
      expect(AVAILABLE_PROVIDERS[0].id).toBe('anthropic');
    });

    it('should have anthropic with claude-sonnet-4 as default model', () => {
      const anthropic = AVAILABLE_PROVIDERS.find(p => p.id === 'anthropic');
      expect(anthropic?.defaultModel).toBe('anthropic/claude-sonnet-4-20250514');
    });

    it('should have openai as an alternative provider', () => {
      const openai = AVAILABLE_PROVIDERS.find(p => p.id === 'openai');
      expect(openai).toBeDefined();
      expect(openai?.defaultModel).toBe('openai/gpt-4o');
    });

    it('should have all required fields for each provider', () => {
      AVAILABLE_PROVIDERS.forEach(provider => {
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.description).toBeDefined();
        expect(provider.defaultModel).toBeDefined();
      });
    });
  });

  describe('AVAILABLE_MODELS', () => {
    it('should have claude-sonnet-4 as the first (recommended) model', () => {
      expect(AVAILABLE_MODELS[0].id).toBe('claude-sonnet-4');
      expect(AVAILABLE_MODELS[0].modelId).toBe('anthropic/claude-sonnet-4-20250514');
    });

    it('should include Anthropic models', () => {
      const claudeModels = AVAILABLE_MODELS.filter(m => m.provider === 'anthropic');
      expect(claudeModels.length).toBeGreaterThanOrEqual(1);
      
      const modelIds = claudeModels.map(m => m.id);
      expect(modelIds).toContain('claude-sonnet-4');
    });

    it('should include OpenAI models', () => {
      const openaiModels = AVAILABLE_MODELS.filter(m => m.provider === 'openai');
      expect(openaiModels.length).toBeGreaterThanOrEqual(2);
      
      const modelIds = openaiModels.map(m => m.id);
      expect(modelIds).toContain('gpt-4o');
      expect(modelIds).toContain('gpt-4o-mini');
    });

    it('should have all required fields for each model', () => {
      AVAILABLE_MODELS.forEach(model => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.modelId).toBeDefined();
        expect(model.description).toBeDefined();
      });
    });
  });

  describe('getDefaultProvider', () => {
    it('should return anthropic as the default provider', () => {
      expect(getDefaultProvider()).toBe('anthropic');
    });
  });

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('anthropic')).toBe(true);
      expect(isValidProvider('openai')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidProvider('invalid')).toBe(false);
      expect(isValidProvider('google')).toBe(false);
      expect(isValidProvider('')).toBe(false);
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid model IDs', () => {
      expect(isValidModel('anthropic/claude-sonnet-4-20250514')).toBe(true);
      expect(isValidModel('openai/gpt-4o')).toBe(true);
    });

    it('should return true for valid model short IDs', () => {
      expect(isValidModel('claude-sonnet-4')).toBe(true);
      expect(isValidModel('gpt-4o')).toBe(true);
    });

    it('should return false for invalid models', () => {
      expect(isValidModel('invalid/model')).toBe(false);
      expect(isValidModel('random')).toBe(false);
    });
  });

  describe('getModel', () => {
    // Note: These tests verify the factory logic without making API calls
    // The actual model instances require OPENROUTER_API_KEY to be set
    
    beforeEach(() => {
      // Set a mock API key for testing
      process.env.OPENROUTER_API_KEY = 'test-api-key-for-unit-tests';
    });

    afterEach(() => {
      delete process.env.OPENROUTER_API_KEY;
    });

    it('should return a model instance for valid provider', () => {
      const model = getModel('anthropic');
      expect(model).toBeDefined();
    });

    it('should return a model instance for valid model ID', () => {
      const model = getModel('anthropic', 'anthropic/claude-sonnet-4-20250514');
      expect(model).toBeDefined();
    });

    it('should return default model when no args provided', () => {
      const model = getModel();
      expect(model).toBeDefined();
    });

    it('should throw InvalidProviderError for invalid provider', () => {
      expect(() => getModel('invalid')).toThrow(InvalidProviderError);
    });

    it('should throw InvalidModelError for invalid model', () => {
      expect(() => getModel('anthropic', 'invalid/model')).toThrow(InvalidModelError);
    });

    it('should throw error when OPENROUTER_API_KEY is missing', () => {
      delete process.env.OPENROUTER_API_KEY;
      expect(() => getModel('anthropic')).toThrow('OPENROUTER_API_KEY');
    });
  });
});

