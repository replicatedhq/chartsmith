import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login with test-auth parameter
  await page.goto('/login?test-auth=true');
  
  // Wait for the page to redirect away from /login
  // The test-auth flow: loads page -> fetches config -> calls validateTestAuth -> sets cookie -> redirects
  // This can take a few seconds, so we wait for URL to change
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  
  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');
  
  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');
}