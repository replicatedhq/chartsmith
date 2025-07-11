import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers';

test('Chat auto-scrolling behavior respects user scroll position', async ({ page }) => {
  // Start tracing for debugging
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Login using our shared test auth function
    await loginTestUser(page);
    
    // Find and click on the first workspace available
    await page.waitForSelector('[data-testid="workspace-item"]');
    await page.click('[data-testid="workspace-item"]');
    await page.waitForSelector('textarea[placeholder="Ask a question or ask for a change..."]');
    
    // Send initial message and verify auto-scroll works
    await page.fill('textarea[placeholder="Ask a question or ask for a change..."]', 'Test message');
    await page.press('textarea[placeholder="Ask a question or ask for a change..."]', 'Enter');
    
    // Wait for the message to be processed
    await page.waitForTimeout(500);
    
    // Verify initially scrolled to bottom
    const isAtBottom = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      return Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 100;
    });
    expect(isAtBottom).toBeTruthy();
    
    // Take screenshot of initial state
    await page.screenshot({ path: './test-results/1-initial-scrolled-to-bottom.png' });
    
    // Manually scroll up
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
      container.scrollTop = 0; // Scroll to top
    });
    
    // Wait for the "Jump to latest" button to appear
    await page.waitForSelector('[data-testid="jump-to-latest"]');
    
    // Take screenshot of scrolled up state with button
    await page.screenshot({ path: './test-results/2-scrolled-up-with-button.png' });
    
    // Verify scroll state via testing helper
    const scrollState = await page.evaluate(() => {
      return {
        isAutoScrollEnabled: window.__scrollTestState.isAutoScrollEnabled(),
        hasScrolledUp: window.__scrollTestState.hasScrolledUp(),
        isShowingJumpButton: window.__scrollTestState.isShowingJumpButton()
      };
    });
    
    expect(scrollState.isAutoScrollEnabled).toBeFalsy();
    expect(scrollState.hasScrolledUp).toBeTruthy();
    expect(scrollState.isShowingJumpButton).toBeTruthy();
    
    // Send another message and verify we DON'T auto-scroll
    await page.fill('textarea[placeholder="Ask a question or ask for a change..."]', 'Another message - should not auto-scroll');
    await page.press('textarea[placeholder="Ask a question or ask for a change..."]', 'Enter');
    await page.waitForTimeout(500);
    
    // Check we're still scrolled up
    const staysScrolledUp = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="scroll-container"]');
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
      return Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 100;
    });
    expect(nowAtBottom).toBeTruthy();
    
    // Take screenshot of scrolled back to bottom state
    await page.screenshot({ path: './test-results/4-scrolled-back-to-bottom.png' });
    
    // Verify auto-scroll re-enabled via testing helper
    const finalScrollState = await page.evaluate(() => {
      return {
        isAutoScrollEnabled: window.__scrollTestState.isAutoScrollEnabled(),
        hasScrolledUp: window.__scrollTestState.hasScrolledUp(),
        isShowingJumpButton: window.__scrollTestState.isShowingJumpButton()
      };
    });
    
    expect(finalScrollState.isAutoScrollEnabled).toBeTruthy();
    expect(finalScrollState.hasScrolledUp).toBeFalsy();
    expect(finalScrollState.isShowingJumpButton).toBeFalsy();
    
  } finally {
    // Stop tracing and save for debugging
    await page.context().tracing.stop({
      path: './test-results/chat-scrolling-trace.zip'
    });
  }
});