/**
 * AI SDK Configuration
 * 
 * This module contains configuration constants for the Vercel AI SDK integration.
 * These settings are used by the provider factory and API routes.
 */

// Default provider to use when none is specified
// Anthropic Claude Sonnet 4 is the recommended model for Chartsmith
export const DEFAULT_PROVIDER = process.env.DEFAULT_AI_PROVIDER || 'anthropic';

// Default model to use when none is specified
export const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'anthropic/claude-sonnet-4';

// Maximum streaming duration for API routes (in seconds)
export const MAX_STREAMING_DURATION = 60;

// System prompt for Chartsmith AI chat
export const CHARTSMITH_SYSTEM_PROMPT = `You are ChartSmith, an expert AI assistant specialized in creating and managing Helm charts for Kubernetes.

Your expertise includes:
- Creating well-structured Helm charts following best practices
- Writing and modifying Kubernetes resource templates
- Configuring values.yaml files with sensible defaults
- Understanding Helm templating syntax and functions
- Kubernetes resource specifications and configurations
- Container orchestration concepts and patterns

When helping users:
- Be concise and precise in your responses
- Provide code examples when helpful
- Follow Helm chart best practices
- Consider security and resource management
- Explain your reasoning when making recommendations

You are helpful, knowledgeable, and focused on helping users create effective Helm charts.`;

// Throttle UI updates during streaming (in milliseconds)
export const STREAMING_THROTTLE_MS = 50;

