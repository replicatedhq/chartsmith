# Chartsmith: Overview & How It Works

**Last Updated:** December 2025  
**Purpose:** High-level overview of Chartsmith's purpose, functionality, and architecture

---

## What is Chartsmith?

**Chartsmith is an AI-powered tool that helps developers and operators create, modify, and manage Helm charts through natural language conversations.**

Instead of manually writing complex YAML files and understanding Helm's intricacies, users can describe what they want in plain English, and Chartsmith's AI assistant generates, modifies, and validates Helm charts automatically.

---

## The Problem Chartsmith Solves

### Challenge 1: Helm Chart Complexity
**Problem:** Creating Helm charts requires deep knowledge of:
- Kubernetes resource definitions
- Helm template syntax (`{{ }}`, `range`, `with`, etc.)
- YAML structure and indentation
- Chart structure and best practices
- Values files and overrides

**Solution:** Users describe their application in natural language, and Chartsmith generates the chart structure automatically.

### Challenge 2: Chart Modification Difficulty
**Problem:** Modifying existing charts requires:
- Understanding the current chart structure
- Finding the right files to modify
- Making precise YAML changes without breaking syntax
- Understanding dependencies between files

**Solution:** Users ask questions or request changes conversationally, and Chartsmith understands context and makes appropriate modifications.

### Challenge 3: Validation and Testing
**Problem:** Helm charts need to be:
- Rendered to see actual Kubernetes manifests
- Validated for syntax errors
- Tested before deployment

**Solution:** Chartsmith automatically renders charts, shows outputs, validates syntax, and helps identify issues before deployment.

---

## How Chartsmith Works

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  (Web App or VS Code Extension)                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Chat UI    │  │  File Tree  │  │  Chart View  │      │
│  │              │  │             │  │              │      │
│  │ "Add a       │  │ templates/  │  │ Rendered     │      │
│  │  ConfigMap"  │  │ values.yaml │  │ Manifests    │      │
│  └──────┬───────┘  └─────────────┘  └──────────────┘      │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ HTTP Request (Chat Message)
          ▼
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS FRONTEND (TypeScript)                  │
│                                                              │
│  • Chat Interface (useChat hook)                           │
│  • File Management UI                                       │
│  • Plan Review Interface                                     │
│  • Chart Rendering Display                                   │
└─────────┬───────────────────────────────────────────────────┘
          │
          │ API Call (/api/chat)
          ▼
┌─────────────────────────────────────────────────────────────┐
│              GO WORKER (Backend)                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Intent Classification (Groq/Llama)                  │   │
│  │  • Conversational question?                           │   │
│  │  • Generate a plan?                                    │   │
│  │  • Execute changes?                                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LLM Orchestration (Anthropic Claude)                │   │
│  │  • Context building (workspace, files, history)      │   │
│  │  • Plan generation                                    │   │
│  │  • File editing (with tools)                         │   │
│  │  • Conversational responses                           │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tools & Execution                                    │   │
│  │  • text_editor tool (view/create/replace files)      │   │
│  │  • latest_subchart_version tool                       │   │
│  │  • latest_kubernetes_version tool                    │   │
│  │  • Helm execution (helm template, helm dep update)  │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      │ Stream Response (AI SDK Protocol)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE                            │
│                                                              │
│  • workspace_chat (messages)                              │
│  • workspace (chart metadata)                              │
│  • file (chart files with embeddings)                       │
│  • plan (generated plans)                                  │
│  • render (chart render outputs)                           │
│  • pgvector (vector embeddings for file search)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Workflows

### 1. Conversational Chat

**Use Case:** User asks questions about their chart or requests simple changes.

**Flow:**
1. User types: *"What does this ConfigMap do?"*
2. System classifies intent as **conversational**
3. AI builds context:
   - Current chart structure
   - Relevant files (via vector similarity search)
   - Chat history
   - User role (developer/operator/auto)
