import { Page, expect } from '@playwright/test';

export async function loginTestUser(page: Page) {
  // Navigate to login with test auth
  await page.goto('/login-with-test-auth');
  
  // Wait for redirect to homepage
  await page.waitForURL('/', { timeout: 10000 });
  
  // Verify successful login - should no longer be on login page
  expect(page.url()).not.toContain('/login');
  
  // Also verify we're not on waitlist page
  expect(page.url()).not.toContain('/waitlist');
  
  // Should be on home page
  expect(page.url()).toBe(new URL('/', page.url()).toString());
}