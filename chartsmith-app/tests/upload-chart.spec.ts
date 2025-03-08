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

    // Ensure the Proceed button is in the viewport before clicking
    const proceedButton = page.locator('[data-testid="plan-message"] [data-testid="plan-message-proceed-button"]');
    await proceedButton.waitFor({ state: 'visible' });

    // Check if button is in viewport without scrolling to it
    const isInViewport = await proceedButton.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    });

    // Take a screenshot to capture the current state
    await page.screenshot({ path: './test-results/upload-proceed-button-verification.png' });

    // Test should fail if button is not visible in viewport
    expect(isInViewport).toBe(true, 'Proceed button is not visible in the viewport without scrolling');

    // click on the Proceed button
    await proceedButton.click();

    // wait for a brief moment for the message to be sent
    await page.waitForTimeout(10000);

    // After the plan is executed, we should see the diff in the editor
    // Look for values.yaml in the file browser and click on it
    await page.getByText('values.yaml').first().click();

    // Take a screenshot to capture the editor view with diff
    await page.screenshot({ path: './test-results/upload-5-diff-view.png' });

    // Wait for the diff editor to be visible
    await page.waitForSelector('.monaco-editor');

    const addedLines = page.locator('.diffInserted');
    const removedLines = page.locator('.diffRemoved');

    // Ensure there's exactly one added and one removed line
    await expect(addedLines).toHaveCount(1);
    await expect(removedLines).toHaveCount(1);

    // Verify the content of the added and removed lines
    await expect(addedLines).toHaveText('replicaCount: 3');
    await expect(removedLines).toHaveText('replicaCount: 1');

    // Take a screenshot with any errors visible
    await page.screenshot({ path: './test-results/upload-6-diff-validation.png' });

    // NOTE FOR VISUAL VERIFICATION:
    // We're taking screenshots to allow manual verification of the diff.
    // The test may still pass even if the assertions below fail, as the
    // styling classes we're checking for may be different in Monaco editor.

    // Comment out the expects for now since we're relying on visual verification
    // expect(removedLine).toBe(true, 'Could not find "replicaCount: 1" highlighted as removed line');
    // expect(addedLine).toBe(true, 'Could not find "replicaCount: 3" highlighted as added line');

    // Wait a bit more to ensure all operations complete
    await page.waitForTimeout(5000);

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
