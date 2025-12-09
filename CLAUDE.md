# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chartsmith is an AI-powered tool for building better Helm charts. The system consists of:
- **Frontend**: Next.js application (`chartsmith-app/`)
- **Backend**: Go worker service that processes AI requests
- **Database**: PostgreSQL with pgvector extension
- **Realtime**: Centrifugo for WebSocket-based notifications
- **VS Code Extension**: `chartsmith-extension/` for IDE integration

## Development Commands

### Prerequisites Setup
```bash
# Start Docker services (Postgres + Centrifugo)
cd hack/chartsmith-dev
docker compose up -d

# Enable pgvector extension
make pgvector

# Apply database schema
make schema

# Bootstrap initial chart data (CRITICAL - app won't work without this)
make bootstrap
```

### Running the Application
```bash
# Terminal 1: Frontend (runs on http://localhost:3000)
cd chartsmith-app
npm install
npm run dev

# Terminal 2: Backend worker
make run-worker

# Terminal 3: Clean dev server (if needed)
cd chartsmith-app
npm run clean-dev
```

### Testing
```bash
# Frontend tests
cd chartsmith-app
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:e2e          # End-to-end tests
npm run test:watch        # Watch mode
npm run test:parseDiff    # Specific test

# Backend integration tests
make integration-test

# Generate test data
make test-data
```

### Database Management
```bash
# Run all schema migrations
make schema

# Manually enable pgvector if needed
docker exec -it chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Building and Validation
```bash
# Build worker binary
make build

# Run linting
cd chartsmith-app
npm run lint

# Validate (runs all CI checks)
make validate
```

### Other Development Commands
```bash
# Interactive debug console
make run-debug-console

