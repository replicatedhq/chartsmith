/**
 * Tool Registry
 *
 * Manages AI tools for the chat system. Tools are registered by name
 * and can be retrieved individually or as a collection for the AI SDK.
 */

import type { HttpClient } from "../providers/types";

/**
 * Tool definition that can be registered with the registry
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Factory function signature for creating tools with dependencies
 */
export type ToolFactory = (deps: ToolDependencies) => ToolDefinition;

/**
 * Dependencies available to tools
 */
export interface ToolDependencies {
  httpClient: HttpClient;
}

/**
 * Tool Registry class for managing AI tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private deps: ToolDependencies;

  constructor(deps: ToolDependencies) {
    this.deps = deps;
  }

  /**
   * Register a tool with the registry
   *
   * @param tool - Tool definition or factory function
   * @throws Error if a tool with the same name is already registered
   */
  register(tool: ToolDefinition | ToolFactory): void {
    const toolDef = typeof tool === "function" ? tool(this.deps) : tool;

    if (this.tools.has(toolDef.name)) {
      throw new Error(`Tool "${toolDef.name}" is already registered`);
    }

    this.tools.set(toolDef.name, toolDef);
  }

  /**
   * Get a tool by name
   *
   * @param name - Tool name
   * @returns Tool definition or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   *
   * @param name - Tool name
   * @returns true if the tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all tools as a record for the AI SDK
   *
   * @returns Record of tools compatible with Vercel AI SDK streamText()
   */
  getToolSet(): Record<string, unknown> {
    const toolSet: Record<string, unknown> = {};

    for (const [name, tool] of this.tools) {
      toolSet[name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      };
    }

    return toolSet;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Create a new tool registry with the given dependencies
 */
export function createToolRegistry(deps: ToolDependencies): ToolRegistry {
  return new ToolRegistry(deps);
}
