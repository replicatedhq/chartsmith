This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

Before starting the development server, ensure you have the following environment variables configured in `.env.local`:

```bash
# =============================================================================
# AI Provider Configuration
# =============================================================================

# LLM Provider: 'anthropic' (default) or 'openai'
LLM_PROVIDER=anthropic

# Optional: Override the default model
# LLM_MODEL=claude-3-haiku-20240307

# Anthropic API Key (required if LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=your-anthropic-api-key

# OpenAI API Key (required if LLM_PROVIDER=openai)
OPENAI_API_KEY=your-openai-api-key

# =============================================================================
# Database & Auth
# =============================================================================

# Database connection (required)
DATABASE_URL=your-database-url

# Authentication (required for production)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Installation

Install the project dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

For a clean start (clears cache):

```bash
npm run dev:stable
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Architecture

### AI Chat System

The chat functionality uses a custom streaming implementation with support for multiple AI providers.

#### Features

- **Multi-provider support**: Switch between Anthropic (Claude) and OpenAI (GPT) models
- **Full control over streaming**: Custom SSE parsing for AI SDK format
- **Stop button support**: Ability to cancel in-progress requests
- **Workspace context**: Automatic injection of chart files into AI context
- **Better error handling**: Graceful handling of network errors and aborts

#### Key Files

- `lib/ai/provider.ts` - AI provider factory for switching between providers
- `hooks/useStreamingChat.ts` - Custom React hook for streaming chat
- `app/api/chat/route.ts` - API endpoint using AI SDK
- `components/ChatContainer.tsx` - Main chat UI component

See `MIGRATION_NOTES.md` for details on the migration from AI SDK's `useChat`.

### Switching AI Providers

ChartSmith supports multiple AI providers. To switch providers:

#### Option 1: Anthropic (Default)

```bash
# .env.local
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Choose a specific model
LLM_MODEL=claude-3-haiku-20240307
```

Available Anthropic models:
| Model | Description |
|-------|-------------|
| `claude-3-haiku-20240307` | Fast, cost-effective (default) |
| `claude-3-sonnet-20240229` | Balanced performance |
| `claude-3-opus-20240229` | Most capable |
| `claude-3-5-sonnet-20241022` | Latest Sonnet |

#### Option 2: OpenAI

```bash
# .env.local
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Optional: Choose a specific model
LLM_MODEL=gpt-4-turbo
```

Available OpenAI models:
| Model | Description |
|-------|-------------|
| `gpt-4-turbo` | Fast GPT-4 (default) |
| `gpt-4o` | Latest optimized |
| `gpt-4o-mini` | Cost-effective |
| `gpt-3.5-turbo` | Legacy, fastest |

#### Provider Factory API

```typescript
import { getModel, getProviderInfo, validateProviderConfig } from '@/lib/ai/provider';

// Get configured model for use with AI SDK
const model = getModel();

// Get provider information
const info = getProviderInfo();
// { provider: 'anthropic', model: 'claude-3-haiku-20240307', apiKeyConfigured: true }

// Validate configuration at startup
const issues = validateProviderConfig();
if (issues.length > 0) {
  console.error('Provider configuration issues:', issues);
}
```

### State Management

We use [Jotai](https://jotai.org/) for state management. Key atoms are defined in `atoms/workspace.ts`:
- `workspaceAtom` - Current workspace state
- `messagesAtom` - Chat messages
- `chartsAtom` - Helm charts in workspace

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentication

### Extension Authentication

The VS Code extension authenticates using a token-based mechanism:

1. When a user clicks "Login" in the extension, it opens a browser window to the authentication page
2. After successful authentication, the app generates an extension token and sends it to the extension
3. The extension stores this token and uses it for API requests with a Bearer token header
4. Token validation happens via the `/api/auth/status` endpoint

To test extension authentication:
```bash
# Run the auth status test script
./test-auth-status.sh <your-token>
```
