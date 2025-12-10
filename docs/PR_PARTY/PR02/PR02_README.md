# PR#2: Go AI SDK Foundation - Quick Start

---

## TL;DR (30 seconds)

**What:** Add `aisdk-go` dependency and create adapter shell for converting Anthropic streams to AI SDK protocol format.

**Why:** Foundation for migrating Go backend to output Vercel AI SDK Data Stream Protocol, enabling frontend `useChat` hook integration.

**Time:** 2-3 hours estimated

**Complexity:** LOW

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ You have 2-3 hours available
- ✅ PR#1 (Frontend Foundation) can be done in parallel
- ✅ You understand Go HTTP streaming basics
- ✅ You're comfortable with adding dependencies

**Red Lights (Skip/defer it!):**
- ❌ Time-constrained (<2 hours)
- ❌ Other critical priorities
- ❌ Not familiar with Go streaming patterns

**Decision Aid:** This is a foundational PR with low risk. If you have 2-3 hours and basic Go knowledge, proceed. It's safe to do in parallel with PR#1.

---

## Prerequisites (5 minutes)

### Required
- [ ] Go 1.23+ installed and working
- [ ] Access to GitHub (for dependency download)
- [ ] Understanding of existing `pkg/llm/` structure
- [ ] Basic knowledge of HTTP streaming/SSE

### Setup Commands
```bash
# 1. Navigate to project root
cd /Users/isaac/Documents/Replicated/chartsmith

# 2. Verify Go version
go version  # Should be 1.23+

# 3. Verify existing code compiles
go build ./pkg/llm/...

# 4. Create branch
git checkout -b feat/ai-sdk-go-foundation
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min)
- [ ] Read main specification (20 min)
- [ ] Review existing `pkg/llm/conversational.go` to understand streaming patterns (5 min)
- [ ] Note any questions

### Step 2: Set Up Environment (5 minutes)
- [ ] Verify Go environment
- [ ] Check existing `pkg/llm/` structure
- [ ] Open relevant files in editor

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Dependency Setup
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (2-3 hours)
- [ ] Phase 1: Dependency Setup (15 min)
- [ ] Phase 2: Type Definitions (30 min)
- [ ] Phase 3: Adapter Shell (45 min)
- [ ] Phase 4: Basic Tests (30 min)
- [ ] Verification & Documentation (30 min)

**Checkpoint:** All code compiles, tests pass, ready for PR review

---

## Common Issues & Solutions

### Issue 1: Dependency Not Found
**Symptoms:** `go mod tidy` fails with "module not found"  
**Cause:** Network issue or incorrect module path  
**Solution:**
```bash
# Verify module path
# Should be: github.com/coder/aisdk-go

# Check latest version on GitHub
# Use: go get github.com/coder/aisdk-go@latest

# If network issues, try with proxy
GOPROXY=direct go mod tidy
```

### Issue 2: Type Conflicts
**Symptoms:** Compilation errors about conflicting types  
**Cause:** Import conflicts or wrong package  
**Solution:**
```go
// Use import alias if needed
import (
    aisdk "github.com/coder/aisdk-go"
)
```

### Issue 3: Tests Fail - SSE Format
**Symptoms:** WriteTextDelta test fails, body doesn't match expected format  
**Cause:** SSE format incorrect  
**Solution:**
```go
// Verify format is: "data: {json}\n\n"
// Check that newlines are correct (\n\n, not \r\n\r\n)
fmt.Fprintf(w.writer, "data: %s\n\n", data)
```

### Issue 4: Flusher Not Available
**Symptoms:** Test fails because httptest.ResponseRecorder doesn't implement Flusher  
**Cause:** httptest.ResponseRecorder doesn't implement http.Flusher  
**Solution:**
```go
// This is expected - flusher will be nil in tests
// Real ResponseWriter in production will have Flusher
flusher, _ := w.(http.Flusher)  // OK if nil in tests
```

---

## Quick Reference

### Key Files
- `pkg/llm/aisdk.go` - Main adapter implementation
- `pkg/llm/types/aisdk.go` - Type definitions
- `pkg/llm/aisdk_test.go` - Unit tests
- `go.mod` - Dependency management

### Key Functions
- `NewAISDKStreamWriter(w http.ResponseWriter)` - Create adapter instance
- `WriteTextDelta(text string)` - Write text streaming event
- `WriteToolCall(id, name string, args interface{})` - Write tool call event
- `WriteToolResult(id string, result interface{})` - Write tool result event
- `WriteFinish(reason string)` - Write finish event

### Key Concepts
- **AI SDK Data Stream Protocol:** SSE format for streaming AI responses
- **SSE Format:** `data: {json}\n\n` per event
- **Stream Writer:** Wraps HTTP ResponseWriter to output protocol-compliant events

### Useful Commands
```bash
# Add dependency
go get github.com/coder/aisdk-go@latest

# Update go.mod
go mod tidy

# Build
go build ./pkg/llm/...

# Test
go test ./pkg/llm/...

# Test specific function
go test ./pkg/llm -run TestWriteTextDelta

# Lint
golangci-lint run ./pkg/llm/...
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] `go mod tidy` succeeds without errors
- [ ] `go build ./pkg/llm/...` compiles successfully
- [ ] `go test ./pkg/llm/...` passes all tests
- [ ] New files exist: `aisdk.go`, `aisdk_test.go`, `types/aisdk.go`
- [ ] No existing tests fail

**Performance Targets:**
- N/A (no performance-critical code in this PR)

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review `pkg/llm/conversational.go` for existing streaming patterns
3. Check `aisdk-go` GitHub repo: https://github.com/coder/aisdk-go
4. Review AI SDK protocol spec: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol

### Want to Skip Something?
- **Can skip:** Advanced error handling (basic is fine for this PR)
- **Can skip:** Comprehensive edge case tests (basic tests sufficient)
- **Must include:** Dependency, adapter shell, basic tests

### Running Out of Time?
**Minimum viable PR:**
1. Add dependency ✓
2. Create adapter shell with WriteTextDelta ✓
3. One basic test ✓

Everything else can be added in follow-up commits.

---

## Motivation

**You've got this!** 💪

This is a straightforward foundational PR. You're setting up the infrastructure that will enable the entire AI SDK migration. The adapter shell you create here will be the foundation for PR#3's full implementation.

**Key Insight:** This PR is intentionally minimal - just enough to establish the foundation. The real work happens in PR#3 when we wire it up to actual streaming.

---

## Next Steps

**When ready:**
1. Run prerequisites (5 min)
2. Read main spec (30 min)
3. Start Phase 1 from checklist
4. Commit early and often

**After completion:**
- PR#3 will use this foundation
- PR#4 will wire it to HTTP endpoint
- Frontend (PR#1) can proceed in parallel

**Status:** Ready to build! 🚀

