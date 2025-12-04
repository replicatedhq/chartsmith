/**
 * Unit tests for message-builder.ts
 */

import {
  buildMessages,
  getSystemPrompt,
  buildIntentClassificationMessages,
  formatToolResult,
} from "../message-builder";
import { CHAT_SYSTEM_PROMPT } from "../prompts/system";
import type { WorkspaceContext } from "../providers/types";

describe("message-builder", () => {
  const baseContext: WorkspaceContext = {
    workspaceId: "ws-123",
    chartStructure: "File: Chart.yaml\nFile: values.yaml",
    relevantFiles: [],
    previousMessages: [],
  };

  describe("buildMessages", () => {
    it("should build messages with user message", () => {
      const messages = buildMessages(baseContext, {
        userMessage: "How do I add a service?",
      });

      // Should include instructions, chart structure, and user message
      expect(messages.length).toBeGreaterThan(0);

      // Last message should be the user message
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.role).toBe("user");
      expect(lastMessage.content).toBe("How do I add a service?");
    });

    it("should include chart structure context", () => {
      const messages = buildMessages(baseContext, {
        userMessage: "Question",
      });

      const structureMessage = messages.find(
        (m) => typeof m.content === "string" && m.content.includes("chart that has the following structure")
      );
      expect(structureMessage).toBeDefined();
      expect(structureMessage?.content).toContain("Chart.yaml");
    });

    it("should include relevant file contents", () => {
      const contextWithFiles: WorkspaceContext = {
        ...baseContext,
        relevantFiles: [
          { filePath: "templates/deployment.yaml", content: "kind: Deployment" },
        ],
      };

      const messages = buildMessages(contextWithFiles, {
        userMessage: "Question",
      });

      const fileMessage = messages.find(
        (m) => typeof m.content === "string" && m.content.includes("templates/deployment.yaml")
      );
      expect(fileMessage).toBeDefined();
      expect(fileMessage?.content).toContain("kind: Deployment");
    });

    it("should include multiple relevant files", () => {
      const contextWithFiles: WorkspaceContext = {
        ...baseContext,
        relevantFiles: [
          { filePath: "file1.yaml", content: "content1" },
          { filePath: "file2.yaml", content: "content2" },
          { filePath: "file3.yaml", content: "content3" },
        ],
      };

      const messages = buildMessages(contextWithFiles, {
        userMessage: "Question",
      });

      const fileMessages = messages.filter(
        (m) => typeof m.content === "string" && m.content.includes("File:")
      );
      // At least 3 file messages (may include chart structure message too)
      expect(fileMessages.length).toBeGreaterThanOrEqual(3);
    });

    it("should include recent plan description", () => {
      const contextWithPlan: WorkspaceContext = {
        ...baseContext,
        recentPlan: {
          id: "plan-1",
          description: "Deploy nginx with custom config",
        },
      };

      const messages = buildMessages(contextWithPlan, {
        userMessage: "Question",
      });

      const planMessage = messages.find(
        (m) => typeof m.content === "string" && m.content.includes("Deploy nginx with custom config")
      );
      expect(planMessage).toBeDefined();
    });

    it("should include previous conversation messages", () => {
      const contextWithHistory: WorkspaceContext = {
        ...baseContext,
        previousMessages: [
          { role: "user", content: "Previous question" },
          { role: "assistant", content: "Previous answer" },
        ],
      };

      const messages = buildMessages(contextWithHistory, {
        userMessage: "Current question",
      });

      const prevUserMsg = messages.find(
        (m) => m.role === "user" && m.content === "Previous question"
      );
      const prevAssistantMsg = messages.find(
        (m) => m.role === "assistant" && m.content === "Previous answer"
      );

      expect(prevUserMsg).toBeDefined();
      expect(prevAssistantMsg).toBeDefined();
    });

    it("should place user message last", () => {
      const contextWithHistory: WorkspaceContext = {
        ...baseContext,
        previousMessages: [
          { role: "user", content: "Previous" },
          { role: "assistant", content: "Response" },
        ],
      };

      const messages = buildMessages(contextWithHistory, {
        userMessage: "Current question",
      });

      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.role).toBe("user");
      expect(lastMessage.content).toBe("Current question");
    });
  });

  describe("getSystemPrompt", () => {
    it("should return default system prompt when no custom prompt provided", () => {
      const prompt = getSystemPrompt();

      expect(prompt).toBe(CHAT_SYSTEM_PROMPT);
      expect(prompt).toContain("ChartSmith");
    });

    it("should return custom prompt when provided", () => {
      const customPrompt = "You are a custom assistant.";
      const prompt = getSystemPrompt(customPrompt);

      expect(prompt).toBe(customPrompt);
    });
  });

  describe("buildIntentClassificationMessages", () => {
    it("should return single user message", () => {
      const messages = buildIntentClassificationMessages("Is this a plan or chat?");

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Is this a plan or chat?");
    });

    it("should handle empty message", () => {
      const messages = buildIntentClassificationMessages("");

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("");
    });
  });

  describe("formatToolResult", () => {
    it("should format string result", () => {
      const result = formatToolResult("kubernetes-version", "1.28.0");

      expect(result).toBe("Tool kubernetes-version returned: 1.28.0");
    });

    it("should format object result as JSON", () => {
      const result = formatToolResult("subchart-version", { name: "nginx", version: "15.0.0" });

      expect(result).toContain("Tool subchart-version returned:");
      expect(result).toContain("nginx");
      expect(result).toContain("15.0.0");
    });

    it("should handle null result", () => {
      const result = formatToolResult("test-tool", null);

      expect(result).toBe("Tool test-tool returned: null");
    });

    it("should handle array result", () => {
      const result = formatToolResult("list-tool", ["item1", "item2"]);

      expect(result).toContain('["item1","item2"]');
    });
  });
});
