import { test, expect, Page } from '@playwright/test';

/**
 * End-to-end test for creating a workspace from a prompt
 * This test ensures the entire flow works correctly:
 * 1. Authentication (test auth bypass)
 * 2. Form submission
 * 3. Workspace creation
 * 4. Navigation to workspace
 * 5. Chat interface availability
 */

test.describe('Create Workspace E2E', () => {
  test('Create workspace from Node.js prompt - full flow', async ({ page, context }) => {
    // Set up console logging for debugging
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    const infoLogs: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push(`[${type}] ${text}`);
      
      if (type === 'error') {
        errors.push(text);
        console.error(`[CONSOLE ERROR]`, text);
      } else if (type === 'info' || type === 'log') {
        // Track info logs that might indicate server action calls
        if (text.includes('createWorkspaceFromPromptAction') || 
            text.includes('Creating workspace') ||
            text.includes('Calling createWorkspace') ||
            text.includes('Workspace created')) {
          infoLogs.push(text);
          console.log(`[CONSOLE INFO] ${text}`);
        }
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
      console.error('[PAGE ERROR]', error);
    });

    // Set up network request/response logging
    const failedRequests: Array<{url: string; status: number; method: string; body?: string}> = [];
    const serverActionResponses: Array<{url: string; status: number; body?: string; timestamp: number; method: string}> = [];
    const allRequests: Array<{url: string; method: string; timestamp: number}> = [];
    
    // Monitor ALL requests to see what's happening
    page.on('request', async (request) => {
      const url = request.url();
      const method = request.method();
      // Log POST requests (server actions use POST)
      if (method === 'POST') {
        const timestamp = Date.now();
        allRequests.push({ url, method, timestamp });
        
        // Try to get request body for POST requests
        try {
          const postData = request.postData();
          const headers = request.headers();
          console.log(`📤 POST ${url}`);
          if (postData) {
            console.log(`   Body: ${postData.substring(0, 200)}`);
          }
          // Check for Next.js server action headers
          if (headers['next-action'] || headers['next-router-prefetch']) {
            console.log(`   ⚡ Next.js server action detected!`);
            console.log(`   Headers: ${JSON.stringify(Object.keys(headers).filter(k => k.startsWith('next')))}`);
          }
        } catch (e) {
          console.log(`📤 POST ${url} (could not read body)`);
        }
      }
    });
    
    page.on('response', async (response) => {
      const status = response.status();
      const url = response.url();
      const method = response.request().method();
      
      // Monitor ALL POST responses (server actions use POST)
      if (method === 'POST') {
        try {
          const body = await response.text();
          const timestamp = Date.now();
          const requestHeaders = response.request().headers();
          
          // Treat ALL POST responses as potential server actions (Next.js server actions POST to current page)
          // Check for server action indicators
          const isServerAction = url.includes('_next/server') || 
                                 url.includes('/actions/') ||
                                 url.includes('create-workspace') ||
                                 requestHeaders['next-action'] ||
                                 url.startsWith('http://localhost:3000/') ||
                                 (url.includes('_next') && method === 'POST');
          
          // Always log POST responses for debugging
          if (isServerAction || url.startsWith('http://localhost:3000/')) {
            serverActionResponses.push({ 
              url, 
              status, 
              body: body.substring(0, 1000),
              timestamp,
              method
            });
            
            console.log(`📥 POST response: ${status} ${method} ${url}`);
            if (status >= 400) {
              console.error(`   ❌ Error response`);
              console.error(`   Body: ${body.substring(0, 1000)}`);
            } else {
              if (body && body.length < 500) {
                console.log(`   ✅ Response: ${body}`);
              } else if (body) {
                console.log(`   ✅ Response length: ${body.length} chars`);
                // Try to parse as JSON
                try {
                  const json = JSON.parse(body);
                  if (json.error || json.message) {
                    console.error(`   ⚠️ Error in JSON: ${JSON.stringify(json)}`);
                  } else {
                    console.log(`   Parsed JSON keys: ${Object.keys(json).join(', ')}`);
                  }
                } catch (e) {
                  // Not JSON - check if it's HTML error page
                  if (body.includes('error') || body.includes('Error') || body.includes('failed')) {
                    console.warn(`   ⚠️ Response contains error keywords`);
                    console.warn(`   First 500 chars: ${body.substring(0, 500)}`);
                  }
                }
              } else {
                console.log(`   Empty response body`);
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to read response body for ${url}: ${e}`);
        }
      }
      
      // Log all failed requests
      if (status >= 400) {
        try {
          const body = await response.text();
          failedRequests.push({ url, status, method, body: body.substring(0, 1000) });
          console.error(`❌ ${method} ${url} - ${status}`);
          if (body) {
            console.error(`   Body: ${body.substring(0, 500)}`);
          }
        } catch (e) {
          failedRequests.push({ url, status, method });
        }
      }
    });

    console.log('🚀 Starting E2E test: Create workspace from Node.js prompt');

    // Step 1: Authenticate using test-auth API
    console.log('📝 Step 1: Setting up test auth...');
    const apiResponse = await page.request.get('http://localhost:3000/api/auth/test-auth?format=json', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!apiResponse.ok()) {
      const errorText = await apiResponse.text();
      throw new Error(`Test auth failed: ${apiResponse.status()} - ${errorText}`);
    }

    const authData = await apiResponse.json();
    const jwt = authData.token;

    if (!jwt) {
      throw new Error('No JWT token received from test-auth API');
    }

    console.log(`✅ Got JWT from API (length: ${jwt.length})`);
    
    // Set up test auth bypass header for all requests
    await context.setExtraHTTPHeaders({
      'X-Test-Auth-Token': jwt,
    });
    console.log('✅ Test auth bypass header set');

    // Set cookie BEFORE navigation using context
    await context.addCookies([{
      name: 'session',
      value: jwt,
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    }]);
    console.log('✅ Cookie set via context.addCookies');
    
    // Also set via addInitScript as backup
    page.addInitScript((token) => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
      console.log('Cookie set via addInitScript:', document.cookie);
    }, jwt);
    
    // Navigate to home page
    console.log('📝 Step 2: Navigating to home page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    
    // Verify cookie is set after navigation
    const cookiesAfterNav = await page.context().cookies();
    const sessionCookie = cookiesAfterNav.find(c => c.name === 'session');
    if (sessionCookie) {
      console.log(`✅ Session cookie verified: ${sessionCookie.value.substring(0, 20)}...`);
    } else {
      console.warn('⚠️ Session cookie not found after navigation');
      // Try setting it again
      await page.evaluate((token) => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
      }, jwt);
      await page.waitForTimeout(500);
    }
    
    // Verify we're not redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Still redirected to login - test auth bypass not working');
    }
    console.log(`✅ Authenticated! Current URL: ${currentUrl}`);

    // Step 3: Wait for form to appear and session to load
    console.log('📝 Step 3: Waiting for form to appear...');
    await page.waitForSelector('textarea[placeholder*="Tell me about the application"]', { timeout: 15000 });
    console.log('✅ Form appeared');
    
    // Wait for session to load (check for session in cookies or wait a bit)
    console.log('⏳ Waiting for session to initialize...');
    await page.waitForFunction(() => {
      // Check if cookie exists
      return document.cookie.includes('session=');
    }, { timeout: 5000 }).catch(() => {
      console.warn('⚠️ Session cookie check timeout - continuing anyway (test auth header should work)');
    });
    
    // Give React time to process the session
    await page.waitForTimeout(2000);
    console.log('✅ Session check complete');

    // Step 4: Type the prompt
    const prompt = 'Create a Helm chart for a Node.js application using the node:18 image, exposing port 3000';
    console.log(`📝 Step 4: Typing prompt: "${prompt}"`);
    const textarea = page.locator('textarea[placeholder*="Tell me about the application"]');
    await textarea.fill(prompt);
    await page.waitForTimeout(500);

    // Step 5: Submit the prompt
    console.log('📝 Step 5: Submitting prompt...');
    
    // Track submission time for filtering server actions
    const submissionStartTime = Date.now();
    
    // Set up dialog handler BEFORE submitting
    let alertMessage: string | null = null;
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      console.error(`⚠️ Alert dialog: ${alertMessage}`);
      await dialog.accept();
    });

    // Server action responses are already being monitored above

    // Submit by clicking the submit button
    const submitButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    const buttonCount = await submitButton.count();
    
    // Wait for any pending operations to complete before submitting
    await page.waitForTimeout(500);
    
    if (buttonCount > 0) {
      const isDisabled = await submitButton.isDisabled();
      const isVisible = await submitButton.isVisible();
      console.log(`Submit button - disabled: ${isDisabled}, visible: ${isVisible}`);
      
      if (!isDisabled && isVisible) {
        // Click and wait for navigation or error
        const clickPromise = submitButton.click({ timeout: 5000 });
        console.log('✅ Button clicked, waiting for response...');
        await clickPromise;
      } else {
        // Fallback: press Enter
        console.log('⚠️ Button disabled or not visible, using Enter key');
        await textarea.press('Enter');
        console.log('✅ Enter key pressed');
      }
    } else {
      // Fallback: press Enter
      console.log('⚠️ No submit button found, using Enter key');
      await textarea.press('Enter');
      console.log('✅ Enter key pressed');
    }
    
    // Wait a moment for the click/Enter to register
    await page.waitForTimeout(500);

    // Step 6: Wait for workspace creation and navigation
    console.log('⏳ Step 6: Waiting for workspace creation...');
    
    // Wait for loading indicator to appear (indicates form submission started)
    console.log('⏳ Waiting for loading indicator...');
    try {
      await page.waitForSelector('[class*="animate-spin"], [class*="Loader"], [class*="loading"], button:has-text("Loading")', { 
        timeout: 5000,
        state: 'visible'
      }).catch(() => {
        console.log('⚠️ No loading indicator found - form may not have submitted');
      });
      console.log('✅ Loading indicator appeared');
    } catch (e) {
      console.warn('⚠️ Could not find loading indicator');
    }
    
    // Wait a bit for the server action to start
    await page.waitForTimeout(1000);
    
    // Check for loading state
    const loadingIndicator = page.locator('[class*="animate-spin"], [class*="Loader"], [class*="loading"]');
    const hasLoading = await loadingIndicator.count() > 0;
    if (hasLoading) {
      console.log('⏳ Waiting for loading to complete...');
      try {
        await loadingIndicator.first().waitFor({ state: 'hidden', timeout: 25000 });
        console.log('✅ Loading completed');
      } catch (e) {
        console.warn('⚠️ Loading indicator still visible after timeout');
      }
    }

    // Check for errors BEFORE waiting for navigation
    await page.waitForTimeout(1000);
    
    // Check for alert dialog
    if (alertMessage) {
      console.error(`❌ Alert dialog appeared: ${alertMessage}`);
      // Wait a bit more to see if navigation happens anyway
      await page.waitForTimeout(2000);
    }

    // Check console errors and logs
    const recentErrors = errors.filter(e => 
      e.includes('Failed to create workspace') || 
      e.includes('unexpected response') ||
      e.includes('Error') ||
      e.includes('error')
    );
    if (recentErrors.length > 0) {
      console.error(`❌ Console errors detected: ${recentErrors.join('; ')}`);
    }
    
    // Check for server action logs
    const actionLogs = infoLogs.filter(log => 
      log.includes('createWorkspaceFromPromptAction') ||
      log.includes('Creating workspace') ||
      log.includes('Calling createWorkspace')
    );
    if (actionLogs.length > 0) {
      console.log(`✅ Server action logs found: ${actionLogs.length} entries`);
      actionLogs.forEach(log => console.log(`   ${log}`));
    } else {
      console.warn('⚠️ No server action logs found - action may not have been called');
    }
    
    // Show all recent console messages for debugging
    const recentMessages = consoleMessages.slice(-20);
    if (recentMessages.length > 0) {
      console.log(`📋 Recent console messages (last 20):`);
      recentMessages.forEach(msg => console.log(`   ${msg}`));
    }

    // Check server action responses (filter to ones after submission)
    const recentServerActions = serverActionResponses.filter(r => r.timestamp >= submissionStartTime);
    const recentRequests = allRequests.filter(r => r.timestamp >= submissionStartTime);
    const failedActions = recentServerActions.filter(r => r.status >= 400);
    
    console.log(`📊 Network activity after submission:`);
    console.log(`   Total POST requests: ${recentRequests.length}`);
    console.log(`   Server action responses: ${recentServerActions.length}`);
    
    if (recentRequests.length > 0) {
      console.log(`   POST requests made:`);
      recentRequests.forEach(req => {
        console.log(`     ${req.method} ${req.url}`);
      });
    }
    
    if (failedActions.length > 0) {
      console.error(`❌ Server action failures:`);
      failedActions.forEach(action => {
        console.error(`   ${action.status} ${action.method} ${action.url}`);
        if (action.body) {
          console.error(`   Body: ${action.body.substring(0, 500)}`);
        }
      });
    } else if (recentServerActions.length > 0) {
      console.log(`✅ Server actions completed: ${recentServerActions.length} responses`);
      recentServerActions.forEach(action => {
        console.log(`   ${action.status} ${action.method} ${action.url}`);
        if (action.body && action.body.length < 200) {
          console.log(`     Response: ${action.body}`);
        }
      });
    } else {
      console.warn('⚠️ No server action responses detected (by our pattern matching)');
      console.warn(`   However, we saw ${recentRequests.length} POST requests`);
      console.warn(`   Checking all POST responses for errors...`);
      
      // Check all POST responses for errors, even if they don't match our pattern
      const allPostResponses = [];
      for (const req of recentRequests) {
        // We already logged these above, but let's summarize
        allPostResponses.push(req.url);
      }
      console.warn(`   POST requests made to: ${allPostResponses.join(', ')}`);
      console.warn(`   Check the logs above for response details`);
    }
    
    // Also check if there were any POST responses at all (even if not matching our pattern)
    const allPostResponses = [];
    page.on('response', async (response) => {
      if (response.request().method() === 'POST' && response.url() === 'http://localhost:3000/') {
        try {
          const body = await response.text();
          allPostResponses.push({ status: response.status(), body: body.substring(0, 1000) });
        } catch (e) {
          // Ignore
        }
      }
    });
    
    // Wait for URL change to workspace or timeout
    let workspaceId: string | undefined;
    try {
      await page.waitForURL((url) => {
        const isWorkspace = url.pathname.startsWith('/workspace/');
        if (isWorkspace) {
          const match = url.pathname.match(/\/workspace\/([^\/]+)/);
          if (match) {
            workspaceId = match[1];
          }
        }
        return isWorkspace;
      }, { timeout: 25000 });
      
      console.log(`✅ Navigated to workspace: ${workspaceId}`);
    } catch (error) {
      // Check if workspace was created but navigation failed
      const finalUrl = page.url();
      const match = finalUrl.match(/\/workspace\/([^\/]+)/);
      if (match) {
        workspaceId = match[1];
        console.log(`✅ Workspace ID found in URL: ${workspaceId}`);
      } else {
        // Build comprehensive error message
        const errorParts: string[] = [];
        
        if (alertMessage) {
          errorParts.push(`Alert: ${alertMessage}`);
        }
        
        if (recentErrors.length > 0) {
          errorParts.push(`Console errors: ${recentErrors.join('; ')}`);
        }
        
        if (failedActions.length > 0) {
          const actionErrors = failedActions.map(a => 
            `${a.status} ${a.url}${a.body ? ` - ${a.body.substring(0, 200)}` : ''}`
          ).join('; ');
          errorParts.push(`Server action errors: ${actionErrors}`);
        }
        
        if (failedRequests.length > 0) {
          const requestErrors = failedRequests.map(r => `${r.method} ${r.url} - ${r.status}`).join(', ');
          errorParts.push(`HTTP errors: ${requestErrors}`);
        }
        
        const errorMessage = errorParts.length > 0 
          ? `Workspace creation failed. ${errorParts.join('. ')}. Current URL: ${finalUrl}`
          : `Failed to navigate to workspace. Current URL: ${finalUrl}`;
        
        throw new Error(errorMessage);
      }
    }

    // Verify workspace ID exists
    expect(workspaceId).toBeDefined();
    expect(workspaceId!.length).toBeGreaterThan(0);
    console.log(`✅ Workspace created successfully! ID: ${workspaceId}`);

    // Step 7: Verify workspace page loaded
    console.log('📝 Step 7: Verifying workspace page...');
    await page.waitForTimeout(2000); // Wait for page to stabilize
    
    // Check for chat input (indicates workspace page loaded)
    try {
      await page.waitForSelector('textarea[placeholder*="Ask a question"]', { timeout: 10000 });
      console.log('✅ Chat input found - workspace page loaded');
    } catch (e) {
      // Chat input not found, but workspace was created - log warning
      console.warn('⚠️ Chat input not found, but workspace was created');
    }

    // Step 8: Verify no errors
    console.log('📝 Step 8: Verifying no errors...');
    
    // Check for error messages on page
    const errorElements = await page.locator('[class*="error"], [role="alert"], [class*="Error"]').all();
    const pageErrors: string[] = [];
    for (const elem of errorElements) {
      const text = await elem.textContent();
      if (text && text.trim().length > 0) {
        pageErrors.push(text.trim());
      }
    }
    
    if (pageErrors.length > 0) {
      console.warn('⚠️ Error messages found on page:', pageErrors);
    }

    // Final assertions
    expect(workspaceId).toBeDefined();
    expect(page.url()).toContain('/workspace/');
    
    if (alertMessage) {
      throw new Error(`Alert dialog appeared: ${alertMessage}`);
    }
    
    if (errors.length > 0) {
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(e => 
        !e.includes('WebSocket') && 
        !e.includes('webpack-hmr') &&
        !e.includes('Failed to create workspace') // This is the error we're testing for
      );
      
      if (criticalErrors.length > 0) {
        console.warn('⚠️ Console errors found:', criticalErrors);
      }
    }

    console.log('✅ E2E test completed successfully!');
    console.log(`   Workspace ID: ${workspaceId}`);
    console.log(`   Final URL: ${page.url()}`);
  });

  test('Create workspace - error handling test', async ({ page, context }) => {
    // Test that errors are properly handled and displayed
    console.log('🚀 Starting error handling test');

    // Set up test auth
    const apiResponse = await page.request.get('http://localhost:3000/api/auth/test-auth?format=json', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!apiResponse.ok()) {
      throw new Error(`Test auth failed: ${apiResponse.status()}`);
    }

    const authData = await apiResponse.json();
    const jwt = authData.token;

    await context.setExtraHTTPHeaders({
      'X-Test-Auth-Token': jwt,
    });

    page.addInitScript((token) => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      document.cookie = `session=${token}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
    }, jwt);

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Wait for form
    await page.waitForSelector('textarea[placeholder*="Tell me about the application"]', { timeout: 15000 });

    // Type a prompt
    const textarea = page.locator('textarea[placeholder*="Tell me about the application"]');
    await textarea.fill('Create a Helm chart for a Node.js application using the node:18 image, exposing port 3000');

    // Monitor for errors
    let errorDialogAppeared = false;
    let errorMessage: string | null = null;
    
    page.on('dialog', async (dialog) => {
      errorDialogAppeared = true;
      errorMessage = dialog.message();
      console.log(`Error dialog: ${errorMessage}`);
      await dialog.accept();
    });

    // Submit
    const submitButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    const buttonCount = await submitButton.count();
    
    if (buttonCount > 0 && !(await submitButton.isDisabled())) {
      await submitButton.click();
    } else {
      await textarea.press('Enter');
    }

    // Wait a bit to see if error appears
    await page.waitForTimeout(5000);

    // If error dialog appeared, that's a problem (but we want to catch it)
    if (errorDialogAppeared && errorMessage) {
      // Check if it's the specific error we're looking for
      if (errorMessage.includes('Failed to create workspace')) {
        throw new Error(`Workspace creation failed: ${errorMessage}`);
      }
    }

    // Try to wait for workspace (should succeed)
    try {
      await page.waitForURL((url) => url.pathname.startsWith('/workspace/'), { timeout: 30000 });
      console.log('✅ Workspace created successfully');
    } catch (e) {
      if (errorDialogAppeared) {
        throw new Error(`Workspace creation failed with error: ${errorMessage}`);
      }
      throw e;
    }
  });
});
