import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { logger } from "../utils/logger";
import { Workspace, WorkspaceFile, Chart, ChatMessage } from "../types/workspace";
import { getWorkspace } from "./workspace";

interface RelevantFile {
  file: WorkspaceFile;
  similarity: number;
}

/**
 * Gets the chart structure as a string listing all files
 * Ported from pkg/llm/conversational.go:236-242
 */
export async function getChartStructure(workspace: Workspace): Promise<string> {
  try {
    let structure = '';

    for (const chart of workspace.charts) {
      for (const file of chart.files) {
        structure += `File: ${file.filePath}\n`;
      }
    }

    return structure;
  } catch (err) {
    logger.error("Failed to get chart structure", { err });
    throw err;
  }
}

/**
 * Chooses relevant files for a chat message using embeddings and vector search
 * Ported from pkg/workspace/context.go - ChooseRelevantFilesForChatMessage
 */
export async function chooseRelevantFiles(
  workspace: Workspace,
  prompt: string,
  chartId?: string,
  maxFiles: number = 10
): Promise<WorkspaceFile[]> {
  try {
    const db = getDB(await getParam("DB_URI"));

    // Get embeddings for the prompt using Voyage AI
    const embeddings = await getEmbeddings(prompt);

    const fileMap = new Map<string, RelevantFile>();

    // Always include Chart.yaml if it exists (match nested paths too)
    const chartYamlResult = await db.query(
      `SELECT id, revision_number, file_path, content FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $2
       AND (file_path = 'Chart.yaml' OR file_path LIKE '%/Chart.yaml')
       LIMIT 1`,
      [workspace.id, workspace.currentRevisionNumber]
    );

    if (chartYamlResult.rows.length > 0) {
      const chartYaml = chartYamlResult.rows[0];
      fileMap.set(chartYaml.id, {
        file: {
          id: chartYaml.id,
          revisionNumber: chartYaml.revision_number,
          filePath: chartYaml.file_path,
          content: chartYaml.content,
        },
        similarity: 1.0,
      });
    }

    // Always include values.yaml if it exists (match nested paths too)
    const valuesYamlResult = await db.query(
      `SELECT id, revision_number, file_path, content FROM workspace_file
       WHERE workspace_id = $1 AND revision_number = $2
       AND (file_path = 'values.yaml' OR file_path LIKE '%/values.yaml')
       LIMIT 1`,
      [workspace.id, workspace.currentRevisionNumber]
    );

    if (valuesYamlResult.rows.length > 0) {
      const valuesYaml = valuesYamlResult.rows[0];
      fileMap.set(valuesYaml.id, {
        file: {
          id: valuesYaml.id,
          revisionNumber: valuesYaml.revision_number,
          filePath: valuesYaml.file_path,
          content: valuesYaml.content,
        },
        similarity: 1.0,
      });
    }

    // Query files with embeddings and calculate cosine similarity
    // Using pgvector's <=> operator for cosine distance
    // Cast the embeddings array to vector type for proper pgvector operation
    const query = `
      WITH similarities AS (
        SELECT
          id,
          revision_number,
          file_path,
          content,
          embeddings,
          1 - (embeddings <=> $1::vector) as similarity
        FROM workspace_file
        WHERE workspace_id = $2
        AND revision_number = $3
        AND embeddings IS NOT NULL
      )
      SELECT
        id,
        revision_number,
        file_path,
        content,
        similarity
      FROM similarities
      ORDER BY similarity DESC
    `;

    const result = await db.query(query, [JSON.stringify(embeddings), workspace.id, workspace.currentRevisionNumber]);

    const extensionsWithHighSimilarity = ['.yaml', '.yml', '.tpl'];

    for (const row of result.rows) {
      // Skip if already in map with similarity 1.0 (pre-inserted Chart.yaml or values.yaml)
      const existing = fileMap.get(row.id);
      if (existing && existing.similarity === 1.0) {
        continue;
      }

      let similarity = row.similarity;

      // Reduce similarity for non-template files
      const ext = row.file_path.substring(row.file_path.lastIndexOf('.'));
      if (!extensionsWithHighSimilarity.includes(ext)) {
        similarity = similarity - 0.25;
      }

      // Force high similarity for Chart.yaml and values.yaml (any path)
      if (row.file_path.endsWith('/Chart.yaml') || row.file_path === 'Chart.yaml' ||
          row.file_path.endsWith('/values.yaml') || row.file_path === 'values.yaml') {
        similarity = 1.0;
      }

      fileMap.set(row.id, {
        file: {
          id: row.id,
          revisionNumber: row.revision_number,
          filePath: row.file_path,
          content: row.content,
        },
        similarity,
      });
    }

    // Convert to array and sort by similarity
    const sorted = Array.from(fileMap.values()).sort((a, b) => b.similarity - a.similarity);

    // Limit to maxFiles
    const limited = sorted.slice(0, maxFiles);

    return limited.map(item => item.file);
  } catch (err) {
    logger.error("Failed to choose relevant files", { err });
    // Fallback: return first maxFiles files
    const allFiles = workspace.charts.flatMap(c => c.files);
    return allFiles.slice(0, maxFiles);
  }
}

/**
 * Gets embeddings for text using Voyage AI
 */
async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    if (!voyageApiKey) {
      throw new Error("VOYAGE_API_KEY not set");
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voyageApiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: 'voyage-3',
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    logger.error("Failed to get embeddings", { err });
    throw err;
  }
}

/**
 * Gets previous chat history after the most recent plan
 * Ported from pkg/llm/conversational.go:75-94
 */
export async function getPreviousChatHistory(
  workspaceId: string,
  currentMessageId: string
): Promise<Array<{ role: 'user' | 'assistant', content: string }>> {
  try {
    const db = getDB(await getParam("DB_URI"));

    // Get the most recent plan
    const planResult = await db.query(
      `SELECT id, description, created_at FROM workspace_plan
       WHERE workspace_id = $1 AND status != 'ignored'
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId]
    );

    if (planResult.rows.length === 0) {
      // No plan found, return empty history
      return [];
    }

    const plan = planResult.rows[0];

    // Get all chat messages after the plan was created
    const messagesResult = await db.query(
      `SELECT id, prompt, response, created_at FROM workspace_chat
       WHERE workspace_id = $1
       AND created_at > $2
       AND id != $3
       AND prompt IS NOT NULL
       ORDER BY created_at ASC`,
      [workspaceId, plan.created_at, currentMessageId]
    );

    const history: Array<{ role: 'user' | 'assistant', content: string }> = [];

    // Add the plan description first
    if (plan.description) {
      history.push({
        role: 'assistant',
        content: plan.description,
      });
    }

    // Add all subsequent messages
    for (const msg of messagesResult.rows) {
      if (msg.prompt) {
        history.push({
          role: 'user',
          content: msg.prompt,
        });
      }
      if (msg.response) {
        history.push({
          role: 'assistant',
          content: msg.response,
        });
      }
    }

    return history;
  } catch (err) {
    logger.error("Failed to get previous chat history", { err });
    return [];
  }
}
