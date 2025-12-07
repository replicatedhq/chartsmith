"use server";

import { streamText, stepCountIs, generateText } from 'ai';
import { Session } from "@/lib/types/session";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { getModel } from "@/lib/ai";
import { createTools } from "@/lib/ai/tools";
import {
  CHARTSMITH_EXECUTION_SYSTEM_PROMPT,
  getExecutionInstruction,
} from "@/lib/ai/prompts";
import { callGoEndpoint } from "@/lib/ai/tools/utils";

interface ExecuteViaAISDKParams {
  session: Session;
  planId: string;
  workspaceId: string;
  revisionNumber: number;
  planDescription: string;
  provider?: string;
}

/**
 * Use LLM to extract expected file paths from plan description.
 * This is more reliable than regex because the AI can understand context.
 * Returns file paths that will be created/modified during execution.
 *
 * The prompt is intentionally generic - not Helm-specific - so it works
 * for any type of project (Helm charts, Kubernetes manifests, etc.)
 */
async function extractExpectedFilesViaLLM(
  planDescription: string,
  provider?: string
): Promise<string[]> {
  const model = getModel(provider);

  const extractionPrompt = `You are a file path extractor. Given a plan description, identify ALL file paths that will be created or modified.

INSTRUCTIONS:
1. Read the plan description carefully
2. Identify ALL files mentioned or implied that will be created or modified
3. Look for explicit file paths (e.g., "Chart.yaml", "templates/deployment.yaml", "values.yaml")
4. Look for file references in backticks, quotes, or bullet points
5. If the plan describes creating a standard project structure (Helm chart, etc.), include the typical files for that structure
6. Return files in the order they should logically be created (metadata/config first, then implementation files)
7. Output ONLY a valid JSON array of file paths, nothing else

Examples:
- For a Helm chart: ["Chart.yaml", "values.yaml", "templates/_helpers.tpl", "templates/deployment.yaml", "templates/service.yaml"]
- For K8s manifests: ["deployment.yaml", "service.yaml", "configmap.yaml"]
- For a single file update: ["templates/deployment.yaml"]

If you cannot determine specific files, return an empty array: []

Plan description:
${planDescription}`;

  try {
    console.log('[extractExpectedFilesViaLLM] Extracting files from plan...');
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const text = result.text.trim();
    console.log('[extractExpectedFilesViaLLM] Raw response:', text);

    // Try to extract JSON array from the response (handle potential markdown code blocks)
    let jsonText = text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse the JSON array
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      const files = parsed.filter((f: unknown) => typeof f === 'string' && f.length > 0);
      console.log('[extractExpectedFilesViaLLM] Extracted files:', files);
      return files;
    }
    return [];
  } catch (error) {
    console.error('[extractExpectedFilesViaLLM] Failed to extract files:', error);
    // Fallback to regex-based extraction
    const fallbackFiles = extractExpectedFilesFromPlanRegex(planDescription);
    console.log('[extractExpectedFilesViaLLM] Fallback regex extracted:', fallbackFiles);
    return fallbackFiles;
  }
}

/**
 * Fallback regex-based extraction for file paths.
 */
