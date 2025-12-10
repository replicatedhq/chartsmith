/**
 * Chat API Route
 *
 * This route handles chat messages with intent-based routing:
 * - Conversational messages → Vercel AI SDK streaming
 * - Plan requests → Delegates to Go worker via createChatMessage
 * - Render requests → Delegates to Go worker
 * - Proceed requests → Creates revision and delegates to Go worker
 * - Off-topic → Returns polite decline
 *
 * Matches the behavior of the Go backend (pkg/listener/new_intent.go)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import {
  getWorkspace,
  createChatMessage,
  ChatMessageIntent,
  ChatMessageFromPersona,
  getMostRecentPlan,
} from "@/lib/workspace/workspace";
import { logger } from "@/lib/utils/logger";
import { CHAT_SYSTEM_PROMPT, CHAT_INSTRUCTIONS } from "@/lib/chat/prompts/system";
import {
  createWriteFileTool,
  WriteFileContext,
  createKubernetesVersionTool,
  createSubchartVersionTool,
} from "@/lib/chat/tools";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { nanoid } from "nanoid";
import { chatRequestSchema } from "@/lib/chat/schema";
import {
  classifyIntent,
  isAmbiguousIntent,
  type Intent,
  type MessageFromPersona,
} from "@/lib/llm/prompt-type";

/**
 * Response type indicators for the frontend
 */
export type ChatResponseType =
  | "streaming" // Vercel AI SDK streaming response
  | "plan_created" // Plan was created, Go worker will process
  | "render_started" // Render job started
  | "proceed_started" // Revision creation started
  | "off_topic" // Message was off-topic
  | "ambiguous" // Intent was unclear
  | "persona_mismatch"; // Persona request couldn't be fulfilled

/**
 * Status response metadata sent to the frontend
 */
export interface StatusResponseData {
  type: ChatResponseType;
  message: string;
  chatMessageId?: string;
  planId?: string;
  renderId?: string;
}

/**
 * Create a streaming response that contains a status message
 * This allows non-conversational intents to return a response compatible with useChat
 */
