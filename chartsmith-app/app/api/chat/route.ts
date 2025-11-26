import { streamText, stepCountIs } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { chartsmithTools } from '@/lib/tools';
import { getModel, getProviderInfo, isApiKeyConfigured } from '@/lib/ai/provider';

// Interface for chart context from client
interface ChartFileContext {
  path: string;
  content: string;
}

interface ChartContext {
  name: string;
  files: ChartFileContext[];
}

/**
 * Build dynamic chart context section for the system prompt.
 * This injects the current workspace state so the AI knows what it's working with.
 */
function buildChartContextPrompt(
  workspaceName?: string,
  currentRevision?: number,
  charts?: ChartContext[],
  looseFiles?: ChartFileContext[]
): string {
  if (!charts?.length && !looseFiles?.length) {
    return '';
  }

  let contextPrompt = `\n<current_workspace_context>
You are currently working on workspace: "${workspaceName || 'Unnamed Workspace'}"
Current revision: ${currentRevision ?? 0}

`;

  // Add chart information
  if (charts && charts.length > 0) {
    contextPrompt += `This workspace contains ${charts.length} Helm chart(s):\n\n`;
    
    for (const chart of charts) {
      contextPrompt += `## Chart: ${chart.name}\n`;
      contextPrompt += `Files in this chart:\n`;
      
      for (const file of chart.files) {
        contextPrompt += `\n### ${file.path}\n`;
        // Truncate very large files to avoid token limits
        const content = file.content.length > 5000 
          ? file.content.substring(0, 5000) + '\n... (truncated, file continues)'
          : file.content;
        contextPrompt += `\`\`\`yaml\n${content}\n\`\`\`\n`;
      }
      contextPrompt += '\n';
    }
  }

  // Add loose files (files not in charts)
  if (looseFiles && looseFiles.length > 0) {
    contextPrompt += `\nAdditional files in workspace:\n`;
    
    for (const file of looseFiles) {
      contextPrompt += `\n### ${file.path}\n`;
      const content = file.content.length > 5000 
        ? file.content.substring(0, 5000) + '\n... (truncated, file continues)'
        : file.content;
      contextPrompt += `\`\`\`yaml\n${content}\n\`\`\`\n`;
    }
  }

  contextPrompt += `</current_workspace_context>

When the user asks questions or requests changes, refer to these files and make modifications to them.
Always preserve the existing structure and only modify what's necessary for the user's request.
`;

  return contextPrompt;
}

/**
 * System prompt for ChartSmith chat interface.
 * Migrated from pkg/llm/system.go (chatOnlySystemPrompt).
 *
 * Defines ChartSmith's expertise, constraints, and response formatting guidelines.
 */
const CHARTSMITH_SYSTEM_PROMPT = `You are ChartSmith, an expert AI assistant and a highly skilled senior software developer specializing in the creation, improvement, and maintenance of Helm charts.
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

<available_tools>
You have access to the following tools to assist with Helm chart development:

1. **text_editor**: Create, view, and modify Helm chart files
   - Commands: view, str_replace, create
   - Use this to read existing files, make targeted edits, or create new files
   - Maintains workspace state for chart files

2. **latest_subchart_version**: Query the latest version of a Helm chart from ArtifactHub
   - Use this to find recommended versions for dependencies
   - Useful for ensuring charts are up-to-date

3. **latest_kubernetes_version**: Get the current stable Kubernetes version
   - Returns major, minor, or patch version information
   - Use this to set appropriate kubeVersion constraints

4. **recommended_dependency**: Find and recommend appropriate Helm charts for specific needs
   - Search for charts that match user requirements
   - Returns top recommendation with alternatives
   - Ranked by popularity and verification status
</available_tools>

<tool_usage_guidelines>
- Use the text_editor tool to make modifications to chart files
- Query latest versions before recommending chart versions
- Recommend appropriate dependencies based on user needs
- Always provide complete, valid YAML when modifying files
- Log important operations for user awareness
</tool_usage_guidelines>

<question_instructions>
  - You will be asked to answer a question.
  - You will be given the question and the context of the question.
  - You will be given the current chat history.
  - You will be asked to answer the question based on the context and the chat history.
  - You can provide small examples of code, but just use markdown.
</question_instructions>
`;

