/**
 * Chat API Route
 *
 * This is an exception to Chartsmith's "no API routes" preference,
 * required for useChat() hook compatibility with Vercel AI SDK streaming.
 *
 * The route is a thin orchestration layer - all business logic is in lib/chat/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { getWorkspace } from "@/lib/workspace/workspace";
import { logger } from "@/lib/utils/logger";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompts/system";
import { createWriteFileTool, WriteFileContext } from "@/lib/chat/tools/write-file";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { nanoid } from "nanoid";
import { chatRequestSchema } from "@/lib/chat/schema";

/**
 * Tool-specific instructions appended to the system prompt
 */
const TOOL_INSTRUCTIONS = `

<tool_instructions>
You have access to a write_file tool to create and update Helm chart files.

CRITICAL REQUIREMENTS:
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
</tool_instructions>
`;

/**
 * POST /api/chat
 *
 * Stream a chat response using Vercel AI SDK.
 * Accepts useChat format: { messages: UIMessage[], workspaceId: string }
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

    const { messages: uiMessages, workspaceId } = parseResult.data;

    // Verify workspace exists and user has access
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Ensure we have a chart to work with
    let chartId: string;
    let revisionNumber = workspace.currentRevisionNumber;

    if (workspace.charts.length > 0) {
      chartId = workspace.charts[0].id;
    } else {
      // Create a chart for revision 0 workspaces
      const result = await ensureChartExists(workspaceId, revisionNumber);
      chartId = result.chartId;
      revisionNumber = result.revisionNumber;
    }

    // Build context messages for chart files
    const contextMessages = buildContextMessages(workspace);

    // Convert UI messages to model format
    const modelMessages = convertToModelMessages(uiMessages as UIMessage[]);

    // Combine context messages with user conversation
    const messages = [...contextMessages, ...modelMessages];

    // Get system prompt - use the existing comprehensive prompt with tool instructions
    const system = CHAT_SYSTEM_PROMPT + TOOL_INSTRUCTIONS;

    // Get the appropriate model based on CHAT_PROVIDER env var
    const model = getChatModel();

    // Create write file tool with workspace context
    const writeFileContext: WriteFileContext = {
      workspaceId,
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
      },
    });

    // Return streaming response in useChat UI message format
    return result.toUIMessageStreamResponse();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Ensure a chart exists for the workspace, creating one if needed
 */
async function ensureChartExists(
  workspaceId: string,
  revisionNumber: number
): Promise<{ chartId: string; revisionNumber: number }> {
  const db = getDB(await getParam("DB_URI"));

  // Check if a chart already exists
  const existingChart = await db.query(
    `SELECT id FROM workspace_chart WHERE workspace_id = $1 AND revision_number = $2 LIMIT 1`,
    [workspaceId, revisionNumber]
  );

  if (existingChart.rows.length > 0) {
    return { chartId: existingChart.rows[0].id, revisionNumber };
  }

  // Create a new chart
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
 *
 * Supports: "anthropic" (default), "openai"
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
  // Try Bearer token first (for API/extension access)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return userIdFromExtensionToken(token);
  }

  // Fall back to session cookie (contains JWT)
  const sessionCookie = req.cookies.get("session");
  if (sessionCookie) {
    try {
      // Session cookie contains a JWT token - decode it to get user ID
      const hmacSecret = process.env.HMAC_SECRET;
      if (!hmacSecret) {
        logger.error("HMAC_SECRET is not defined");
        return null;
      }

      const decoded = jwt.verify(sessionCookie.value, hmacSecret) as {
        sub?: string; // User ID is in the subject claim
        id?: string;  // Session ID
      };

      // The 'sub' claim contains the user ID
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
 * These provide the AI with knowledge about the current chart state
 */
function buildContextMessages(
  workspace: {
    id: string;
    charts: Array<{
      id: string;
      name: string;
      files: Array<{ filePath: string; content: string }>;
    }>;
    currentRevisionNumber: number;
  }
): Array<{ role: "assistant"; content: string }> {
  const messages: Array<{ role: "assistant"; content: string }> = [];

  // Add chart structure context
  if (workspace.charts.length > 0 && workspace.charts[0].files.length > 0) {
    const fileList = workspace.charts[0].files.map((f) => f.filePath).join(", ");
    messages.push({
      role: "assistant",
      content: `I am working on a Helm chart that has the following structure: ${fileList}`,
    });

    // Add file contents (limited to first 10 files)
    for (const file of workspace.charts[0].files.slice(0, 10)) {
      messages.push({
        role: "assistant",
        content: `File: ${file.filePath}\nContent:\n${file.content}`,
      });
    }
  }

  return messages;
}

/**
 * Handle errors and return appropriate response
 */
function handleError(error: unknown): NextResponse {
  // Log the full error with stack trace for debugging
  if (error instanceof Error) {
    logger.error("Chat API error", {
      message: error.message,
      stack: error.stack,
      name: error.name
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

  // Check for rate limiting
  if (error instanceof Error && error.message.includes("rate limit")) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  // Check for auth errors
  if (error instanceof Error && error.message.includes("API key")) {
    return NextResponse.json(
      { error: "Service configuration error" },
      { status: 502 }
    );
  }

  // Generic error
  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
