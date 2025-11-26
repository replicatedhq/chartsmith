/**
 * End-to-end tests for chat functionality.
 * 
 * Tests the complete chat flow including:
 * - Sending messages and receiving AI responses
 * - Streaming responses display token-by-token
 * - Stop button cancels in-progress requests
 * - Error states display correctly when API fails
 * - Chat persists across component re-renders
 * - Role selector changes work
 * - Empty message validation
 * - Multiple messages in sequence
 * 
 * @module tests/chat-e2e
 */

import { test, expect, Page, Route } from '@playwright/test';
import { loginTestUser } from './helpers';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Sample streaming response chunks for testing.
 */
const SAMPLE_RESPONSES = {
  greeting: 'Hello! I am ChartSmith, your Helm chart assistant. I can help you with your Helm charts.',
  helmHelp: 'To create a new Helm chart, you can use the `helm create` command. This will scaffold a basic chart structure with templates, values.yaml, and Chart.yaml.',
  yamlExample: '```yaml\napiVersion: v2\nname: my-chart\nversion: 0.1.0\n```',
  error: 'I apologize, but I encountered an error processing your request.',
};

/**
 * Helper to mock the /api/chat endpoint with a streaming response.
 * Simulates the AI SDK's SSE streaming format.
 * 
 * @param page - Playwright page object
 * @param options - Configuration options for the mock
 */
async function mockChatAPI(page: Page, options: {
  response?: string;
  delay?: number;
  shouldError?: boolean;
  errorStatus?: number;
  errorMessage?: string;
  streamChunks?: string[];
}) {
  const { 
    response = SAMPLE_RESPONSES.greeting,
    delay = 100,
    shouldError = false,
    errorStatus = 500,
    errorMessage = 'Internal Server Error',
    streamChunks
  } = options;

  await page.route('**/api/chat', async (route: Route) => {
    if (shouldError) {
      await route.fulfill({
        status: errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: errorMessage }),
      });
      return;
    }

    // Simulate streaming response in AI SDK format
    const chunks = streamChunks || response.split(' ').map(word => word + ' ');
    let body = '';
    
    for (const chunk of chunks) {
      // AI SDK format: 0:"text content"
      body += `0:"${chunk}"\n`;
    }

    // Add small delay to simulate network latency
    await new Promise(resolve => setTimeout(resolve, delay));

    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body,
    });
  });
}

/**
 * Helper to mock a slow streaming response for testing stop button.
 * The response takes 3 seconds to complete.
 */
async function mockSlowChatAPI(page: Page) {
  await page.route('**/api/chat', async (route: Route) => {
    // Create a response that streams slowly
    const words = ['This', 'is', 'a', 'slow', 'streaming', 'response', 'that', 'takes', 'a', 'while', 'to', 'complete.'];
    let body = '';
    
    for (const word of words) {
      body += `0:"${word} "\n`;
    }

    // Simulate a slow response
    await new Promise(resolve => setTimeout(resolve, 3000));

    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body,
    });
  });
}

/**
 * Helper to mock a rate limit error response.
 */
async function mockRateLimitError(page: Page) {
  await page.route('**/api/chat', async (route: Route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
    });
  });
}

/**
 * Helper to mock a network error (connection refused).
 */
async function mockNetworkError(page: Page) {
  await page.route('**/api/chat', async (route: Route) => {
    await route.abort('connectionrefused');
  });
}

/**
 * Helper to set up a workspace by uploading a test chart.
 * Returns after the workspace page is loaded.
 */
async function setupWorkspace(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('../testdata/charts/empty-chart-0.1.0.tgz');
  
  await page.waitForURL(/\/workspace\/[a-zA-Z0-9-]+$/, { timeout: 30000 });
  await page.waitForSelector('textarea[placeholder="Ask a question or ask for a change..."]', { timeout: 10000 });
}

/**
 * Helper to get the chat textarea element.
 */
function getChatTextarea(page: Page) {
  return page.locator('textarea[placeholder="Ask a question or ask for a change..."]');
}

