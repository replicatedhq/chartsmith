import { getWorkspace, listPlans } from '@/lib/workspace/workspace';
import { listMessagesForWorkspace } from '@/lib/workspace/chat';
import { UIMessage } from 'ai';

const CHAT_SYSTEM_PROMPT = `You are ChartSmith, an AI assistant specialized in creating and managing Helm charts for Kubernetes.
You help developers and operators understand, modify, and improve their Helm charts.
Be helpful, concise, and technical when appropriate.`;

const CHAT_INSTRUCTIONS = `When answering questions:
1. Consider the chart structure and existing files
2. Reference specific files when relevant
3. Provide code examples when helpful
4. Be aware of Helm best practices`;

export interface WorkspaceContext {
  systemPrompt: string;
  chartStructure: string;
  relevantFiles: Array<{ path: string; content: string }>;
}

export async function getWorkspaceContext(
  workspaceId: string,
  chartId?: string,
  messages?: UIMessage[]
): Promise<WorkspaceContext> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  // Get chart structure
  const chart = chartId
    ? workspace.charts.find(c => c.id === chartId)
    : workspace.charts[0];

  const chartStructure = chart
    ? chart.files.map(f => `File: ${f.filePath}`).join('\n')
    : '';

  // Get relevant files from the chart (limit to 10)
  const relevantFiles: Array<{ path: string; content: string }> = [];
  if (chart) {
    for (const file of chart.files.slice(0, 10)) {
      relevantFiles.push({
        path: file.filePath,
        content: file.content,
      });
    }
  }

  // Build system prompt with context
  let systemPrompt = CHAT_SYSTEM_PROMPT + '\n\n' + CHAT_INSTRUCTIONS;

  if (chartStructure) {
    systemPrompt += `\n\nCurrent chart structure:\n${chartStructure}`;
  }

  // Add relevant file contents
  for (const file of relevantFiles) {
    systemPrompt += `\n\nFile: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
  }

  // Get previous plan and chat history if available
  try {
    const plans = await listPlans(workspaceId);
    const plan = plans.length > 0 ? plans[0] : null; // Most recent plan (ordered by created_at DESC)

    if (plan) {
      systemPrompt += `\n\nMost recent plan:\n${plan.description || '(No description)'}`;

      // Get chat messages and filter to those after the plan
      const allMessages = await listMessagesForWorkspace(workspaceId);
      const planCreatedAt = new Date(plan.createdAt);
      const previousChats = allMessages.filter(msg =>
        new Date(msg.createdAt) > planCreatedAt
      );

      if (previousChats.length > 0) {
        systemPrompt += '\n\nPrevious conversation context:';
        for (const chat of previousChats.slice(-5)) {
          if (chat.prompt) systemPrompt += `\nUser: ${chat.prompt}`;
          if (chat.response) systemPrompt += `\nAssistant: ${chat.response}`;
        }
      }
    }
  } catch {
    // No plan exists or error fetching, continue without it
  }

  return {
    systemPrompt,
    chartStructure,
    relevantFiles,
  };
}