function extractExpectedFilesFromPlanRegex(planDescription: string): string[] {
  const files: Set<string> = new Set();

  // Common Helm chart file patterns to look for
  const patterns = [
    // Explicit file mentions like "Chart.yaml", "values.yaml", etc.
    /\b(Chart\.yaml|values\.yaml|\.helmignore)\b/gi,
    // Template files like "templates/deployment.yaml"
    /\btemplates\/[\w\-\.]+\.(?:yaml|yml|tpl|txt)\b/gi,
    // Tests like "templates/tests/test-connection.yaml"
    /\btemplates\/tests\/[\w\-\.]+\.(?:yaml|yml)\b/gi,
    // Generic yaml/tpl file paths
    /\b[\w\-]+\.(?:yaml|yml|tpl)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = planDescription.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Normalize the path
        const path = match.trim();
        // Skip common false positives
        if (path === 'yaml' || path === 'yml' || path === 'tpl') continue;
        files.add(path);
      }
    }
  }

  // Also look for bullet points or numbered lists with file names
  const bulletPattern = /[-*•]\s*[`"]?([\w\-\/]+\.(?:yaml|yml|tpl|txt))[`"]?/gi;
  let bulletMatch;
  while ((bulletMatch = bulletPattern.exec(planDescription)) !== null) {
    files.add(bulletMatch[1]);
  }

  // Look for backtick-quoted file paths
  const backtickPattern = /`([\w\-\/]+\.(?:yaml|yml|tpl|txt))`/gi;
  let btMatch;
  while ((btMatch = backtickPattern.exec(planDescription)) !== null) {
    files.add(btMatch[1]);
  }

  return Array.from(files);
}

/**
 * Publishes a plan update event via Go backend
 */
async function publishPlanUpdate(
  workspaceId: string,
  planId: string
): Promise<void> {
  try {
    await callGoEndpoint<{ success: boolean }>(
      "/api/plan/publish-update",
      { workspaceId, planId }
    );
  } catch (error) {
    console.error("[executeViaAISDK] Failed to publish plan update:", error);
  }
}

/**
 * Adds or updates an action file in the plan.
 * This mimics Go's behavior in pkg/listener/execute-plan.go:116-153
 * where action files are added dynamically as they're discovered.
 *
 * Uses the existing /api/plan/update-action-file-status endpoint,
 * which we extend to support adding new files (not just updating existing ones).
 */
async function addOrUpdateActionFile(
  workspaceId: string,
  planId: string,
  path: string,
  action: "create" | "update",
  status: "pending" | "creating" | "created"
): Promise<void> {
  try {
    await callGoEndpoint<{ success: boolean }>(
      "/api/plan/update-action-file-status",  // Existing endpoint, extended to add files
      { workspaceId, planId, path, action, status }
    );
  } catch (error) {
    console.error(`[executeViaAISDK] Failed to add/update action file ${path}:`, error);
  }
}

/**
 * Executes a text-only plan via AI SDK with tools enabled.
 *
 * This is the AI SDK execution path for plans that were created without
 * buffered tool calls (i.e., plans generated during the plan-only phase).
 *
 * This mirrors Go's two-phase approach in pkg/listener/execute-plan.go:
 * - File list is NOT known upfront
 * - As the AI calls textEditor, we add files to actionFiles dynamically
 * - UI shows "selecting files..." initially, then file list streams in
 *
 * Flow:
 * 1. Update plan status to 'applying'
 * 2. Call AI SDK with execution prompt + textEditor tool
 * 3. As tools are called, add action files dynamically (like Go does)
 * 4. Tools execute against Go /api/tools/editor endpoint
 * 5. Update plan status to 'applied' on success, 'review' on failure
 */
