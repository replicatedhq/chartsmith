import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login
  await page.goto('/login?test-auth=true');
  
  // Wait for navigation after login (should redirect to homepage)
  // The login page redirects via window.location.href, so we wait for URL change
  await page.waitForURL('/', { timeout: 20000 });
  
  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');
  
  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');
  
  // Should be on home page
  expect(page.url()).toBe(new URL('/', page.url()).toString());
}

/**
 * Creates a workspace by uploading a test chart
 * Returns the workspace ID from the URL
 */
export async function createTestWorkspace(page: Page): Promise<string> {
  // Navigate to home page
  await page.goto('/', { waitUntil: 'networkidle' });
  
  // Get the file input
  const fileInput = page.locator('input[type="file"]');
  
  // Wait for file input to be present
  await fileInput.waitFor({ state: 'attached', timeout: 20000 });
  
  // Prepare file for upload - use the actual test chart path
  const testFile = '../testdata/charts/empty-chart-0.1.0.tgz';
  
  // Set file in the input directly without clicking the upload button
  await fileInput.setInputFiles(testFile);
  
  // Wait for redirect to workspace page with longer timeout
  await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/, { timeout: 60000 });
  
  // Extract workspace ID from URL
  const currentUrl = page.url();
  const match = currentUrl.match(/\/workspace\/([a-zA-Z0-9-]+)$/);
  if (!match) {
    throw new Error(`Failed to extract workspace ID from URL: ${currentUrl}`);
  }
  
  const workspaceId = match[1];
  
  // Verify FileBrowser component is rendered
  await page.waitForSelector('[data-testid="file-browser"]', { timeout: 20000 });
  
  // Verify WorkspaceContainer is rendered
  await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 20000 });
  
  // Wait for chat input to be ready
  await page.waitForSelector('textarea[placeholder*="Ask a question"]', { timeout: 20000 });
  
  return workspaceId;
}

/**
 * Gets or creates a workspace for testing
 * If a workspace ID is provided and exists, uses it; otherwise creates a new one
 */
export async function getOrCreateTestWorkspace(page: Page, workspaceId?: string): Promise<string> {
  if (workspaceId) {
    // Try to navigate to the workspace
    await page.goto(`/workspace/${workspaceId}`);
    
    // Check if workspace exists by waiting for workspace container or error
    try {
      await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 5000 });
      return workspaceId;
    } catch (e) {
      // Workspace doesn't exist, create a new one
      console.log(`Workspace ${workspaceId} not found, creating new workspace`);
    }
  }
  
  // Create a new workspace
  return await createTestWorkspace(page);
}
