# Claude Service

A Node.js service that wraps the official Anthropic Claude SDK, providing HTTP endpoints for the Go worker to consume.

## Why?

The official Anthropic SDK is only available for Node.js and Python. This service allows the Go worker to access SDK-exclusive features like:

- Prompt caching
- Extended thinking (Claude 3.7+)
- Better streaming primitives
- Faster feature parity with API releases

## Endpoints

### Health Check
```
GET /health
```

### Messages (Non-streaming)
```
POST /v1/messages
Content-Type: application/json

{
  "model": "claude-3-7-sonnet-20250219",
  "max_tokens": 8192,
  "system": "You are a helpful assistant.",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

### Messages (Streaming)
```
POST /v1/messages/stream
Content-Type: application/json
Accept: text/event-stream

{
  "model": "claude-3-7-sonnet-20250219",
  "max_tokens": 8192,
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

Returns Server-Sent Events (SSE):
```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop","message":{...}}

event: done
data: [DONE]
```

### Extended Thinking (Claude 3.7+)
```
POST /v1/messages/think
Content-Type: application/json
Accept: text/event-stream

{
  "model": "claude-3-7-sonnet-20250219",
  "max_tokens": 16000,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  },
  "messages": [
    {"role": "user", "content": "Solve this complex problem..."}
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Run production build
npm start
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required. Your Anthropic API key.
- `PORT` - Optional. Server port (default: 3100).

## Docker

```bash
# Build
docker build -t claude-service .

# Run
docker run -p 3100:3100 -e ANTHROPIC_API_KEY=your-key claude-service
```

## Integration with Go Worker

Set the `CLAUDE_SERVICE_URL` environment variable in the Go worker to enable routing Claude calls through this service:

```bash
export CLAUDE_SERVICE_URL=http://localhost:3100
```

When this variable is set, supported LLM functions will use the Node service instead of the Go Anthropic SDK.
