# Project Brief: Chartsmith

## Overview

Chartsmith is a web-based application that helps users create, modify, and manage Helm charts through natural language conversations with an AI assistant. The system combines LLM-powered chat with Helm chart generation, editing, and rendering capabilities.

## Core Purpose

Chartsmith enables users to:
- **Create Helm charts** from natural language descriptions
- **Modify existing charts** through conversational AI interactions
- **Generate plans** for complex chart modifications
- **Execute changes** to chart files with AI assistance
- **Render and validate** Helm charts in real-time

## Key Constraints & Principles

1. **Simplicity First** - Avoid adding new databases, queues, or components unnecessarily
2. **Go Backend** - All LLM orchestration and complex logic runs in Go worker processes
3. **Next.js Frontend** - React-based UI with server actions for data operations
4. **PostgreSQL + pgvector** - Single database for all data and vector embeddings
5. **Centrifugo** - WebSocket pub/sub for realtime notifications
6. **Hybrid Architecture** - Go handles LLM, frontend handles UI, clear separation of concerns

## Current Architecture

```
Frontend (Next.js) → Server Actions → PostgreSQL (pg_notify) → Go Worker → LLM Providers
                                                                    ↓
                                                              Centrifugo → Frontend
```

## Current State

- **Chat System**: Custom implementation using Centrifugo WebSocket for streaming
- **LLM Providers**: Anthropic (Claude) for generation, Groq (Llama) for intent, Voyage for embeddings
- **State Management**: Jotai atoms for frontend state
- **Message Storage**: PostgreSQL `workspace_chat` table
- **Streaming**: Per-token updates via Centrifugo events

## Active Migration

**Vercel AI SDK Migration** - Migrating chat system from custom Centrifugo-based streaming to Vercel AI SDK's `useChat` hook with HTTP SSE streaming, while preserving Go backend LLM orchestration.

## Success Criteria

1. All existing chat functionality preserved
2. System prompts and user roles unchanged
3. Tool calling continues to work
4. Improved developer experience with standard patterns
5. Foundation for easy provider switching

## Project Structure

- `chartsmith-app/` - Next.js frontend application
- `pkg/` - Go backend packages (llm, listener, workspace, etc.)
- `db/schema/` - Database schema definitions
- `docs/` - Project documentation including PRD and architecture docs

