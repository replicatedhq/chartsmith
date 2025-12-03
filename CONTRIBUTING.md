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
- `GROQ_API_KEY`: Get your own key (Get a new API key from groq.com)
- `VOYAGE_API_KEY`: Get your own key (Generate new key)
- `CHARTSMITH_PG_URI=postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable`
- `CHARTSMITH_CENTRIFUGO_ADDRESS=http://localhost:8000/api`
- `CHARTSMITH_CENTRIFUGO_API_KEY=api_key` (Already set)
- `CHARTSMITH_TOKEN_ENCRYPTION=` (Can ignore)
- `CHARTSMITH_SLACK_TOKEN=` (Can ignore)
- `CHARTSMITH_SLACK_CHANNEL=` (Can ignore)

# Optional (has defaults)
INTERNAL_API_KEY=dev-internal-key           # For worker→Next.js auth (default: dev-internal-key)
```

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

8. **Terminal 5: Claude Integration (optional)**
   ```bash
   # Use Claude for development assistance
   ```

### Additional Commands

- To rebuild the worker:
  ```bash
  make run-worker
  ```

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
4. Use Claude for code assistance and development guidance

### Notes

- The development environment uses PostgreSQL running in Docker
- Schemahero is used for database migrations
- The frontend runs on the default Next.js port
- The worker runs on a separate process


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

## Release

All releases are automated using Dagger functions. The validate function runs all tests and linting checks.

```bash
make release version=[patch|minor|major]
```

This creates a new release tag and pushes container images to registries and K8s manifests to the gitops repo.