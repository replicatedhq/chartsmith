import { test, expect } from '@playwright/test';
import { loginTestUser } from './helpers';

test('login flow', async ({ page }) => {
  // Start tracing
  await page.context().tracing.start({
    screenshots: true,
    snapshots: true
  });

  try {
    // Use the helper to login
    await loginTestUser(page);

    // Log final URL
    console.log('Final URL after login:', page.url());

    // Take screenshot of final state
    await page.screenshot({ path: './test-results/after-login.png' });

    // Verify we are NOT on waitlist page
    expect(page.url()).not.toContain('/waitlist');

    // Verify we are on home page
    expect(page.url()).toContain('localhost:3000');
    expect(page.url()).not.toContain('/login');

  } finally {
    // Stop tracing and save
    await page.context().tracing.stop({
      path: './test-results/trace.zip'
    });
  }
});
