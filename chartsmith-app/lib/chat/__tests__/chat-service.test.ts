/**
 * Integration tests for chat-service.ts
 */

import { ChatService, createChatService } from "../chat-service";
import { MockProvider } from "../providers/mock";
import type { WorkspaceContext } from "../providers/types";

describe("ChatService", () => {
  const mockContext: WorkspaceContext = {
    workspaceId: "test-workspace",
    chartStructure: "File: Chart.yaml\nFile: values.yaml",
    relevantFiles: [
      { filePath: "Chart.yaml", content: "name: test-chart\nversion: 1.0.0" },
    ],
    previousMessages: [],
  };

  describe("constructor", () => {
    it("should create service with mock provider", () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      expect(service).toBeDefined();
      expect(service.getProviderId()).toBe("mock");
    });

    it("should accept custom tools", () => {
      const provider = new MockProvider();
      const customTools = {
        "custom-tool": { description: "A custom tool" },
      };

      const service = new ChatService({ provider, tools: customTools });

      expect(service).toBeDefined();
    });
  });

  describe("streamResponse", () => {
    it("should stream response with mock provider", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "This is a test response about Helm charts." },
      });
      const service = new ChatService({ provider });

      const result = await service.streamResponse({
        context: mockContext,
        userMessage: "How do I add a deployment?",
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();

      const text = await result.text;
      expect(text).toBe("This is a test response about Helm charts.");
    });

    it("should pass messages to provider", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      await service.streamResponse({
        context: mockContext,
        userMessage: "What is in my Chart.yaml?",
      });

      expect(provider.callHistory).toHaveLength(1);
      const call = provider.callHistory[0];

      // Verify messages include the user message
      const messages = call.params.messages ?? [];
      const userMessage = messages.find(
        (m) => m.role === "user" && String(m.content) === "What is in my Chart.yaml?"
      );
      expect(userMessage).toBeDefined();
    });

    it("should include system prompt", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      await service.streamResponse({
        context: mockContext,
        userMessage: "Help",
      });

      const call = provider.callHistory[0];
      expect(call.params.system).toBeDefined();
      expect(call.params.system).toContain("ChartSmith");
    });

    it("should pass maxTokens parameter", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      await service.streamResponse({
        context: mockContext,
        userMessage: "Short response please",
        maxTokens: 100,
      });

      const call = provider.callHistory[0];
      expect(call.params.maxTokens).toBe(100);
    });

    it("should pass temperature parameter", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      await service.streamResponse({
        context: mockContext,
        userMessage: "Be creative",
        temperature: 0.9,
      });

      const call = provider.callHistory[0];
      expect(call.params.temperature).toBe(0.9);
    });

    it("should include tools in the request", async () => {
      const provider = new MockProvider();
      const customTools = {
        "test-tool": {
          description: "A test tool",
          execute: async () => "result",
        },
      };
      const service = new ChatService({ provider, tools: customTools });

      await service.streamResponse({
        context: mockContext,
        userMessage: "Use the tool",
      });

      const call = provider.callHistory[0];
      expect(call.params.tools).toBeDefined();
      const tools = call.params.tools as Record<string, unknown>;
      expect(tools["test-tool"]).toBeDefined();
    });

    it("should handle context with previous messages", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      const contextWithHistory: WorkspaceContext = {
        ...mockContext,
        previousMessages: [
          { role: "user", content: "Previous question" },
          { role: "assistant", content: "Previous answer" },
        ],
      };

      await service.streamResponse({
        context: contextWithHistory,
        userMessage: "Follow up question",
      });

      const call = provider.callHistory[0];
      const messages = call.params.messages ?? [];

      // Should include previous conversation
      const prevUserMsg = messages.find(
        (m) => String(m.content) === "Previous question"
      );
      expect(prevUserMsg).toBeDefined();
    });

    it("should handle context with recent plan", async () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      const contextWithPlan: WorkspaceContext = {
        ...mockContext,
        recentPlan: {
          id: "plan-1",
          description: "Deploy nginx with 3 replicas and custom config",
        },
      };

      await service.streamResponse({
        context: contextWithPlan,
        userMessage: "What was the plan?",
      });

      const call = provider.callHistory[0];
      const messages = call.params.messages ?? [];

      // Should include plan description
      const planMsg = messages.find(
        (m) => String(m.content).includes("Deploy nginx with 3 replicas")
      );
      expect(planMsg).toBeDefined();
    });
  });

  describe("getProviderId", () => {
    it("should return provider ID", () => {
      const provider = new MockProvider();
      const service = new ChatService({ provider });

      expect(service.getProviderId()).toBe("mock");
    });
  });
});

