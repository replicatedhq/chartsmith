# PR#10: Frontend Anthropic SDK Removal - Quick Start

---

## TL;DR (30 seconds)

**What:** Migrate `promptType()` function from using Anthropic SDK to Go backend API, then remove `@anthropic-ai/sdk` from frontend dependencies.

**Why:** Complete the frontend migration away from direct LLM calls, reduce bundle size, and centralize API key management.

**Time:** 3-5 hours estimated

**Complexity:** MEDIUM

**Status:** 📋 PLANNED

---

## Decision Framework (2 minutes)

### Should You Build This?

**Green Lights (Build it!):**
- ✅ PR#4 complete (Go backend API infrastructure ready)
- ✅ You have 3-5 hours available
- ✅ You understand the migration strategy (read PRD)
- ✅ You're comfortable with Go and TypeScript
- ✅ Go backend is deployed and accessible

**Red Lights (Skip/defer it!):**
- ❌ PR#4 not complete (Go backend not ready)
- ❌ Time-constrained (<3 hours)
- ❌ Haven't read the PRD or architecture docs
- ❌ Go backend not accessible
- ❌ Not comfortable with API integration

**Decision Aid:** This PR depends on Go backend infrastructure. Verify PR#4 is complete and Go backend is deployed before starting. If unsure, read the [main specification](./PR10_FRONTEND_ANTHROPIC_SDK_REMOVAL.md) first.

---

## Prerequisites (5 minutes)

### Required
- [ ] PR#4 complete (New Chat Streaming Endpoint)
- [ ] Go backend deployed and accessible
- [ ] Access to `chartsmith-app` directory
- [ ] Node.js and npm installed
- [ ] Go development environment set up
- [ ] Anthropic API key available in Go backend environment

### Recommended
- [ ] Read [PRD: Vercel AI SDK Migration](../../PRD-vercel-ai-sdk-migration.md) - Understand overall strategy
- [ ] Read [Architecture Comparison](../../architecture-comparison.md) - Understand before/after
- [ ] Familiarity with Next.js API routes
- [ ] Understanding of Go HTTP handlers

### Setup Commands
```bash
# 1. Navigate to project root
cd /path/to/chartsmith

# 2. Verify Go backend is running
curl http://localhost:8080/health  # Or your backend URL

# 3. Navigate to frontend directory
cd chartsmith-app

# 4. Verify Node.js version (should be 18+)
node --version

# 5. Create branch
git checkout -b feat/remove-anthropic-sdk-frontend
```

---

## Getting Started (First Hour)

### Step 1: Read Documentation (45 minutes)
- [ ] Read this quick start (5 min) ✓
- [ ] Read main specification (30 min)
  - [ ] Understand architecture decisions
  - [ ] Note key implementation steps
  - [ ] Review code examples
- [ ] Review implementation checklist (10 min)
  - [ ] Understand phase structure
  - [ ] Note testing checkpoints

### Step 2: Set Up Environment (10 minutes)
- [ ] Navigate to project root
- [ ] Verify Go backend is running
- [ ] Create git branch
- [ ] Verify current state (run `npm run build` to baseline)

### Step 3: Start Phase 1
- [ ] Open implementation checklist
- [ ] Begin Phase 1: Go Backend Endpoint
- [ ] Follow checklist step-by-step
- [ ] Commit when phase complete

---

## Daily Progress Template

### Day 1 Goals (3-5 hours)
- [ ] Phase 1: Go Backend Endpoint (2-3 h)
  - [ ] Classification function (1 h)
  - [ ] HTTP handler (45 min)
  - [ ] Route registration (15 min)
  - [ ] Unit tests (30 min)
- [ ] Phase 2: Next.js API Route (30 min)
- [ ] Phase 3: Frontend Migration (1 h)
- [ ] Phase 4: Dependency Removal (30 min)
- [ ] Phase 5: Testing & Verification (1 h)

**Checkpoint:** All functionality working, package removed, tests passing

---

## Common Issues & Solutions

### Issue 1: Go backend not accessible
**Symptoms:** API calls fail with connection errors  
**Cause:** Go backend not running or wrong URL  
**Solution:**
```bash
# Check if backend is running
curl http://localhost:8080/health

# Verify environment variable
echo $GO_BACKEND_URL

# Start backend if needed
cd /path/to/chartsmith
go run cmd/main.go
```

### Issue 2: Anthropic API key not found
**Symptoms:** Go backend returns 500 error  
**Cause:** API key not set in Go backend environment  
**Solution:**
```bash
# Check environment variable
echo $ANTHROPIC_API_KEY

# Set if missing (in Go backend environment)
export ANTHROPIC_API_KEY="your-key-here"
```

