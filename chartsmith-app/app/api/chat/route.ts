import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getDB } from "@/lib/data/db";
import { getParam } from "@/lib/data/param";
import { logger } from "@/lib/utils/logger";
import { expandPrompt, chooseRelevantFilesForChatMessage } from "@/lib/llm/chat-utils";
import * as srs from "secure-random-string";
import { getLatestSubchartVersion } from "@/lib/recommendations/subchart";
import { createPlan } from "@/lib/workspace/workspace";
import { enqueueWork } from "@/lib/utils/queue";
import { findSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

export const maxDuration = 300;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, workspaceId, chatMessageId } = body;

        logger.info("Chat request received", { hasMessages: !!messages, messagesLength: messages?.length, workspaceId, chatMessageId, bodyKeys: Object.keys(body) });

        // Validate required parameters
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            logger.error("Invalid messages parameter", { messages, body });
            return new Response(JSON.stringify({ error: "Messages array is required" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Log message details
        logger.info("Messages array content", { messages: messages.map((m: any) => ({ role: m?.role, contentLength: m?.content?.length, keys: Object.keys(m || {}) })) });

        // Auth check
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get("session")?.value;
        if (!sessionToken) {
            return new Response("Unauthorized", { status: 401 });
        }

        const session = await findSession(sessionToken);
        if (!session) {
            return new Response("Unauthorized", { status: 401 });
        }

        // Validate workspace access
        // Validate workspace access
        const db = getDB(await getParam("DB_URI"));
        // Verify workspace access
        // We check if the workspace exists and if it was created by the current user
        const accessResult = await db.query(
            `SELECT id FROM workspace WHERE id = $1 AND created_by_user_id = $2`,
            [workspaceId, session.user.id]
        );

        if (accessResult.rows.length === 0) {
            return new Response("Unauthorized", { status: 401 });
        }

        // Get relevant files context
        let systemPrompt = `You are ChartSmith, an expert at creating Helm charts and Kubernetes manifests.
You have access to the current state of the chart files.
If the user asks to create or modify a chart or perform a complex task that requires multiple steps, use the tool 'create_plan'.
`;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === "user") {
            try {
                // Get current revision
                const revisionResult = await db.query(
                    `SELECT current_revision_number FROM workspace WHERE id = $1`,
                    [workspaceId]
                );
                const currentRevision = revisionResult.rows[0]?.current_revision_number || 1;

                // Expand prompt and find relevant files
                const expandedPrompt = await expandPrompt(lastMessage.content);
                const relevantFiles = await chooseRelevantFilesForChatMessage(
                    workspaceId,
                    {},
                    currentRevision,
                    expandedPrompt
                );

                if (relevantFiles.length > 0) {
                    systemPrompt += "\n\nHere are the relevant files from the current chart:\n";
                    for (const item of relevantFiles) {
                        systemPrompt += `\n--- ${item.file.filePath} ---\n${item.file.content}\n`;
                    }
                }
            } catch (err) {
                logger.error("Failed to add context to prompt", { err });
            }
        }

        // Format messages for the AI SDK
        // Extract only role and content fields to avoid issues with extra fields like 'id'
        const formattedMessages = messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
        }));

        logger.info("Formatted messages for AI SDK", {
            originalCount: messages.length,
            formattedCount: formattedMessages.length,
            firstFormatted: formattedMessages[0]
        });

        const result = streamText({
            model: openai("gpt-4o"),
            system: systemPrompt,
            messages: formattedMessages,
            maxSteps: 5,
            // DISABLED: Tools cause client error "Cannot read properties of undefined (reading 'state')"
            // This is a known issue with @ai-sdk/react@2.0.106 and tool calling
            // TODO: Re-enable when AI SDK fixes this bug or we find a workaround
            tools: {
                latest_subchart_version: tool({
                    description: "Return the latest version of a subchart from name",
                    inputSchema: z.object({
                        chart_name: z.string().describe("The subchart name to get the latest version of"),
                    }),
                    execute: async ({ chart_name }) => {
                        try {
                            return await getLatestSubchartVersion(chart_name);
                        } catch (err) {
                            return "?";
                        }
                    },
                }),
                latest_kubernetes_version: tool({
                    description: "Return the latest version of Kubernetes",
                    inputSchema: z.object({
                        semver_field: z.enum(["major", "minor", "patch"]).describe("One of 'major', 'minor', or 'patch'"),
                    }),
                    execute: async ({ semver_field }) => {
                        switch (semver_field) {
                            case "major": return "1";
                            case "minor": return "1.32";
                            case "patch": return "1.32.1";
                            default: return "1.32.1";
                        }
                    },
                }),
                create_plan: tool({
                    description: "Create a plan to modify the helm chart",
                    inputSchema: z.object({
                        description: z.string().describe("Description of the plan"),
                    }),
                    execute: async ({ description }) => {
                        try {
                            // Create plan
                            const plan = await createPlan(session.user.id, workspaceId, chatMessageId);
                            console.log("[DEBUG] Plan created:", plan.id, "for message:", chatMessageId);

                            await enqueueWork("new_plan", {
                                planId: plan.id,
                            });

                            // Update chat message with plan ID
                            await db.query("UPDATE workspace_chat SET response_plan_id = $1 WHERE id = $2", [plan.id, chatMessageId]);

                            return `Plan created with ID: ${plan.id}`;
                        } catch (err) {
                            logger.error("Failed to create plan", { err });
                            return "Failed to create plan";
                        }
                    },
                }),
            },
            onFinish: async ({ text }) => {
                // Save to DB
                if (chatMessageId) {
                    await db.query(
                        `UPDATE workspace_chat SET response = $1, is_intent_complete = true WHERE id = $2`,
                        [text, chatMessageId]
                    );
                }
            },
        });

        return result.toUIMessageStreamResponse();
    } catch (err) {
        console.error("CRITICAL ERROR in /api/chat:", err);
        logger.error("Error in chat route", { err });
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
}
