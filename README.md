# ChartSmith

Build Better Helm Charts with AI

## Overview

ChartSmith is an AI-powered tool that helps you create, modify, and maintain Helm charts through natural language conversations. It uses advanced AI models to understand your requirements and generate production-ready Kubernetes configurations.

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **Vercel AI SDK** - AI chat integration with streaming support
- **Jotai** - State management
- **Tailwind CSS** - Styling
- **Centrifugo** - Real-time WebSocket communication

### Backend Worker
- **Go** - High-performance backend worker
- **PostgreSQL with pgvector** - Database with vector embeddings
- **OpenRouter** - Primary AI provider with multi-model support
- **VoyageAI** - Semantic embeddings for file selection
- **Centrifugo** - Real-time pub/sub messaging

### AI Providers
- **OpenRouter** (Default) - Unified API for multiple AI models
  - Claude Sonnet 4.5 (Default model)
  - GPT-4.1, Gemini 3 Pro, Grok 4.1, and more
- **Anthropic** - Direct Claude API support (optional)

### Infrastructure
- **Docker Compose** - Local development environment
- **Schemahero** - Database schema management
- **pgx** - PostgreSQL connection pooling

## Key Features

- **Natural Language Interface** - Describe your chart requirements in plain English
- **Real-time Streaming** - Watch as AI generates your chart files live
- **Multi-Model Support** - Choose from the best AI models (Claude, GPT, Gemini, etc.)
- **Semantic File Search** - AI automatically selects relevant files for modifications
- **Plan Review** - Review and approve changes before applying
- **Version Control** - Track revisions of your charts

## Recent Improvements

### AI Integration
- ✅ **OpenRouter as Default Provider** - Unified access to multiple AI models
- ✅ **Enhanced Model Selection** - Latest models including Claude 4.5, GPT 5.1, Gemini 3 Pro
- ✅ **Grouped Model Dropdown** - Models organized by provider for easy selection
- ✅ **Comprehensive Error Handling** - Clear messages for API errors, rate limits, and insufficient credits

### Performance & Reliability
- ✅ **Connection Pool Optimization** - Fixed connection leaks causing worker crashes
  - Idle connections close after 5 minutes of inactivity
  - Reduced polling from 500ms to 100ms for faster response
  - Proper connection pooling prevents exhaustion
- ✅ **Context Leak Fix** - Added proper context cancellation to prevent resource leaks
- ✅ **Exponential Backoff** - Smart retry logic for failed jobs
- ✅ **Queue Health Monitoring** - Real-time pool statistics and warnings

### User Experience
- ✅ **Improved Chat UI** - Larger text, better formatting, cleaner design
- ✅ **Compact Model Selector** - Streamlined dropdown with better visibility
- ✅ **Real-time File Updates** - Files appear in explorer immediately after creation
- ✅ **Interactive States** - "Thinking", "Planning", "Rendering" indicators
- ✅ **Streaming Response** - Watch AI generate responses in real-time

### Developer Experience
- ✅ **Environment Setup Guides** - Comprehensive `.env.example` files and documentation
- ✅ **Cleaner Logs** - Removed verbose debug output, kept essential operational logs
- ✅ **Better Error Messages** - Provider-specific error parsing with actionable feedback

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup instructions and [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed environment variable configuration.

### Quick Start

1. **Setup Environment Variables**
   ```bash
   # Backend worker
   cp env.example .env
   # Edit .env with your API keys
   
   # Frontend app
   cd chartsmith-app
   cp env.local.example .env.local
   # Edit .env.local with your API keys
   ```

2. **Start Services**
   ```bash
   # Start PostgreSQL and Centrifugo
   docker compose up -d
   
   # Initialize database
   make schema
   make bootstrap
   
   # Start worker (Git Bash on Windows)
   make run-worker
   
   # Start frontend (new terminal)
   cd chartsmith-app
   npm install
   npm run dev
   ```

3. **Access the App**
   - Open http://localhost:3000
   - Login with Google OAuth
   - Start creating charts!

## Authentication

### Extension Authentication

The VS Code extension authenticates using a token-based mechanism:

1. User clicks "Login" in the extension, opening a browser window
2. After successful authentication, the app generates an extension token
3. The extension stores this token and uses it for API requests
4. Token validation happens via the `/api/auth/status` endpoint

### Web Authentication

The web app uses NextAuth with Google OAuth for user authentication.

## Architecture

ChartSmith uses a modern event-driven architecture:

1. **User Request** → Frontend sends message via server action
2. **Intent Detection** → Go worker analyzes request using AI
3. **Plan Generation** → AI creates a detailed plan of changes
4. **User Review** → Plan is presented for approval
5. **Execution** → AI generates file content for each file action
6. **Real-time Updates** → Centrifugo streams progress to frontend

All steps use connection pooling and proper resource management to ensure stability.

## Contributing

If you are interested in contributing or being a maintainer on this project, please reach out to us by [opening an issue](https://github.com/replicatedhq/chartsmith/issues/new) in the repo.

## License

See [LICENSE](LICENSE) for details.
