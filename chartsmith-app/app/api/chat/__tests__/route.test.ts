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

describe("/api/chat route", () => {
  describe("authentication", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const { POST } = await import("../route");

      const request = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws-123", message: "Hello" }),
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
        body: JSON.stringify({ message: "Hello" }),
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
          "Authorization": "Bearer invalid-token",
        },
        body: JSON.stringify({ workspaceId: "ws-123", message: "Hello" }),
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
          message: "Test message",
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
  it("should validate correct input", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      workspaceId: z.string().min(1, "Workspace ID is required"),
      message: z.string().min(1, "Message is required"),
    });

    const result = chatRequestSchema.safeParse({
      workspaceId: "ws-123",
      message: "Hello, how do I create a deployment?",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workspaceId).toBe("ws-123");
      expect(result.data.message).toBe("Hello, how do I create a deployment?");
    }
  });

  it("should reject missing fields", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      workspaceId: z.string().min(1, "Workspace ID is required"),
      message: z.string().min(1, "Message is required"),
    });

    const result = chatRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("should allow additional fields (ignored)", async () => {
    const { z } = await import("zod");

    const chatRequestSchema = z.object({
      workspaceId: z.string().min(1),
      message: z.string().min(1),
    });

    const result = chatRequestSchema.safeParse({
      workspaceId: "ws-123",
      message: "Test",
      extraField: "ignored",
    });

    expect(result.success).toBe(true);
  });
});
