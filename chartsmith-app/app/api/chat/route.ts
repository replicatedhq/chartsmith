import { streamText, tool, convertToModelMessages, UIMessage } from 'ai';
import { chatModel } from '@/lib/ai/provider';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/ai/context';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, workspaceId, chartId }: {
    messages: UIMessage[];
    workspaceId: string;
    chartId?: string;
  } = await req.json();

  // Get workspace context (chart structure, relevant files, etc.)
  const context = await getWorkspaceContext(workspaceId, chartId, messages);

  const result = streamText({
    model: chatModel,
    system: context.systemPrompt,
    messages: convertToModelMessages(messages),
    tools: {
      latest_subchart_version: tool({
        description: 'Return the latest version of a subchart from name',
        inputSchema: z.object({
          chart_name: z.string().describe('The subchart name to get the latest version of'),
        }),
        execute: async ({ chart_name }) => {
          // Call the existing recommendation service
          try {
            const response = await fetch(
              `${process.env.INTERNAL_API_URL}/api/recommendations/subchart/${encodeURIComponent(chart_name)}`
            );
            if (!response.ok) return '?';
            const data = await response.json();
            return data.version || '?';
          } catch {
            return '?';
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
            case 'major': return '1';
            case 'minor': return '1.32';
            case 'patch': return '1.32.1';
            default: return '1.32.1';
          }
        },
      }),
    },
    maxOutputTokens: 8192,
  });

  return result.toUIMessageStreamResponse();
}
