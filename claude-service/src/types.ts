import { z } from 'zod';

// Content block schemas
export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.string(),
  is_error: z.boolean().optional(),
});

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  z.string(),
]);

// Message schema
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

// Tool schema
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  }),
});

// Main request schema
export const ClaudeRequestSchema = z.object({
  model: z.string(),
  system: z.string().optional(),
  messages: z.array(MessageSchema),
  max_tokens: z.number(),
  tools: z.array(ToolSchema).optional(),
  tool_choice: z.union([
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('any') }),
    z.object({ type: z.literal('tool'), name: z.string() }),
  ]).optional(),
  stop_sequences: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  
  // Extended thinking (Claude 3.7)
  thinking: z.object({
    type: z.literal('enabled'),
    budget_tokens: z.number().int().positive(),
  }).optional(),
});

export type ClaudeRequest = z.infer<typeof ClaudeRequestSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