export async function executeViaAISDK({
  session,
  planId,
  workspaceId,
  revisionNumber,
  planDescription,
  provider,
}: ExecuteViaAISDKParams): Promise<void> {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDB(await getParam("DB_URI"));

  // 1. Update plan status to 'applying' (this triggers "Creating chart..." UI state)
  await db.query(
    `UPDATE workspace_plan SET status = 'applying', updated_at = NOW() WHERE id = $1`,
    [planId]
  );
  await publishPlanUpdate(workspaceId, planId);

  // 2. Extract expected files from plan description using LLM
  // This shows the full file list to the user BEFORE execution starts
  console.log('[executeViaAISDK] Starting file extraction from plan...');

  // Use LLM to intelligently extract file paths from the plan description
  const expectedFiles = await extractExpectedFilesViaLLM(planDescription, provider);
  console.log('[executeViaAISDK] Expected files from plan:', expectedFiles);

  // Add all expected files as "pending" upfront - this shows them immediately in the UI
  if (expectedFiles.length > 0) {
    for (const filePath of expectedFiles) {
      await addOrUpdateActionFile(workspaceId, planId, filePath, 'create', 'pending');
    }
    await publishPlanUpdate(workspaceId, planId);
    console.log('[executeViaAISDK] Published pending file list to UI');
  } else {
    console.log('[executeViaAISDK] No files extracted from plan, will discover during execution');
  }

  // 3. Prepare execution context
  const isInitialChart = revisionNumber === 0;
  const executionInstruction = getExecutionInstruction(planDescription, isInitialChart);

  const model = getModel(provider);
  const tools = createTools(undefined, workspaceId, revisionNumber);

  // Track files that have been completed
  const completedFiles = new Set<string>();
  // Track files currently marked as "creating" (spinner showing)
  const creatingFiles = new Set<string>();

  try {
    // 4. Execute via AI SDK with tools
    // Using stepCountIs(50) to allow many tool calls for multi-file operations
    // Reference: chartsmith-app/app/api/chat/route.ts lines 272-277
    console.log('[executeViaAISDK] Starting execution with AI SDK...');
    const result = await streamText({
      model,
      system: CHARTSMITH_EXECUTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: executionInstruction }],
      tools,
      stopWhen: stepCountIs(50), // Allow many tool calls for multi-file operations (AI SDK v5 pattern)

      // onChunk fires as the stream is received - use to detect tool calls BEFORE execution
      onChunk: async ({ chunk }) => {
        if (chunk.type === 'tool-call' && chunk.toolName === 'textEditor') {
          // AI SDK v5 uses 'input' not 'args' for tool call parameters
          const input = chunk.input as { path?: string; command?: string } | undefined;
          if (input?.path && (input.command === 'create' || input.command === 'str_replace')) {
            // Tool call detected - mark file as "creating" BEFORE execution
            if (!creatingFiles.has(input.path) && !completedFiles.has(input.path)) {
              console.log('[executeViaAISDK] Tool call starting:', input.command, input.path);
              const fileAction = input.command === 'create' ? 'create' : 'update';
              await addOrUpdateActionFile(workspaceId, planId, input.path, fileAction, 'creating');
              creatingFiles.add(input.path);
              await publishPlanUpdate(workspaceId, planId);
            }
          }
        }
      },

      // onStepFinish fires AFTER tool execution - use to mark files as "created"
      onStepFinish: async ({ toolResults }) => {
        // toolResults contains the results of executed tools
        console.log('[executeViaAISDK] Step finished with toolResults:', toolResults?.length || 0);
        for (const toolResult of toolResults ?? []) {
          if (toolResult.toolName === 'textEditor') {
            // AI SDK v5 uses 'input' not 'args' for tool result parameters
            const input = toolResult.input as { path?: string; command?: string };
            console.log('[executeViaAISDK] textEditor completed:', input.command, input.path);
            if (input.path && (input.command === 'create' || input.command === 'str_replace')) {
              // Tool execution completed - mark as "created"
              const fileAction = input.command === 'create' ? 'create' : 'update';
              await addOrUpdateActionFile(workspaceId, planId, input.path, fileAction, 'created');
              completedFiles.add(input.path);
              creatingFiles.delete(input.path);
              await publishPlanUpdate(workspaceId, planId);
            }
          }
        }
      },
    });

    // Consume the stream to completion
    for await (const _ of result.textStream) {
      // Stream consumed - side effects handled in onStepFinish
    }

    // 4. Update plan status to 'applied'
    await db.query(
      `UPDATE workspace_plan SET status = 'applied', proceed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [planId]
    );
    await publishPlanUpdate(workspaceId, planId);

  } catch (error) {
    console.error('[executeViaAISDK] Execution failed:', error);

    // Reset to review on failure (matches Go behavior)
    await db.query(
      `UPDATE workspace_plan SET status = 'review', updated_at = NOW() WHERE id = $1`,
      [planId]
    );
    await publishPlanUpdate(workspaceId, planId);

    throw error;
  }
}
