import { 
  getAvailableProviders, 
  getDefaultModel, 
  createModelProvider,
  getModel 
} from '../registry';

describe('LLM Registry', () => {
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

  describe('getAvailableProviders', () => {
    it('should return empty array when no keys are set', () => {
      const providers = getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('should detect OpenRouter when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const providers = getAvailableProviders();
      expect(providers).toContain('openrouter');
    });

    it('should detect Anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const providers = getAvailableProviders();
      expect(providers).toContain('anthropic');
    });

    it('should detect OpenAI when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      const providers = getAvailableProviders();
      expect(providers).toContain('openai');
    });

    it('should detect Google when GOOGLE_GENERATIVE_AI_API_KEY is set', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
      const providers = getAvailableProviders();
      expect(providers).toContain('google');
    });

    it('should detect all providers when all keys are set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
      const providers = getAvailableProviders();
      expect(providers).toContain('openrouter');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
    });
  });

  describe('getDefaultModel', () => {
    it('should return OpenRouter model when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const model = getDefaultModel();
      expect(model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should return Anthropic model when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const model = getDefaultModel();
      expect(model).toBe('claude-sonnet-4-20250514');
    });

    it('should return OpenAI model when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      const model = getDefaultModel();
      expect(model).toBe('gpt-4o');
    });

    it('should return Google model when GOOGLE_GENERATIVE_AI_API_KEY is set', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
      const model = getDefaultModel();
      expect(model).toBe('gemini-2.0-flash-exp');
    });

    it('should prioritize OpenRouter over other providers', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      const model = getDefaultModel();
      expect(model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should fallback to Claude Sonnet 4 when no keys are set', () => {
      const model = getDefaultModel();
      expect(model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('createModelProvider', () => {
    it('should create OpenRouter provider for OpenRouter model', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const provider = createModelProvider('anthropic/claude-3.5-sonnet');
      expect(provider).toBeDefined();
    });

    it('should create Anthropic provider for Claude model', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const provider = createModelProvider('claude-sonnet-4-20250514');
      expect(provider).toBeDefined();
    });

    it('should create OpenAI provider for GPT model', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-test';
      const provider = createModelProvider('gpt-4o');
      expect(provider).toBeDefined();
    });

    it('should create Google provider for Gemini model', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
      const provider = createModelProvider('gemini-2.0-flash-exp');
      expect(provider).toBeDefined();
    });

    it('should fallback to OpenRouter for Claude when Anthropic key not available', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      const provider = createModelProvider('claude-sonnet-4-20250514');
      expect(provider).toBeDefined();
    });

    it('should throw error when no provider available for model', () => {
      expect(() => {
        createModelProvider('claude-sonnet-4-20250514');
      }).toThrow('no API key available');
    });

    it('should throw error for unknown model format when no fallback', () => {
      expect(() => {
        createModelProvider('unknown-model');
      }).toThrow('Unknown model');
    });
  });

  describe('getModel', () => {
    it('should return default model when no modelId provided', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const model = getModel();
      expect(model).toBeDefined();
    });

    it('should return specified model when modelId provided', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const model = getModel('claude-3-5-sonnet-20241022');
      expect(model).toBeDefined();
    });
  });
});