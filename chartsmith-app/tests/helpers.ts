import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login with test-auth parameter
  await page.goto('/login?test-auth=true');

  // Wait for redirect to home page (test auth redirects via window.location.href)
  await page.waitForURL('/', { timeout: 15000 });

  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');

  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');
}