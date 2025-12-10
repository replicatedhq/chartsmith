# Product Context: Chartsmith

## Why Chartsmith Exists

Chartsmith solves the problem of **Helm chart complexity** by making chart creation and modification accessible through natural language. Instead of manually writing YAML and understanding Helm's intricacies, users can describe what they want and have an AI assistant generate and modify charts.

## Problems Solved

### 1. Chart Creation Complexity
- **Problem**: Creating Helm charts requires deep knowledge of Kubernetes, Helm templates, and YAML syntax
- **Solution**: Users describe their application in natural language, and Chartsmith generates the chart structure

### 2. Chart Modification Difficulty
- **Problem**: Modifying existing charts requires understanding the current structure and making precise changes
- **Solution**: Users ask questions or request changes conversationally, and Chartsmith understands context and makes appropriate modifications

### 3. Validation and Testing
- **Problem**: Helm charts need to be rendered and validated before deployment
- **Solution**: Chartsmith automatically renders charts, shows outputs, and validates syntax

## User Experience Goals

### For Chart Developers
- **Conversational Interface**: Ask questions, request changes, get explanations
- **Context Awareness**: AI understands the current chart structure and file contents
- **Plan Generation**: For complex changes, AI generates a plan for review before execution
- **File Editing**: AI can view, modify, and create chart files with precision

### For Operators/SREs
- **End-User Perspective**: Get explanations and modifications from an operator's viewpoint
- **Chart Understanding**: Understand what a chart does without deep technical knowledge
- **Quick Modifications**: Make simple changes without diving into YAML

## How It Should Work

### Chat Flow
1. User types a message in the chat interface
2. System classifies intent (conversational, plan, execute)
3. For conversational: AI responds with context from chart files
4. For plan: AI generates a structured plan for review
5. For execute: AI modifies files according to approved plan

### Key Features
- **Role Selection**: Users can choose "auto", "developer", or "operator" persona
- **File Context**: AI has access to relevant chart files via embeddings
- **Streaming Responses**: Real-time token-by-token streaming for responsive feel
- **Plan Review**: Complex changes are presented as plans before execution
- **Render Preview**: See rendered Helm output before applying changes

## Current User Experience

### Chat Interface
- Custom chat components (`ChatContainer`, `ChatMessage`)
- Manual state management with Jotai atoms
- WebSocket streaming via Centrifugo
- Real-time message updates
- Plan and render embeds within chat

### Pain Points (Being Addressed)
1. **Custom streaming logic** - Maintaining bespoke code instead of using standards
2. **Tight coupling** - Chat UI tied to specific message format
3. **Provider lock-in** - Hard to switch LLM providers
4. **Missing optimizations** - No built-in retries, optimistic updates, etc.

## Migration Impact on Users

### What Users Will Notice
- **Improved streaming** - Smoother, faster token rendering
- **Better error handling** - More graceful error states
- **Same functionality** - All features continue to work identically

### What Users Won't Notice
- **Backend changes** - Go worker logic unchanged
- **System prompts** - AI behavior remains the same
- **Tool calling** - File editing works the same way

## Success Metrics

- **Functionality Parity**: 100% of existing features work
- **Performance**: Same or better time-to-first-token
- **User Satisfaction**: No regression in user experience
- **Developer Experience**: Easier to maintain and extend

