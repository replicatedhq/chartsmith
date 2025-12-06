/**
 * PR3.0: Tool Call Interceptor
 *
 * Provides infrastructure for buffering tool calls during AI SDK streaming.
 * Only file-modifying tools (textEditor with create/str_replace) are buffered.
 * Read-only tools execute immediately.
 */

/**
 * Represents a buffered tool call that will be executed on Proceed
 */
export interface BufferedToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

/**
 * Tool interceptor interface for managing buffered tool calls
 */
export interface ToolInterceptor {
  /** Current buffer of tool calls */
  readonly buffer: BufferedToolCall[];

  /** Whether buffering is enabled */
  readonly shouldBuffer: boolean;

  /**
   * Intercept a tool call and add it to the buffer
   * @param toolCallId - The unique ID of the tool call
   * @param toolName - The name of the tool being called
   * @param args - The arguments passed to the tool
   * @returns The buffered tool call object
   */
  intercept(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>
  ): BufferedToolCall;

  /** Clear all buffered tool calls */
  clear(): void;

  /** Get a copy of all buffered tool calls */
  getBufferedCalls(): BufferedToolCall[];

  /** Check if there are any buffered tool calls */
  hasBufferedCalls(): boolean;
}

/**
 * Creates a new tool interceptor for buffering tool calls
 *
 * @returns A ToolInterceptor instance
 */
export function createToolInterceptor(): ToolInterceptor {
  let buffer: BufferedToolCall[] = [];
  const shouldBuffer = true; // Always buffer for plan workflow

  return {
    get buffer() {
      return buffer;
    },
    get shouldBuffer() {
      return shouldBuffer;
    },

    intercept(
      toolCallId: string,
      toolName: string,
      args: Record<string, unknown>
    ): BufferedToolCall {
      const buffered: BufferedToolCall = {
        id: toolCallId,
        toolName,
        args,
        timestamp: Date.now(),
      };

      if (shouldBuffer) {
        buffer.push(buffered);
      }

      return buffered;
    },

    clear() {
      buffer = [];
    },

    getBufferedCalls(): BufferedToolCall[] {
      return [...buffer];
    },

    hasBufferedCalls(): boolean {
      return buffer.length > 0;
    },
  };
}

/**
 * Determines if a tool call should be buffered based on tool name and command
 *
 * Per Decision 3 in PRD:
 * - textEditor with 'view' → execute immediately (read-only)
 * - textEditor with 'create' → buffer
 * - textEditor with 'str_replace' → buffer
 * - Other tools → execute immediately (read-only)
 *
 * @param toolName - The name of the tool
 * @param args - The arguments passed to the tool
 * @returns true if the tool call should be buffered
 */
export function shouldBufferToolCall(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  if (toolName === "textEditor") {
    const command = args.command as string | undefined;
    return command === "create" || command === "str_replace";
  }
  return false;
}

