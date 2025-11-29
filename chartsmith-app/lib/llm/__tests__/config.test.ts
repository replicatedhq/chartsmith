import { getLLMConfig, getModel } from '../config';

describe('LLM Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CHARTSMITH_LLM_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getLLMConfig', () => {
    it('should use manual override when CHARTSMITH_LLM_MODEL is set', () => {
      process.env.CHARTSMITH_LLM_MODEL = 'custom-model';
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      
      const config = getLLMConfig();
      expect(config.model).toBe('custom-model');
    });

    it('should use OpenRouter model when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      
      const config = getLLMConfig();
      expect(config.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should use Anthropic model when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      
      const config = getLLMConfig();
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });

    it('should use OpenAI model when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      
      const config = getLLMConfig();
      expect(config.model).toBe('gpt-4o');
    });

    it('should use Google model when GOOGLE_GENERATIVE_AI_API_KEY is set', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
      
      const config = getLLMConfig();
      expect(config.model).toBe('gemini-2.0-flash-exp');
    });

    it('should fallback to Claude Sonnet 4 when no keys are set', () => {
      const config = getLLMConfig();
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });

    it('should prioritize OpenRouter over other providers', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      
      const config = getLLMConfig();
      expect(config.model).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('getModel', () => {
    it('should return the configured model', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      
      const model = getModel();
      expect(model).toBe('claude-sonnet-4-20250514');
    });

    it('should return override model when set', () => {
      process.env.CHARTSMITH_LLM_MODEL = 'my-custom-model';
      
      const model = getModel();
      expect(model).toBe('my-custom-model');
    });
  });
});