4. AI responds with explanation, referencing specific files
5. Response streams back in real-time

**Example:**
```
User: "What does this ConfigMap do?"
AI: "The ConfigMap in `templates/configmap.yaml` stores application 
     configuration that gets mounted into your pods. It contains:
     - Database connection string
     - Feature flags
     - Environment-specific settings
     
     You can modify it by editing the `data` section in the file."
```

---

### 2. Plan Generation

**Use Case:** User requests complex changes that require multiple file modifications.

**Flow:**
1. User types: *"Add a Redis cache to the chart"*
2. System classifies intent as **plan generation**
3. AI analyzes:
   - Current chart structure
   - Dependencies and relationships
   - Best practices
4. AI generates a structured plan:
   ```
   Plan: Add Redis Cache
   
   1. Create templates/redis-deployment.yaml
      - Redis deployment with persistence
      - Resource limits
   
   2. Create templates/redis-service.yaml
      - ClusterIP service for Redis
   
   3. Update values.yaml
      - Add redis section with configuration
   
   4. Update templates/deployment.yaml
      - Add Redis connection environment variables
   ```
5. User reviews plan
6. User approves or requests modifications

**Key Features:**
- Plans are structured and reviewable
- User can see exactly what will change
- Plans can be modified before execution
- Plans are stored for history

---

### 3. Plan Execution

**Use Case:** User approves a plan and wants changes applied.

**Flow:**
1. User clicks "Execute Plan"
2. System processes plan step-by-step
3. For each step, AI uses `text_editor` tool:
   - **view**: Read current file content
   - **str_replace**: Replace specific sections (with fuzzy matching)
   - **create**: Create new files
4. Changes are applied to files
5. System validates changes (syntax, structure)
6. User sees updated files in real-time

**Example:**
```
Executing: Create templates/redis-deployment.yaml

[AI uses text_editor tool]
→ view: templates/redis-deployment.yaml (doesn't exist)
→ create: templates/redis-deployment.yaml with Redis deployment spec

✅ File created successfully
```

---

### 4. Chart Rendering

**Use Case:** User wants to see what Kubernetes manifests will be generated.

**Flow:**
1. User requests render: *"Show me what this chart generates"*
2. System executes `helm template` command
3. System processes dependencies (`helm dep update`)
4. Rendered manifests stream back
5. User sees actual Kubernetes YAML that will be deployed

**Benefits:**
- Validate chart before deployment
- See all generated resources
- Debug template issues
- Understand chart output

---

## Key Features

### 1. Context-Aware AI

**How It Works:**
- **Vector Search:** Uses pgvector to find relevant files based on user's question
- **File Embeddings:** Chart files are embedded using Voyage AI
- **Similarity Matching:** AI receives only relevant files, not entire chart
- **Chat History:** Previous conversations provide context

**Example:**
```
User: "How do I configure the database connection?"
AI: [Receives only files related to database/config]
    [References specific files in response]
```

---

### 2. Multi-Provider LLM Strategy

**Intent Classification:** Groq (Llama) - Fast, cheap
- Classifies user intent quickly
- Routes to appropriate handler

**Main Generation:** Anthropic (Claude) - High quality
- Conversational responses
- Plan generation
- File editing

**Embeddings:** Voyage AI - Specialized
- File content embeddings
- Vector similarity search

**Why This Matters:**
- Cost optimization (cheap model for simple tasks)
- Quality where it matters (Claude for complex reasoning)
- Specialized tools (Voyage for embeddings)

---

### 3. Tool-Based File Editing

**The `text_editor` Tool:**
- **view**: Read file content
- **str_replace**: Replace text with fuzzy matching
- **create**: Create new files

**Fuzzy Matching:**
- AI doesn't need exact text matches
- Handles whitespace differences
- Handles formatting variations
- More robust than exact string matching

**Example:**
```
AI wants to replace:
  image: nginx:1.20

But file has:
  image: nginx:1.20  # Production image

Fuzzy matching finds and replaces correctly!
```

