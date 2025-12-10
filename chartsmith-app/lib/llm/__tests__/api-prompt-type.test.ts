import { POST } from '@/app/api/llm/prompt-type/route';
import { NextRequest } from 'next/server';

// Mock the promptType function
jest.mock('@/lib/llm/prompt-type', () => ({
  promptType: jest.fn(),
}));

describe('/api/llm/prompt-type', () => {
  const { promptType } = jest.requireMock('@/lib/llm/prompt-type');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return prompt type for valid message', async () => {
    promptType.mockResolvedValueOnce('question');

    const request = new NextRequest('http://localhost:3000/api/llm/prompt-type', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is Helm?',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('type');
    expect(data.type).toBe('question');
    expect(promptType).toHaveBeenCalledWith('What is Helm?');
  });

  it('should return 400 when message is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/llm/prompt-type', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return 400 when message is not a string', async () => {
    const request = new NextRequest('http://localhost:3000/api/llm/prompt-type', {
      method: 'POST',
      body: JSON.stringify({
        message: 123,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return 500 when promptType throws error', async () => {
    promptType.mockRejectedValueOnce(new Error('Failed to classify'));

    const request = new NextRequest('http://localhost:3000/api/llm/prompt-type', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test message',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('should handle different prompt types', async () => {
    const types = ['question', 'action', 'conversation'];
    
    for (const expectedType of types) {
      promptType.mockResolvedValueOnce(expectedType);

      const request = new NextRequest('http://localhost:3000/api/llm/prompt-type', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test message',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(expectedType);
    }
  });
});
