# E2E Test Requirements

## Prerequisites

To run the E2E tests successfully, you need:

### 1. Development Environment Running

**Required Services:**
- ✅ **Next.js Dev Server** - Running on `http://localhost:3000`
  - The `playwright.config.ts` has `webServer` configured to auto-start this
  - But you can also run manually: `cd chartsmith-app && npm run dev`

- ✅ **PostgreSQL Database** - Running in Docker
  ```bash
  cd hack/chartsmith-dev
  docker compose up -d
  ```

- ✅ **Database Schema** - Migrations applied
  ```bash
  make schema
  ```

- ✅ **Bootstrap Data** - Default workspace data loaded
  ```bash
  make bootstrap
  ```
  This creates the `default-workspace` in `bootstrap_workspace` table which is required for workspace creation.

- ✅ **Go Worker** (Optional for basic tests, but needed for full functionality)
  ```bash
  make run-worker
  ```

### 2. Test Data Files

The tests use a test chart file:
- **Location**: `../testdata/charts/empty-chart-0.1.0.tgz`
- **Path relative to**: `chartsmith-app/tests/`
- **Must exist** for workspace creation tests

### 3. Environment Variables

**For Next.js** (`.env.local`):
- `NEXT_PUBLIC_ENABLE_TEST_AUTH=true` - Enables test authentication
- `ENABLE_TEST_AUTH=true` - Server-side test auth
- At least one LLM API key (for model tests):
  - `OPENROUTER_API_KEY` (recommended)
  - OR `ANTHROPIC_API_KEY`
  - OR `OPENAI_API_KEY`
  - OR `GOOGLE_GENERATIVE_AI_API_KEY`

**For Go Worker** (if running):
- `CHARTSMITH_PG_URI` - Database connection string
- `INTERNAL_API_KEY` - Must match Next.js `INTERNAL_API_KEY`

### 4. Playwright Browsers

Browsers must be installed:
```bash
cd chartsmith-app
npx playwright install
```

## Test Setup Flow

The tests now automatically:

1. **Login** - Uses `loginTestUser()` helper with test auth
2. **Create Workspace** - Uses `getOrCreateTestWorkspace()` helper which:
   - Uploads a test chart (`empty-chart-0.1.0.tgz`)
   - Waits for workspace to be created
   - Returns the workspace ID
   - Reuses workspace if it already exists

## Running Tests

```bash
cd chartsmith-app

# Run all E2E tests
npm run test:e2e

# Run with browser visible (for debugging)
npm run test:e2e:headed

# Run specific test file
npx playwright test model-selection.spec.ts

# Run in debug mode
npx playwright test --debug
```

## Common Issues

### Issue: "Workspace not found" or timeout waiting for workspace
**Solution**: 
- Ensure `make bootstrap` has been run
- Check that database is running: `docker ps`
- Verify bootstrap_workspace table has 'default-workspace' entry

### Issue: "Test chart file not found"
**Solution**:
- Ensure `testdata/charts/empty-chart-0.1.0.tgz` exists
- Path is relative to `chartsmith-app/tests/` directory

### Issue: "Page timeout" or "Element not found"
**Solution**:
- Ensure dev server is running on port 3000
- Check browser console for errors
- Increase timeout in test if needed
- Check that workspace was created successfully

### Issue: "Authentication failed"
**Solution**:
- Verify `NEXT_PUBLIC_ENABLE_TEST_AUTH=true` in `.env.local`
- Check that test auth route is working: visit `/login?test-auth=true`

### Issue: "Models API not responding"
**Solution**:
- Ensure at least one LLM API key is set in `.env.local`
- Check that `/api/models` endpoint is accessible

## Test Structure

### Helper Functions (`helpers.ts`)

- `loginTestUser(page)` - Logs in using test authentication
- `createTestWorkspace(page)` - Creates a workspace by uploading a chart
- `getOrCreateTestWorkspace(page, workspaceId?)` - Gets existing or creates new workspace

### Test Files

- `login.spec.ts` - Authentication flow
- `model-selection.spec.ts` - Model selector UI and functionality
- `multi-provider-chat.spec.ts` - Chat with different LLM providers
- `upload-chart.spec.ts` - Chart upload workflow
- `chat-scrolling.spec.ts` - Chat UI scrolling behavior
- `import-artifactory.spec.ts` - ArtifactHub import

## Debugging Tips

1. **Use headed mode** to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```

2. **Check screenshots** in `test-results/` directory

3. **View trace** files:
   ```bash
   npx playwright show-trace test-results/trace.zip
   ```

4. **Add console logs** in tests:
   ```typescript
   console.log('Current URL:', page.url());
   await page.screenshot({ path: 'debug.png' });
   ```

5. **Check network requests**:
   ```typescript
   page.on('request', request => console.log('Request:', request.url()));
   page.on('response', response => console.log('Response:', response.url(), response.status()));
   ```

## CI/CD Considerations

For CI/CD environments:
- Set `CI=true` environment variable
- Tests will retry on failure (2 retries)
- Tests run sequentially (1 worker) for stability
- Web server auto-starts (doesn't reuse existing)