/**
 * POST /api/chat
 *
 * AI SDK-based chat endpoint for Chartsmith.
 * Streams responses using Vercel AI SDK with Anthropic provider.
 *
 * Request body:
 * {
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Validate API key is configured for the selected provider
    const providerInfo = getProviderInfo();
    if (!isApiKeyConfigured()) {
      const keyName = providerInfo.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      console.error(`[/api/chat] ${keyName} is not configured for provider "${providerInfo.provider}"`);
      return NextResponse.json(
        { error: `Server configuration error: ${keyName} is not set` },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('[/api/chat] Raw body:', JSON.stringify(body, null, 2));
    const { messages, workspaceId, workspaceName, currentRevision, charts, looseFiles } = body;

    // Validate required fields
    if (!messages) {
      return NextResponse.json(
        { error: 'Missing required field: messages' },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid field type: messages must be an array' },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid field value: messages array cannot be empty' },
        { status: 400 }
      );
    }

    // Validate message format
    for (const message of messages) {
      if (!message.role || (!message.content && !message.parts)) {
        return NextResponse.json(
          { error: 'Invalid message format: each message must have role and content or parts' },
          { status: 400 }
        );
      }
      if (!['user', 'assistant'].includes(message.role)) {
        return NextResponse.json(
          { error: 'Invalid message role: must be "user" or "assistant"' },
          { status: 400 }
        );
      }
    }

    // Log request for debugging
    console.log('[/api/chat] POST request received:', {
      messageCount: messages.length,
      hasWorkspaceId: !!workspaceId,
      workspaceName: workspaceName || 'not provided',
      currentRevision: currentRevision ?? 'not provided',
      chartCount: charts?.length || 0,
      looseFileCount: looseFiles?.length || 0,
      firstMessage: messages[0]?.content?.substring(0, 50) + '...',
    });

    // Inject workspace context into environment for tool handlers
    // The textEditorTool will read WORKSPACE_ID from process.env
    if (workspaceId) {
      process.env.WORKSPACE_ID = workspaceId;
      console.log('[/api/chat] Workspace context injected:', { workspaceId });
    }

    // Build dynamic system prompt with chart context
    const chartContextPrompt = buildChartContextPrompt(workspaceName, currentRevision, charts, looseFiles);
    const fullSystemPrompt = CHARTSMITH_SYSTEM_PROMPT + chartContextPrompt;

    console.log('[/api/chat] System prompt built:', {
      basePromptLength: CHARTSMITH_SYSTEM_PROMPT.length,
      contextPromptLength: chartContextPrompt.length,
      totalLength: fullSystemPrompt.length,
    });

    // Get AI model from provider factory
    // Supports switching between Anthropic and OpenAI via LLM_PROVIDER env var
    const model = getModel();

    console.log('[/api/chat] AI provider configured:', {
      provider: providerInfo.provider,
      model: providerInfo.model,
      apiKeyConfigured: providerInfo.apiKeyConfigured,
      toolCount: Object.keys(chartsmithTools).length,
      systemPromptLength: fullSystemPrompt.length,
    });

    // Stream response using AI SDK with tool support
    console.log('[/api/chat] Starting AI SDK streaming with tool support...');

    const result = streamText({
      model,
      messages,
      system: fullSystemPrompt,
      tools: chartsmithTools,
      temperature: 0.7,
      // Allow up to 5 steps for tool execution (default is stepCountIs(1) which stops immediately)
      stopWhen: stepCountIs(5),
      onStepFinish: ({ text, toolCalls, toolResults }) => {
        console.log('[/api/chat] Step finished:', {
          textLength: text?.length || 0,
          toolCallCount: toolCalls?.length || 0,
          toolResultCount: toolResults?.length || 0,
        });
      },
    });

    console.log('[/api/chat] Stream initialized successfully with tool support');

    // Return streaming response
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[/api/chat] Error processing request:', error);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Handle AI SDK / streaming errors
    if (error instanceof Error) {
      // Check for common AI SDK error patterns
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI provider authentication error' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timeout. Please try again.' },
          { status: 504 }
        );
      }
    }

    // Handle unexpected errors
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
