import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login
  await page.goto('/login?test-auth=true');
  
  // Wait for navigation after login (should redirect to homepage)
  await Promise.all([
    page.waitForNavigation({ timeout: 10000 }),
    page.waitForTimeout(2000) // Giving some time for the auth to complete
  ]);
  
  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');
  
  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');
  
  // Should be on home page
  expect(page.url()).toBe(new URL('/', page.url()).toString());
}