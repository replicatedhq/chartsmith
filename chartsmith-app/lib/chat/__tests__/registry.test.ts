/**
 * Unit tests for tools/registry.ts
 */

import {
  ToolRegistry,
  createToolRegistry,
  type ToolDefinition,
  type ToolDependencies,
  type ToolFactory,
} from "../tools/registry";
import type { HttpClient } from "../providers/types";

describe("ToolRegistry", () => {
  // Mock HTTP client for dependencies
  const mockHttpClient: HttpClient = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockDeps: ToolDependencies = {
    httpClient: mockHttpClient,
  };

  // Sample tool definition
  const sampleTool: ToolDefinition = {
    name: "test-tool",
    description: "A test tool for unit tests",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    },
    execute: jest.fn().mockResolvedValue("test result"),
  };

  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry(mockDeps);
  });

  describe("constructor", () => {
    it("should create an empty registry", () => {
      expect(registry.getToolNames()).toHaveLength(0);
    });
  });

  describe("register", () => {
    it("should register a tool definition", () => {
      registry.register(sampleTool);

      expect(registry.has("test-tool")).toBe(true);
      expect(registry.get("test-tool")).toBeDefined();
    });

    it("should register a tool factory", () => {
      const toolFactory: ToolFactory = (deps) => ({
        name: "factory-tool",
        description: "Created by factory",
        parameters: {},
        execute: async () => "factory result",
      });

      registry.register(toolFactory);

      expect(registry.has("factory-tool")).toBe(true);
    });

    it("should throw error for duplicate tool names", () => {
      registry.register(sampleTool);

      expect(() => registry.register(sampleTool)).toThrow(
        'Tool "test-tool" is already registered'
      );
    });

    it("should register multiple different tools", () => {
      const tool1: ToolDefinition = { ...sampleTool, name: "tool-1" };
      const tool2: ToolDefinition = { ...sampleTool, name: "tool-2" };
      const tool3: ToolDefinition = { ...sampleTool, name: "tool-3" };

      registry.register(tool1);
      registry.register(tool2);
      registry.register(tool3);

      expect(registry.getToolNames()).toHaveLength(3);
      expect(registry.has("tool-1")).toBe(true);
      expect(registry.has("tool-2")).toBe(true);
      expect(registry.has("tool-3")).toBe(true);
    });
  });

  describe("get", () => {
    it("should return registered tool", () => {
      registry.register(sampleTool);

      const tool = registry.get("test-tool");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("test-tool");
      expect(tool?.description).toBe("A test tool for unit tests");
    });

    it("should return undefined for unregistered tool", () => {
      const tool = registry.get("nonexistent-tool");

      expect(tool).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered tool", () => {
      registry.register(sampleTool);

      expect(registry.has("test-tool")).toBe(true);
    });

    it("should return false for unregistered tool", () => {
      expect(registry.has("nonexistent-tool")).toBe(false);
    });
  });

  describe("getToolNames", () => {
    it("should return empty array for empty registry", () => {
      expect(registry.getToolNames()).toEqual([]);
    });

    it("should return all registered tool names", () => {
      registry.register({ ...sampleTool, name: "tool-a" });
      registry.register({ ...sampleTool, name: "tool-b" });
      registry.register({ ...sampleTool, name: "tool-c" });

      const names = registry.getToolNames();

      expect(names).toHaveLength(3);
      expect(names).toContain("tool-a");
      expect(names).toContain("tool-b");
      expect(names).toContain("tool-c");
    });
  });

  describe("getToolSet", () => {
    it("should return empty object for empty registry", () => {
      const toolSet = registry.getToolSet();

      expect(toolSet).toEqual({});
    });

    it("should return tools in AI SDK format", () => {
      registry.register(sampleTool);

      const toolSet = registry.getToolSet();

      expect(toolSet["test-tool"]).toBeDefined();
      expect((toolSet["test-tool"] as any).description).toBe("A test tool for unit tests");
      expect((toolSet["test-tool"] as any).parameters).toBeDefined();
      expect((toolSet["test-tool"] as any).execute).toBeDefined();
    });

    it("should include all registered tools", () => {
      registry.register({ ...sampleTool, name: "tool-1" });
      registry.register({ ...sampleTool, name: "tool-2" });

      const toolSet = registry.getToolSet();

      expect(Object.keys(toolSet)).toHaveLength(2);
      expect(toolSet["tool-1"]).toBeDefined();
      expect(toolSet["tool-2"]).toBeDefined();
    });
  });

  describe("clear", () => {
    it("should remove all registered tools", () => {
      registry.register({ ...sampleTool, name: "tool-1" });
      registry.register({ ...sampleTool, name: "tool-2" });

      expect(registry.getToolNames()).toHaveLength(2);

      registry.clear();

      expect(registry.getToolNames()).toHaveLength(0);
      expect(registry.has("tool-1")).toBe(false);
      expect(registry.has("tool-2")).toBe(false);
    });
  });

  describe("tool execution", () => {
    it("should allow executing registered tool", async () => {
      const mockExecute = jest.fn().mockResolvedValue({ result: "success" });
      const executableTool: ToolDefinition = {
        ...sampleTool,
        name: "executable-tool",
        execute: mockExecute,
      };

      registry.register(executableTool);

      const tool = registry.get("executable-tool");
      const result = await tool?.execute({ input: "test" });

      expect(mockExecute).toHaveBeenCalledWith({ input: "test" });
      expect(result).toEqual({ result: "success" });
    });
  });
});

describe("createToolRegistry", () => {
  it("should create a new registry instance", () => {
    const mockDeps: ToolDependencies = {
      httpClient: { get: jest.fn(), post: jest.fn() },
    };

    const registry = createToolRegistry(mockDeps);

    expect(registry).toBeInstanceOf(ToolRegistry);
    expect(registry.getToolNames()).toHaveLength(0);
  });
});