function createStatusStreamResponse(data: StatusResponseData): Response {
  const messageId = nanoid();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Start the text message
      writer.write({
        type: "text-start",
        id: messageId,
      });
      // Write the text content
      writer.write({
        type: "text-delta",
        id: messageId,
        delta: data.message,
      });
      // End the text message
      writer.write({
        type: "text-end",
        id: messageId,
      });
      // Finish the message stream
      writer.write({
        type: "finish",
        finishReason: "stop",
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * Tool-specific instructions appended to the system prompt
 */
const TOOL_INSTRUCTIONS = `

<tool_instructions>
You have access to the following tools:

1. **write_file** - Create or update files in the Helm chart
   - Use this for Chart.yaml, values.yaml, templates/*, etc.
   - Call it separately for EACH file

2. **latest_kubernetes_version** - Get the latest Kubernetes version
   - Use when setting apiVersion or when users ask about K8s versions
   - Pass semver_field: "major", "minor", or "patch"

3. **latest_subchart_version** - Get the latest version of a Helm subchart from Artifact Hub
   - Use when adding dependencies to Chart.yaml
   - Pass chart_name: the name of the chart (e.g., "postgresql", "redis")

CRITICAL REQUIREMENTS FOR CHART CREATION:
1. When asked to create a Helm chart, you MUST create ALL of these files using write_file:
   - Chart.yaml (required)
   - values.yaml (required)
   - templates/_helpers.tpl (required - for naming helpers)
   - templates/deployment.yaml (required)
   - templates/service.yaml (required)

2. You MUST call write_file for EACH file separately. Do not stop until all 5 required files are created.

3. Do NOT just explain what to create - actually create the files using the write_file tool.

4. Each file must be complete and production-ready:
   - values.yaml: Include replicaCount, image (repository, tag, pullPolicy), service (type, port), resources (limits and requests)
   - templates/_helpers.tpl: Include chart name, fullname, labels, and selector labels helpers
   - templates/deployment.yaml: Use proper Helm templating, include resource limits, use helper templates
   - templates/service.yaml: Use helper templates for naming and labels

5. Use 2 spaces for YAML indentation.

6. When adding dependencies, use latest_subchart_version to get the current version.
</tool_instructions>
`;

/**
 * POST /api/chat
 *
 * Handles chat messages with intent-based routing.
 * Accepts useChat format: { messages: UIMessage[], workspaceId: string, persona?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const userId = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const parseResult = chatRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { messages: uiMessages, workspaceId, persona } = parseResult.data;

    // Verify workspace exists and user has access
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get the latest user message for intent classification
    const latestUserMessage = [...uiMessages]
      .reverse()
      .find((m) => m.role === "user");

    if (!latestUserMessage) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 });
    }

    // Extract text content from the message
    const messageText = extractMessageText(latestUserMessage);

    // Determine if this is the initial prompt (no previous plan exists)
    const existingPlan = await getMostRecentPlan(workspaceId);
    const isInitialPrompt = workspace.currentRevisionNumber === 0 && !existingPlan;

    // Classify intent
    const intent = await classifyIntent(
      messageText,
      isInitialPrompt,
      (persona as MessageFromPersona) || null
    );

    logger.info("Intent classified", {
      workspaceId,
      messageText: messageText.substring(0, 100),
      intent,
      isInitialPrompt,
    });

    // Route based on intent
    return await routeByIntent(
      userId,
      workspace,
      uiMessages,
      messageText,
      intent,
      (persona as MessageFromPersona) || "auto"
    );
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Route the message based on classified intent
 */
async function routeByIntent(
  userId: string,
  workspace: Awaited<ReturnType<typeof getWorkspace>>,
  uiMessages: UIMessage[],
  messageText: string,
  intent: Intent,
  persona: MessageFromPersona
): Promise<Response> {
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspaceId = workspace.id;

  // Check for persona mismatch (developer asked but can't answer as developer)
  if (persona === "developer" && !intent.isChartDeveloper && !intent.isPlan) {
    return handlePersonaMismatch(userId, workspaceId, messageText, "developer");
  }

  if (persona === "operator" && !intent.isChartOperator) {
    return handlePersonaMismatch(userId, workspaceId, messageText, "operator");
  }

  // Check for ambiguous intent
  if (isAmbiguousIntent(intent)) {
    return handleAmbiguousIntent(userId, workspaceId, messageText);
  }

  // Handle proceed intent - create revision from current plan
  if (intent.isProceed) {
    return handleProceedIntent(userId, workspaceId, messageText);
  }

  // Handle off-topic (but not if it's also a plan request)
  if (intent.isOffTopic && !intent.isPlan && workspace.currentRevisionNumber > 0) {
    return handleOffTopicIntent(userId, workspaceId, messageText);
  }

  // Handle render intent
  if (intent.isRender) {
    return handleRenderIntent(userId, workspaceId, messageText);
  }

  // Handle plan intent (requests to modify the chart)
  if (intent.isPlan && !intent.isConversational) {
    return handlePlanIntent(userId, workspaceId, messageText, persona);
  }

  // Handle conversational intent - use Vercel AI SDK streaming
  if (intent.isConversational || intent.isChartDeveloper || intent.isChartOperator) {
    return handleConversationalIntent(userId, workspace, uiMessages, messageText, persona);
  }

  // Default to conversational if nothing else matched
  return handleConversationalIntent(userId, workspace, uiMessages, messageText, persona);
}

/**
 * Handle conversational messages with Vercel AI SDK streaming
 */
async function handleConversationalIntent(
  userId: string,
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspace>>>,
  uiMessages: UIMessage[],
  messageText: string,
  persona: MessageFromPersona
): Promise<Response> {
  // Ensure we have a chart to work with
  let chartId: string;
  let revisionNumber = workspace.currentRevisionNumber;

  if (workspace.charts.length > 0) {
    chartId = workspace.charts[0].id;
  } else {
    const result = await ensureChartExists(workspace.id, revisionNumber);
    chartId = result.chartId;
    revisionNumber = result.revisionNumber;
  }

  // Store the message in the database (for history)
  await createChatMessage(userId, workspace.id, {
    prompt: messageText,
    knownIntent: ChatMessageIntent.NON_PLAN,
    messageFromPersona: persona as ChatMessageFromPersona,
  });

  // Build context messages for chart files
  const contextMessages = buildContextMessages(workspace);

  // Convert UI messages to model format
  const modelMessages = convertToModelMessages(uiMessages);

  // Combine context messages with user conversation
  const messages = [...contextMessages, ...modelMessages];

  // Get system prompt
  const system = CHAT_SYSTEM_PROMPT + TOOL_INSTRUCTIONS;

  // Get the appropriate model
  const model = getChatModel();

  // Create write file tool with workspace context
  const writeFileContext: WriteFileContext = {
    workspaceId: workspace.id,
    chartId,
    revisionNumber,
  };

  // Stream response with tools
  const result = streamText({
    model,
    messages,
    system,
    maxOutputTokens: 8192,
    tools: {
      write_file: createWriteFileTool(writeFileContext),
      latest_kubernetes_version: createKubernetesVersionTool(),
      latest_subchart_version: createSubchartVersionTool(),
    },
  });

  // Return streaming response
  return result.toUIMessageStreamResponse();
}

/**
 * Handle plan intent by delegating to Go worker
 */
async function handlePlanIntent(
  userId: string,
  workspaceId: string,
  messageText: string,
  persona: MessageFromPersona
): Promise<Response> {
  logger.info("Handling plan intent", { userId, workspaceId });

  // Create chat message with PLAN intent - this triggers Go worker
  const chatMessage = await createChatMessage(userId, workspaceId, {
    prompt: messageText,
    knownIntent: ChatMessageIntent.PLAN,
    messageFromPersona: persona as ChatMessageFromPersona,
  });

  return createStatusStreamResponse({
    type: "plan_created",
    chatMessageId: chatMessage.id,
    planId: chatMessage.responsePlanId,
    message: "Creating a plan for your request. Please wait for the plan to be generated.",
  });
}

/**
 * Handle render intent by delegating to Go worker
 */
async function handleRenderIntent(
  userId: string,
  workspaceId: string,
  messageText: string
): Promise<Response> {
  logger.info("Handling render intent", { userId, workspaceId });

  // Create chat message with RENDER intent - this triggers Go worker
  const chatMessage = await createChatMessage(userId, workspaceId, {
    prompt: messageText,
    knownIntent: ChatMessageIntent.RENDER,
  });

  return createStatusStreamResponse({
    type: "render_started",
    chatMessageId: chatMessage.id,
    renderId: chatMessage.responseRenderId,
    message: "Starting chart validation. The results will appear shortly.",
  });
}

/**
 * Handle proceed intent by creating revision
 */
async function handleProceedIntent(
  userId: string,
  workspaceId: string,
  messageText: string
): Promise<Response> {
  logger.info("Handling proceed intent", { userId, workspaceId });

  // Get the most recent plan
  const plan = await getMostRecentPlan(workspaceId);
  if (!plan) {
    return createStatusStreamResponse({
      type: "ambiguous",
      message: "There is no plan to proceed with. Please describe what you'd like to create first.",
    });
  }

  // Create chat message - this will trigger the Go worker to create a revision
  // The Go worker handles this in new_intent.go when isProceed is true
  await createChatMessage(userId, workspaceId, {
    prompt: messageText,
    // Don't set knownIntent so it goes through intent processing
    // which will detect isProceed and create the revision
  });

  return createStatusStreamResponse({
    type: "proceed_started",
    planId: plan.id,
    message: "Executing the plan and creating a new revision.",
  });
}

/**
 * Handle off-topic messages
 */
async function handleOffTopicIntent(
  userId: string,
  workspaceId: string,
  messageText: string
): Promise<Response> {
  logger.info("Handling off-topic intent", { userId, workspaceId });

  // Create chat message - Go worker will generate decline response
  await createChatMessage(userId, workspaceId, {
    prompt: messageText,
    // Don't set knownIntent so it goes through intent processing
  });

  return createStatusStreamResponse({
    type: "off_topic",
    message:
      "I'm ChartSmith, an expert in Helm charts and Kubernetes. I can only help with questions related to Helm charts, Kubernetes configurations, and chart development. Could you rephrase your question to focus on those topics?",
  });
}

/**
 * Handle ambiguous intent
 */
async function handleAmbiguousIntent(
  userId: string,
  workspaceId: string,
  messageText: string
): Promise<Response> {
  logger.info("Handling ambiguous intent", { userId, workspaceId });

  // Create chat message - Go worker will ask for clarification
  await createChatMessage(userId, workspaceId, {
    prompt: messageText,
  });

  return createStatusStreamResponse({
    type: "ambiguous",
    message:
      "I'm not sure I understand your request. Could you please clarify whether you'd like me to:\n- Answer a question about Helm charts\n- Make changes to your chart\n- Test or validate your chart",
  });
}

/**
 * Handle persona mismatch
 */
async function handlePersonaMismatch(
  userId: string,
  workspaceId: string,
  messageText: string,
  requestedPersona: "developer" | "operator"
): Promise<Response> {
  logger.info("Handling persona mismatch", { userId, workspaceId, requestedPersona });

  // Create chat message - Go worker will explain the mismatch
  await createChatMessage(userId, workspaceId, {
    prompt: messageText,
  });

  const personaLabel = requestedPersona === "developer" ? "chart developer" : "chart operator";

  return createStatusStreamResponse({
    type: "persona_mismatch",
    message: `I'm unable to answer this question as a ${personaLabel}. The question doesn't seem to be related to ${
      requestedPersona === "developer"
        ? "chart development or modifications"
        : "chart operations or deployment"
    }. Would you like to try asking differently?`,
  });
}

/**
 * Extract text content from a UI message
 * UIMessage has a 'parts' array, not a 'content' property
 */
function extractMessageText(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return "";
  }

  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/**
 * Ensure a chart exists for the workspace, creating one if needed
 */
async function ensureChartExists(
  workspaceId: string,
  revisionNumber: number
): Promise<{ chartId: string; revisionNumber: number }> {
  const db = getDB(await getParam("DB_URI"));

  const existingChart = await db.query(
    `SELECT id FROM workspace_chart WHERE workspace_id = $1 AND revision_number = $2 LIMIT 1`,
    [workspaceId, revisionNumber]
  );

  if (existingChart.rows.length > 0) {
    return { chartId: existingChart.rows[0].id, revisionNumber };
  }

  const chartId = nanoid(12);
  await db.query(
    `INSERT INTO workspace_chart (id, workspace_id, name, revision_number)
     VALUES ($1, $2, $3, $4)`,
    [chartId, workspaceId, "chart", revisionNumber]
  );

  logger.info("Created new chart for workspace", { workspaceId, chartId, revisionNumber });

  return { chartId, revisionNumber };
}

/**
 * Get the chat model based on CHAT_PROVIDER environment variable
 */
function getChatModel() {
  const provider = process.env.CHAT_PROVIDER ?? "anthropic";

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || "",
      });
      return openai("gpt-4o");
    }
    case "anthropic":
    default: {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || "",
      });
      return anthropic("claude-sonnet-4-20250514");
    }
  }
}

