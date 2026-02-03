import express, { Request, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeRequestSchema, ClaudeRequest, Message } from './types';
import { ZodError } from 'zod';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Initialize Anthropic client
const anthropic = new Anthropic();

// Convert our Message type to Anthropic's MessageParam
function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' 
      ? m.content 
      : m.content.map(block => {
          if (typeof block === 'string') {
            return { type: 'text' as const, text: block };
          }
          return block as Anthropic.ContentBlockParam;
        }),
  }));
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Non-streaming messages endpoint
app.post('/v1/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ClaudeRequestSchema.parse(req.body);
    
    // If stream requested, redirect to streaming endpoint
    if (body.stream) {
      return handleStreaming(body, res);
    }
    
    const response = await anthropic.messages.create({
      model: body.model,
      max_tokens: body.max_tokens,
      system: body.system,
      messages: toAnthropicMessages(body.messages),
      tools: body.tools?.map(t => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      tool_choice: body.tool_choice as Anthropic.ToolChoice | undefined,
      stop_sequences: body.stop_sequences,
      temperature: body.temperature,
      top_p: body.top_p,
      top_k: body.top_k,
    });
    
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Streaming messages endpoint
app.post('/v1/messages/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ClaudeRequestSchema.parse(req.body);
    await handleStreaming(body, res);
  } catch (err) {
    next(err);
  }
});

async function handleStreaming(body: ClaudeRequest, res: Response): Promise<void> {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  try {
    const stream = await anthropic.messages.stream({
      model: body.model,
      max_tokens: body.max_tokens,
      system: body.system,
      messages: toAnthropicMessages(body.messages),
      tools: body.tools?.map(t => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      tool_choice: body.tool_choice as Anthropic.ToolChoice | undefined,
      stop_sequences: body.stop_sequences,
      temperature: body.temperature,
      top_p: body.top_p,
      top_k: body.top_k,
    });
    
    // Forward all events to client
    stream.on('text', (text) => {
      res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`);
    });
    
    stream.on('message', (message) => {
      res.write(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message })}\n\n`);
    });
    
    stream.on('contentBlock', (block) => {
      res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', content_block: block })}\n\n`);
    });
    
    stream.on('finalMessage', (message) => {
      res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop', message })}\n\n`);
    });
    
    // Wait for stream to complete
    await stream.finalMessage();
    
    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
  } catch (err) {
    // Send error as SSE event
    const error = err instanceof Error ? err.message : 'Unknown error';
    res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error })}\n\n`);
    res.end();
  }
}

// Extended thinking endpoint (Claude 3.7+)
app.post('/v1/messages/think', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ClaudeRequestSchema.parse(req.body);
    
    if (!body.thinking) {
      res.status(400).json({ error: 'thinking parameter required for this endpoint' });
      return;
    }
    
    // Set up SSE for streaming thinking + response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    const stream = await anthropic.messages.stream({
      model: body.model,
      max_tokens: body.max_tokens,
      thinking: body.thinking,
      system: body.system,
      messages: toAnthropicMessages(body.messages),
      tools: body.tools?.map(t => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      temperature: 1, // Required for extended thinking
      betas: ['interleaved-thinking-2025-05-14'],
    } as Parameters<typeof anthropic.messages.stream>[0]);
    
    stream.on('text', (text) => {
      res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`);
    });
    
    // Handle thinking blocks
    stream.on('contentBlock', (block) => {
      res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', content_block: block })}\n\n`);
    });
    
    stream.on('finalMessage', (message) => {
      res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop', message })}\n\n`);
    });
    
    await stream.finalMessage();
    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
    return;
  }
  
  if (err instanceof Anthropic.APIError) {
    res.status(err.status || 500).json({
      error: err.message,
      type: err.name,
    });
    return;
  }
  
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`Claude service listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
