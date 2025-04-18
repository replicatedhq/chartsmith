import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Navigate to login with test auth
    await page.goto('/login-with-test-auth');
    await page.screenshot({ path: './test-results/1-initial-load.png' });

    // Wait a bit and capture another screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: './test-results/2-after-wait.png' });

    // Log current URL
    console.log('Current URL:', page.url());
    
    // Wait for URL to change to home page (instead of using deprecated waitForNavigation)
    await page.waitForURL('/', { timeout: 10000 });
    
    // Log final URL
    console.log('Final URL after login:', page.url());
    
    // Take screenshot of final state
    await page.screenshot({ path: './test-results/3-after-login.png' });
    
    // Verify we are NOT on waitlist page
    expect(page.url()).not.toContain('/waitlist');
    
    // Verify we are on home page
    expect(page.url()).toBe(new URL('/', page.url()).toString());

  } finally {
    // Stop tracing and save
    await page.context().tracing.stop({
      path: './test-results/trace.zip'
    });
  }
});