/**
 * Authenticate the request using extension token or session
 */
async function authenticateRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return userIdFromExtensionToken(token);
  }

  const sessionCookie = req.cookies.get("session");
  if (sessionCookie) {
    try {
      const hmacSecret = process.env.HMAC_SECRET;
      if (!hmacSecret) {
        logger.error("HMAC_SECRET is not defined");
        return null;
      }

      const decoded = jwt.verify(sessionCookie.value, hmacSecret) as {
        sub?: string;
        id?: string;
      };

      if (decoded.sub) {
        return decoded.sub;
      }

      logger.error("JWT does not contain user ID (sub claim)");
      return null;
    } catch (error) {
      logger.error("Failed to decode session JWT", { error });
      return null;
    }
  }

  return null;
}

/**
 * Build context messages from workspace chart files
 */
function buildContextMessages(workspace: {
  id: string;
  charts: Array<{
    id: string;
    name: string;
    files: Array<{ filePath: string; content: string }>;
  }>;
  currentRevisionNumber: number;
}): Array<{ role: "assistant"; content: string }> {
  const messages: Array<{ role: "assistant"; content: string }> = [];

  messages.push({
    role: "assistant",
    content: CHAT_INSTRUCTIONS,
  });

  if (workspace.charts.length > 0 && workspace.charts[0].files.length > 0) {
    const fileList = workspace.charts[0].files.map((f) => f.filePath).join(", ");
    messages.push({
      role: "assistant",
      content: `I am working on a Helm chart that has the following structure: ${fileList}`,
    });

    const MAX_FILE_CONTENT_LENGTH = 10000;
    for (const file of workspace.charts[0].files.slice(0, 10)) {
      const content =
        file.content.length > MAX_FILE_CONTENT_LENGTH
          ? file.content.slice(0, MAX_FILE_CONTENT_LENGTH) + "\n... [truncated]"
          : file.content;
      messages.push({
        role: "assistant",
        content: `File: ${file.filePath}\nContent:\n${content}`,
      });
    }
  }

  return messages;
}

/**
 * Handle errors and return appropriate response
 */
function handleError(error: unknown): NextResponse {
  if (error instanceof Error) {
    logger.error("Chat API error", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    console.error("Chat API error:", error.message, error.stack);
  } else {
    logger.error("Chat API error", { error });
    console.error("Chat API error:", error);
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation error", details: error.flatten() },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.includes("rate limit")) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  if (error instanceof Error && error.message.includes("API key")) {
    return NextResponse.json({ error: "Service configuration error" }, { status: 502 });
  }

  return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
}
