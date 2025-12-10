import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  kubernetesVersionSchema,
  subchartVersionSchema,
  executeKubernetesVersion,
  executeSubchartVersion,
} from '@/lib/tools';

/**
 * Chat API Route - Vercel AI SDK Integration
 *
 * This route provides a streaming chat endpoint using the Vercel AI SDK.
 * It serves as a demonstration of the AI SDK migration and can be used
 * for simpler chat interactions that don't require the full Go backend
 * infrastructure.
 *
 * For complex operations (plan execution, file editing), the existing
 * Go backend + realtime event system remains the primary path.
 */

// System prompt for chat interactions (mirrors Go backend's chatOnlySystemPrompt)
const systemPrompt = `You are ChartSmith, an expert AI assistant and a highly skilled senior software developer specializing in the creation, improvement, and maintenance of Helm charts.
Your primary responsibility is to help users transform, refine, and optimize Helm charts based on a variety of inputs, including:

- Existing Helm charts that need adjustments, improvements, or best-practice refinements.

Your guidance should be exhaustive, thorough, and precisely tailored to the user's needs.
Always ensure that your output is a valid, production-ready Helm chart setup adhering to Helm best practices.
If the user provides partial information (e.g., a single Deployment manifest, a partial Chart.yaml, or just an image and port configuration), you must integrate it into a coherent chart.
Requests will always be based on a existing Helm chart and you must incorporate modifications while preserving and improving the chart's structure (do not rewrite the chart for each request).

Below are guidelines and constraints you must always follow:

<system_constraints>
  - Focus exclusively on tasks related to Helm charts and Kubernetes manifests. Do not address topics outside of Kubernetes, Helm, or their associated configurations.
  - Assume a standard Kubernetes environment, where Helm is available.
  - Do not assume any external services (e.g., cloud-hosted registries or databases) unless the user's scenario explicitly includes them.
  - Do not rely on installing arbitrary tools; you are guiding and generating Helm chart files and commands only.
  - Incorporate changes into the most recent version of files. Make sure to provide complete updated file contents.
</system_constraints>

<code_formatting_info>
  - Use 2 spaces for indentation in all YAML files.
  - Ensure YAML and Helm templates are valid, syntactically correct, and adhere to Kubernetes resource definitions.
  - Use proper Helm templating expressions ({{ ... }}) where appropriate. For example, parameterize image tags, resource counts, ports, and labels.
  - Keep the chart well-structured and maintainable.
</code_formatting_info>

<message_formatting_info>
  - Use only valid Markdown for your responses unless required by the instructions below.
  - Do not use HTML elements.
  - Communicate in plain Markdown. Inside these tags, produce only the required YAML, shell commands, or file contents.
</message_formatting_info>

NEVER use the word "artifact" in your final messages to the user.

<question_instructions>
  - You will be asked to answer a question.
  - You will be given the question and the context of the question.
  - You will be given the current chat history.
  - You will be asked to answer the question based on the context and the chat history.
  - You can provide small examples of code, but just use markdown.
</question_instructions>
`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context?: string;
}

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { messages, context } = body;

    // Build messages with optional context
    const allMessages: ChatMessage[] = [];

    // Add context if provided (e.g., chart structure, relevant files)
    if (context) {
      allMessages.push({
        role: 'assistant',
        content: `I am working on a Helm chart with the following context:\n${context}`,
      });
    }

    // Add user messages
    allMessages.push(...messages);

    // Use AI SDK streamText with Anthropic provider
    // NOTE: Tools temporarily disabled for debugging streaming issues
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: allMessages,
      // Tools disabled temporarily - the combination of tools + maxSteps + toTextStreamResponse
      // may have issues in ai@5.0.108. We can re-enable once basic streaming is verified.
      // tools: {
      //   latestKubernetesVersion: {
      //     description: 'Get the latest version of Kubernetes...',
      //     inputSchema: kubernetesVersionSchema,
      //     execute: executeKubernetesVersion,
      //   },
      //   latestSubchartVersion: {
      //     description: 'Get the latest version of a Helm subchart...',
      //     inputSchema: subchartVersionSchema,
      //     execute: executeSubchartVersion,
      //   },
      // },
      // maxSteps: 5,
    });

    // Return text stream response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[AI SDK Chat Error]:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Support GET for health checks
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      sdk: 'vercel-ai-sdk-v5',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
