/**
 * PR1.5 Integration Tests - AI SDK Tools
 * 
 * These tests verify the tool → Go HTTP → response pattern works correctly.
 * 
 * Prerequisites:
 * - Go HTTP server running on port 8080 (`make run-worker`)
 * - Database accessible with valid connection
 * 
 * Run with: npm test -- tests/integration/tools.test.ts
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

// Helper to call Go endpoints directly (mimics callGoEndpoint from utils.ts)
async function callGoEndpoint<T>(endpoint: string, body: object): Promise<T> {
  const response = await fetch(`${GO_BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  return response.json() as Promise<T>;
}

describe('PR1.5 AI SDK Tools Integration', () => {
  
  // Check if Go server is running before tests
  beforeAll(async () => {
    try {
      const response = await fetch(`${GO_BACKEND_URL}/health`);
      if (!response.ok) {
        console.warn('⚠️  Go HTTP server may not be running on port 8080');
      }
    } catch {
      console.warn('⚠️  Go HTTP server not reachable. Some tests may fail.');
    }
  });

  describe('Health Check', () => {
    test('GET /health returns healthy status', async () => {
      const response = await fetch(`${GO_BACKEND_URL}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('healthy');
    });
  });

  describe('latestKubernetesVersion Tool', () => {
    test('returns patch version by default', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        field: string;
      }>('/api/tools/versions/kubernetes', {});
      
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.32.1');
      expect(result.field).toBe('patch');
    });

    test('returns major version when requested', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        field: string;
      }>('/api/tools/versions/kubernetes', { semverField: 'major' });
      
      expect(result.success).toBe(true);
      expect(result.version).toBe('1');
      expect(result.field).toBe('major');
    });

    test('returns minor version when requested', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        field: string;
      }>('/api/tools/versions/kubernetes', { semverField: 'minor' });
      
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.32');
      expect(result.field).toBe('minor');
    });
  });

  describe('latestSubchartVersion Tool', () => {
    test('returns version for known chart (postgresql)', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        name: string;
      }>('/api/tools/versions/subchart', { chartName: 'postgresql' });
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('postgresql');
      // Version format should be semver-like (e.g., "18.1.13")
      expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('returns version for redis chart', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        name: string;
      }>('/api/tools/versions/subchart', { chartName: 'redis' });
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('redis');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('handles unknown chart gracefully', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        version: string;
        name: string;
      }>('/api/tools/versions/subchart', { chartName: 'nonexistent-chart-12345' });
      
      // Should return success with "?" version for unknown charts
      expect(result.success).toBe(true);
      expect(result.version).toBe('?');
    });

    test('validates required chartName parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/versions/subchart', {});
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('chartName');
    });
  });

  describe('getChartContext Tool', () => {
    test('returns context for valid workspace request', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        charts?: Array<{ id: string; name: string }>;
        revisionNumber?: number;
        message?: string;
      }>('/api/tools/context', { 
        workspaceId: 'test-workspace-id',
        revisionNumber: 1 
      });
      
      // Even with invalid workspace, should return structured response
      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.revisionNumber).toBe(1);
      }
    });

    test('validates required workspaceId parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/context', { revisionNumber: 1 });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('workspaceId');
    });
  });

  describe('textEditor Tool', () => {
    const testWorkspaceId = 'test-workspace-id';
    const testRevisionNumber = 1;

    test('view command returns error for non-existent file', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'view',
        workspaceId: testWorkspaceId,
        path: 'nonexistent-file.yaml',
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    test('validates required command parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        workspaceId: testWorkspaceId,
        path: 'test.yaml',
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('command');
    });

    test('validates required path parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'view',
        workspaceId: testWorkspaceId,
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('path');
    });

    test('validates required workspaceId parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'view',
        path: 'test.yaml',
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('workspaceId');
    });

    test('rejects invalid command', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'invalid-command',
        workspaceId: testWorkspaceId,
        path: 'test.yaml',
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('command');
    });

    test('str_replace requires oldStr parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'str_replace',
        workspaceId: testWorkspaceId,
        path: 'test.yaml',
        revisionNumber: testRevisionNumber,
        newStr: 'replacement',
      });
      
      expect(result.success).toBe(false);
      // Should indicate oldStr is required
    });

    test('create requires content parameter', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
      }>('/api/tools/editor', {
        command: 'create',
        workspaceId: testWorkspaceId,
        path: 'new-file.yaml',
        revisionNumber: testRevisionNumber,
      });
      
      expect(result.success).toBe(false);
      // Should indicate content is required for create
    });
  });

  describe('Error Response Contract', () => {
    test('all error responses have success=false and message', async () => {
      // Test validation error
      const result = await callGoEndpoint<{
        success: boolean;
        message: string;
        code?: string;
      }>('/api/tools/editor', {});
      
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    test('success responses have success=true', async () => {
      const result = await callGoEndpoint<{
        success: boolean;
      }>('/api/tools/versions/kubernetes', { semverField: 'patch' });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Tool Schema Validation', () => {
  // These tests verify the Zod schemas are correctly defined
  // by checking that the tools module exports correctly
  
  test('all tool factories are exported', async () => {
    // Dynamic import to avoid issues if tools have side effects
    const tools = await import('../../tools');
    
    expect(typeof tools.createGetChartContextTool).toBe('function');
    expect(typeof tools.createTextEditorTool).toBe('function');
    expect(typeof tools.createLatestSubchartVersionTool).toBe('function');
    expect(typeof tools.createLatestKubernetesVersionTool).toBe('function');
    expect(typeof tools.createTools).toBe('function');
  });

  test('createTools returns all 4 tools', async () => {
    const { createTools } = await import('../../tools');
    
    const tools = createTools('test-auth-header', 'test-workspace-id', 1);
    
    expect(tools).toHaveProperty('getChartContext');
    expect(tools).toHaveProperty('textEditor');
    expect(tools).toHaveProperty('latestSubchartVersion');
    expect(tools).toHaveProperty('latestKubernetesVersion');
  });

  test('callGoEndpoint utility is exported', async () => {
    const { callGoEndpoint } = await import('../../tools');
    
    expect(typeof callGoEndpoint).toBe('function');
  });
});

