import { GET } from '@/app/api/models/route';
import { NextRequest } from 'next/server';

// Mock the registry module
jest.mock('@/lib/llm/registry', () => ({
  getAvailableProviders: jest.fn(),
  VERIFIED_MODELS: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      description: 'Latest Claude model',
      contextWindow: 200000,
      supportsTools: true,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      description: 'Versatile and fast',
      contextWindow: 128000,
      supportsTools: true,
    },
  ],
  OPENROUTER_MODELS: [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet (OpenRouter)',
      provider: 'openrouter',
      description: 'Auto-routes to latest Claude 3.5',
      contextWindow: 200000,
      supportsTools: true,
    },
  ],
}));

// Mock fetch for OpenRouter API
global.fetch = jest.fn();

describe('/api/models', () => {
  const { getAvailableProviders } = jest.requireMock('@/lib/llm/registry');
  
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should return OpenRouter models when OpenRouter key is available', async () => {
    getAvailableProviders.mockReturnValue(['openrouter']);
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(data.providers).toContain('openrouter');
    expect(data.recommended).toBeDefined();
    expect(Array.isArray(data.recommended)).toBe(true);
    expect(data.recommended.length).toBeGreaterThan(0);
    expect(data.recommended[0].provider).toBe('openrouter');
  });

  it('should return direct provider models when OpenRouter is not available', async () => {
    getAvailableProviders.mockReturnValue(['anthropic', 'openai']);
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(data.providers).toContain('anthropic');
    expect(data.providers).toContain('openai');
    expect(data.recommended).toBeDefined();
    expect(Array.isArray(data.recommended)).toBe(true);
    // Should only include models from available providers
    data.recommended.forEach((model: any) => {
      expect(['anthropic', 'openai']).toContain(model.provider);
    });
  });

  it('should filter models by available providers', async () => {
    getAvailableProviders.mockReturnValue(['anthropic']);
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(data.recommended).toBeDefined();
    data.recommended.forEach((model: any) => {
      expect(model.provider).toBe('anthropic');
    });
  });

  it('should include all models in response', async () => {
    getAvailableProviders.mockReturnValue(['openrouter']);
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(data.all).toBeDefined();
    expect(Array.isArray(data.all)).toBe(true);
    expect(data.all.length).toBeGreaterThanOrEqual(data.recommended.length);
  });

  it('should handle empty providers gracefully', async () => {
    getAvailableProviders.mockReturnValue([]);
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(data.providers).toEqual([]);
    expect(data.recommended).toBeDefined();
    expect(Array.isArray(data.recommended)).toBe(true);
  });

  it('should fetch additional OpenRouter models when key is available', async () => {
    getAvailableProviders.mockReturnValue(['openrouter']);
    
    // Mock OpenRouter API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'anthropic/claude-3-opus',
            name: 'Claude 3 Opus',
            context_length: 200000,
            pricing: { prompt: '0.015', completion: '0.075' },
          },
        ],
      }),
    });
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer'),
        }),
      })
    );
  });

  it('should handle OpenRouter API errors gracefully', async () => {
    getAvailableProviders.mockReturnValue(['openrouter']);
    
    // Mock OpenRouter API error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });
    
    const request = new NextRequest('http://localhost:3000/api/models');
    const response = await GET();
    const data = await response.json();
    
    // Should still return recommended models even if OpenRouter fetch fails
    expect(data.recommended).toBeDefined();
    expect(Array.isArray(data.recommended)).toBe(true);
  });
});

