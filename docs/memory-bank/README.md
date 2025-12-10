# Memory Bank: Chartsmith Project Knowledge

This directory contains comprehensive documentation about the Chartsmith project, its architecture, and the current Vercel AI SDK migration effort.

## File Structure

### Core Files (Read First)

1. **`projectbrief.md`** - Foundation document
   - Project overview and purpose
   - Core constraints and principles
   - Current architecture summary
   - Active migration context

2. **`productContext.md`** - Product understanding
   - Why Chartsmith exists
   - Problems solved
   - User experience goals
   - Migration impact on users

3. **`activeContext.md`** - Current work focus
   - Vercel AI SDK migration status
   - What's changing and what's staying
   - Implementation plan and phases
   - Risks and mitigations
   - Next actions

4. **`systemPatterns.md`** - Architecture patterns
   - Key architectural patterns
   - Component relationships
   - Data flow diagrams
   - Design principles

5. **`techContext.md`** - Technical stack
   - Technology choices
   - Development setup
   - Dependencies
   - Constraints and patterns

6. **`progress.md`** - Development status
   - What works (current system)
   - What's left to build (migration)
   - Success criteria tracking
   - Known issues and blockers

## Quick Reference

### Current Migration Status
- **Status**: Planning complete, ready for implementation
- **Phase**: Foundation Setup (Phase 1)
- **Next PR**: PR 1 - Install AI SDK packages

### Key Decisions
- **Option A**: Keep Go backend, use `coder/aisdk-go` adapter
- **Hybrid Architecture**: `useChat` for chat, Centrifugo for plans/renders
- **Feature Flags**: Incremental rollout with rollback capability

### Critical Preservations
- ✅ System prompts (`pkg/llm/system.go`) - Unchanged
- ✅ User roles (auto/developer/operator) - Same behavior
- ✅ Tool calling - Works identically
- ✅ Database schema - No changes

### Migration Timeline
- **Total**: 6 weeks (14 PRs)
- **Phase 1**: Foundation (Week 1-2)
- **Phase 2**: Backend Protocol (Week 2-3)
- **Phase 3**: Frontend Integration (Week 3-4)
- **Phase 4**: Tool Calling (Week 4-5)
- **Phase 5**: Cleanup (Week 5-6)

## Related Documentation

### Main Project Docs
- `docs/PRD-vercel-ai-sdk-migration.md` - Product Requirements Document
- `docs/architecture-comparison.md` - Detailed architecture analysis
- `ARCHITECTURE.md` - High-level architecture principles

### PR Documentation
- `docs/prs/PR-*.md` - Individual PR plans (14 PRs documented)

## How to Use This Memory Bank

### For New Contributors
1. Start with `projectbrief.md` for overview
2. Read `productContext.md` to understand the product
3. Review `systemPatterns.md` for architecture
4. Check `activeContext.md` for current work

### For AI Assistants
1. Read ALL core files at start of session
2. Check `activeContext.md` for current focus
3. Reference `systemPatterns.md` for patterns
4. Update `progress.md` after completing work

### For Developers
1. `techContext.md` for setup and dependencies
2. `systemPatterns.md` for code patterns
3. `activeContext.md` for migration details
4. `progress.md` for status tracking

## Update Guidelines

### When to Update
- After completing significant work
- When architecture decisions change
- When blockers are resolved
- When new patterns emerge

### What to Update
- `activeContext.md` - Current work status
- `progress.md` - Completion tracking
- `systemPatterns.md` - New patterns discovered
- `techContext.md` - New dependencies or constraints

## Migration Context

This memory bank was initialized during the **Vercel AI SDK Migration** project. The migration aims to:

1. Replace custom chat UI with Vercel AI SDK's `useChat` hook
2. Migrate from Centrifugo WebSocket to HTTP SSE streaming
3. Preserve all existing functionality
4. Improve developer experience with standard patterns
5. Enable easy provider switching in the future

See `activeContext.md` for detailed migration plan and `docs/PRD-vercel-ai-sdk-migration.md` for full requirements.