### Issue 3: Route not found (404)
**Symptoms:** API calls return 404  
**Cause:** Route not registered in Go backend  
**Solution:**
- Check route registration in `pkg/api/routes.go` or `cmd/main.go`
- Verify route path matches frontend expectations (`/api/prompt-type`)
- Restart Go backend after adding route

### Issue 4: CORS errors
**Symptoms:** Browser console shows CORS errors  
**Cause:** Go backend not allowing frontend origin  
**Solution:**
- Add CORS headers in Go handler (if needed)
- Or ensure Next.js API route handles CORS (should be same-origin)

### Issue 5: Bundle size not reduced
**Symptoms:** Bundle size same or larger after removal  
**Cause:** Package still imported somewhere or tree-shaking not working  
**Solution:**
```bash
# Search for remaining imports
grep -r "@anthropic-ai/sdk" chartsmith-app/

# Check bundle analyzer
npm run build
# Look for Anthropic SDK in bundle output

# Verify package removed from node_modules
ls node_modules/@anthropic-ai/  # Should not exist
```

### Issue 6: TypeScript errors after removal
**Symptoms:** Build fails with type errors  
**Cause:** Types still referenced somewhere  
**Solution:**
```bash
# Find all references
grep -r "Anthropic" chartsmith-app/ --include="*.ts" --include="*.tsx"

# Remove or update references
# Run type check
npx tsc --noEmit
```

---

## Quick Reference

### Key Files
- `pkg/llm/prompt_type.go` - LLM classification function (new)
- `pkg/api/prompt_type.go` - HTTP handler (new)
- `chartsmith-app/app/api/prompt-type/route.ts` - Next.js API route (new)
- `chartsmith-app/lib/llm/prompt-type.ts` - Frontend function (modified)
- `chartsmith-app/package.json` - Dependencies (modified)

### Key Functions
- `llm.ClassifyPromptType()` - Go function for classification
- `api.HandlePromptType()` - Go HTTP handler
- `promptType()` - Frontend function (now calls API)

### Key Concepts
- **Migration Strategy:** Move LLM calls from frontend to backend
- **API Route:** Next.js route proxies to Go backend
- **Bundle Reduction:** Removing SDK reduces frontend bundle size
- **Centralized Logic:** All LLM calls go through Go backend

### Useful Commands
```bash
# Go backend
go test ./pkg/llm/... -v
go test ./pkg/api/... -v
go run cmd/main.go

# Frontend
npm run build
npm run dev
npm test

# Verify package removal
grep -r "@anthropic-ai/sdk" chartsmith-app/
npm ls @anthropic-ai/sdk  # Should show "empty"
```

---

## Success Metrics

**You'll know it's working when:**
- [ ] `promptType()` function works without errors
- [ ] API calls succeed (check network tab)
- [ ] Classification results match expected behavior
- [ ] `@anthropic-ai/sdk` removed from package.json
- [ ] Bundle size reduced (~50-100KB)
- [ ] No Anthropic SDK imports in codebase
- [ ] All tests passing
- [ ] No console errors

**Performance Targets:**
- Response time: < 2 seconds (same as before)
- Bundle size: Reduced by 50-100KB
- Error rate: < 1% (same as before)

---

## Help & Support

### Stuck?
1. Check main planning doc for details: `PR10_FRONTEND_ANTHROPIC_SDK_REMOVAL.md`
2. Review implementation checklist: `PR10_IMPLEMENTATION_CHECKLIST.md`
3. Check [PRD](../../PRD-vercel-ai-sdk-migration.md) for overall context
4. Review [Architecture Comparison](../../architecture-comparison.md) for technical details
5. Check Go backend logs for errors
6. Check Next.js API route logs

### Want to Skip a Feature?
- Can't skip - this is required for migration completion
- All parts are necessary
- But you can defer if dependencies not ready

### Running Out of Time?
- Phase 1 (Go backend) is critical - must complete
- Phase 2 (API route) is critical - must complete
- Phase 3 (Frontend migration) is critical - must complete
- Phase 4 (Dependency removal) is critical - must complete
- Phase 5 (Testing) is critical - must complete

**Minimum viable:** All phases are required - this is a cleanup PR that must be complete.

---

## Motivation

**You've got this!** 💪

This PR completes an important migration step. You're:
- Removing a large dependency from the frontend
- Centralizing LLM logic in the backend
- Improving security (API keys stay on backend)
- Reducing bundle size
- Making the codebase cleaner

The work is straightforward - you're moving existing logic to a better location. Take your time with testing - it's worth it!

---

## Next Steps

**When ready:**
1. Verify PR#4 is complete (5 min)
2. Read main spec (30 min)
3. Review checklist (10 min)
4. Start Phase 1: Go Backend Endpoint
5. Follow checklist step-by-step
6. Commit frequently

**After completion:**
- PR#11: Documentation & Final Testing (can proceed)
- Migration complete! 🎉

**Status:** Ready to build! 🚀

