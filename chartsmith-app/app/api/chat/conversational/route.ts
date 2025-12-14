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
import { getChatMessage, getWorkspace } from '@/lib/workspace/workspace';
import { appendChatMessageResponse, markChatMessageComplete, getWorkspaceIdForChatMessage } from '@/lib/workspace/chat-helpers';
import { publishChatMessageUpdate } from '@/lib/realtime/centrifugo-publish';
import { getChartStructure, chooseRelevantFiles, getPreviousChatHistory } from '@/lib/workspace/context';
import { getLatestSubchartVersion } from '@/lib/recommendations/subchart';

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
  const startTime = Date.now();
  let chatMessageId: string | undefined;

  try {
    // Validate Authorization header using dedicated internal API token
    // This prevents leaking the Anthropic API key via request headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[CHAT API] Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken) {
      console.error('[CHAT API] INTERNAL_API_TOKEN not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (token !== expectedToken) {
      console.error('[CHAT API] Invalid Bearer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get chat message ID from request
    const body = await req.json();
    chatMessageId = body.chatMessageId;

    console.log(`[CHAT API] Starting request for chatMessageId=${chatMessageId}`);

    if (!chatMessageId) {
      console.error('[CHAT API] Missing chatMessageId in request');
      return NextResponse.json({ error: 'chatMessageId is required' }, { status: 400 });
    }

    // Fetch the chat message from database
    console.log(`[CHAT API] Fetching chat message from database...`);
    const chatMessage = await getChatMessage(chatMessageId);
    if (!chatMessage) {
      console.error(`[CHAT API] Chat message not found: ${chatMessageId}`);
      return NextResponse.json({ error: 'Chat message not found' }, { status: 404 });
    }
    console.log(`[CHAT API] Found chat message. Prompt: "${chatMessage.prompt.substring(0, 100)}..."`);

    // Get workspace ID and user ID for Centrifugo publishing
    const workspaceId = await getWorkspaceIdForChatMessage(chatMessageId);
    const userId = chatMessage.userId;

    if (!userId) {
      console.error(`[CHAT API] Chat message missing userId: ${chatMessageId}`);
      return NextResponse.json({ error: 'Chat message missing userId' }, { status: 400 });
    }

    console.log(`[CHAT API] workspaceId=${workspaceId}, userId=${userId}`);

    // Initialize Anthropic with Vercel AI SDK
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log(`[CHAT API] Initialized Anthropic client`);

    // Define tools (from pkg/llm/conversational.go)
    const tools = {
      latest_subchart_version: tool({
        description: 'Return the latest version of a subchart from name',
        inputSchema: z.object({
          chart_name: z.string().describe('The subchart name to get the latest version of'),
        }),
        execute: async ({ chart_name }) => {
          try {
            const version = await getLatestSubchartVersion(chart_name);
            return version;
          } catch (error) {
            console.error(`Failed to get subchart version for ${chart_name}:`, error);
            return 'unknown';
          }
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
    console.log(`[CHAT API] Loading workspace context...`);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      console.error(`[CHAT API] Workspace not found: ${workspaceId}`);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const chartStructure = await getChartStructure(workspace);
    const relevantFiles = await chooseRelevantFiles(workspace, chatMessage.prompt, undefined, 10);
    const chatHistory = await getPreviousChatHistory(workspaceId, chatMessageId);
    console.log(`[CHAT API] Context loaded: ${relevantFiles.length} files, ${chatHistory.length} history messages`);

    // Build system prompt (includes instructions and chart context)
    const systemPrompt = `${CHAT_SYSTEM_PROMPT}

${CHAT_INSTRUCTIONS}

I am working on a Helm chart that has the following structure: ${chartStructure}

${relevantFiles.map(file => `File: ${file.filePath}, Content: ${file.content}`).join('\n\n')}`;

    // Build messages array (conversation history + current message)
    const messages = [
      // Add conversation history
      ...chatHistory,
      // User's current message
      { role: 'user' as const, content: chatMessage.prompt },
    ];

    console.log(`[CHAT API] Built system prompt and ${messages.length} messages, calling streamText()...`);

    let chunkCount = 0;
    let totalChars = 0;

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      system: systemPrompt,
      messages,
      tools,
      onChunk: async ({ chunk }) => {
        chunkCount++;
        console.log(`[CHAT API] onChunk called (chunk #${chunkCount}): type=${chunk.type}`);

        // Handle text delta chunks
        if (chunk.type === 'text-delta') {
          const textChunk = chunk.text;
          totalChars += textChunk.length;
          console.log(`[CHAT API] text-delta chunk: ${textChunk.length} chars (total: ${totalChars})`);

          try {
            // 1. Append to database
            await appendChatMessageResponse(chatMessageId!, textChunk);
            console.log(`[CHAT API] Saved chunk to database`);

            // 2. Publish to Centrifugo for real-time updates
            await publishChatMessageUpdate(workspaceId, userId, chatMessageId!, textChunk, false);
            console.log(`[CHAT API] Published chunk to Centrifugo`);
          } catch (err) {
            console.error(`[CHAT API] Error processing chunk:`, err);
            throw err;
          }
        }
      },
      onFinish: async () => {
        console.log(`[CHAT API] onFinish called. Total chunks: ${chunkCount}, total chars: ${totalChars}`);

        try {
          // Mark message as complete
          await markChatMessageComplete(chatMessageId!);
          console.log(`[CHAT API] Marked message complete in database`);

          // Publish final completion event
          await publishChatMessageUpdate(workspaceId, userId, chatMessageId!, '', true);
          console.log(`[CHAT API] Published completion to Centrifugo`);
        } catch (err) {
          console.error(`[CHAT API] Error in onFinish:`, err);
          throw err;
        }
      },
    });

    console.log(`[CHAT API] Waiting for streamText to complete...`);

    // Wait for completion
    const fullText = await result.text;

    const duration = Date.now() - startTime;
    console.log(`[CHAT API] Completed successfully in ${duration}ms. Response length: ${fullText.length} chars`);

    return NextResponse.json({ success: true });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CHAT API] Error after ${duration}ms:`, error);
    console.error(`[CHAT API] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
        chatMessageId
      },
      { status: 500 }
    );
  }
}
