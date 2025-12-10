# PR#5: Next.js API Route Proxy - Quick Start

---

## TL;DR (30 seconds)

**What:** Create a Next.js API route at `/api/chat` that proxies requests from the frontend `useChat` hook to the Go worker's streaming endpoint.

**Why:** This route is the critical bridge that enables the frontend to communicate with the Go backend using the standard AI SDK protocol.

**Time:** 2-3 hours estimated

**Complexity:** LOW-MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#4 (Go Chat HTTP Endpoint) is complete
- ✅ You have 2-3 hours available
- ✅ You understand Next.js API routes
- ✅ You're comfortable with TypeScript and async/await
- ✅ Go worker is running (for testing)

**Red Lights (Skip/defer it!):**
- ❌ PR#4 not complete (this PR depends on it)
- ❌ Time-constrained (<2 hours)
- ❌ Not familiar with Next.js API routes
- ❌ Go worker not available for testing
- ❌ Feature flag infrastructure not ready (PR#1)

**Decision Aid:** This PR is straightforward but critical. It's a proxy route with standard patterns. If PR#4 is complete and you understand Next.js API routes, you can confidently build this. If unsure, read the [main specification](./PR05_NEXTJS_API_ROUTE_PROXY.md) first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#4 complete (Go chat endpoint exists at `/api/v1/chat/stream`)
- [ ] PR#1 complete (Feature flag infrastructure available)
- [ ] Access to `chartsmith-app` directory
- [ ] Node.js and npm installed
- [ ] Git access (for creating branch)
- [ ] Basic understanding of Next.js API routes
- [ ] Understanding of async/await and streaming

### Recommended
- [ ] Read [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Understand overall strategy
- [ ] Read [Architecture Comparison](../../architecture-comparison.md) - Understand before/after
- [ ] Familiarity with Next.js 14+ App Router
- [ ] Understanding of Server-Sent Events (SSE)

### Setup Commands
```bash
# 1. Navigate to frontend directory
cd chartsmith-app

# 2. Verify Node.js version (should be 18+)
node --version

# 3. Verify npm works
npm --version

# 4. Create branch
git checkout -b feat/ai-sdk-api-route

# 5. Verify Go worker is running (for testing)
# In another terminal:
# ENABLE_AI_SDK_CHAT=true make run-worker
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (30 minutes)
- [ ] Read this quick start (5 min) ✓
- [ ] Read main specification (20 min)
  - [ ] Understand architecture decisions
  - [ ] Review code examples
  - [ ] Note error handling patterns
- [ ] Review implementation checklist (5 min)
  - [ ] Understand phase structure
  - [ ] Note testing checkpoints

### Step 2: Set Up Environment (5 minutes)
- [ ] Navigate to `chartsmith-app` directory
- [ ] Create git branch
- [ ] Verify current state (run `npm run build` to baseline)
- [ ] Verify Go worker URL configuration

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Create Route File
- [ ] Follow checklist step-by-step
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (2-3 hours)
- [ ] Phase 1: Create Route File (30 min)
- [ ] Phase 2: Go Worker URL Configuration (15 min)
- [ ] Phase 3: Proxy Implementation (30 min)
- [ ] Phase 4: Testing (45 min)
- [ ] Phase 5: Documentation & Polish (15 min)

**Checkpoint:** `/api/chat` route proxies requests and streams responses ✓

---

## Common Issues & Solutions

### Issue 1: Go Worker Not Found
**Symptoms:** `fetch` fails with network error  
**Cause:** Go worker URL incorrect or worker not running  
**Solution:**
```bash
# Check GO_WORKER_URL environment variable
echo $GO_WORKER_URL

# Default should be http://localhost:8080
# Start Go worker:
ENABLE_AI_SDK_CHAT=true make run-worker
```

### Issue 2: Authentication Always Fails
**Symptoms:** Route returns 401 even with valid session  
**Cause:** `authOptions` import path incorrect or session not configured  
**Solution:**
```typescript
// Verify import path matches your project structure
import { authOptions } from '@/lib/auth/auth-options';

// Check that getServerSession is called correctly
const session = await getServerSession(authOptions);
```

### Issue 3: Streaming Not Working
**Symptoms:** Response is buffered, not streamed  
**Cause:** Response body not passed correctly  
**Solution:**
```typescript
// Ensure you're passing response.body directly
return new Response(response.body, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

### Issue 4: Feature Flag Not Working
**Symptoms:** Route always returns 404  
**Cause:** Feature flag not enabled or import path incorrect  
**Solution:**
```typescript
// Verify import path
import { featureFlags } from '@/lib/config/feature-flags';

// Check feature flag value
console.log(featureFlags.enableAISDKChat); // Should be true

// Enable in environment:
ENABLE_AI_SDK_CHAT=true npm run dev
```

### Issue 5: TypeScript Errors
**Symptoms:** Type errors for `NextRequest`, `NextResponse`  
**Cause:** Next.js types not installed or version mismatch  
**Solution:**
```bash
# Verify Next.js version
npm list next

# Should be 14+ for App Router support
# If not, update:
npm install next@latest
```

---

## Quick Reference

### Key Files
- `chartsmith-app/app/api/chat/route.ts` - Main route handler
- `chartsmith-app/types/env.d.ts` - Environment variable types
- `chartsmith-app/.env.example` - Environment variable examples

### Key Functions
- `POST(req: NextRequest)` - Main route handler
- `getGoWorkerUrl()` - Resolves Go worker URL from config
- `getServerSession(authOptions)` - Validates authentication

### Key Concepts
- **API Route:** Next.js App Router pattern for API endpoints
- **Streaming:** Passing response body directly without buffering
- **Proxy:** Forwarding requests from one server to another
- **SSE:** Server-Sent Events format for streaming data

### Useful Commands
```bash
# Run dev server
npm run dev

# Run tests
npm test app/api/chat

# Type check
npm run type-check

# Build
npm run build

# Test with curl
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: [session cookie]" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "workspaceId": "test"}'
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] Route responds to POST requests at `/api/chat`
- [ ] Authentication validation works (401 for unauthenticated)
- [ ] Feature flag check works (404 when disabled)
- [ ] Request validation works (400 for invalid requests)
- [ ] Requests are forwarded to Go backend correctly
- [ ] Responses stream back correctly (SSE format)
- [ ] Error handling works for all scenarios
- [ ] Unit tests pass
- [ ] No console errors

**Performance Targets:**
- Proxy overhead: < 100ms
- First token latency: < 50ms additional overhead
- No buffering (streams directly)

---

## Help & Support

### Stuck?
1. Check main planning doc for details
2. Review similar API routes in `chartsmith-app/app/api/`
3. Check Go worker logs for backend errors
4. Verify feature flag is enabled
5. Check network tab in browser dev tools

### Want to Skip a Feature?
This PR is minimal - all features are required. If you want to simplify:
- Can skip comprehensive error handling (but not recommended)
- Can skip unit tests (but not recommended)
- Can skip manual testing (but not recommended)

### Running Out of Time?
**Priority order:**
1. ✅ Basic route with auth check (30 min)
2. ✅ Proxy implementation (30 min)
3. ✅ Basic error handling (15 min)
4. ⏳ Testing (45 min) - Can reduce to 15 min for basic tests
5. ⏳ Documentation (15 min) - Can skip if needed

**Minimum viable:** Route + proxy + basic error handling (1.5 hours)

---

## Motivation

**You've got this!** 💪

This PR is straightforward - it's a proxy route with standard Next.js patterns. The code is clean, the logic is simple, and the testing is straightforward. Once this is done, PR#6 can wire up the frontend `useChat` hook, and users will start seeing the new AI SDK-powered chat experience!

---

## Next Steps

**When ready:**
1. Run prerequisites (5 min)
2. Read main spec (20 min)
3. Start Phase 1 from checklist
4. Commit early and often

**Status:** Ready to build! 🚀

