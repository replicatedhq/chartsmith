import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers';

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

    // Wait for redirect to home page
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });

    // Log current URL
    console.log('Current URL:', page.url());

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