---

### 4. User Roles

**Auto (Default):**
- System decides best approach
- Balances developer and operator perspectives

**Developer:**
- Focuses on chart structure and best practices
- Technical implementation details
- Helm-specific guidance

**Operator/SRE:**
- Focuses on operational concerns
- Deployment considerations
- Production readiness

**How It Works:**
- Different system prompts based on role
- Affects AI's response style and focus
- User can switch roles mid-conversation

---

### 5. Real-Time Updates

**Chat Messages:**
- Stream via HTTP SSE (Server-Sent Events)
- Token-by-token streaming
- Real-time UI updates

**Plans & Renders:**
- Stream via WebSocket (Centrifugo)
- Background job updates
- Progress notifications

**Why Hybrid?**
- Chat: Synchronous request-response (HTTP SSE perfect)
- Plans/Renders: Asynchronous background jobs (WebSocket perfect)

---

## Technical Architecture

### Frontend (Next.js + TypeScript)

**Components:**
- `ChatContainer`: Main chat interface
- `ChatMessage`: Individual message display
- `FileTree`: Chart file structure
- `PlanView`: Plan review interface
- `RenderView`: Rendered manifest display

**State Management:**
- `useChat` hook (AI SDK) for chat state
- Jotai atoms for workspace state (files, plans, renders)
- React Query for server state

**Key Files:**
- `hooks/useAIChat.ts`: Chat hook wrapper
- `app/api/chat/route.ts`: API route proxy
- `components/ChatContainer.tsx`: Main UI

---

### Backend (Go)

**Core Packages:**

**`pkg/llm/`** - LLM Orchestration
- `intent.go`: Intent classification
- `conversational_aisdk.go`: Chat handling
- `plan.go`: Plan generation
- `execute-action.go`: File editing
- `aisdk.go`: AI SDK protocol adapter
- `system.go`: System prompts

**`pkg/listener/`** - Job Handlers
- `new_intent.go`: Handle new chat messages
- `new_plan.go`: Handle plan generation requests
- `execute-plan.go`: Handle plan execution

**`pkg/workspace/`** - Workspace Operations
- `chart.go`: Chart file operations
- `file.go`: File CRUD
- `plan.go`: Plan management
- `revision.go`: Version control

**`pkg/realtime/`** - Real-Time Updates
- `centrifugo.go`: WebSocket pub/sub
- Events: `plan-updated`, `render-stream`, `artifact-updated`

**`pkg/embedding/`** - Vector Search
- `embeddings.go`: Generate embeddings
- Uses Voyage AI API
- Stores in pgvector

---

### Database (PostgreSQL + pgvector)

**Key Tables:**

**`workspace`**
- Chart metadata
- Workspace settings
- User associations

**`workspace_chat`**
- Chat messages (user prompts + AI responses)
- Message metadata (planId, renderId, etc.)
- Conversation history

**`file`**
- Chart files (templates, values.yaml, etc.)
- File content
- Vector embeddings (for similarity search)

**`plan`**
- Generated plans
- Plan steps
- Execution status

**`render`**
- Rendered chart outputs
- Kubernetes manifests
- Render metadata

**`work_queue`**
- Background job queue
- Uses PostgreSQL `pg_notify` for job dispatch
- No external queue system needed

---

### Infrastructure Components

**PostgreSQL:**
- Single database for all data
- pgvector extension for embeddings
- pg_notify for job queue

**Centrifugo:**
- WebSocket pub/sub server
- Real-time updates for plans/renders
- Not used for chat (uses HTTP SSE instead)

**Helm Binary:**
- Executed in Go worker
- `helm template` for rendering
- `helm dep update` for dependencies

---

## User Experience Flow

### Example: Adding a New Service

**1. User Request:**
```
User: "I need to add a Redis cache service to my chart"
```

**2. Intent Classification:**
```
System: [Groq/Llama classifies as "plan generation"]
```

