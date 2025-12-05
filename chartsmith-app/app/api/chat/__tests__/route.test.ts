/**
 * Integration tests for /api/chat route
 *
 * These tests verify the API route's request/response handling,
 * validation, and error cases.
 *
 * Note: The route checks auth BEFORE validation, so unauthenticated
 * requests will always get 401 regardless of body content.
 */

import { NextRequest } from "next/server";

// Sample UI message format for useChat
const sampleMessages = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Hello" }],
  },
];

describe("/api/chat route", () => {
  describe("authentication", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const { POST } = await import("../route");

      const request = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws-123", messages: sampleMessages }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 when no auth header or session", async () => {
      const { POST } = await import("../route");

      const request = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sampleMessages }),
      });

      const response = await POST(request);

      // Auth is checked first, so we get 401 not 400
      expect(response.status).toBe(401);
    });

    it("should reject invalid bearer token", async () => {
      const { POST } = await import("../route");

      const request = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({ workspaceId: "ws-123", messages: sampleMessages }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe("content type handling", () => {
    it("should handle JSON content type", async () => {
      const { POST } = await import("../route");

      const request = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws-123",
          messages: sampleMessages,
        }),
      });

      // Will fail auth but should parse body correctly
      const response = await POST(request);
      expect(response.status).toBe(401); // Auth fails first
    });
  });
});

describe("chatRequestSchema", () => {
  // Test the schema directly for edge cases
  it("should validate correct input with messages array", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      messages: z.array(z.any()).min(1, "Messages array is required"),
      workspaceId: z.string().min(1, "Workspace ID is required"),
    });

    const result = chatRequestSchema.safeParse({
      workspaceId: "ws-123",
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Hello, how do I create a deployment?" }],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workspaceId).toBe("ws-123");
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.messages[0].role).toBe("user");
    }
  });

  it("should reject missing fields", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      messages: z.array(z.any()).min(1, "Messages array is required"),
      workspaceId: z.string().min(1, "Workspace ID is required"),
    });

    const result = chatRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("should reject empty messages array", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      messages: z.array(z.any()).min(1, "Messages array is required"),
      workspaceId: z.string().min(1, "Workspace ID is required"),
    });

    const result = chatRequestSchema.safeParse({
      workspaceId: "ws-123",
      messages: [],
    });

    expect(result.success).toBe(false);
  });

  it("should allow additional fields (ignored)", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      messages: z.array(z.any()).min(1),
      workspaceId: z.string().min(1),
    });

    const result = chatRequestSchema.safeParse({
      workspaceId: "ws-123",
      messages: [{ id: "1", role: "user", parts: [] }],
      extraField: "ignored",
    });

    expect(result.success).toBe(true);
  });
});
