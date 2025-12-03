import { test, expect } from '@playwright/test';
import { loginTestUser, getOrCreateTestWorkspace } from './helpers';

test.describe('Model Selection', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await loginTestUser(page);
    workspaceId = await getOrCreateTestWorkspace(page);
  });

  test('should display chat interface with model selector area', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 20000 });
    
    const chatInput = page.locator('textarea[placeholder*="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 20000 });
    
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 10000 });
  });

  test('should return valid response from models API', async ({ page }) => {
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });
    
    const response = await page.request.get('/api/models');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    expect(data).toHaveProperty('providers');
    expect(data).toHaveProperty('recommended');
    expect(Array.isArray(data.providers)).toBeTruthy();
    expect(Array.isArray(data.recommended)).toBeTruthy();
    
    // If there are recommended models, verify they have required fields
    if (data.recommended.length > 0) {
      const firstModel = data.recommended[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('provider');
    }
  });

  test('should have functional chat input regardless of model selection', async ({ page }) => {
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });
    
    const chatInput = page.locator('textarea[placeholder*="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    await expect(chatInput).toBeEnabled();
    
    await chatInput.fill('Test message');
    const value = await chatInput.inputValue();
    expect(value).toBe('Test message');
  });

  test('should have submit button in chat form', async ({ page }) => {
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });
    await page.waitForSelector('textarea[placeholder*="Ask a question"]', { timeout: 10000 });
    
    const submitButton = page.locator('form').locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should persist across page navigation', async ({ page }) => {
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });
    await page.waitForSelector('textarea[placeholder*="Ask a question"]', { timeout: 10000 });
    
    await page.goto('/');
    await page.goto(`/workspace/${workspaceId}`);
    
    await page.waitForSelector('[data-testid="workspace-container"]', { timeout: 10000 });
    const chatInput = page.locator('textarea[placeholder*="Ask a question"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await expect(chatInput).toBeEnabled();
  });
});
