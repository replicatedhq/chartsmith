/**
 * Unit tests for context-builder.ts
 */

import {
  buildChatContext,
  estimateContextTokens,
  type WorkspaceData,
  type RelevantFile,
  type ChatMessageData,
  type PlanData,
} from "../context-builder";

describe("context-builder", () => {
  describe("buildChatContext", () => {
    const baseWorkspace: WorkspaceData = {
      id: "workspace-123",
      charts: [
        {
          id: "chart-1",
          files: [
            { filePath: "Chart.yaml", content: "name: my-chart" },
            { filePath: "values.yaml", content: "replicaCount: 1" },
          ],
        },
      ],
    };

    it("should build context with basic workspace data", () => {
      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles: [],
        previousMessages: [],
      });

      expect(result.workspaceId).toBe("workspace-123");
      expect(result.chartStructure).toContain("Chart.yaml");
      expect(result.chartStructure).toContain("values.yaml");
      expect(result.relevantFiles).toHaveLength(0);
      expect(result.previousMessages).toHaveLength(0);
    });

    it("should include relevant files in context", () => {
      const relevantFiles: RelevantFile[] = [
        { filePath: "templates/deployment.yaml", content: "kind: Deployment" },
        { filePath: "templates/service.yaml", content: "kind: Service" },
      ];

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles,
        previousMessages: [],
      });

      expect(result.relevantFiles).toHaveLength(2);
      expect(result.relevantFiles[0].filePath).toBe("templates/deployment.yaml");
      expect(result.relevantFiles[1].filePath).toBe("templates/service.yaml");
    });

    it("should limit relevant files to MAX_FILES (10)", () => {
      const relevantFiles: RelevantFile[] = Array.from({ length: 15 }, (_, i) => ({
        filePath: `file-${i}.yaml`,
        content: `content-${i}`,
      }));

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles,
        previousMessages: [],
      });

      expect(result.relevantFiles).toHaveLength(10);
    });

    it("should sort files by relevance score", () => {
      const relevantFiles: RelevantFile[] = [
        { filePath: "low.yaml", content: "content", relevanceScore: 0.1 },
        { filePath: "high.yaml", content: "content", relevanceScore: 0.9 },
        { filePath: "medium.yaml", content: "content", relevanceScore: 0.5 },
      ];

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles,
        previousMessages: [],
      });

      expect(result.relevantFiles[0].filePath).toBe("high.yaml");
      expect(result.relevantFiles[1].filePath).toBe("medium.yaml");
      expect(result.relevantFiles[2].filePath).toBe("low.yaml");
    });

    it("should truncate long file content", () => {
      const longContent = "x".repeat(15000);
      const relevantFiles: RelevantFile[] = [
        { filePath: "long.yaml", content: longContent },
      ];

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles,
        previousMessages: [],
      });

      expect(result.relevantFiles[0].content.length).toBeLessThan(longContent.length);
      expect(result.relevantFiles[0].content).toContain("[truncated]");
    });

    it("should include recent plan when provided", () => {
      const recentPlan: PlanData = {
        id: "plan-1",
        description: "Deploy nginx with 3 replicas",
      };

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles: [],
        previousMessages: [],
        recentPlan,
      });

      expect(result.recentPlan).toBeDefined();
      expect(result.recentPlan?.id).toBe("plan-1");
      expect(result.recentPlan?.description).toBe("Deploy nginx with 3 replicas");
    });

    it("should filter out current message from previous messages", () => {
      const previousMessages: ChatMessageData[] = [
        { id: "msg-1", prompt: "Hello", response: "Hi there" },
        { id: "msg-2", prompt: "Current message" },
        { id: "msg-3", prompt: "Another", response: "Response" },
      ];

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles: [],
        previousMessages,
        currentMessageId: "msg-2",
      });

      expect(result.previousMessages).toHaveLength(2);
      expect(result.previousMessages.some((m) => m.content === "Current message")).toBe(false);
    });

    it("should convert messages to correct role format", () => {
      const previousMessages: ChatMessageData[] = [
        { id: "msg-1", prompt: "User question", response: "Assistant response" },
      ];

      const result = buildChatContext({
        workspace: baseWorkspace,
        relevantFiles: [],
        previousMessages,
      });

      // Messages with response become assistant messages
      expect(result.previousMessages[0].role).toBe("assistant");
      expect(result.previousMessages[0].content).toBe("Assistant response");
    });

    it("should handle empty workspace charts", () => {
      const emptyWorkspace: WorkspaceData = {
        id: "empty-workspace",
        charts: [],
      };

      const result = buildChatContext({
        workspace: emptyWorkspace,
        relevantFiles: [],
        previousMessages: [],
      });

      expect(result.chartStructure).toBe("No charts in workspace");
    });

    it("should handle charts with no files", () => {
      const emptyChartWorkspace: WorkspaceData = {
        id: "workspace",
        charts: [{ id: "chart-1", files: [] }],
      };

      const result = buildChatContext({
        workspace: emptyChartWorkspace,
        relevantFiles: [],
        previousMessages: [],
      });

      expect(result.chartStructure).toBe("Empty chart");
    });
  });

  describe("estimateContextTokens", () => {
    it("should estimate tokens for a simple context", () => {
      const context = {
        workspaceId: "ws-1",
        chartStructure: "File: Chart.yaml",
        relevantFiles: [{ filePath: "test.yaml", content: "content here" }],
        previousMessages: [{ role: "user" as const, content: "Hello" }],
      };

      const tokens = estimateContextTokens(context);

      // Should be roughly total characters / 4
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe("number");
    });

    it("should include plan description in token estimate", () => {
      const contextWithoutPlan = {
        workspaceId: "ws-1",
        chartStructure: "File: Chart.yaml",
        relevantFiles: [],
        previousMessages: [],
      };

      const contextWithPlan = {
        ...contextWithoutPlan,
        recentPlan: { id: "plan-1", description: "A very long plan description that adds tokens" },
      };

      const tokensWithoutPlan = estimateContextTokens(contextWithoutPlan);
      const tokensWithPlan = estimateContextTokens(contextWithPlan);

      expect(tokensWithPlan).toBeGreaterThan(tokensWithoutPlan);
    });

    it("should handle empty context", () => {
      const emptyContext = {
        workspaceId: "ws-1",
        chartStructure: "",
        relevantFiles: [],
        previousMessages: [],
      };

      const tokens = estimateContextTokens(emptyContext);

      expect(tokens).toBe(0);
    });
  });
});
