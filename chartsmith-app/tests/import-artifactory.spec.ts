import { test, expect, Page } from '@playwright/test';
import { loginTestUser } from './helpers';

test('import chart from artifacthub', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60 seconds

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

    // Wait for redirect to workspace page with increased timeout
    await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/, { timeout: 60000 });
    
    // Wait for the page to fully load with increased timeout
    try {
      await page.waitForLoadState('networkidle', { timeout: 60000 });
    } catch (error) {
      console.log('Network did not reach idle state, continuing test');
      await page.screenshot({ path: './test-results/network-not-idle.png' });
    }

    // Verify the current URL matches the expected pattern
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/workspace\/[a-zA-Z0-9-]+$/);

    // Verify FileBrowser component is rendered
    await page.waitForSelector('[data-testid="file-browser"]', { timeout: 10000 });

    // Verify WorkspaceContainer is rendered
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });

    // Wait for and verify chat messages
    await page.waitForSelector('[data-testid="chat-message"]', { timeout: 10000 });
    const chatMessages = await page.locator('[data-testid="chat-message"]').all();
    expect(chatMessages.length).toBe(1);  // it's the user message and the assistant message

    // Verify the chat message contains both user and assistant parts
    await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Send a message to render the chart
    await page.fill('textarea[placeholder="Ask a question or ask for a change..."]', 'render this chart using the default values.yaml');
    await page.click('button[type="submit"]');

    // Wait 3 seconds for the response
    await page.waitForTimeout(3000);

    // Verify we have 2 messages
    const updatedChatMessages = await page.locator('[data-testid="chat-message"]').all();
    expect(updatedChatMessages.length).toBe(2);  // Now we should have 2 messages

    // Wait 3 seconds for the detection and terminal
    await page.waitForTimeout(3000);

    // Take a screenshot of the chat messages
    await page.screenshot({ path: './test-results/artifacthub-3-chat-messages.png' });

    // Wait for and verify terminal in the last message
    const lastMessage = await page.locator('[data-testid="chat-message"]:last-child');

    // Look for specific terminal content
    await expect(lastMessage.locator('.font-mono')).toBeVisible(); // Terminal uses font-mono class

    // Verify terminal structure exists
    const terminalElements = await lastMessage.locator('.font-mono').all();
    expect(terminalElements.length).toBe(1);

    await page.screenshot({ path: './test-results/artifacthub-4-workspace.png' });

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
