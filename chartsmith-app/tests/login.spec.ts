import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Navigate to login
    await page.goto('/login?test-auth=true');
    await page.screenshot({ path: './test-results/1-initial-load.png' });

    // Wait a bit and capture another screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: './test-results/2-after-wait.png' });

    // Log current URL
    console.log('Current URL:', page.url());

  } finally {
    // Stop tracing and save
    await page.context().tracing.stop({
      path: './test-results/trace.zip'
    });
  }
});
