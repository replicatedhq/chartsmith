import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers';

test('Chat auto-scrolling behavior respects user scroll position', async ({ page }) => {
  test.setTimeout(120000); // Increase timeout to 120 seconds
  // Start tracing for debugging
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Login using our shared test auth function
    await loginTestUser(page);
    
    await page.goto('/', {
      waitUntil: 'networkidle'
    });
    
    const fileInput = page.locator('input[type="file"]');
    
    const testFile = '../testdata/charts/empty-chart-0.1.0.tgz';
    
    await fileInput.setInputFiles(testFile);
    
    // Wait for redirect to workspace page with increased timeout
    await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/, { timeout: 60000 });
    
    // Wait for the chat textarea to appear
    await page.waitForSelector('textarea[placeholder="Ask a question or ask for a change..."]', { timeout: 30000 });
    
    // Send initial message and verify auto-scroll works
    await page.fill('textarea[placeholder="Ask a question or ask for a change..."]', 'Test message');
    await page.press('textarea[placeholder="Ask a question or ask for a change..."]', 'Enter');
    
    // Wait for the message to be processed
    await page.waitForTimeout(500);
    
    // Verify initially scrolled to bottom
    const isAtBottom = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      if (!container) return false;
      return Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 100;
    });
    expect(isAtBottom).toBeTruthy();
    
    // Take screenshot of initial state
    await page.screenshot({ path: './test-results/1-initial-scrolled-to-bottom.png' });
    
    // Manually scroll up
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      if (!container) {
        throw new Error('Scroll container not found');
      }
      container.scrollTop = 0; // Scroll to top
    });
    
    // Wait for the "Jump to latest" button to appear with increased timeout
    await page.waitForSelector('[data-testid="jump-to-latest"]', { timeout: 60000 });
    
    // Take screenshot of scrolled up state with button
    await page.screenshot({ path: './test-results/2-scrolled-up-with-button.png' });
    
    // Verify scroll state via testing helper
    // Note: We're removing the __scrollTestState check since it doesn't exist
    // Instead, we'll check the UI state directly
    const jumpButtonVisible = await page.isVisible('[data-testid="jump-to-latest"]');
    expect(jumpButtonVisible).toBeTruthy();
    
    // Send another message and verify we DON'T auto-scroll
    await page.fill('textarea[placeholder="Ask a question or ask for a change..."]', 'Another message - should not auto-scroll');
    await page.press('textarea[placeholder="Ask a question or ask for a change..."]', 'Enter');
    await page.waitForTimeout(500);
    
    // Check we're still scrolled up
    const staysScrolledUp = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      if (!container) return false;
      return container.scrollTop < 100; // Still near the top
    });
    expect(staysScrolledUp).toBeTruthy();
    
    // Take screenshot of still scrolled up state
    await page.screenshot({ path: './test-results/3-still-scrolled-up-after-message.png' });
    
    // Click "Jump to latest" and verify scroll and button state
    await page.click('[data-testid="jump-to-latest"]');
    await page.waitForTimeout(200);
    
    // Check button disappears
    const buttonVisible = await page.isVisible('[data-testid="jump-to-latest"]');
    expect(buttonVisible).toBeFalsy();
    
    // Verify now scrolled to bottom
    const nowAtBottom = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      if (!container) return false;
      return Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 100;
    });
    expect(nowAtBottom).toBeTruthy();
    
    // Take screenshot of scrolled back to bottom state
    await page.screenshot({ path: './test-results/4-scrolled-back-to-bottom.png' });
    
    // Verify auto-scroll re-enabled by checking the button is gone
    const finalButtonVisible = await page.isVisible('[data-testid="jump-to-latest"]');
    expect(finalButtonVisible).toBeFalsy();
    
  } finally {
    // Stop tracing and save for debugging
    await page.context().tracing.stop({
      path: './test-results/chat-scrolling-trace.zip'
    });
  }
});
