/**
 * AI Chat Streaming API Route
 * 
 * This route uses the Vercel AI SDK to stream chat responses from the LLM.
 * It handles conversational messages for the Chartsmith chat interface.
 * 
 * For plan execution, renders, and other complex workflows,
 * the Go backend continues to handle those via Centrifugo.
 */

import { streamText, convertToCoreMessages, CoreMessage } from 'ai';
import type { Message as UIMessage } from '@ai-sdk/react';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

import { getModel } from '@/lib/llm/provider';
import { buildSystemPrompt, ChatRole, ChartContext } from '@/lib/llm/system-prompts';
import { findSession } from '@/lib/auth/session';
import { searchArtifactHubCharts } from '@/lib/artifacthub/artifacthub';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

/**
 * Request body schema for the chat endpoint.
 */
interface ChatRequestBody {
  messages: UIMessage[];
  workspaceId?: string;
  role?: ChatRole;
  chartContext?: ChartContext;
}

/**
 * Validates the user session from cookies.
 * Returns the session if valid, null otherwise.
 */
async function getAuthenticatedSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session = await findSession(sessionCookie.value);
    return session;
  } catch {
    return null;
  }
}

/**
 * Searches for the latest version of a subchart from ArtifactHub.
 */
async function getLatestSubchartVersion(chartName: string): Promise<string> {
  try {
    const results = await searchArtifactHubCharts(chartName);
    if (results.length === 0) {
      return 'Not found on ArtifactHub';
    }
    
    // Extract version from URL or return the first result
    // The searchArtifactHubCharts returns URLs like https://artifacthub.io/packages/helm/org/name
    // We'd need to fetch the actual version from the package details
    // For now, return that we found it (the full version lookup would require additional API call)
    return `Found: ${results[0]}`;
  } catch (error) {
    console.error('Error searching ArtifactHub:', error);
    return 'Error searching ArtifactHub';
  }
}

/**
 * POST handler for chat streaming.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getAuthenticatedSession();
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: ChatRequestBody = await req.json();
    const { messages, role = 'auto', chartContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build the system prompt based on role and context
    const systemPrompt = buildSystemPrompt(role, chartContext);

    // Convert UI messages to core format for the model
    const coreMessages: CoreMessage[] = convertToCoreMessages(messages);

    // Stream the response using AI SDK
    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages: coreMessages,
      maxTokens: 8192,
      tools: {
        /**
         * Tool to get the latest version of a subchart from ArtifactHub.
         * The LLM can use this when users ask about specific chart versions.
         */
        getLatestSubchartVersion: {
          description: 'Get the latest version of a Helm subchart from ArtifactHub. Use this when the user asks about chart versions or dependencies.',
          parameters: z.object({
            chartName: z.string().describe('The name of the subchart to look up (e.g., "redis", "postgresql", "ingress-nginx")'),
          }),
          execute: async ({ chartName }) => {
            return await getLatestSubchartVersion(chartName);
          },
        },
        
        /**
         * Tool to get the latest Kubernetes version information.
         */
        getLatestKubernetesVersion: {
          description: 'Get the latest version of Kubernetes. Use this when the user asks about Kubernetes version compatibility.',
          parameters: z.object({
            semverField: z.enum(['major', 'minor', 'patch']).describe('Which part of the version to return'),
          }),
          execute: async ({ semverField }) => {
            // Current latest Kubernetes versions (as of early 2025)
            const versions: Record<string, string> = {
              major: '1',
              minor: '1.32',
              patch: '1.32.1',
            };
            return versions[semverField];
          },
        },
      },
    });

    // Return the streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