**3. Plan Generation:**
```
AI: [Claude generates plan]
    
    Plan: Add Redis Cache Service
    
    Steps:
    1. Create templates/redis-deployment.yaml
    2. Create templates/redis-service.yaml
    3. Update values.yaml with Redis config
    4. Update main deployment with Redis connection
    
    [User reviews plan]
```

**4. Plan Execution:**
```
User: [Clicks "Execute Plan"]

System: [For each step]
  → AI uses text_editor tool
  → Creates/updates files
  → Validates changes
  → Shows progress

✅ All steps completed
```

**5. Validation:**
```
User: "Render the chart to see what it generates"

System: [Executes helm template]
  → Shows rendered Kubernetes manifests
  → Validates syntax
  → Highlights any issues
```

---

## Key Differentiators

### 1. **Context-Aware**
- Understands entire chart structure
- References specific files in responses
- Maintains conversation context

### 2. **Plan-Then-Execute**
- Generates reviewable plans
- User approves before changes
- Reduces mistakes

### 3. **Tool-Based Editing**
- Uses structured tools, not free-form text
- Fuzzy matching for robustness
- Validates changes automatically

### 4. **Multi-Provider Strategy**
- Right model for each task
- Cost optimization
- Quality where it matters

### 5. **Real-Time Feedback**
- Streaming responses
- Progress updates
- Immediate validation

---

## Use Cases

### For Chart Developers
- **Quick Prototyping:** "Create a basic nginx chart"
- **Complex Modifications:** "Add monitoring to all services"
- **Best Practices:** "How should I structure this chart?"
- **Debugging:** "Why isn't this ConfigMap mounting correctly?"

### For Operators/SREs
- **Chart Understanding:** "What does this chart deploy?"
- **Configuration:** "How do I configure the database?"
- **Troubleshooting:** "Why is the service failing?"
- **Customization:** "Add resource limits to all deployments"

### For Teams
- **Onboarding:** New team members learn charts faster
- **Documentation:** AI explains chart structure
- **Consistency:** Enforces best practices
- **Collaboration:** Shared workspace with chat history

---

## Security & Privacy

### API Keys
- LLM API keys stored in backend only
- Never exposed to frontend
- Environment variable configuration

### Authentication
- Session-based authentication
- Cookie-based (web) or Bearer token (extension)
- Server-side validation

### Data Storage
- Chart files stored in database
- User-specific workspaces
- Chat history preserved per workspace

---

## Deployment

### Self-Hosted
- Deploy via Helm chart
- Requires:
  - Kubernetes cluster
  - PostgreSQL with pgvector
  - Anthropic API key
  - (Optional) Google OAuth

### Components
- **Frontend:** Next.js application
- **Backend:** Go worker process
- **Database:** PostgreSQL with pgvector
- **Realtime:** Centrifugo WebSocket server

---

## Future Enhancements

### Planned Features
- Multi-chart workspaces
- Chart templates library
- Integration with Git repositories
- Advanced validation rules
- Team collaboration features

### Technical Improvements
- Provider switching (OpenAI, Google, etc.)
- Enhanced tool calling
- Better error recovery
- Performance optimizations

---

## Summary

**Chartsmith** is an AI-powered assistant that makes Helm chart development accessible through natural language. It combines:

- **Intelligent Context Understanding** (vector search, file embeddings)
- **Structured Plan Generation** (reviewable, executable plans)
- **Tool-Based File Editing** (robust, validated changes)
- **Real-Time Feedback** (streaming responses, progress updates)
- **Multi-Provider LLM Strategy** (cost-optimized, quality-focused)

**Result:** Developers and operators can create, modify, and understand Helm charts without deep Kubernetes/Helm expertise, dramatically reducing the barrier to entry for chart development.

---

**For Technical Details:**
- Architecture: `ARCHITECTURE.md`
- Migration Details: `docs/architecture-comparison.md`
- Development Setup: `CONTRIBUTING.md`
