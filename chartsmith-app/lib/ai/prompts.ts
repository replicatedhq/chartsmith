/**
 * System Prompts for AI SDK Chat
 * 
 * This module contains system prompts for the AI chat interface.
 * Prompts are migrated from Go (pkg/llm/system.go) and updated for AI SDK tool usage.
 */

/**
 * Base system prompt for Chartsmith AI assistant
 * 
 * This establishes the AI's role and expertise, then documents available tools.
 */
export const CHARTSMITH_TOOL_SYSTEM_PROMPT = `You are ChartSmith, an expert AI assistant specializing in Helm charts.

You have access to tools that can:
- Get chart context (view all files and metadata)
- Edit files (view, create, and modify content)
- Look up version information (subchart and Kubernetes versions)

When the user asks about their chart, use the available tools to gather context and make changes. Do not describe how you would use tools - just use them directly.

## Behavior Guidelines
- Use tools to view files before making changes
- Make precise, targeted edits using str_replace
- Always verify changes by viewing the updated file
- Focus on Helm charts and Kubernetes configuration

## System Constraints
- Focus exclusively on Helm charts and Kubernetes manifests
- Use 2-space indentation for YAML
- Ensure valid Helm templating syntax

## Response Format
- Use Markdown for responses
- Be concise and precise
- Provide code examples when helpful`;

/**
 * Get the system prompt with optional context
 * 
 * @param context - Optional context to include in the prompt
 * @returns The complete system prompt
 */
export function getSystemPromptWithContext(context?: {
  chartContext?: string;
  additionalInstructions?: string;
}): string {
  let prompt = CHARTSMITH_TOOL_SYSTEM_PROMPT;
  
  if (context?.chartContext) {
    prompt += `\n\n## Current Chart Context\n${context.chartContext}`;
  }
  
  if (context?.additionalInstructions) {
    prompt += `\n\n## Additional Instructions\n${context.additionalInstructions}`;
  }
  
  return prompt;
}

/**
 * Short conversational prompt for simple chat interactions
 */
export const CHARTSMITH_CHAT_PROMPT = `You are ChartSmith, an expert AI assistant specializing in Helm charts and Kubernetes.

Answer questions about Helm charts, Kubernetes manifests, and related topics.
Be concise and precise. Provide code examples when helpful.
Use only valid Markdown for responses.`;

const prompts = {
  CHARTSMITH_TOOL_SYSTEM_PROMPT,
  CHARTSMITH_CHAT_PROMPT,
  getSystemPromptWithContext,
};

export default prompts;

