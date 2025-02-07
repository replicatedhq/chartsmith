import { applyPatch } from '../patch';
import { WorkspaceFile } from '../../types/workspace';
import { logger } from '../../utils/logger';

// Mock the logger
jest.mock('../../utils/logger');

describe('applyPatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return file unchanged if no pending patch', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'original content',
      pendingPatch: undefined
    };

    const result = await applyPatch(file);
    expect(result).toEqual(file);
  });

  it('should apply a simple one-line replacement patch', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'line 1\nline 2\nline 3',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -2,1 +2,1 @@
-line 2
+new line 2`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('line 1\nnew line 2\nline 3');
    expect(result.pendingPatch).toBeUndefined();
  });

  it('should apply multiple hunks in a patch', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'line 1\nline 2\nline 3\nline 4',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -1,2 +1,2 @@
-line 1
+new line 1
 line 2
@@ -3,2 +3,2 @@
-line 3
+new line 3
 line 4`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('new line 1\nline 2\nnew line 3\nline 4');
  });

  it('should handle patches that add new lines', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'line 1\nline 2',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -1,2 +1,4 @@
 line 1
+new line
+another new line
 line 2`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('line 1\nnew line\nanother new line\nline 2');
  });

  it('should handle patches that remove lines', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'line 1\nline to remove\nline 2',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -1,3 +1,2 @@
 line 1
-line to remove
 line 2`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('line 1\nline 2');
  });

  it('should handle patches with context lines', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'line 1\nline 2\nline 3\nline 4\nline 5',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -1,5 +1,5 @@
 line 1
-line 2
+new line 2
 line 3
-line 4
+new line 4
 line 5`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('line 1\nnew line 2\nline 3\nnew line 4\nline 5');
  });

  it('should throw error for invalid hunk header', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'original content',
      pendingPatch: `--- test.txt
+++ test.txt
@@ invalid hunk header @@
+new content`
    };

    await expect(applyPatch(file)).rejects.toThrow('Failed to apply patch');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to parse hunk header',
      expect.any(Object)
    );
  });

  it('should handle empty files', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: '',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -0,0 +1,1 @@
+new content`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('new content');
  });

  it('should ignore file headers in patch', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'original',
      pendingPatch: `diff --git a/test.txt b/test.txt
index 1234567..89abcdef 100644
--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-original
+modified`
    };

    const result = await applyPatch(file);
    expect(result.content).toBe('modified');
  });

  it('should log patch application progress', async () => {
    const file: WorkspaceFile = {
      id: '1',
      filePath: 'test.txt',
      content: 'test',
      pendingPatch: `--- test.txt
+++ test.txt
@@ -1 +1 @@
-test
+modified`
    };

    await applyPatch(file);

    expect(logger.info).toHaveBeenCalledWith(
      'Starting patch application:',
      expect.any(Object)
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Patch application completed successfully'
    );
  });
});
