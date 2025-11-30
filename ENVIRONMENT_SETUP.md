# Environment Variables Setup Guide

This guide will help you configure the environment variables for ChartSmith.

## Quick Setup

### 1. Go Worker (Backend)

```bash
# Copy the example file
cp env.example .env

# Edit .env and fill in your values
# At minimum, you need:
# - CHARTSMITH_PG_URI
# - OPENROUTER_API_KEY
# - VOYAGE_API_KEY
```

### 2. Next.js App (Frontend)

```bash
# Navigate to the app directory
cd chartsmith-app

# Copy the example file
cp env.local.example .env.local

# Edit .env.local and fill in your values
# At minimum, you need:
# - CHARTSMITH_PG_URI (or DB_URI)
# - NEXTAUTH_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - OPENROUTER_API_KEY
# - NEXT_PUBLIC_CENTRIFUGO_ADDRESS
```

## Required API Keys

### 1. OpenRouter API Key (Recommended)

OpenRouter provides access to multiple AI models including Claude, GPT, Gemini, and more.

1. Go to [https://openrouter.ai/](https://openrouter.ai/)
2. Sign up and create an account
3. Navigate to [Keys](https://openrouter.ai/keys)
4. Create a new API key
5. Add credits to your account (pay-as-you-go)
6. Copy the key to both `.env` and `.env.local`

**Format:** `sk-or-v1-...`

### 2. VoyageAI API Key (Required)

VoyageAI is used for semantic search to find relevant files when modifying charts.

1. Go to [https://www.voyageai.com/](https://www.voyageai.com/)
2. Sign up and create an account
3. Navigate to the [API Keys section](https://dash.voyageai.com/api-keys)
4. Create a new API key
5. Copy the key to `.env`

**Format:** `pa-...`

### 3. Google OAuth Credentials (Required for Login)

Google OAuth is used for user authentication.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen
6. Set **Authorized JavaScript origins**: `http://localhost:3000`
7. Set **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`
8. Copy the Client ID and Client Secret to `.env.local`

### 4. Anthropic API Key (Optional)

Only needed if you want to use Anthropic directly instead of through OpenRouter.

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up and create an account
3. Navigate to API Keys
4. Create a new API key
5. Copy the key to both `.env` and `.env.local`

**Format:** `sk-ant-...`

## Database Setup

### Using Docker (Recommended)

ChartSmith includes a `docker-compose.yml` that sets up PostgreSQL and Centrifugo:

```bash
# Start the services
docker compose up -d

# Your DATABASE URI will be:
CHARTSMITH_PG_URI=postgresql://chartsmith:password@localhost:5432/chartsmith?sslmode=disable
```

### Using External PostgreSQL

If you have your own PostgreSQL instance:

```bash
# Format:
CHARTSMITH_PG_URI=postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=disable

# Example:
CHARTSMITH_PG_URI=postgresql://myuser:mypassword@db.example.com:5432/chartsmith?sslmode=disable
```

## Generate NextAuth Secret

```bash
# Generate a secure random secret
openssl rand -base64 32

# Copy the output to .env.local as NEXTAUTH_SECRET
```

## Environment Variable Reference

### Go Worker (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHARTSMITH_PG_URI` | ✅ Yes | - | PostgreSQL connection string |
| `CHARTSMITH_AI_PROVIDER` | ❌ No | `openrouter` | AI provider: `openrouter` or `anthropic` |
| `OPENROUTER_API_KEY` | ✅ Yes | - | OpenRouter API key |
| `ANTHROPIC_API_KEY` | ❌ No | - | Anthropic API key (if using Anthropic) |
| `VOYAGE_API_KEY` | ✅ Yes | - | VoyageAI API key for embeddings |
| `CENTRIFUGO_ADDRESS` | ❌ No | `ws://localhost:8001/connection/websocket` | Centrifugo WebSocket address |

### Next.js App (.env.local)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHARTSMITH_PG_URI` or `DB_URI` | ✅ Yes | - | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ Yes | - | Secret for session encryption |
| `NEXTAUTH_URL` | ❌ No | `http://localhost:3000` | Your app's URL |
| `GOOGLE_CLIENT_ID` | ✅ Yes | - | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | - | Google OAuth Client Secret |
| `OPENROUTER_API_KEY` | ✅ Yes | - | OpenRouter API key |
| `ANTHROPIC_API_KEY` | ❌ No | - | Anthropic API key (if using Anthropic) |
| `NEXT_PUBLIC_CENTRIFUGO_ADDRESS` | ❌ No | `ws://localhost:8001/connection/websocket` | Centrifugo WebSocket address (browser-accessible) |
| `NEXT_PUBLIC_DEFAULT_AI_PROVIDER` | ❌ No | `openrouter` | Default AI provider for new users |
| `NEXT_PUBLIC_DEFAULT_AI_MODEL` | ❌ No | `anthropic/claude-sonnet-4.5` | Default AI model for new users |

## Verification

After setting up your environment files, verify they're working:

```bash
# 1. Start Docker services
docker compose up -d

# 2. Initialize database schema
make schema

# 3. Bootstrap default chart
make bootstrap

# 4. Start the worker (in Git Bash on Windows)
make run-worker

# 5. In a new terminal, start the frontend
cd chartsmith-app
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and you should be able to log in with Google!

## Troubleshooting

### Worker can't connect to database
- Check that Docker is running: `docker ps`
- Verify the database URI in `.env`
- Ensure the database exists: `docker exec -it chartsmith-postgres psql -U chartsmith -d chartsmith`

### Frontend shows "Failed to get Centrifugo address"
- Check that Centrifugo is running: `docker ps | grep centrifugo`
- Verify `NEXT_PUBLIC_CENTRIFUGO_ADDRESS` in `.env.local`

### "Invalid API key" errors
- Verify your OpenRouter key is correct
- Check that you have credits on your OpenRouter account
- Ensure the key is in both `.env` and `.env.local`

### VoyageAI timeout or errors
- Verify your VoyageAI key is correct
- Check your VoyageAI account has available credits
- Ensure the key is in `.env`

## Security Notes

⚠️ **Important:**
- Never commit `.env` or `.env.local` files to version control
- Keep your API keys secret
- Rotate API keys if they're exposed
- Use different keys for development and production

The `.gitignore` file already excludes these files by default.