describe("createChatService", () => {
  it("should create a ChatService instance", () => {
    const provider = new MockProvider();
    const service = createChatService({ provider });

    expect(service).toBeInstanceOf(ChatService);
  });

  it("should pass dependencies to service", async () => {
    const provider = new MockProvider({
      defaultResponse: { text: "Factory created response" },
    });
    const service = createChatService({ provider });

    const result = await service.streamResponse({
      context: {
        workspaceId: "ws",
        chartStructure: "",
        relevantFiles: [],
        previousMessages: [],
      },
      userMessage: "Test",
    });

    expect(await result.text).toBe("Factory created response");
  });
});

describe("ChatService integration flow", () => {
  it("should complete full context → messages → stream flow", async () => {
    const provider = new MockProvider({
      defaultResponse: {
        text: "Here is how to add a Deployment to your Helm chart...",
      },
    });
    const service = createChatService({ provider });

    const context: WorkspaceContext = {
      workspaceId: "integration-test",
      chartStructure: "File: Chart.yaml\nFile: values.yaml\nFile: templates/deployment.yaml",
      relevantFiles: [
        {
          filePath: "values.yaml",
          content: "replicaCount: 1\nimage:\n  repository: nginx\n  tag: latest",
        },
        {
          filePath: "templates/deployment.yaml",
          content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ .Release.Name }}",
        },
      ],
      previousMessages: [
        { role: "user", content: "I want to deploy nginx" },
        { role: "assistant", content: "I'll help you create a deployment for nginx." },
      ],
      recentPlan: {
        id: "plan-123",
        description: "Create nginx deployment with configurable replicas",
      },
    };

    const result = await service.streamResponse({
      context,
      userMessage: "How do I increase the replica count?",
      maxTokens: 2048,
    });

    // Verify the response
    const text = await result.text;
    expect(text).toContain("Helm chart");

    // Verify the provider received all context
    const call = provider.callHistory[0];
    expect(call.params.messages).toBeDefined();
    expect(call.params.system).toContain("ChartSmith");
    expect(call.params.maxTokens).toBe(2048);

    // Verify messages include all parts
    const messages = call.params.messages ?? [];

    // Has chart structure context
    const structureMsg = messages.find(
      (m) => String(m.content).includes("chart that has the following structure")
    );
    expect(structureMsg).toBeDefined();

    // Has file contents
    const fileMsg = messages.find(
      (m) => String(m.content).includes("values.yaml")
    );
    expect(fileMsg).toBeDefined();

    // Has the current user message
    const currentUserMsg = messages.find(
      (m) => m.role === "user" && String(m.content) === "How do I increase the replica count?"
    );
    expect(currentUserMsg).toBeDefined();
  });

  it("should handle streaming text response", async () => {
    const provider = new MockProvider({
      defaultResponse: { text: "Chunk1 Chunk2 Chunk3" },
    });
    const service = createChatService({ provider });

    const result = await service.streamResponse({
      context: {
        workspaceId: "stream-test",
        chartStructure: "",
        relevantFiles: [],
        previousMessages: [],
      },
      userMessage: "Stream test",
    });

    // Read from text stream
    const reader = result.textStream.getReader();
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("").trim()).toBe("Chunk1 Chunk2 Chunk3");
  });

  it("should handle tool calls in response", async () => {
    const provider = new MockProvider({
      defaultResponse: {
        text: "Let me check the Kubernetes version for you.",
        toolCalls: [
          { toolName: "kubernetes-version", args: {} },
        ],
      },
    });
    const service = createChatService({ provider });

    const result = await service.streamResponse({
      context: {
        workspaceId: "tool-test",
        chartStructure: "",
        relevantFiles: [],
        previousMessages: [],
      },
      userMessage: "What is the latest Kubernetes version?",
    });

    // The mock provider includes toolCalls in the response
    // Cast to access the mock-specific property
    const mockResult = result as unknown as { toolCalls: Promise<Array<{ toolName: string; args: Record<string, unknown> }>> };
    const toolCalls = await mockResult.toolCalls;
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].toolName).toBe("kubernetes-version");
  });
});
