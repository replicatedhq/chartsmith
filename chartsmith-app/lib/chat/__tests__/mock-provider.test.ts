/**
 * Unit tests for providers/mock.ts
 */

import {
  MockProvider,
  createMockProvider,
  type MockResponse,
  type MockProviderConfig,
} from "../providers/mock";

describe("MockProvider", () => {
  describe("constructor", () => {
    it("should create provider with default response", () => {
      const provider = new MockProvider();

      expect(provider.providerId).toBe("mock");
      expect(provider.callHistory).toHaveLength(0);
    });

    it("should create provider with custom default response", () => {
      const config: MockProviderConfig = {
        defaultResponse: { text: "Custom default", delayMs: 100 },
      };
      const provider = new MockProvider(config);

      expect(provider.providerId).toBe("mock");
    });

    it("should create provider with pre-configured responses", () => {
      const config: MockProviderConfig = {
        responses: [
          { text: "First response" },
          { text: "Second response" },
        ],
      };
      const provider = new MockProvider(config);

      expect(provider.providerId).toBe("mock");
    });
  });

  describe("streamChat", () => {
    it("should return mock stream result", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Hello, world!" },
      });

      const result = await provider.streamChat({
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.textStream).toBeDefined();
    });

    it("should record call in history", async () => {
      const provider = new MockProvider();
      const params = {
        messages: [{ role: "user" as const, content: "Test message" }],
      };

      await provider.streamChat(params);

      expect(provider.callHistory).toHaveLength(1);
      expect(provider.callHistory[0].method).toBe("streamChat");
      expect(provider.callHistory[0].params).toEqual(params);
    });

    it("should return sequential responses from queue", async () => {
      const provider = new MockProvider({
        responses: [
          { text: "First" },
          { text: "Second" },
          { text: "Third" },
        ],
        defaultResponse: { text: "Default" },
      });

      const result1 = await provider.streamChat({ messages: [] });
      const result2 = await provider.streamChat({ messages: [] });
      const result3 = await provider.streamChat({ messages: [] });
      const result4 = await provider.streamChat({ messages: [] });

      expect(await result1.text).toBe("First");
      expect(await result2.text).toBe("Second");
      expect(await result3.text).toBe("Third");
      expect(await result4.text).toBe("Default"); // Falls back to default
    });

    it("should provide toTextStreamResponse method", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Stream response" },
      });

      const result = await provider.streamChat({ messages: [] });
      const response = result.toTextStreamResponse();

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
    });

    it("should provide toDataStreamResponse method", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Data stream" },
      });

      const result = await provider.streamChat({ messages: [] });
      const response = result.toDataStreamResponse();

      expect(response).toBeInstanceOf(Response);
    });
  });

  describe("generateText", () => {
    it("should return text directly", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Generated text" },
      });

      const result = await provider.generateText({
        messages: [{ role: "user", content: "Generate" }],
      });

      expect(result.text).toBe("Generated text");
    });

    it("should record call in history", async () => {
      const provider = new MockProvider();

      await provider.generateText({
        messages: [{ role: "user", content: "Test" }],
      });

      expect(provider.callHistory).toHaveLength(1);
      expect(provider.callHistory[0].method).toBe("generateText");
    });

    it("should respect delay configuration", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Delayed", delayMs: 50 },
      });

      const start = Date.now();
      await provider.generateText({ messages: [] });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
    });
  });

  describe("callHistory", () => {
    it("should track multiple calls", async () => {
      const provider = new MockProvider();

      await provider.streamChat({ messages: [] });
      await provider.generateText({ messages: [] });
      await provider.streamChat({ messages: [] });

      expect(provider.callHistory).toHaveLength(3);
      expect(provider.callHistory[0].method).toBe("streamChat");
      expect(provider.callHistory[1].method).toBe("generateText");
      expect(provider.callHistory[2].method).toBe("streamChat");
    });

    it("should include timestamps", async () => {
      const provider = new MockProvider();
      const before = new Date();

      await provider.streamChat({ messages: [] });

      const after = new Date();
      expect(provider.callHistory[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(provider.callHistory[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("clearHistory", () => {
    it("should clear all call history", async () => {
      const provider = new MockProvider();

      await provider.streamChat({ messages: [] });
      await provider.streamChat({ messages: [] });

      expect(provider.callHistory).toHaveLength(2);

      provider.clearHistory();

      expect(provider.callHistory).toHaveLength(0);
    });

    it("should reset response index", async () => {
      const provider = new MockProvider({
        responses: [{ text: "First" }, { text: "Second" }],
      });

      await provider.streamChat({ messages: [] });
      const result1 = await provider.streamChat({ messages: [] });
      expect(await result1.text).toBe("Second");

      provider.clearHistory();

      const result2 = await provider.streamChat({ messages: [] });
      expect(await result2.text).toBe("First"); // Starts from beginning
    });
  });

  describe("addResponse", () => {
    it("should add response to queue", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Default" },
      });

      provider.addResponse({ text: "Added" });

      const result = await provider.streamChat({ messages: [] });
      expect(await result.text).toBe("Added");
    });
  });

  describe("setDefaultResponse", () => {
    it("should update default response", async () => {
      const provider = new MockProvider({
        defaultResponse: { text: "Original" },
      });

      provider.setDefaultResponse({ text: "Updated" });

      const result = await provider.streamChat({ messages: [] });
      expect(await result.text).toBe("Updated");
    });
  });

  describe("tool calls", () => {
    it("should include tool calls in response", async () => {
      const provider = new MockProvider({
        defaultResponse: {
          text: "I'll check that for you.",
          toolCalls: [
            { toolName: "get-version", args: { package: "nginx" } },
          ],
        },
      });

      const result = await provider.streamChat({ messages: [] });
      // Cast to access mock-specific toolCalls property
      const mockResult = result as unknown as { toolCalls: Promise<Array<{ toolName: string; args: Record<string, unknown> }>> };
      const toolCalls = await mockResult.toolCalls;

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("get-version");
      expect(toolCalls[0].args).toEqual({ package: "nginx" });
    });

    it("should handle multiple tool calls", async () => {
      const provider = new MockProvider({
        defaultResponse: {
          text: "Checking...",
          toolCalls: [
            { toolName: "tool-1", args: { a: 1 } },
            { toolName: "tool-2", args: { b: 2 } },
          ],
        },
      });

      const result = await provider.streamChat({ messages: [] });
      // Cast to access mock-specific toolCalls property
      const mockResult = result as unknown as { toolCalls: Promise<Array<{ toolName: string; args: Record<string, unknown> }>> };
      const toolCalls = await mockResult.toolCalls;

      expect(toolCalls).toHaveLength(2);
    });
  });
});

describe("createMockProvider", () => {
  it("should create provider instance", () => {
    const provider = createMockProvider();

    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("should pass config to provider", async () => {
    const provider = createMockProvider({
      defaultResponse: { text: "Factory response" },
    });

    const result = await provider.streamChat({ messages: [] });
    expect(await result.text).toBe("Factory response");
  });
});
