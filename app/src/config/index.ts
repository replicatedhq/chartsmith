import { z } from 'zod';

// Environment configuration schema
const envSchema = z.object({
  VITE_USE_MOCK_DATA: z.string().optional(),
});

// Parsed and validated configuration
const env = envSchema.parse(import.meta.env);

export const config = {
  useMockData: true, // Always use mock data
} as const;

export type Config = typeof config;