# PR-02: Add Go AI SDK Library

**Branch:** `feat/go-aisdk-library`
**Dependencies:** None (can start immediately)
**Parallel With:** PR-01, PR-03
**Estimated Complexity:** Low
**Success Criteria:** G2 (Migrate to AI SDK Core)

---

## Overview

Add the `coder/aisdk-go` library to the Go backend. This library allows Go to output streams in the Vercel AI SDK Data Stream Protocol format. This is a foundational PR that adds the dependency without changing functionality.

## Prerequisites

- Access to the root project directory (Go module)
- Go 1.21+ installed
- Ability to run `go get`

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | `github.com/coder/aisdk-go` | Only Go library implementing AI SDK protocol |
| Version | Latest (`@latest`) | Actively maintained by Coder |

---

## Step-by-Step Instructions

### Step 1: Navigate to Project Root

```bash
cd /path/to/chartsmith
```

Verify you're in the right directory:

```bash
ls go.mod
```

Should show `go.mod` file.

### Step 2: Add the AI SDK Go Library

```bash
go get github.com/coder/aisdk-go@latest
```

### Step 3: Verify Installation

Check that the package was added to `go.mod`:

```bash
grep "aisdk-go" go.mod
```

Expected output:
```
github.com/coder/aisdk-go v0.x.x
```

### Step 4: Tidy Dependencies

```bash
go mod tidy
```

### Step 5: Verify Build

```bash
make build
```

Or if no Makefile:

```bash
go build ./...
```

Build should succeed with no errors.

### Step 6: Run Existing Tests

```bash
make test
```

Or:

```bash
go test ./...
```

All existing tests should pass.

### Step 7: Create Type Verification File

Create a simple file to verify the library is accessible:

```go
// pkg/llm/aisdk_verify.go
package llm

import (
    // Verify import works - delete this file after PR or keep for reference
    _ "github.com/coder/aisdk-go"
)
```

Run build again to verify:

```bash
go build ./...
```

**Note:** Delete this file before merging or keep it as a placeholder for the actual implementation.

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `go.mod` | Modified | Added `github.com/coder/aisdk-go` dependency |
| `go.sum` | Modified | Updated checksums |
| `pkg/llm/aisdk_verify.go` | Added (Optional) | Type verification placeholder |

---

## Acceptance Criteria

- [ ] `github.com/coder/aisdk-go` is in `go.mod`
- [ ] `go build ./...` succeeds
- [ ] `go test ./...` passes (all existing tests)
- [ ] No compilation errors
- [ ] Worker starts successfully

---

## Testing Instructions

1. Start the worker:
   ```bash
   make run-worker
   ```
   Or however the worker is typically started.

2. Verify it starts without errors

3. Verify existing functionality works (send a test chat message)

---

## Understanding the Library

The `aisdk-go` library provides types and helpers for the AI SDK Data Stream Protocol:

```go
import "github.com/coder/aisdk-go"

// Key types we'll use later:
// - aisdk.DataStream      - For writing SSE events
// - aisdk.Message         - AI SDK message format
// - aisdk.ToolInvocation  - Tool call representation
```

Documentation: https://github.com/coder/aisdk-go

---

## Rollback Plan

If issues arise:

```bash
# Remove from go.mod
go mod edit -droprequire github.com/coder/aisdk-go
go mod tidy

# Or revert files
git checkout go.mod go.sum
```

---

## PR Checklist

- [ ] Branch created from `main`
- [ ] Library added to go.mod
- [ ] go.sum updated
- [ ] Build passes
- [ ] Tests pass
- [ ] Worker starts successfully
- [ ] PR description references this doc
- [ ] Ready for review

---

## Notes for Reviewer

- This PR only adds a dependency, no functional code changes
- The library is maintained by Coder (reputable company)
- Verify the library version is recent and maintained
- Check go.sum for any suspicious transitive dependencies
