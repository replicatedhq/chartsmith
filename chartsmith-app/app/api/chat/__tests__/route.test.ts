/**
 * Integration tests for /api/chat route
 *
 * Tests authentication boundary - the only external contract that matters.
 * Schema validation is handled by Zod + TypeScript at compile time.
 */

import { NextRequest } from "next/server";
import type { UIMessage } from "ai";

const sampleMessages: UIMessage[] = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Hello" }],
  },
];

describe("/api/chat route", () => {
  describe("authentication", () => {
    it("should return 401 for requests without valid authentication", async () => {
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
  });
});
