#!/bin/bash
# Test the chat API route
#
# Usage:
#   ./scripts/test-chat-api.sh [auth_token]
#
# If no auth token is provided, uses a test token.
# The server must be running on localhost:3000.
#
# For mock responses (no API calls), start the server with:
#   MOCK_LLM_RESPONSES=true npm run dev

AUTH_TOKEN="${1:-test-token}"

echo "Testing chat API..."
echo "Using auth token: ${AUTH_TOKEN:0:10}..."
echo ""

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is a Helm chart?"}
    ],
    "workspaceId": "test-workspace"
  }'

echo ""
echo ""
echo "Done."
