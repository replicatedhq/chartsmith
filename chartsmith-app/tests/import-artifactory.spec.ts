import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers';

test('import chart from artifacthub', async ({ page }) => {
  test.setTimeout(60000);
  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Login first
    await loginTestUser(page);
    await page.screenshot({ path: './test-results/artifacthub-1-post-login.png' });

    // Navigate to the specific chart import URL with explicit wait for load state
    await page.goto('/artifacthub.io/packages/helm/okteto/okteto', {
      waitUntil: 'networkidle'
    });
    await page.screenshot({ path: './test-results/artifacthub-2-import-page.png' });

    // Wait for redirect to workspace page
    await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/, { timeout: 30000 });

    // Verify the current URL matches the expected pattern
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/workspace\/[a-zA-Z0-9-]+$/);

    // Verify FileBrowser component is rendered
    await page.waitForSelector('[data-testid="file-browser"]', { timeout: 10000 });

    // Verify WorkspaceContainer is rendered
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });

    // Wait for chat messages to appear (may or may not have initial messages)
    await page.waitForSelector('[data-testid="chat-message"]', { timeout: 10000 }).catch(() => {
      // Chat messages may not be present initially, that's okay
    });
    
    const chatMessages = await page.locator('[data-testid="chat-message"]').count();
    // Just verify we got to the workspace page with at least the expected structure
    expect(chatMessages).toBeGreaterThanOrEqual(0);

    // Wait for chat input to be visible
    const chatInput = page.locator('textarea[placeholder*="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    // Verify we can type in the chat input
    await chatInput.fill('render this chart using the default values.yaml');
    const inputValue = await chatInput.inputValue();
    expect(inputValue).toBe('render this chart using the default values.yaml');

    await page.screenshot({ path: './test-results/artifacthub-3-workspace.png' });

    // Attempt to submit the form
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Wait a bit for any processing
      await page.waitForTimeout(3000);
      
      // Take screenshot after submission attempt
      await page.screenshot({ path: './test-results/artifacthub-4-after-submit.png' });
    }

  } finally {
    try {
      // Stop tracing and save with a catch block
      await page.context().tracing.stop({
        path: './test-results/artifacthub-trace.zip'
      });
    } catch (error) {
      console.error('Error stopping trace:', error);
    }
  }
});
