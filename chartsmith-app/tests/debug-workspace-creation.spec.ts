import { test, expect } from '@playwright/test';

/**
 * Simple debug test to see what happens when we try to create a workspace
 */
test('Debug workspace creation', async ({ page, context }) => {
  // Get test auth token
  const apiResponse = await page.request.get('http://localhost:3000/api/auth/test-auth?format=json');
  const authData = await apiResponse.json();
  const jwt = authData.token;

  // Set headers
  await context.setExtraHTTPHeaders({
    'X-Test-Auth-Token': jwt,
  });

  // Navigate first
  await page.goto('http://localhost:3000/');
  
  // Set cookie AFTER navigation using page.evaluate
  console.log('Setting session cookie...');
  await page.evaluate((token) => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
    console.log('Cookie set:', document.cookie);
  }, jwt);
  
  // Verify cookie is set
  const cookies = await page.evaluate(() => document.cookie);
  console.log(`Cookies after setting: ${cookies}`);
  
  await page.waitForSelector('textarea[placeholder*="Tell me about the application"]');
  
  // Wait a bit for session hook to process
  await page.waitForTimeout(3000);
  
  // Check if session loaded
  const sessionCheck = await page.evaluate(() => {
    return {
      cookie: document.cookie,
      hasSession: document.cookie.includes('session=')
    };
  });
  console.log(`Session check: ${JSON.stringify(sessionCheck)}`);
  
  const prompt = 'Create a Helm chart for a Node.js application using the node:18 image, exposing port 3000';
  await page.fill('textarea[placeholder*="Tell me about the application"]', prompt);
  await page.waitForTimeout(500);
  
  // Capture ALL network activity
  const responses: Array<{url: string; status: number; body: string}> = [];
  page.on('response', async (response) => {
    if (response.request().method() === 'POST') {
      try {
        const body = await response.text();
        responses.push({
          url: response.url(),
          status: response.status(),
          body: body.substring(0, 2000)
        });
        console.log(`\n📥 POST ${response.status()} ${response.url()}`);
        console.log(`Body: ${body.substring(0, 500)}\n`);
      } catch (e) {
        console.error(`Failed to read response: ${e}`);
      }
    }
  });

  // Capture ALL console messages
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      console.error(`[CONSOLE ${type.toUpperCase()}] ${text}`);
    } else if (text.includes('session') || text.includes('Session') || text.includes('createWorkspace') || text.includes('Failed')) {
      console.log(`[CONSOLE ${type}] ${text}`);
    }
  });

  // Capture dialogs
  page.on('dialog', async (dialog) => {
    console.error(`\n⚠️ DIALOG: ${dialog.message()}\n`);
    await dialog.accept();
  });

  // Check button state before clicking
  const submitButton = page.locator('button').filter({ has: page.locator('svg') }).last();
  const isDisabled = await submitButton.isDisabled();
  const isVisible = await submitButton.isVisible();
  console.log(`Submit button - disabled: ${isDisabled}, visible: ${isVisible}`);
  
  // Also try calling the handler directly via JavaScript
  console.log('Attempting to trigger form submission via JavaScript...');
  await page.evaluate(() => {
    const textarea = document.querySelector('textarea[placeholder*="Tell me about the application"]') as HTMLTextAreaElement;
    if (textarea) {
      // Find the form or button
      const form = textarea.closest('form');
      const button = Array.from(document.querySelectorAll('button')).find(btn => {
        const svg = btn.querySelector('svg');
        return svg !== null && !btn.disabled;
      });
      
      if (button) {
        (button as HTMLButtonElement).click();
        console.log('Clicked button via JS');
      } else if (form) {
        form.requestSubmit();
        console.log('Submitted form via JS');
      } else {
        // Trigger Enter key
        const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
        textarea.dispatchEvent(event);
        console.log('Dispatched Enter event');
      }
    }
  });
  
  // Also try clicking normally
  if (!isDisabled && isVisible) {
    console.log('Clicking submit button normally...');
    await submitButton.click();
  }
  
  // Wait for responses
  console.log('Waiting for network activity...');
  await page.waitForTimeout(10000);
  
  // Print all responses
  console.log(`\n📊 Total POST responses: ${responses.length}`);
  responses.forEach((r, i) => {
    console.log(`\nResponse ${i + 1}:`);
    console.log(`  URL: ${r.url}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Body: ${r.body}`);
  });
  
  // Check current URL
  const currentUrl = page.url();
  console.log(`\nCurrent URL: ${currentUrl}`);
  
  // The test will fail, but we'll see the output
  expect(currentUrl).toContain('/workspace/');
});
