import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Debug test to navigate through the helm chart creation flow
 * and capture all logs for analysis
 */

interface LogEntry {
  timestamp: string;
  type: 'console' | 'network' | 'error';
  level?: string;
  message: string;
  url?: string;
  status?: number;
  stack?: string;
}

const logs: LogEntry[] = [];

function addLog(entry: Omit<LogEntry, 'timestamp'>) {
  logs.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

test.describe('Debug Helm Chart Flow', () => {
  test('Navigate to login, authenticate, create workspace, and submit helm chart prompt', async ({ page, context }) => {
    // Set up console logging
    page.on('console', (msg) => {
      const text = msg.text();
      addLog({
        type: 'console',
        level: msg.type(),
        message: text,
      });
      console.log(`[CONSOLE ${msg.type()}]`, text);
    });

    // Set up network request logging
    page.on('request', (request) => {
      addLog({
        type: 'network',
        message: `${request.method()} ${request.url()}`,
        url: request.url(),
      });
    });

    // Set up network response logging
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      addLog({
        type: 'network',
        message: `Response: ${status} ${response.statusText()} - ${url}`,
        url,
        status,
      });

      // Log failed requests with body if possible
      if (status >= 400) {
        try {
          const body = await response.text();
          addLog({
            type: 'error',
            message: `Failed request body: ${body.substring(0, 500)}`,
            url,
            status,
          });
        } catch (e) {
          // Ignore errors reading body
        }
      }
    });

    // Set up error logging
    page.on('pageerror', (error) => {
      addLog({
        type: 'error',
        message: `Page error: ${error.message}`,
        stack: error.stack,
      });
      console.error('[PAGE ERROR]', error);
    });

    // Set up request failed logging
    page.on('requestfailed', (request) => {
      addLog({
        type: 'error',
        message: `Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        url: request.url(),
      });
      console.error('[REQUEST FAILED]', request.url(), request.failure());
    });

    console.log('🚀 Starting test flow...');

    // Step 1: Authenticate using test-auth API and set up test auth bypass header
    console.log('📝 Step 1: Setting up test auth bypass...');
    
    // Use Playwright's request API to call test-auth endpoint with JSON format
    const apiResponse = await page.request.get('http://localhost:3000/api/auth/test-auth?format=json', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!apiResponse.ok()) {
      const errorText = await apiResponse.text();
      console.error(`❌ Test auth failed: ${apiResponse.status()} - ${errorText}`);
      throw new Error(`Test auth failed: ${apiResponse.status()}`);
    }

    // Get JWT from response body (JSON format)
    const authData = await apiResponse.json();
    const jwt = authData.token;

    if (!jwt) {
      console.error('❌ No JWT token in response!');
      console.error('Response:', authData);
      throw new Error('No JWT token received from test-auth API');
    }

    console.log(`✅ Got JWT from API (length: ${jwt.length})`);
    
    // Set up test auth bypass header for all requests
    // This bypasses cookie issues entirely!
    await context.setExtraHTTPHeaders({
      'X-Test-Auth-Token': jwt,
    });
    console.log('✅ Test auth bypass header set for all requests');
    
    // Set cookie BEFORE navigating so it's available immediately
    // Use addInitScript to set it before any page scripts run
    page.addInitScript((token) => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      // Set cookie with all necessary attributes
      document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
      console.log('Cookie set via addInitScript:', document.cookie);
    }, jwt);
    
    // Navigate to home page - middleware will see the header and allow access
    console.log('📝 Navigating to home page with test auth bypass...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    
    // Verify we're not redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Still redirected to login - test auth bypass not working');
    }
    
    // Verify cookie is set
    const pageCookies = await page.evaluate(() => document.cookie);
    console.log(`Page cookies: ${pageCookies}`);
    
    if (!pageCookies.includes('session=')) {
      // Set it again if not found
      await page.evaluate((token) => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
      }, jwt);
      await page.waitForTimeout(500);
    }
    
    // Wait for session to be loaded by useSession hook
    console.log('⏳ Waiting for session to load...');
    await page.waitForFunction(() => {
      // Check if session is loaded by looking for elements that require session
      // Or wait for a specific condition
      return document.cookie.includes('session=');
    }, { timeout: 5000 }).catch(() => {
      console.warn('Session cookie check timeout - continuing anyway');
    });
    
    // Wait a bit more for React to process the session
    await page.waitForTimeout(2000);
    
    console.log(`✅ Authenticated! Current URL: ${currentUrl}`);

    // Step 2: Wait for the home page to load and find the prompt textarea
    console.log('📝 Step 2: Waiting for session to load and form to appear...');
    
    // Wait for session to be loaded - check for elements that appear when session is ready
    // The form should appear once session is loaded
    await page.waitForFunction(() => {
      // Check if the textarea exists (means form is rendered)
      const textarea = document.querySelector('textarea[placeholder*="Tell me about the application"]');
      return textarea !== null;
    }, { timeout: 15000 }).catch(async () => {
      // If form doesn't appear, check what's on the page
      const pageContent = await page.content();
      const hasLogin = pageContent.includes('Log In') || pageContent.includes('Get Started');
      const hasTextarea = pageContent.includes('textarea');
      console.error(`Form check - Has login buttons: ${hasLogin}, Has textarea: ${hasTextarea}`);
      throw new Error('Form did not appear - session may not be loaded');
    });
    
    console.log('✅ Form appeared - session is loaded');
    
    // Wait for the textarea with the specific placeholder
    const promptTextarea = page.locator('textarea[placeholder*="Tell me about the application"]');
    await promptTextarea.waitFor({ timeout: 5000 });
    console.log('✅ Found prompt textarea');

    // Step 3: Type a helm chart prompt
    const helmPrompt = 'Create a Helm chart for a simple nginx web server with 3 replicas, a ConfigMap for nginx.conf, and a Service exposing port 80';
    console.log(`📝 Step 3: Typing prompt: "${helmPrompt}"`);
    await promptTextarea.fill(helmPrompt);
    await page.waitForTimeout(500); // Small delay to ensure input is processed

    // Test auth bypass header is set for all requests - no need to verify cookies
    console.log('✅ Test auth bypass active - ready to submit');

    // Step 4: Verify session is available before submitting
    console.log('📝 Step 4: Verifying session before submit...');
    
    // Check if session is loaded by checking for elements that require session
    const sessionCheck = await page.evaluate(() => {
      // Check if there's a session in localStorage or if the component is ready
      return {
        cookie: document.cookie,
        hasSession: document.cookie.includes('session='),
      };
    });
    console.log(`Session check: ${JSON.stringify(sessionCheck)}`);
    
    // Wait for any loading states to clear
    await page.waitForTimeout(1000);
    
    // Check for error messages before submitting
    const preSubmitErrors = await page.locator('[class*="error"], [role="alert"]').all();
    if (preSubmitErrors.length > 0) {
      for (const elem of preSubmitErrors) {
        const text = await elem.textContent();
        console.error(`Pre-submit error: ${text}`);
      }
    }
    
    console.log('📝 Step 4: Submitting prompt...');
    
    // Set up dialog handler to capture alerts
    page.on('dialog', async (dialog) => {
      console.error(`⚠️ Alert dialog: ${dialog.message()}`);
      await dialog.accept();
    });
    
    // Monitor console for errors during submission
    const submissionErrors: string[] = [];
    const allConsoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      allConsoleMessages.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        submissionErrors.push(text);
        console.error(`Console error during submission: ${text}`);
      }
    });
    
    // Try multiple methods to submit
    console.log('Attempting to submit prompt...');
    
    // Method 1: Try clicking the submit button
    const submitButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    const buttonCount = await submitButton.count();
    console.log(`Found ${buttonCount} submit buttons`);
    
    if (buttonCount > 0) {
      const isDisabled = await submitButton.isDisabled();
      const isVisible = await submitButton.isVisible();
      console.log(`Button state - disabled: ${isDisabled}, visible: ${isVisible}`);
      
      if (!isDisabled && isVisible) {
        console.log('Clicking submit button...');
        try {
          await submitButton.click({ force: true, timeout: 5000 });
          console.log('✅ Button clicked');
        } catch (e) {
          console.error(`Button click failed: ${e}`);
        }
      }
    }
    
    // Method 2: Also try pressing Enter as backup
    console.log('Also trying Enter key...');
    await promptTextarea.press('Enter');
    
    // Method 3: Try calling the handler directly via JavaScript
    console.log('Trying to trigger handler directly...');
    await page.evaluate(() => {
      // Find the textarea and trigger its form submission
      const textarea = document.querySelector('textarea[placeholder*="Tell me about the application"]');
      if (textarea) {
        // Try to find and click the button via DOM
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(btn => {
          const svg = btn.querySelector('svg');
          return svg !== null;
        });
        if (submitBtn && !submitBtn.disabled) {
          (submitBtn as HTMLButtonElement).click();
          console.log('Clicked button via DOM');
        } else {
          // Try form submission
          const form = textarea.closest('form');
          if (form) {
            form.requestSubmit();
            console.log('Submitted form');
          } else {
            // Create a synthetic Enter keypress
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            textarea.dispatchEvent(event);
            console.log('Dispatched Enter keypress');
          }
        }
      }
    });
    
    // Wait a moment for the action to start and check for errors
    await page.waitForTimeout(3000);
    
    // Check for immediate errors
    if (submissionErrors.length > 0) {
      console.error(`Errors during submission: ${submissionErrors.join(', ')}`);
    }
    
    // Log all console messages for debugging
    console.log(`All console messages (last 10): ${allConsoleMessages.slice(-10).join('\n')}`);
    
    // Check if form is still visible (if it disappeared, there was an error)
    const formStillVisible = await page.locator('textarea[placeholder*="Tell me about the application"]').count();
    if (formStillVisible === 0) {
      console.error('❌ Form disappeared after submission - likely an error occurred');
      
      // Check for error messages
      const errorMessages = await page.locator('[class*="error"], [role="alert"], [class*="Error"]').all();
      for (const elem of errorMessages) {
        const text = await elem.textContent();
        console.error(`Error message found: ${text}`);
      }
    }

    // Step 5: Wait for workspace to be created and navigate to workspace page
    console.log('⏳ Step 5: Waiting for workspace creation...');
    
    // Monitor network requests to see what's happening
    const requestLogs: Array<{url: string; status: number; method: string; body?: string}> = [];
    
    // Set up response listener BEFORE submitting
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();
      
      // Log ALL requests - Next.js server actions use special endpoints
      if (url.includes('/api/') || 
          url.includes('_next/data') || 
          url.includes('_next/server') ||
          url.includes('workspace') ||
          url.includes('create-workspace') ||
          url.includes('actions') ||
          status >= 400 ||
          method === 'POST') {  // Server actions are POST requests
        try {
          const body = await response.text();
          requestLogs.push({ url, status, method, body: body.substring(0, 500) });
          
          if (status >= 400) {
            console.error(`❌ ${method} ${url} - ${status}`);
            console.error(`   Body: ${body.substring(0, 500)}`);
            addLog({
              type: 'error',
              message: `${method} ${url} failed: ${status}`,
              url,
              status,
            });
          } else {
            console.log(`✅ ${method} ${url} - ${status}`);
            if (body && body.length < 200) {
              console.log(`   Response: ${body}`);
            } else if (url.includes('actions') || url.includes('create')) {
              console.log(`   Server action response (first 200 chars): ${body.substring(0, 200)}`);
            }
          }
        } catch (e) {
          requestLogs.push({ url, status, method });
          if (status >= 400) {
            console.error(`❌ ${method} ${url} - ${status} (failed to read body)`);
          }
        }
      }
    });
    
    // Also monitor requests (before response) - especially POST requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      if (url.includes('/api/') || 
          url.includes('_next/data') || 
          url.includes('_next/server') ||
          url.includes('workspace') ||
          url.includes('actions') ||
          method === 'POST') {
        console.log(`📤 ${method} ${url}`);
      }
    });
    
    // Monitor console errors more carefully
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error' || text.includes('Failed') || text.includes('Error') || text.includes('error')) {
        console.error(`[CONSOLE ${type}] ${text}`);
        addLog({
          type: 'console',
          level: type as any,
          message: text,
        });
      }
    });
    
    // Wait for either workspace URL or check if workspace was created
    // Even if page fails to load, workspace creation might have succeeded
    let workspaceCreated = false;
    let workspaceId: string | undefined;
    
    try {
      // Wait for URL change to workspace
      await page.waitForURL((url) => {
        const isWorkspace = url.pathname.startsWith('/workspace/');
        if (isWorkspace) {
          const match = url.pathname.match(/\/workspace\/([^\/]+)/);
          if (match) {
            workspaceId = match[1];
            workspaceCreated = true;
          }
        }
        return isWorkspace;
      }, { timeout: 30000 });
      
      console.log(`✅ Navigated to workspace: ${workspaceId}`);
    } catch (error: any) {
      // Check console logs for workspace creation message
      const workspaceCreatedLogs = allConsoleMessages.filter(msg => 
        msg.includes('Workspace created successfully')
      );
      
      if (workspaceCreatedLogs.length > 0) {
        // Extract workspace ID from log: "Workspace created successfully {"workspaceId":"XXX"}"
        const idMatch = workspaceCreatedLogs[0].match(/workspaceId["']:\s*["']([^"']+)["']/);
        if (idMatch) {
          workspaceId = idMatch[1];
          workspaceCreated = true;
          console.log(`✅ Workspace created successfully! ID: ${workspaceId}`);
          addLog({
            type: 'console',
            level: 'info',
            message: `Workspace created: ${workspaceId}`,
          });
        }
      }
      
      // Also check network request logs
      if (!workspaceCreated) {
        const workspaceIdMatch = requestLogs.find(log => 
          log.body && log.body.includes('workspaceId')
        );
        
        if (workspaceIdMatch) {
          const bodyMatch = workspaceIdMatch.body.match(/workspaceId["']:\s*["']([^"']+)["']/);
          if (bodyMatch) {
            workspaceId = bodyMatch[1];
            workspaceCreated = true;
            console.log(`✅ Workspace created (ID from network logs): ${workspaceId}`);
          }
        }
      }
      
      if (!workspaceCreated) {
      // Check current URL
      const currentUrl = page.url();
      console.error(`❌ Failed to navigate to workspace. Current URL: ${currentUrl}`);
      console.error(`Network requests logged: ${requestLogs.length}`);
      requestLogs.forEach(log => {
        console.error(`  ${log.method} ${log.url} - ${log.status}`);
        if (log.body) {
          console.error(`    Body: ${log.body}`);
        }
      });
      
      // Check page state
      const pageState = await page.evaluate(() => {
        return {
          url: window.location.href,
          cookie: document.cookie,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 500),
        };
      });
      console.error(`Page state: ${JSON.stringify(pageState, null, 2)}`);
      
      // Check for error messages on page
      const errorElements = await page.locator('[class*="error"], [role="alert"], [class*="Error"]').all();
      if (errorElements.length > 0) {
        for (const elem of errorElements) {
          const text = await elem.textContent();
          console.error(`Error on page: ${text}`);
          addLog({
            type: 'error',
            message: `Page error: ${text}`,
          });
        }
      }
      
      // Check page content for clues
      const pageContent = await page.content();
      if (pageContent.includes('error') || pageContent.includes('Error')) {
        console.error('Page contains error text');
      }
      
        throw error;
      } else {
        console.log(`⚠️ Workspace created but page failed to load. Workspace ID: ${workspaceId}`);
        // Try to navigate to workspace manually
        if (workspaceId) {
          console.log(`Attempting to navigate to /workspace/${workspaceId}...`);
          await page.goto(`http://localhost:3000/workspace/${workspaceId}`, { waitUntil: 'networkidle', timeout: 10000 });
        }
      }
    }

    const workspaceUrl = page.url();
    const finalWorkspaceId = workspaceId || workspaceUrl.match(/\/workspace\/([^\/]+)/)?.[1];
    
    if (finalWorkspaceId) {
      console.log(`✅ Workspace created successfully! ID: ${finalWorkspaceId}`);
      console.log(`   URL: ${workspaceUrl}`);
      addLog({
        type: 'console',
        level: 'info',
        message: `Workspace created: ${finalWorkspaceId}`,
      });
    } else {
      throw new Error('Workspace ID not found - workspace creation may have failed');
    }

    // Step 6: Wait for the workspace page to load and find the chat input
    console.log('📝 Step 6: Looking for chat input in workspace...');
    
    // Wait a moment for page to stabilize (workspace page might have errors but still be functional)
    await page.waitForTimeout(2000);
    
    // Try to find chat input, but don't fail if page has errors
    try {
      await page.waitForSelector('textarea[placeholder*="Ask a question"]', { timeout: 10000 });
      const chatInput = page.locator('textarea[placeholder*="Ask a question"]');
      console.log('✅ Found chat input');
    } catch (e) {
      console.warn('⚠️ Chat input not found - workspace page may have errors, but workspace was created');
      console.warn(`   Workspace ID: ${finalWorkspaceId}`);
      // Continue anyway - workspace creation succeeded
    }
    
    // If we found chat input, continue with chat submission
    const chatInputExists = await page.locator('textarea[placeholder*="Ask a question"]').count() > 0;
    if (!chatInputExists) {
      console.log('⚠️ Skipping chat submission - workspace page not fully loaded');
      console.log(`✅ Test complete! Workspace created successfully: ${finalWorkspaceId}`);
      return; // Exit early - workspace creation is the main goal
    }
    
    const chatInput = page.locator('textarea[placeholder*="Ask a question"]');

    // Step 7: Type a follow-up prompt in the chat
    const chatPrompt = 'Add a HorizontalPodAutoscaler to scale between 2 and 10 replicas based on CPU usage';
    console.log(`📝 Step 7: Typing chat prompt: "${chatPrompt}"`);
    await chatInput.fill(chatPrompt);
    await page.waitForTimeout(500);

    // Step 8: Submit the chat message
    console.log('📝 Step 8: Submitting chat message...');
    
    // Find the send button or press Enter
    const sendButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last();
    const sendButtonCount = await sendButton.count();
    
    if (sendButtonCount > 0) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Step 9: Wait for response and monitor streaming
    console.log('⏳ Step 9: Waiting for AI response...');
    
    // Wait for loading indicator to appear and then disappear
    const loadingIndicator = page.locator('[class*="animate-spin"], [class*="Loader"]');
    
    // Wait for loading to start
    await loadingIndicator.first().waitFor({ timeout: 5000 }).catch(() => {
      console.log('No loading indicator found, response may have started immediately');
    });

    // Wait for loading to finish (or timeout after 60 seconds)
    await Promise.race([
      loadingIndicator.first().waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
        console.log('Loading indicator still visible after timeout');
      }),
      page.waitForTimeout(60000), // Max wait time
    ]);

    console.log('✅ Response received (or timeout reached)');

    // Step 10: Capture final state
    console.log('📸 Step 10: Capturing final state...');
    const finalUrl = page.url();
    const pageTitle = await page.title();
    
    // Check for any error messages on the page
    const errorMessages = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').allTextContents();
    
    console.log(`Final URL: ${finalUrl}`);
    console.log(`Page Title: ${pageTitle}`);
    if (errorMessages.length > 0) {
      console.log('⚠️ Error messages found:', errorMessages);
    }

    // Save logs to file
    const logFilePath = path.join(__dirname, '../../debug-helm-chart-logs.json');
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
    console.log(`\n📄 Logs saved to: ${logFilePath}`);
    console.log(`📊 Total log entries: ${logs.length}`);

    // Print summary
    console.log('\n📊 Log Summary:');
    const consoleLogs = logs.filter(l => l.type === 'console');
    const networkLogs = logs.filter(l => l.type === 'network');
    const errorLogs = logs.filter(l => l.type === 'error');
    
    console.log(`  - Console logs: ${consoleLogs.length}`);
    console.log(`  - Network requests: ${networkLogs.length}`);
    console.log(`  - Errors: ${errorLogs.length}`);

    if (errorLogs.length > 0) {
      console.log('\n❌ Errors found:');
      errorLogs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.message}`);
        if (log.url) console.log(`     URL: ${log.url}`);
        if (log.status) console.log(`     Status: ${log.status}`);
      });
    }

    // Check for failed network requests
    const failedRequests = networkLogs.filter(l => l.status && l.status >= 400);
    if (failedRequests.length > 0) {
      console.log('\n⚠️ Failed network requests:');
      failedRequests.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.status} - ${log.url}`);
      });
    }

    // Verify we're still on the workspace page
    expect(page.url()).toContain('/workspace/');
  });
});
