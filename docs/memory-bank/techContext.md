# Technical Context: Chartsmith Stack

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Library**: React
- **State Management**: Jotai (atoms)
- **Styling**: Tailwind CSS
- **Markdown**: react-markdown
- **WebSocket Client**: centrifuge (Centrifugo client)

### Backend
- **Language**: Go
- **LLM SDKs**:
  - `github.com/anthropics/anthropic-sdk-go` - Anthropic Claude
  - Groq SDK (for intent classification)
  - Voyage API (for embeddings)
- **Database**: PostgreSQL with pgvector extension
- **WebSocket Server**: Centrifugo
- **HTTP Server**: Standard Go HTTP (for worker API)

### Infrastructure
- **Database**: PostgreSQL
- **Realtime**: Centrifugo (WebSocket pub/sub)
- **Vector Search**: pgvector (PostgreSQL extension)
- **Helm**: Helm binary execution in Go

## Development Setup

### Frontend Development
```bash
cd chartsmith-app
npm install
npm run dev
```

### Backend Development
```bash
make run-worker  # Runs Go worker
```

### Database
- Schema in `db/schema/` (YAML format)
- Migrations handled via schema files

## Key Dependencies

### Frontend (`chartsmith-app/package.json`)
- `next` - Next.js framework
- `react` - React library
- `jotai` - State management
- `centrifuge` - Centrifugo WebSocket client
- `react-markdown` - Markdown rendering
- `lucide-react` - Icons

### Backend (`go.mod`)
- `github.com/anthropics/anthropic-sdk-go` - Anthropic SDK
- `github.com/jackc/pgx/v5` - PostgreSQL driver
- `github.com/replicatedhq/chartsmith/pkg/*` - Internal packages

### Migration Dependencies (To Be Added)
- `@ai-sdk/react` - useChat hook
- `ai` - AI SDK core
- `github.com/coder/aisdk-go` - Go AI SDK protocol

## Technical Constraints

### 1. Single Database Principle
- **Constraint**: Use PostgreSQL for everything (data + vectors + jobs)
- **Rationale**: Simplicity, no new infrastructure
- **Impact**: All data in one place, pgvector for embeddings

### 2. Go Worker Pattern
- **Constraint**: LLM orchestration must stay in Go
- **Rationale**: Proven logic, complex tool implementations, Helm execution
- **Impact**: Migration uses adapter pattern, not rewrite

### 3. Centrifugo for Realtime
- **Constraint**: Keep Centrifugo for background events
- **Rationale**: Plans/renders are async, need pub/sub
- **Impact**: Hybrid architecture (HTTP for chat, WebSocket for events)

### 4. No External Queues
- **Constraint**: Use PostgreSQL pg_notify, not Redis/RabbitMQ
- **Rationale**: Simplicity, leverage existing database
- **Impact**: Job dispatch via database notifications

## API Patterns

### Server Actions (Next.js)
- **Location**: `chartsmith-app/lib/*/actions/`
- **Pattern**: `"use server"` functions
- **Usage**: Called from client components
- **Examples**:
  - `createChatMessageAction`
  - `getWorkspaceMessagesAction`
  - `cancelMessageAction`

### API Routes (Next.js)
- **Location**: `chartsmith-app/app/api/`
- **Pattern**: Route handlers
- **Current**: `/api/config`, `/api/centrifugo-token`
- **Migration**: New `/api/chat` route

### Go Worker Endpoints
- **Location**: `pkg/api/` or `cmd/`
- **Pattern**: HTTP handlers
- **Current**: Worker listens for pg_notify
- **Migration**: New `/api/v1/chat` HTTP endpoint

## Database Schema

### Key Tables
- `workspace_chat` - Chat messages
- `work_queue` - Job queue
- `workspace` - Workspace metadata
- `plan` - Generated plans
- `render` - Chart renders
- `file` - Chart files (with embeddings)

### Vector Search
- Uses pgvector extension
- Embeddings stored in `file` table
- Similarity search for relevant file selection

## Environment Variables

### Frontend
- `NEXT_PUBLIC_CENTRIFUGO_ADDRESS` - Centrifugo WebSocket URL
- `ENABLE_AI_SDK_CHAT` - Feature flag (to be added)

### Backend
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GROQ_API_KEY` - Groq API key (for intent)
- `VOYAGE_API_KEY` - Voyage API key (for embeddings)
- `DATABASE_URL` - PostgreSQL connection string
- `CENTRIFUGO_API_KEY` - Centrifugo API key

## Build & Deployment

### Frontend Build
```bash
cd chartsmith-app
npm run build
```

### Go Build
```bash
go build ./cmd/worker
```

### Docker
- Frontend: Next.js Docker image
- Backend: Go binary in container
- Database: PostgreSQL with pgvector
- Centrifugo: Separate service

## Testing

### Frontend Tests
- Jest configuration: `chartsmith-app/jest.config.ts`
- Test files: `chartsmith-app/**/__tests__/`

### Backend Tests
- Go test files: `*_test.go`
- Integration tests: `pkg/*/testhelpers/`

### E2E Tests
- Playwright: `chartsmith-app/playwright.config.ts`
- Test files: `chartsmith-app/tests/`

## Code Organization

### Frontend Structure
```
chartsmith-app/
├── app/              # Next.js app router
│   ├── api/          # API routes
│   └── workspace/    # Workspace pages
├── components/       # React components
├── lib/              # Utilities and server actions
├── hooks/            # React hooks
├── atoms/            # Jotai atoms
└── contexts/         # React contexts
```

### Backend Structure
```
pkg/
├── listener/          # pg_notify handlers
├── llm/              # LLM orchestration
├── workspace/        # Workspace operations
├── realtime/         # Centrifugo integration
├── persistence/      # Database access
└── embedding/        # Vector embeddings
```

## Migration Technical Details

### New Dependencies
- **Frontend**: `@ai-sdk/react`, `ai`
- **Backend**: `github.com/coder/aisdk-go`

### New Files
- `chartsmith-app/hooks/useAIChat.ts` - AI SDK hook wrapper
- `chartsmith-app/app/api/chat/route.ts` - API route proxy
- `pkg/llm/aisdk.go` - AI SDK stream adapter
- `pkg/api/chat.go` - New HTTP endpoint

### Modified Files
- `chartsmith-app/components/ChatContainer.tsx` - Use useChat
- `chartsmith-app/components/ChatMessage.tsx` - AI SDK message format
- `pkg/llm/conversational.go` - Add AI SDK path
- `pkg/listener/conversational.go` - Optional AI SDK path

## Performance Considerations

### Current Performance
- **Time to first token**: ~500-1000ms
- **Streaming**: Token-by-token via Centrifugo
- **Database writes**: Per-token (high load)

### Migration Targets
- **Time to first token**: Same or better
- **Streaming**: HTTP SSE (potentially faster)
- **Database writes**: On-completion (lower load)

## Security

### Authentication
- Session-based auth
- Server actions validate session
- Go endpoints validate auth tokens

### API Keys
- LLM API keys in backend only
- Never exposed to frontend
- Environment variables for configuration

## Monitoring & Logging

### Frontend
- Console logging for development
- Error boundaries for React errors

### Backend
- Structured logging with `zap`
- Logger package: `pkg/logger/`

## Known Technical Debt

### Pre-Migration
- Custom streaming logic (being replaced)
- Tight coupling to Centrifugo (being addressed)
- Per-token database writes (being optimized)

### Post-Migration
- Hybrid architecture complexity (accepted trade-off)
- Two streaming patterns (HTTP + WebSocket)

