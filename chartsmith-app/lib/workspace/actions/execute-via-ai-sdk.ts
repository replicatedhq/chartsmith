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
 */
async function extractExpectedFilesViaLLM(
  planDescription: string,
  provider?: string
): Promise<string[]> {
  const model = getModel(provider);

  const extractionPrompt = `You are a Helm chart file path extractor. Given a plan description, identify ALL file paths that will be created or modified.

Standard Helm chart files (in typical creation order):
1. Chart.yaml (chart metadata - always first)
2. values.yaml (default configuration values)
3. .helmignore (files to exclude from packaging)
4. templates/_helpers.tpl (template helpers - before other templates)
5. templates/serviceaccount.yaml (ServiceAccount)
6. templates/configmap.yaml (ConfigMap)
7. templates/secret.yaml (Secret)
8. templates/deployment.yaml (Kubernetes Deployment)
9. templates/service.yaml (Kubernetes Service)
10. templates/ingress.yaml (Ingress)
11. templates/hpa.yaml (HorizontalPodAutoscaler)
12. templates/pdb.yaml (PodDisruptionBudget)
13. templates/NOTES.txt (post-install notes)
14. templates/tests/test-connection.yaml (helm test - last)

INSTRUCTIONS:
1. Read the plan description carefully
2. Identify ALL files that will be created or modified
3. If the plan mentions creating a complete Helm chart, include standard files
4. **IMPORTANT: Return files in the ORDER they should be created** (Chart.yaml first, then values.yaml, then helpers, then templates)
5. Output ONLY a valid JSON array of file paths, nothing else

Example output (note the order - metadata first, then helpers, then templates):
["Chart.yaml", "values.yaml", "templates/_helpers.tpl", "templates/deployment.yaml", "templates/service.yaml"]

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
  // Track the single file currently being worked on (only one at a time)
  let currentActiveFile: string | null = null;

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
      onStepFinish: async ({ toolCalls }) => {
        // Update action file statuses as tools are called
        console.log('[executeViaAISDK] Step finished with toolCalls:', toolCalls?.length || 0);
        for (const toolCall of toolCalls ?? []) {
          if (toolCall.toolName === 'textEditor' && 'input' in toolCall) {
            // AI SDK v5 uses 'input' for tool arguments
            const input = toolCall.input as { path?: string; command?: string };
            console.log('[executeViaAISDK] textEditor call:', input.command, input.path);
            if (input.path) {
              const fileAction = input.command === 'create' ? 'create' : 'update';

              if (input.command === 'create' || input.command === 'str_replace') {
                // File is being created/modified - this is the active file
                // First, mark any previous active file as still pending (if not completed)
                // Then mark this file as "creating" (active with spinner)
                if (currentActiveFile && currentActiveFile !== input.path && !completedFiles.has(currentActiveFile)) {
                  // Previous file wasn't completed - keep it pending
                  await addOrUpdateActionFile(workspaceId, planId, currentActiveFile, 'create', 'pending');
                }

                // Mark current file as active (creating = spinner)
                currentActiveFile = input.path;
                await addOrUpdateActionFile(workspaceId, planId, input.path, fileAction, 'creating');
                await publishPlanUpdate(workspaceId, planId);

                // File is now done - mark as "created" (checkmark)
                await addOrUpdateActionFile(workspaceId, planId, input.path, fileAction, 'created');
                completedFiles.add(input.path);
                currentActiveFile = null;
                await publishPlanUpdate(workspaceId, planId);
              } else if (input.command === 'view') {
                // Viewing a file - mark it as "creating" to show it's being worked on
                if (!completedFiles.has(input.path)) {
                  currentActiveFile = input.path;
                  await addOrUpdateActionFile(workspaceId, planId, input.path, fileAction, 'creating');
                  await publishPlanUpdate(workspaceId, planId);
                }
              }
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
