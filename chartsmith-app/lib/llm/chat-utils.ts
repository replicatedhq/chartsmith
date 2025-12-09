import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { generateText, embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { WorkspaceFile } from "@/lib/types/workspace";
import { logger } from "@/lib/utils/logger";
import crypto from "crypto";

export interface RelevantFile {
    file: WorkspaceFile;
    similarity: number;
}

export interface WorkspaceFilter {
    chartID?: string;
}

// Use OpenAI for embeddings
// const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

async function getEmbeddings(content: string): Promise<string> {
    if (!content) return "";

    // Mock mode: return empty embeddings
    if (process.env.MOCK_AI_SERVICE === 'true') {
        logger.info("Mock mode: skipping embeddings generation");
        // Return a mock 1536-dimensional zero vector
        const mockEmbedding = new Array(1536).fill(0);
        return `[${mockEmbedding.join(",")}]`;
    }

    const db = getDB(await getParam("DB_URI"));
    const contentSHA256 = crypto.createHash("sha256").update(content).digest("hex");

    // Check cache
    const cacheResult = await db.query(
        `select embeddings from content_cache where content_sha256 = $1`,
        [contentSHA256]
    );

    if (cacheResult.rows.length > 0) {
        return cacheResult.rows[0].embeddings;
    }

    // Use OpenAI embeddings
    try {
        const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: content,
        });

        // Format as vector string for Postgres
        const vectorString = `[${embedding.join(",")}]`;

        // Cache result
        await db.query(
            `insert into content_cache (content_sha256, embeddings) values ($1, $2) on conflict (content_sha256) do update set embeddings = $2`,
            [contentSHA256, vectorString]
        );

        return vectorString;
    } catch (err) {
        logger.error("Failed to generate embeddings", { err });
        // Fallback or rethrow?
        // If embeddings fail, we can't search. Rethrow.
        throw err;
    }
}

export async function expandPrompt(prompt: string): Promise<string> {
    // Mock mode: return the original prompt
    if (process.env.MOCK_AI_SERVICE === 'true') {
        logger.info("Mock mode: skipping prompt expansion");
        return prompt;
    }

    try {
        const { text } = await generateText({
            model: openai("gpt-4o"),
            messages: [
                {
                    role: "user",
                    content: `The following question is about developing a Helm chart.
There is an existing chart that we will be editing.
Look at the question, and help decide how to determine the existing files that are relevant to the question.
Try to structure the terms to be as specific as possible to avoid nearby matches.

To do this, take the prompt below, and expand it to include specific terms that we should search for in the existing chart.

If there are Kubernetes GVKs that are relevant to the question, include them prominently in the expanded prompt.

The expanded prompt should be a single paragraph, and should be no more than 100 words.

Here is the prompt:

${prompt}
`,
                },
            ],
        });
        return text;
    } catch (err) {
        logger.error("Failed to expand prompt", { err });
        throw err;
    }
}

export async function chooseRelevantFilesForChatMessage(
    workspaceId: string,
    filter: WorkspaceFilter,
    revisionNumber: number,
    expandedPrompt: string
): Promise<RelevantFile[]> {
    logger.info("Choosing relevant files", { workspaceId, revisionNumber, expandedPrompt });

    try {
        const promptEmbeddings = await getEmbeddings(expandedPrompt);
        const db = getDB(await getParam("DB_URI"));

        const fileMap = new Map<string, RelevantFile>();

        // Get Chart.yaml
        const chartYamlResult = await db.query(
            `SELECT id, revision_number, chart_id, workspace_id, file_path, content FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = 'Chart.yaml'`,
            [workspaceId, revisionNumber]
        );

        if (chartYamlResult.rows.length > 0) {
            const row = chartYamlResult.rows[0];
            fileMap.set(row.id, {
                file: {
                    id: row.id,
                    revisionNumber: row.revision_number,
                    filePath: row.file_path,
                    content: row.content,
                },
                similarity: 1.0,
            });
        }

        // Get values.yaml
        const valuesYamlResult = await db.query(
            `SELECT id, revision_number, chart_id, workspace_id, file_path, content FROM workspace_file WHERE workspace_id = $1 AND revision_number = $2 AND file_path = 'values.yaml'`,
            [workspaceId, revisionNumber]
        );

        if (valuesYamlResult.rows.length > 0) {
            const row = valuesYamlResult.rows[0];
            fileMap.set(row.id, {
                file: {
                    id: row.id,
                    revisionNumber: row.revision_number,
                    filePath: row.file_path,
                    content: row.content,
                },
                similarity: 1.0,
            });
        }

        // Vector search
        const query = `
      WITH similarities AS (
        SELECT
          id,
          revision_number,
          chart_id,
          workspace_id,
          file_path,
          content,
          embeddings,
          1 - (embeddings <=> $1) as similarity
        FROM workspace_file
        WHERE workspace_id = $2
        AND revision_number = $3
        AND embeddings IS NOT NULL
      )
      SELECT
        id,
        revision_number,
        chart_id,
        workspace_id,
        file_path,
        content,
        similarity
      FROM similarities
      ORDER BY similarity DESC
    `;

        const vectorResult = await db.query(query, [promptEmbeddings, workspaceId, revisionNumber]);
        const extensionsWithHighSimilarity = [".yaml", ".yml", ".tpl"];

        for (const row of vectorResult.rows) {
            let similarity = row.similarity;
            const ext = row.file_path.split('.').pop();

            if (!extensionsWithHighSimilarity.includes(`.${ext}`)) {
                similarity = similarity - 0.25;
            }

            if (row.file_path === "Chart.yaml" || row.file_path === "values.yaml") {
                similarity = 1.0;
            }

            fileMap.set(row.id, {
                file: {
                    id: row.id,
                    revisionNumber: row.revision_number,
                    filePath: row.file_path,
                    content: row.content,
                },
                similarity
            });
        }

        const sorted = Array.from(fileMap.values()).sort((a, b) => b.similarity - a.similarity);
        return sorted;

    } catch (err) {
        logger.error("Failed to choose relevant files", { err });
        throw err;
    }
}
