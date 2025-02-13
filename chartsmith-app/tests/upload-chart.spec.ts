import { test, expect, Page } from '@playwright/test';

async function loginTestUser(page: Page) {
  await page.goto('/login?test-auth=true');
  // Wait for navigation after login
  await Promise.all([
    page.waitForNavigation(),
    page.waitForTimeout(2000)
  ]);
  expect(page.url()).not.toContain('/login'); // Verify successful login
}

test('upload helm chart', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60 seconds

  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Login first
    await loginTestUser(page);
    await page.screenshot({ path: './test-results/upload-1-post-login.png' });

    // Navigate to home page
    await page.goto('/', {
      waitUntil: 'networkidle'
    });
    await page.screenshot({ path: './test-results/upload-2-home-page.png' });

    // Get the file input
    const fileInput = page.locator('input[type="file"]');

    // Prepare file for upload - use the actual test chart path
    const testFile = '../testdata/charts/empty-chart-0.1.0.tgz';

    // Set file in the input directly without clicking the upload button
    await fileInput.setInputFiles(testFile);

    // Wait for redirect to workspace page
    await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/);

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
    expect(chatMessages.length).toBe(1);  // Initial welcome message

    // Verify the chat message contains both user and assistant parts
    await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Send a message to render the chart
    await page.fill('textarea[placeholder="Type your message..."]', 'change the default replicaCount in the values.yaml to 3');
    await page.click('button[type="submit"]');

    // wait for a brief moment for the message to be sent
    await page.waitForTimeout(2000);

    // Verify we have 2 messages
    const messagesAfterSubmit = await page.locator('[data-testid="chat-message"]').all();
    expect(messagesAfterSubmit.length).toBe(2);

    // Verify that we have a user message and a plan message
    const latestMessage = messagesAfterSubmit[1];
    await expect(latestMessage.locator('[data-testid="user-message"]')).toBeVisible();
    // Look for plan message anywhere in the document, not just in the latest message
    await expect(page.locator('[data-testid="plan-message"]')).toBeVisible();


    // Take a screenshot of the chat messages
    await page.screenshot({ path: './test-results/upload-3-chat-messages.png' });

    // now we wait up to 30 seconds for the plan to change to review status
    await expect(page.locator('[data-testid="plan-message"] [data-testid="plan-message-top"]')).toContainText('Proposed Plan(review)', { timeout: 30000 });

    // Take a screenshot of the chat messages
    await page.screenshot({ path: './test-results/upload-4-chat-messages.png' });

    // click on the Proceed button
    await page.click('[data-testid="plan-message"] [data-testid="plan-message-proceed-button"]');

    // wait for a brief moment for the message to be sent
    await page.waitForTimeout(20000);

  } finally {
    try {
      // Stop tracing and save
      await page.context().tracing.stop({
        path: './test-results/upload-trace.zip'
      });
    } catch (error) {
      console.error('Error stopping trace:', error);
    }
  }
});
