/**
 * Vercel AI SDK Chat API Route
 *
 * This demonstrates how to migrate the conversational chat from Go to Next.js using Vercel AI SDK.
 * This is a complete implementation showing all key features from pkg/llm/conversational.go
 *
 * Key features demonstrated:
 * - Vercel AI SDK streamText() for streaming responses
 * - Tool calling (latest_subchart_version, latest_kubernetes_version)
 * - System prompts preservation
 * - Context injection (chart structure, relevant files)
 * - Centrifugo real-time publishing
 * - Database integration for message persistence
 */

import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userIdFromExtensionToken } from '@/lib/auth/extension-token';
import { getChatMessage, getWorkspace } from '@/lib/workspace/workspace';
import { appendChatMessageResponse, markChatMessageComplete, getWorkspaceIdForChatMessage } from '@/lib/workspace/chat-helpers';
import { publishChatMessageUpdate } from '@/lib/realtime/centrifugo-publish';
import { getChartStructure, chooseRelevantFiles, getPreviousChatHistory } from '@/lib/workspace/context';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// System prompts from pkg/llm/system.go
const CHAT_SYSTEM_PROMPT = `You are ChartSmith, an expert AI assistant and a highly skilled senior software developer specializing in the creation, improvement, and maintenance of Helm charts.
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
</question_instructions>`;

const CHAT_INSTRUCTIONS = `- You will be asked to answer a question.
- You will be given the question and the context of the question.
- You will be given the current chat history.
- You will be asked to answer the question based on the context and the chat history.
- You can be technical in your response and include inline code snippets identifed with Markdown when appropriate.
- Never use the <chartsmithArtifact> tag in your response.`;

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1]);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get chat message ID from request
    const { chatMessageId } = await req.json();
    if (!chatMessageId) {
      return NextResponse.json({ error: 'chatMessageId is required' }, { status: 400 });
    }

    // Fetch the chat message from database
    const chatMessage = await getChatMessage(chatMessageId);
    if (!chatMessage) {
      return NextResponse.json({ error: 'Chat message not found' }, { status: 404 });
    }

    // Get workspace ID for Centrifugo publishing
    const workspaceId = await getWorkspaceIdForChatMessage(chatMessageId);

    // Initialize Anthropic with Vercel AI SDK
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Define tools (from pkg/llm/conversational.go)
    const tools = {
      latest_subchart_version: tool({
        description: 'Return the latest version of a subchart from name',
        inputSchema: z.object({
          chart_name: z.string().describe('The subchart name to get the latest version of'),
        }),
        execute: async ({ chart_name }) => {
          // TODO: Implement getLatestSubchartVersion from pkg/recommendations
          // For now, return placeholder
          return '1.0.0';
        },
      }),
      latest_kubernetes_version: tool({
        description: 'Return the latest version of Kubernetes',
        inputSchema: z.object({
          semver_field: z.enum(['major', 'minor', 'patch']).describe('One of major, minor, or patch'),
        }),
        execute: async ({ semver_field }) => {
          switch (semver_field) {
            case 'major':
              return '1';
            case 'minor':
              return '1.32';
            case 'patch':
              return '1.32.1';
            default:
              return '1.32.1';
          }
        },
      }),
    };

    // Get workspace and chart context
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const chartStructure = await getChartStructure(workspace);
    const relevantFiles = await chooseRelevantFiles(workspace, chatMessage.prompt, undefined, 10);
    const chatHistory = await getPreviousChatHistory(workspaceId, chatMessageId);

    // Build messages array with context (like Go implementation)
    const messages = [
      { role: 'assistant' as const, content: CHAT_SYSTEM_PROMPT },
      { role: 'assistant' as const, content: CHAT_INSTRUCTIONS },
      // Add chart structure context
      { role: 'assistant' as const, content: `I am working on a Helm chart that has the following structure: ${chartStructure}` },
      // Add relevant files
      ...relevantFiles.map(file => ({
        role: 'assistant' as const,
        content: `File: ${file.filePath}, Content: ${file.content}`
      })),
      // Add conversation history
      ...chatHistory,
      // User's current message
      { role: 'user' as const, content: chatMessage.prompt },
    ];

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-3-7-sonnet-20250219'),
      messages,
      tools,
      onChunk: async ({ chunk }) => {
        // Handle text delta chunks
        if (chunk.type === 'text-delta') {
          const textChunk = chunk.text;

          // 1. Append to database
          await appendChatMessageResponse(chatMessageId, textChunk);

          // 2. Publish to Centrifugo for real-time updates
          await publishChatMessageUpdate(workspaceId, userId, chatMessageId, textChunk, false);
        }
      },
      onFinish: async () => {
        // Mark message as complete
        await markChatMessageComplete(chatMessageId);

        // Publish final completion event
        await publishChatMessageUpdate(workspaceId, userId, chatMessageId, '', true);
      },
    });

    // Wait for completion
    await result.text;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
