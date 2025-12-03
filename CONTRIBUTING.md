# Contributing

This doc is a development guide for how engineers can contribute to this project.

## Development Environment Setup

### Prerequisites

- macOS
- Docker Desktop
- Go 1.24 or later
- Node.js 18 and nvm 
- npm
- [Schemahero](https://schemahero.io/docs/installation/) (must rename the binary to `schemahero` and put on path)
- A SQL DB editor available. Consider Beekeeper Studio if you don't already have one available

### Required Secrets

You'll need to configure secrets in two places:

#### 1. Environment Variables (for Go Worker)

Export these in your shell before running `make run-worker`:

```bash
# Required - API Keys
export GROQ_API_KEY=your-groq-key                  # Get from groq.com
export VOYAGE_API_KEY=your-voyage-key              # Get from voyageai.com

# Required - Infrastructure
export CHARTSMITH_PG_URI=postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable
export CHARTSMITH_CENTRIFUGO_ADDRESS=http://localhost:8000/api
export CHARTSMITH_CENTRIFUGO_API_KEY=api_key

# Optional (has defaults)
export INTERNAL_API_KEY=dev-internal-key           # For worker→Next.js auth (default: dev-internal-key)
```

**Note:** You can ignore `CHARTSMITH_TOKEN_ENCRYPTION`, `CHARTSMITH_SLACK_TOKEN`, and `CHARTSMITH_SLACK_CHANNEL` for local development.

#### 2. Next.js Environment File (`.env.local`)

Create `chartsmith-app/.env.local` with the following content:

```bash
# Google Auth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google
GOOGLE_CLIENT_SECRET=<get from 1password>

# Security
HMAC_SECRET=not-secure
TOKEN_ENCRYPTION=H5984PaaBSbFZTMKjHiqshqRCG4dg49JAs0dDdLbvEs=

# Centrifugo
CENTRIFUGO_TOKEN_HMAC_SECRET=change.me
NEXT_PUBLIC_CENTRIFUGO_ADDRESS=ws://localhost:8000/connection/websocket

# Replicated
NEXT_PUBLIC_REPLICATED_REDIRECT_URI=https://vendor-web-<youruser>.okteto.repldev.com/chartsmith-login?redirect_uri=https://chartsmith-app-<youruser>.okteto.repldev.com/auth/replicated

# LLM Provider Keys - Add at least one
# If OpenRouter is set: Uses it exclusively (ignores others)
# Otherwise: Mix-and-match from available providers (Anthropic, OpenAI, Google)
OPENROUTER_API_KEY=sk-or-v1-...           # Recommended: Access to all models
ANTHROPIC_API_KEY=sk-ant-...              # Alternative: Direct Anthropic
OPENAI_API_KEY=sk-proj-...                # Alternative: Direct OpenAI
GOOGLE_GENERATIVE_AI_API_KEY=...          # Alternative: Direct Google

# Worker Communication (optional - defaults to dev-internal-key if not set)
INTERNAL_API_KEY=dev-internal-key         # Must match worker's INTERNAL_API_KEY

# Test Auth
NEXT_PUBLIC_ENABLE_TEST_AUTH=true
ENABLE_TEST_AUTH=true

# API
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000/api
```

### Setup Steps

1. **Start the Development Environment**

   ```bash
   cd hack/chartsmith-dev
   docker compose up -d
   ```

2. **Open Four Terminal Windows**

   You'll need to run multiple services simultaneously. Open four separate terminal windows and navigate to the project root in each.

3. **Terminal 1: Frontend Development**
   ```bash
   cd chartsmith-app
   npm install
   npm run dev
   ```
   This starts the frontend development server.

4. **Terminal 2: Backend Worker**
   ```bash
   make run-worker
   ```
   This runs the backend worker service.

5. **Terminal 3: Database Schema**
   ```bash
   make schema
   ```
   This deploys the Schemahero migrations to set up the database schema.

6. **Terminal 4: Bootstrap Chart Data**
   ```bash
   make bootstrap
   ```
   This is a **critical step** that initializes the chart data in the database. Without this step, the application won't have the necessary template data to function properly.

7. **Admin Access**
   
   The first user to log in will automatically be granted admin privileges and bypass the waitlist.
   You can log in at: http://localhost:3000/login?test-auth=true


### Troubleshooting

If you encounter any issues:

1. Ensure Docker is running and all containers are up
2. Verify all required secrets are properly configured
3. Check that Schemahero is installed and accessible in your PATH
4. Make sure all dependencies are installed (both Go and npm packages)
5. If you get an error `ERROR: type "vector" does not exist` when running `make schema`, you can manually enable the PGVector extension:
   ```bash
   docker exec -it chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```
   Or simply run the Make target that handles this:
   ```bash
   make pgvector
   ```
   After enabling the extension, run `make schema` again (though it now automatically runs the pgvector target as a prerequisite).

### Development Workflow

1. Make changes to the code
2. The frontend will automatically reload with changes
3. The worker will need to be restarted if you make backend changes

## VS Code Extension Development

For detailed instructions on developing the VS Code extension, see [chartsmith-extension/DEVELOPMENT.md](chartsmith-extension/DEVELOPMENT.md). 

This guide covers:
- Building and installing the extension from a VSIX file
- Configuring endpoints for local development
- Enabling development mode
- Debugging with the developer console
- Testing extension features with built-in commands

## LLM Integration

Chartsmith uses Vercel AI SDK for LLM operations to support multiple providers.

### Provider Configuration

**All LLM API keys are configured in Next.js only** (see the `.env.local` setup in the "Required Secrets" section above).

The Go worker communicates with Next.js for all LLM operations and requires:

```bash
export INTERNAL_API_KEY=dev-internal-key  # Development (default)
# In production, use: export INTERNAL_API_KEY=$(openssl rand -hex 32)
```

This `INTERNAL_API_KEY` is used to authenticate the worker when calling Next.js LLM API endpoints. The Next.js app must have the same key in its `.env.local` file.

### Adding or Changing Models

All recommended models are stored in `chartsmith-app/lib/llm/registry.ts`. There are two arrays to manage:

1. **`VERIFIED_MODELS`** - Direct provider models (Anthropic, OpenAI, Google)
   - Use direct API model IDs (e.g., `claude-3-5-sonnet-20241022`, `gpt-4o`, `gemini-1.5-pro`)
   - These models are shown when using direct provider API keys (not OpenRouter)

2. **`OPENROUTER_MODELS`** - OpenRouter models
   - Use OpenRouter's format: `provider/model-id` (e.g., `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`)
   - These models are shown when OpenRouter API key is configured

**To add a new model:**

1. Open `chartsmith-app/lib/llm/registry.ts`
2. Add the model to the appropriate array (`VERIFIED_MODELS` or `OPENROUTER_MODELS`)
3. Include all required fields:
   - `id`: Model identifier (verify format matches provider's API)
   - `name`: Display name
   - `provider`: Provider name (`anthropic`, `openai`, `google`, or `openrouter`)
   - `description`: Brief description for users
   - `contextWindow`: Context window size in tokens
   - `supportsTools`: Whether the model supports tool/function calling (usually `true`)

**Important:** Verify model IDs match the official provider documentation. The models are automatically exposed via the `/api/models` endpoint and appear in the model selector UI.

All LLM operations go through the Next.js API layer, which handles provider selection and API key management based on the `.env.local` configuration.

## Testing

Chartsmith uses a comprehensive testing strategy covering unit tests, integration tests, and end-to-end tests.

### Test Frameworks

| Test Type | Framework | Location | Command |
|-----------|-----------|----------|---------|
| **Frontend Unit** | Jest + Testing Library | `chartsmith-app/` | `npm run test:unit` |
| **Frontend E2E** | Playwright | `chartsmith-app/tests/` | `npm run test:e2e` |
| **Backend Unit** | Go testing | `pkg/` | `go test ./...` |
| **Full Suite** | Both | Root | `npm test` |

### Running Tests

#### Frontend Unit Tests (Jest)

```bash
cd chartsmith-app
npm run test:unit          # Run all unit tests
npm run test:watch         # Run in watch mode
npm run test:parseDiff     # Run specific test
```

**Test Files:**
- `lib/llm/__tests__/config.test.ts` - Registry and model configuration
- `lib/llm/__tests__/api-models.test.ts` - Models API endpoint
- `lib/llm/__tests__/api-routes.test.ts` - LLM API routes
- `atoms/__tests__/workspace.test.ts` - State management
- `hooks/__tests__/parseDiff.test.ts` - Diff parsing
- `components/__tests__/FileTree.test.ts` - Components

#### Frontend E2E Tests (Playwright)

**First-time setup:**
```bash
cd chartsmith-app
npx playwright install     # Install browser binaries (required once)
```

**Running tests:**
```bash
cd chartsmith-app
npm run test:e2e           # Run all E2E tests
npm run test:e2e:headed    # Run with browser visible
```

**Test Files:**
- `tests/login.spec.ts` - Authentication
- `tests/chat-scrolling.spec.ts` - Chat UI
- `tests/upload-chart.spec.ts` - Chart upload
- `tests/import-artifactory.spec.ts` - ArtifactHub import
- `tests/model-selection.spec.ts` - Model selection
- `tests/multi-provider-chat.spec.ts` - Multi-provider chat

#### Backend Tests (Go)

```bash
go test ./...              # Run all Go tests
go test ./pkg/llm/...      # Run LLM package tests
go test -v ./pkg/llm/...   # Run with verbose output
```

**Test Files:**
- `pkg/llm/config_test.go` - Model configuration
- `pkg/llm/execute-action_test.go` - Action execution
- `pkg/diff/apply_test.go` - Diff application
- `pkg/diff/reconstruct_test.go` - Diff reconstruction

### Writing Tests

#### Unit Test Guidelines

1. Use `describe` blocks to group related tests
2. Mock external dependencies (AI SDK, API calls, etc.)
3. Each test should be independent
4. Use descriptive test names

#### E2E Test Guidelines

1. Use `loginTestUser` helper for authenticated tests
2. Always wait for elements to be visible before interacting
3. Mock API endpoints when testing specific scenarios
4. Tests should clean up after themselves

#### API Route Test Guidelines

1. Mock auth, workspace, and AI SDK functions
2. Verify request format and response structure
3. Test error cases (400, 401, 404, 500)
4. Ensure responses match Go backend expectations

### Test Coverage

#### Current Coverage

- Model configuration and provider detection
- API route request/response formats
- Message format compatibility
- Authentication flows
- Chat UI behavior
- Chart upload and import workflows

#### Areas Needing More Coverage

- Tool calling workflows
- Streaming response handling
- Error recovery scenarios
- Model switching during conversation

### CI/CD Testing

Tests are automatically run on pull requests, pushes to main, and pre-release validation.

### Debugging Tests

#### Jest Debugging

```bash
npm run test:unit -- config.test.ts    # Run specific test file
npm run test:unit -- --coverage       # Run with coverage
```

#### Playwright Debugging

```bash
npm run test:e2e:headed                              # Run with browser visible
npx playwright test model-selection.spec.ts          # Run specific test
npx playwright test --debug                         # Debug mode
npx playwright show-trace test-results/trace.zip    # Show trace
```

#### Go Test Debugging

```bash
go test -v ./pkg/llm/...                    # Run with verbose output
go test -run TestGetModelConfig ./pkg/llm/...  # Run specific test
go test -race ./pkg/llm/...                # Run with race detector
```

### Test Data

- Test charts: `test_chart/`
- Test fixtures: `testdata/`
- E2E tests use test authentication (see `tests/helpers.ts`)

### Best Practices

1. Keep tests fast - unit tests should run in milliseconds
2. Test behavior, not implementation
3. Use descriptive test names
4. One assertion per test when possible
5. Reset mocks and state between tests
6. Mock external services - don't make real API calls
7. Test error cases, not just the happy path

### Adding New Tests

When adding new features:
1. Write unit tests for individual functions and components
2. Add integration tests for API routes and data flow
3. Add E2E tests for user-facing workflows

## Release

All releases are automated using Dagger functions. The validate function runs all tests and linting checks.

```bash
make release version=[patch|minor|major]
```

This creates a new release tag and pushes container images to registries and K8s manifests to the gitops repo.
