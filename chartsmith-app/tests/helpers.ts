import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login
  await page.goto('/login?test-auth=true');

  // Wait for navigation after login (should redirect to homepage)
  // Wait for navigation after login (should redirect to homepage)
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 });

  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');

  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');

  // Should be on home page
  expect(page.url()).toBe(new URL('/', page.url()).toString());
}