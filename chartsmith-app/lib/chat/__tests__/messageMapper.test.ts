/**
 * Unit tests for Message Mapper
 *
 * Tests conversions between AI SDK UIMessage format and existing Message format
 */

import type { UIMessage } from "ai";
import type { Message } from "@/components/types";
import {
  extractTextFromParts,
  extractPromptFromUIMessage,
  extractResponseFromUIMessage,
  hasToolInvocations,
  mapStatusToFlags,
  mapUIMessageToMessage,
  mapUIMessagesToMessages,
  mergeMessages,
  isMessageCurrentlyStreaming,
} from "../messageMapper";

describe("messageMapper", () => {
  describe("extractTextFromParts", () => {
    it("should extract text from text parts", () => {
      const parts = [
        { type: "text" as const, text: "Hello" },
        { type: "text" as const, text: "World" },
      ];
      expect(extractTextFromParts(parts)).toBe("Hello\nWorld");
    });

    it("should filter out non-text parts", () => {
      const parts = [
        { type: "text" as const, text: "Hello" },
        { type: "tool-invocation" as const, toolName: "test", args: {} },
        { type: "text" as const, text: "World" },
      ];
      expect(extractTextFromParts(parts as UIMessage["parts"])).toBe(
        "Hello\nWorld"
      );
    });

    it("should return empty string for empty parts", () => {
      expect(extractTextFromParts([])).toBe("");
    });

    it("should return empty string for undefined parts", () => {
      expect(extractTextFromParts(undefined as unknown as UIMessage["parts"])).toBe("");
    });

    it("should handle single text part", () => {
      const parts = [{ type: "text" as const, text: "Single message" }];
      expect(extractTextFromParts(parts)).toBe("Single message");
    });
  });

  describe("extractPromptFromUIMessage", () => {
    it("should extract prompt from user message", () => {
      const message: UIMessage = {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "What is Helm?" }],
      };
      expect(extractPromptFromUIMessage(message)).toBe("What is Helm?");
    });

    it("should return empty string for assistant message", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "Helm is a package manager" }],
      };
      expect(extractPromptFromUIMessage(message)).toBe("");
    });
  });

  describe("extractResponseFromUIMessage", () => {
    it("should extract response from assistant message", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "Helm is a package manager" }],
      };
      expect(extractResponseFromUIMessage(message)).toBe(
        "Helm is a package manager"
      );
    });

    it("should return empty string for user message", () => {
      const message: UIMessage = {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "What is Helm?" }],
      };
      expect(extractResponseFromUIMessage(message)).toBe("");
    });
  });

  describe("hasToolInvocations", () => {
    it("should detect tool invocations", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "inv-1",
            toolName: "textEditor",
            args: { command: "view", path: "/Chart.yaml" },
            state: "output-available",
            input: {},
            output: {},
          } as unknown as UIMessage["parts"][0],
        ],
      };
      expect(hasToolInvocations(message)).toBe(true);
    });

    it("should detect tool results", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "tool-result",
            toolName: "textEditor",
            output: { success: true },
          } as unknown as UIMessage["parts"][0],
        ],
      };
      expect(hasToolInvocations(message)).toBe(true);
    });

    it("should return false for text-only messages", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "Hello" }],
      };
      expect(hasToolInvocations(message)).toBe(false);
    });

    it("should return false for empty parts", () => {
      const message: UIMessage = {
        id: "1",
        role: "assistant",
        parts: [],
      };
      expect(hasToolInvocations(message)).toBe(false);
    });
  });

  describe("mapStatusToFlags", () => {
    it("should map submitted to isThinking=true", () => {
      const flags = mapStatusToFlags("submitted");
      expect(flags.isThinking).toBe(true);
      expect(flags.isStreaming).toBe(false);
      expect(flags.isIntentComplete).toBe(false);
      expect(flags.isComplete).toBe(false);
    });

    it("should map streaming to isStreaming=true", () => {
      const flags = mapStatusToFlags("streaming");
      expect(flags.isThinking).toBe(false);
      expect(flags.isStreaming).toBe(true);
      expect(flags.isIntentComplete).toBe(false);
      expect(flags.isComplete).toBe(false);
    });

    it("should map ready to both false and complete", () => {
      const flags = mapStatusToFlags("ready");
      expect(flags.isThinking).toBe(false);
      expect(flags.isStreaming).toBe(false);
      expect(flags.isIntentComplete).toBe(true);
      expect(flags.isComplete).toBe(true);
    });

    it("should map error to both false and complete", () => {
      const flags = mapStatusToFlags("error");
      expect(flags.isThinking).toBe(false);
      expect(flags.isStreaming).toBe(false);
      expect(flags.isIntentComplete).toBe(true);
      expect(flags.isComplete).toBe(true);
    });
  });

  describe("mapUIMessageToMessage", () => {
    it("should convert user UIMessage to Message", () => {
      const uiMessage: UIMessage = {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Create a Chart.yaml" }],
      };

      const message = mapUIMessageToMessage(uiMessage, {
        workspaceId: "ws-123",
        revisionNumber: 1,
      });

      expect(message.id).toBe("user-1");
      expect(message.prompt).toBe("Create a Chart.yaml");
      expect(message.response).toBeUndefined();
      expect(message.workspaceId).toBe("ws-123");
      expect(message.revisionNumber).toBe(1);
    });

    it("should convert assistant UIMessage to Message", () => {
      const uiMessage: UIMessage = {
        id: "asst-1",
        role: "assistant",
        parts: [{ type: "text", text: "I'll create that file for you." }],
      };

      const message = mapUIMessageToMessage(uiMessage, {
        workspaceId: "ws-123",
        isComplete: true,
      });

      expect(message.id).toBe("asst-1");
      expect(message.prompt).toBe("");
      expect(message.response).toBe("I'll create that file for you.");
      expect(message.isComplete).toBe(true);
      expect(message.isIntentComplete).toBe(true);
    });

    it("should handle isCanceled option", () => {
      const uiMessage: UIMessage = {
        id: "asst-1",
        role: "assistant",
        parts: [{ type: "text", text: "Partial response..." }],
      };

      const message = mapUIMessageToMessage(uiMessage, {
        isCanceled: true,
        isComplete: true,
      });

      expect(message.isCanceled).toBe(true);
    });
  });

  describe("mapUIMessagesToMessages", () => {
    it("should pair user and assistant messages", () => {
      const uiMessages: UIMessage[] = [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
        {
          id: "asst-1",
          role: "assistant",
          parts: [{ type: "text", text: "Hi there!" }],
        },
      ];

      const messages = mapUIMessagesToMessages(uiMessages, {
        workspaceId: "ws-1",
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("user-1");
      expect(messages[0].prompt).toBe("Hello");
      expect(messages[0].response).toBe("Hi there!");
      expect(messages[0].workspaceId).toBe("ws-1");
    });

    it("should handle streaming (incomplete) messages", () => {
      const uiMessages: UIMessage[] = [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
        {
          id: "asst-1",
          role: "assistant",
          parts: [{ type: "text", text: "Thinking..." }],
        },
      ];

      const messages = mapUIMessagesToMessages(uiMessages, {
        isStreaming: true,
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].isComplete).toBe(false);
      expect(messages[0].isIntentComplete).toBe(false);
    });

    it("should handle multiple conversation turns", () => {
      const uiMessages: UIMessage[] = [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "What is Helm?" }],
        },
        {
          id: "asst-1",
          role: "assistant",
          parts: [{ type: "text", text: "Helm is a package manager." }],
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "How do I install it?" }],
        },
        {
          id: "asst-2",
          role: "assistant",
          parts: [{ type: "text", text: "Run brew install helm." }],
        },
      ];

      const messages = mapUIMessagesToMessages(uiMessages);

      expect(messages).toHaveLength(2);
      expect(messages[0].prompt).toBe("What is Helm?");
      expect(messages[0].response).toBe("Helm is a package manager.");
      expect(messages[1].prompt).toBe("How do I install it?");
      expect(messages[1].response).toBe("Run brew install helm.");
    });

    it("should handle user message without response yet", () => {
      const uiMessages: UIMessage[] = [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Create a deployment" }],
        },
      ];

      const messages = mapUIMessagesToMessages(uiMessages);

      expect(messages).toHaveLength(1);
      expect(messages[0].prompt).toBe("Create a deployment");
      expect(messages[0].response).toBeUndefined();
      expect(messages[0].isComplete).toBe(false);
    });

    it("should handle canceled streaming message", () => {
      const uiMessages: UIMessage[] = [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
        {
          id: "asst-1",
          role: "assistant",
          parts: [{ type: "text", text: "Part of response..." }],
        },
      ];

      const messages = mapUIMessagesToMessages(uiMessages, {
        isStreaming: false,
        isCanceled: true,
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].isCanceled).toBe(true);
    });
  });

  describe("mergeMessages", () => {
    it("should not duplicate messages by ID", () => {
      const historical: Message[] = [
        {
          id: "msg-1",
          prompt: "Old message",
          isComplete: true,
        },
      ];
      const streaming: Message[] = [
        {
          id: "msg-1",
          prompt: "New version",
          isComplete: true,
        },
        {
          id: "msg-2",
          prompt: "Brand new",
          isComplete: true,
        },
      ];

      const merged = mergeMessages(historical, streaming);

      expect(merged).toHaveLength(2);
      expect(merged[0].prompt).toBe("Old message"); // Historical takes precedence
      expect(merged[1].id).toBe("msg-2");
    });

    it("should preserve order with historical first", () => {
      const historical: Message[] = [
        { id: "h1", prompt: "First", isComplete: true },
        { id: "h2", prompt: "Second", isComplete: true },
      ];
      const streaming: Message[] = [
        { id: "s1", prompt: "Third", isComplete: true },
      ];

      const merged = mergeMessages(historical, streaming);

      expect(merged).toHaveLength(3);
      expect(merged[0].id).toBe("h1");
      expect(merged[1].id).toBe("h2");
      expect(merged[2].id).toBe("s1");
    });

    it("should handle empty historical array", () => {
      const historical: Message[] = [];
      const streaming: Message[] = [
        { id: "s1", prompt: "First", isComplete: true },
      ];

      const merged = mergeMessages(historical, streaming);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe("s1");
    });

    it("should handle empty streaming array", () => {
      const historical: Message[] = [
        { id: "h1", prompt: "First", isComplete: true },
      ];
      const streaming: Message[] = [];

      const merged = mergeMessages(historical, streaming);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe("h1");
    });
  });

  describe("isMessageCurrentlyStreaming", () => {
    it("should return true when message ID matches streaming ID", () => {
      expect(isMessageCurrentlyStreaming("msg-123", "msg-123")).toBe(true);
    });

    it("should return false when message ID does not match", () => {
      expect(isMessageCurrentlyStreaming("msg-123", "msg-456")).toBe(false);
    });

    it("should return false when streaming ID is null", () => {
      expect(isMessageCurrentlyStreaming("msg-123", null)).toBe(false);
    });

    it("should return false for empty string streaming ID", () => {
      expect(isMessageCurrentlyStreaming("msg-123", "")).toBe(false);
    });
  });
});