# Frontend specific
cd chartsmith-app
npm run dev:stable       # Run without turbopack
npm run build           # Production build
npm run start           # Start production server
```

## Required Environment Variables

Export these before running backend services:

```bash
export ANTHROPIC_API_KEY="your-key"
export GROQ_API_KEY="your-key"
export VOYAGE_API_KEY="your-key"
export CHARTSMITH_PG_URI="postgresql://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export CHARTSMITH_CENTRIFUGO_ADDRESS="http://localhost:8000/api"
export CHARTSMITH_CENTRIFUGO_API_KEY="api_key"
export GOOGLE_CLIENT_ID="your-id"
export GOOGLE_CLIENT_SECRET="your-secret"
```

Create `chartsmith-app/.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google
GOOGLE_CLIENT_SECRET=<get from 1password>
HMAC_SECRET=not-secure
CENTRIFUGO_TOKEN_HMAC_SECRET=change.me
NEXT_PUBLIC_CENTRIFUGO_ADDRESS=ws://localhost:8000/connection/websocket
TOKEN_ENCRYPTION=H5984PaaBSbFZTMKjHiqshqRCG4dg49JAs0dDdLbvEs=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_ENABLE_TEST_AUTH=true
ENABLE_TEST_AUTH=true
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000/api
```

## Architecture Overview

### System Design Principles
- Keep the architecture simple: avoid adding new databases, queues, or components
- Frontend is Next.js with server-side rendering
- Single Go worker processes all AI/background tasks
- PostgreSQL handles both data storage and job queueing (via NOTIFY and work_queue table)
- Centrifugo provides real-time updates to clients

### Frontend Architecture (`chartsmith-app/`)

**State Management**:
- Uses Jotai for state management
- Components subscribe to atoms directly (no prop drilling or callbacks)
- Avoid passing onChange handlers through component trees

**Server-Side Rendering**:
- Prioritize SSR to avoid loading states
- Move client-only code into separate components with `"use client"`

**Data Layer**:
- Prefer server actions over Next.js API routes
- Exception: `/api/chat/route.ts` for AI streaming
- Server actions call `lib/*` functions (no direct DB queries in actions)
- Database queries belong in `lib/*` functions only

**AI SDK Integration**:
- Uses Vercel AI SDK Core (`streamText`, `tool`) in `/api/chat/route.ts`
- LLM provider: OpenAI (`@ai-sdk/openai`) with `gpt-4o` model
- Chat UI: Vercel AI SDK React (`useChat`) in `components/ChatContainer.tsx`
- Tools use Zod schemas (`inputSchema`) for validation
- Server-side tool execution with streaming protocol

**Monaco Editor**:
- Use single editor instance with model swapping (don't recreate instances)
- Properly clean up models to prevent memory leaks
- Avoid showing "Loading..." states to prevent UI flashes

### Backend Architecture (Go)

**Structure**:
- `cmd/`: CLI commands and entrypoints
- `pkg/llm/`: LLM client and AI interactions
- `pkg/listener/`: Job processors (conversational, plan execution, rendering, etc.)
- `pkg/workspace/`: Core domain models (workspaces, charts, messages)
- `pkg/persistence/`: Database access and work queue
- `pkg/realtime/`: Centrifugo integration for push notifications
- `pkg/diff/`: Git-style diff generation and application
- `pkg/embedding/`: Vector embeddings for RAG
- `helm-utils/`: Helm chart rendering utilities

**Worker Job System**:
- Jobs enqueued via PostgreSQL NOTIFY
- `work_queue` table stores job metadata
- Status communicated to clients via Centrifugo messages
- Job types: conversational, new_plan, execute_plan, render_workspace, publish_workspace, conversion tasks

**LLM Integration**:
- Direct Anthropic SDK usage (`github.com/anthropics/anthropic-sdk-go`)
- Also supports Groq for faster inference
- System prompts in `pkg/llm/system.go`
- Streaming responses sent via Centrifugo

### Database Schema

Located in `db/schema/`:
- `extensions/`: pgvector extension definition
- `tables/`: SchemaHero table definitions (YAML)
- Schema management via SchemaHero (not raw SQL migrations)

Key tables:
- `workspaces`: User workspaces containing charts
- `chat_messages`: Conversation history
- `plans`: AI-generated implementation plans
- `revisions`: Chart version history
- `work_queue`: Background job queue
- `artifacts`: Generated files and patches
- `knowledge_*`: Vector embeddings for RAG

### Authentication

**Extension Authentication**:
1. User clicks "Login" in VS Code extension
2. Browser opens authentication page
3. App generates extension token after auth
4. Extension stores token, uses Bearer auth header
5. Validation via `/api/auth/status` endpoint

**Web Authentication**:
- Google OAuth (production)
- Test auth available in development (`NEXT_PUBLIC_ENABLE_TEST_AUTH=true`)
- First user gets admin privileges automatically

### API Design Principles
- Consolidate data in endpoints (avoid granular N+1 calls)
- Use Next.js file-based routing with resource-oriented paths
- Return complete objects, not fragments
- Prefer server-side data processing over client assembly

## Key Integration Points

### Frontend ↔ Backend Worker
- Frontend enqueues jobs via API routes → Postgres
- Worker receives jobs via LISTEN/NOTIFY
- Worker sends status updates via Centrifugo → Frontend

### Frontend ↔ AI (Chat)
- `/api/chat/route.ts` handles streaming AI responses
- Uses Vercel AI SDK with OpenAI
- Tools execute server-side, results stream to client
- Chat component uses `useChat()` hook

### Worker ↔ LLM
- Worker calls Anthropic/Groq APIs directly
- Streams responses through Centrifugo to frontend
- Handles chart generation, planning, conversational responses

### Deployment
- Dagger functions handle CI/CD (`dagger/`)
- Releases push to container registries and Kubernetes
- Helm chart for deployment in `chart/chartsmith/`

## Common Patterns

**Adding a new worker job type**:
1. Define job handler in `pkg/listener/`
2. Add case in `pkg/listener/start.go`
3. Enqueue via `pkg/persistence/queue.go`
4. Send status updates via `pkg/realtime/`

**Adding a new API endpoint**:
1. Create route in `app/api/[resource]/route.ts`
2. Add lib function in `chartsmith-app/lib/[domain].ts`
3. Call from server action if needed
4. Follow consolidated data endpoint pattern

**Updating database schema**:
1. Modify YAML in `db/schema/tables/`
2. Run `make schema` to generate and apply migration
3. SchemaHero handles the diff and DDL generation

## VS Code Extension Development

See `chartsmith-extension/DEVELOPMENT.md` for:
- Building VSIX packages
- Configuring endpoints for local dev
- Enabling dev mode and debugging
- Testing extension commands

## Notes

- Port 5433 used for Postgres (not default 5432)
- Postgres container runs `ankane/pgvector:latest`
- First user login bypasses waitlist and gets admin
- Bootstrap step is critical - generates template data
- Worker must be restarted after backend code changes
- Frontend has hot reload for development