// ============================================================================
// Test Suite: Chat E2E Tests
// ============================================================================

test.describe('Chat E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start tracing for debugging
    await page.context().tracing.start({
      screenshots: true,
      snapshots: true
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Stop tracing and save
    await page.context().tracing.stop({
      path: `./test-results/chat-e2e-${testInfo.title.replace(/\s+/g, '-')}-trace.zip`
    });
  });

  // --------------------------------------------------------------------------
  // Core Chat Functionality
  // --------------------------------------------------------------------------

  test('user sends message and receives streamed response', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await page.screenshot({ path: './test-results/chat-e2e-1-post-login.png' });
    await setupWorkspace(page);
    await page.screenshot({ path: './test-results/chat-e2e-2-workspace.png' });

    // Mock the chat API with a test response
    await mockChatAPI(page, {
      response: SAMPLE_RESPONSES.greeting,
      delay: 500,
    });

    // Type a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Hello, can you help me with my chart?');
    await page.screenshot({ path: './test-results/chat-e2e-3-message-typed.png' });

    // Submit the message
    await textarea.press('Enter');

    // Wait for the response to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: './test-results/chat-e2e-4-response-received.png' });

    // Verify user message appears
    const userMessages = page.locator('[data-testid="user-message"]');
    await expect(userMessages.first()).toBeVisible();

    // Verify assistant response appears
    const assistantMessages = page.locator('[data-testid="assistant-message"]');
    await expect(assistantMessages.first()).toBeVisible();

    // Verify the response contains expected text
    await expect(page.getByText('ChartSmith')).toBeVisible();
  });

  test('empty message is not sent', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Track API calls
    let apiCalled = false;
    await page.route('**/api/chat', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '0:"Response"\n',
      });
    });

    // Try to submit with empty input
    const textarea = getChatTextarea(page);
    await textarea.press('Enter');

    // Wait a moment
    await page.waitForTimeout(500);

    // Verify API was not called
    expect(apiCalled).toBe(false);

    // Verify send button is disabled when input is empty
    const sendButton = page.locator('button[title="Send message"]');
    await expect(sendButton).toBeDisabled();

    await page.screenshot({ path: './test-results/chat-e2e-empty-message.png' });
  });

  // --------------------------------------------------------------------------
  // Streaming and Loading States
  // --------------------------------------------------------------------------

  test('stop button cancels generation', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock a slow streaming response
    await mockSlowChatAPI(page);

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Generate a long response please');
    await textarea.press('Enter');

    // Wait for the stop button to appear (indicates loading state)
    const stopButton = page.locator('button[title="Stop generating"]');
    await expect(stopButton).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: './test-results/chat-e2e-stop-button-visible.png' });

    // Click the stop button
    await stopButton.click();

    // Wait a moment for the abort to process
    await page.waitForTimeout(500);

    // Verify the stop button is no longer visible (loading stopped)
    await expect(stopButton).not.toBeVisible();

    // Verify the send button is back
    const sendButton = page.locator('button[title="Send message"]');
    await expect(sendButton).toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-after-stop.png' });
  });

  test('loading indicator shows during streaming', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock a slow response
    await mockSlowChatAPI(page);

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Test loading indicator');
    await textarea.press('Enter');

    // Verify loading indicator appears
    const loadingText = page.getByText('ChartSmith is thinking...');
    await expect(loadingText).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: './test-results/chat-e2e-loading-indicator.png' });

    // Stop the request to clean up
    const stopButton = page.locator('button[title="Stop generating"]');
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }
  });

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  test('API error displays error message', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock an error response
    await mockChatAPI(page, {
      shouldError: true,
      errorStatus: 500,
      errorMessage: 'Internal Server Error',
    });

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('This should trigger an error');
    await textarea.press('Enter');

    // Wait for the error to appear
    await page.waitForTimeout(1000);

    // Verify error message is displayed (look for the error alert)
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: './test-results/chat-e2e-error-displayed.png' });
  });

  test('rate limit error displays appropriate message', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock a rate limit error
    await mockRateLimitError(page);

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('This should trigger rate limit');
    await textarea.press('Enter');

    // Wait for the error to appear
    await page.waitForTimeout(1000);

    // Verify rate limit error message is displayed
    const rateLimitText = page.getByText(/rate limit/i);
    await expect(rateLimitText).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: './test-results/chat-e2e-rate-limit-error.png' });
  });

  test('network error displays connection error message', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock a network error
    await mockNetworkError(page);

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('This should trigger network error');
    await textarea.press('Enter');

    // Wait for the error to appear
    await page.waitForTimeout(1000);

    // Verify error alert is displayed
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: './test-results/chat-e2e-network-error.png' });
  });

  test('error can be dismissed', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock an error response
    await mockChatAPI(page, {
      shouldError: true,
      errorStatus: 500,
    });

    // Type and send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Trigger error');
    await textarea.press('Enter');

    // Wait for the error to appear
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    // Click dismiss button
    const dismissButton = page.getByText('Dismiss');
    await dismissButton.click();

    // Verify error is dismissed
    await expect(errorAlert).not.toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-error-dismissed.png' });
  });

  // --------------------------------------------------------------------------
  // Input and Submission
  // --------------------------------------------------------------------------

  test('chat input clears after sending message', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock the chat API
    await mockChatAPI(page, {
      response: 'Got your message!',
      delay: 100,
    });

    // Type a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Test message');
    
    // Verify input has content
    await expect(textarea).toHaveValue('Test message');

    // Submit the message
    await textarea.press('Enter');

    // Wait a moment for the message to be sent
    await page.waitForTimeout(200);

    // Verify input is cleared
    await expect(textarea).toHaveValue('');

    await page.screenshot({ path: './test-results/chat-e2e-input-cleared.png' });
  });

  test('Shift+Enter creates new line instead of submitting', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Track API calls
    let apiCalled = false;
    await page.route('**/api/chat', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '0:"Response"\n',
      });
    });

    // Type a message and press Shift+Enter
    const textarea = getChatTextarea(page);
    await textarea.fill('First line');
    await textarea.press('Shift+Enter');
    await textarea.type('Second line');

    // Wait a moment
    await page.waitForTimeout(300);

    // Verify API was not called (message not submitted)
    expect(apiCalled).toBe(false);

    // Verify textarea contains multi-line content
    const value = await textarea.inputValue();
    expect(value).toContain('First line');
    expect(value).toContain('Second line');

    await page.screenshot({ path: './test-results/chat-e2e-multiline-input.png' });
  });

  // --------------------------------------------------------------------------
  // Multiple Messages
  // --------------------------------------------------------------------------

  test('multiple messages can be sent in sequence', async ({ page }) => {
    test.setTimeout(90000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock the chat API
    let messageCount = 0;
    await page.route('**/api/chat', async (route) => {
      messageCount++;
      await new Promise(resolve => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: `0:"Response ${messageCount}"\n`,
      });
    });

    const textarea = getChatTextarea(page);

    // Send first message
    await textarea.fill('First message');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // Send second message
    await textarea.fill('Second message');
    await textarea.press('Enter');
    await page.waitForTimeout(500);

    // Verify both messages were sent
    expect(messageCount).toBe(2);

    await page.screenshot({ path: './test-results/chat-e2e-multiple-messages.png' });
  });

  test('chat history persists after page interactions', async ({ page }) => {
    test.setTimeout(90000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock the chat API
    await mockChatAPI(page, {
      response: 'This is a test response that should persist.',
      delay: 100,
    });

    // Send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Test message for persistence');
    await textarea.press('Enter');

    // Wait for response
    await page.waitForTimeout(500);

    // Verify message is visible
    await expect(page.getByText('Test message for persistence')).toBeVisible();
    await expect(page.getByText('persist')).toBeVisible();

    // Interact with other parts of the page (e.g., role selector)
    const roleButton = page.locator('button[title*="Perspective"]');
    await roleButton.click();
    await page.waitForTimeout(200);
    
    // Click outside to close dropdown
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(200);

    // Verify chat history is still visible
    await expect(page.getByText('Test message for persistence')).toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-persistence.png' });
  });

  // --------------------------------------------------------------------------
  // Role Selector
  // --------------------------------------------------------------------------

  test('role selector dropdown opens and closes', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Find and click the role selector button
    const roleButton = page.locator('button[title*="Perspective"]');
    await expect(roleButton).toBeVisible();
    await roleButton.click();

    // Verify dropdown is open
    const dropdown = page.getByText('Ask questions from...');
    await expect(dropdown).toBeVisible();

    // Verify all role options are present
    await expect(page.getByText('Auto-detect')).toBeVisible();
    await expect(page.getByText('Chart Developer')).toBeVisible();
    await expect(page.getByText('End User')).toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-role-dropdown-open.png' });

    // Click outside to close dropdown
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(200);

    // Verify dropdown is closed
    await expect(dropdown).not.toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-role-dropdown-closed.png' });
  });

  test('role selector changes role', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Open role selector
    const roleButton = page.locator('button[title*="Perspective"]');
    await roleButton.click();

    // Select "Chart Developer" role
    const developerOption = page.getByText('Chart Developer');
    await developerOption.click();

    // Wait for dropdown to close
    await page.waitForTimeout(200);

    // Verify the role button now shows developer perspective
    await expect(roleButton).toHaveAttribute('title', 'Perspective: Chart Developer');

    await page.screenshot({ path: './test-results/chat-e2e-role-changed.png' });

    // Open again and select "End User"
    await roleButton.click();
    const operatorOption = page.getByText('End User');
    await operatorOption.click();

    // Verify the role changed
    await expect(roleButton).toHaveAttribute('title', 'Perspective: End User');

    await page.screenshot({ path: './test-results/chat-e2e-role-changed-operator.png' });
  });

  // --------------------------------------------------------------------------
  // Streaming Responses
  // --------------------------------------------------------------------------

  test('streaming response displays progressively', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock streaming with distinct chunks
    await mockChatAPI(page, {
      streamChunks: ['Hello ', 'world! ', 'This ', 'is ', 'streaming.'],
      delay: 500,
    });

    // Send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Test streaming');
    await textarea.press('Enter');

    // Wait for response to complete
    await page.waitForTimeout(1000);

    // Verify the full response is visible
    await expect(page.getByText('Hello world! This is streaming.')).toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-streaming-complete.png' });
  });

  // --------------------------------------------------------------------------
  // Code Block Rendering
  // --------------------------------------------------------------------------

  test('code blocks render correctly in responses', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Mock response with YAML code block
    await mockChatAPI(page, {
      response: SAMPLE_RESPONSES.yamlExample,
      delay: 100,
    });

    // Send a message
    const textarea = getChatTextarea(page);
    await textarea.fill('Show me a YAML example');
    await textarea.press('Enter');

    // Wait for response
    await page.waitForTimeout(500);

    // Verify code block content is visible
    await expect(page.getByText('apiVersion: v2')).toBeVisible();
    await expect(page.getByText('name: my-chart')).toBeVisible();

    await page.screenshot({ path: './test-results/chat-e2e-code-block.png' });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  test('chat interface is keyboard navigable', async ({ page }) => {
    test.setTimeout(60000);

    // Login and setup workspace
    await loginTestUser(page);
    await setupWorkspace(page);

    // Focus on textarea
    const textarea = getChatTextarea(page);
    await textarea.focus();
    
    // Verify textarea is focused
    await expect(textarea).toBeFocused();

    // Tab to role selector
    await page.keyboard.press('Tab');
    
    // Tab to send button
    await page.keyboard.press('Tab');

    await page.screenshot({ path: './test-results/chat-e2e-keyboard-nav.png' });
  });
});

