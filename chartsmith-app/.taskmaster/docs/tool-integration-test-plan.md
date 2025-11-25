# Tool Integration Verification Test Plan
## Tasks #11-12: End-to-End Testing

**Objective**: Verify that the migrated Chartsmith tools work correctly in the Next.js frontend application.

## Prerequisites ✅

All completed:
- [x] Tools schemas defined (`lib/tools/index.ts`)
- [x] Tool execution handlers implemented
- [x] ArtifactHub API client ready (`lib/tools/artifacthub.ts`)
- [x] Kubernetes version client ready (`lib/tools/kubernetes.ts`)
- [x] Text editor database operations ready (`lib/tools/text-editor-db.ts`)
- [x] Tools integrated in `/api/chat` route
- [x] Workspace context injection working
- [x] Database bootstrapped with default workspace

## Available Tools

### 1. text_editor
**Purpose**: Create, view, and modify Helm chart files in workspace
**Commands**:
- `view` - Read file contents
- `str_replace` - Find and replace text
- `create` - Create new file

### 2. latest_subchart_version
**Purpose**: Query ArtifactHub for latest Helm chart versions
**Example charts**: redis, postgresql, nginx-ingress, prometheus

### 3. latest_kubernetes_version
**Purpose**: Get current stable Kubernetes version
**Fields**: major, minor, patch

### 4. recommended_dependency
**Purpose**: Search and recommend Helm charts for user requirements
**Returns**: Top recommendation + alternatives

## Test Scenarios

### Test 1: View Existing Files ✓
**Objective**: Verify text_editor can view bootstrap workspace files

**Test Prompt**:
```
Show me the contents of values.yaml
```

**Expected AI Behavior**:
1. AI calls `text_editor` tool with:
   - command: "view"
   - path: "values.yaml"
2. Tool returns file content from workspace_file table
3. AI displays the content to user

**Success Criteria**:
- ✅ Tool call is made
- ✅ File content is returned
- ✅ AI shows content in response

---

### Test 2: Query Chart Versions ✓
**Objective**: Verify latest_subchart_version queries ArtifactHub

**Test Prompt**:
```
What's the latest version of the Redis Helm chart?
```

**Expected AI Behavior**:
1. AI calls `latest_subchart_version` tool with:
   - chart_name: "redis"
2. Tool queries https://artifacthub.io/api/v1/packages/search
3. Returns latest version (e.g., "19.0.2")
4. AI reports version to user

**Success Criteria**:
- ✅ ArtifactHub API call succeeds
- ✅ Version number returned
- ✅ AI reports version in response

---

### Test 3: Query Kubernetes Version ✓
**Objective**: Verify latest_kubernetes_version fetches K8s info

**Test Prompt**:
```
What's the current stable Kubernetes minor version?
```

**Expected AI Behavior**:
1. AI calls `latest_kubernetes_version` tool with:
   - semver_field: "minor"
2. Tool fetches from https://dl.k8s.io/release/stable.txt
3. Returns version (e.g., "1.32")
4. AI reports version to user

**Success Criteria**:
- ✅ K8s API call succeeds (or fallback works)
- ✅ Version component returned correctly
- ✅ AI reports version in response

---

### Test 4: Create New File ✓
**Objective**: Verify text_editor can create new Helm chart files

**Test Prompt**:
```
Create a deployment.yaml file for a nginx web server with 2 replicas, using image nginx:1.25, exposing port 80
```

**Expected AI Behavior**:
1. AI calls `text_editor` tool with:
   - command: "create"
   - path: "templates/deployment.yaml"
   - new_str: (complete YAML content)
2. Tool inserts into workspace_file table
3. Returns success
4. AI confirms file created

**Success Criteria**:
- ✅ Tool call with correct YAML
- ✅ File inserted in database
- ✅ AI confirms creation

---

### Test 5: Modify Existing File ✓
**Objective**: Verify text_editor can replace text in files

**Test Prompt** (after viewing values.yaml):
```
Change the replicaCount to 3
```

**Expected AI Behavior**:
1. AI calls `text_editor` tool with:
   - command: "view"
   - path: "values.yaml"
2. Reads current content
3. AI calls `text_editor` again with:
   - command: "str_replace"
   - path: "values.yaml"
   - old_str: "replicaCount: 1"
   - new_str: "replicaCount: 3"
4. Tool updates workspace_file
5. AI confirms change

**Success Criteria**:
- ✅ View operation succeeds
- ✅ Replace operation succeeds
- ✅ Database updated correctly
- ✅ AI confirms modification

---

### Test 6: Search for Chart Dependencies ✓
**Objective**: Verify recommended_dependency searches ArtifactHub

**Test Prompt**:
```
I need a message queue for my application. What Helm chart should I use?
```

**Expected AI Behavior**:
1. AI calls `recommended_dependency` tool with:
   - requirement: "message queue"
2. Tool searches ArtifactHub
3. Returns ranked results (e.g., bitnami/rabbitmq, apache/kafka)
4. AI presents recommendation with alternatives

**Success Criteria**:
- ✅ Search executes
- ✅ Results ranked by score
- ✅ Top recommendation identified
- ✅ AI presents options to user

---

### Test 7: Complex Multi-Tool Workflow ✓
**Objective**: Verify AI can chain multiple tools together

**Test Prompt**:
```
Create a Helm chart for a production-ready PostgreSQL database with the following requirements:
1. Use the latest available PostgreSQL chart version from ArtifactHub
2. Set kubeVersion to the latest Kubernetes minor version
3. Configure it with 3 replicas and persistent storage
```

**Expected AI Behavior**:
1. AI calls `latest_subchart_version` to get PostgreSQL version
2. AI calls `latest_kubernetes_version` to get K8s version
3. AI calls `text_editor` to view/create Chart.yaml
4. AI calls `text_editor` to view/create values.yaml
5. AI calls `text_editor` multiple times to create dependency configs
6. AI presents complete solution

**Success Criteria**:
- ✅ Multiple tools used correctly
- ✅ Tools called in logical order
- ✅ Results from one tool inform next tool call
- ✅ Final chart is production-ready

---

## Verification Steps

### Step 1: Start Fresh Workspace
1. Use test auth: `http://localhost:3000/login-with-test-auth`
2. Go to home page
3. Type a test prompt

### Step 2: Monitor Server Logs
Check Next.js dev server logs for:
```
[/api/chat] POST request received
[/api/chat] Workspace context injected
[textEditorTool] Executing command
[ArtifactHub] Searching for: redis
[Kubernetes] Fetched version: 1.32.1
```

### Step 3: Verify Database Operations
For text editor operations, check PostgreSQL:
```sql
-- View workspace files
SELECT id, file_path, content FROM workspace_file WHERE workspace_id = 'xxx';

-- View str_replace logs
SELECT * FROM str_replace_log ORDER BY created_at DESC LIMIT 10;
```

### Step 4: Test Each Tool Individually
Execute Tests 1-6 in order, verifying each tool works independently.

### Step 5: Execute Complex Workflow
Run Test 7 to verify tools work together in a real-world scenario.

---

## Expected Tool Call Logs

### Example: Text Editor View
```json
{
  "tool": "text_editor",
  "params": {
    "command": "view",
    "path": "values.yaml"
  },
  "result": {
    "success": true,
    "content": "replicaCount: 1\nimage:\n  repository: nginx\n  ..."
  }
}
```

### Example: Latest Chart Version
```json
{
  "tool": "latest_subchart_version",
  "params": {
    "chart_name": "redis"
  },
  "result": {
    "version": "19.0.2",
    "found": true,
    "chart_name": "redis",
    "message": "Latest version of redis is 19.0.2"
  }
}
```

### Example: K8s Version
```json
{
  "tool": "latest_kubernetes_version",
  "params": {
    "semver_field": "minor"
  },
  "result": {
    "version": "1.32",
    "field": "minor",
    "source": "kubernetes-release-api",
    "success": true
  }
}
```

---

## Error Scenarios to Test

### 1. File Not Found
**Test**: View non-existent file
```
Show me the contents of nonexistent.yaml
```
**Expected**: Tool returns `success: false, error: "File not found"`

### 2. String Not Found in Replace
**Test**: Replace text that doesn't exist
```
In values.yaml, change "nonexistent: value" to "new: value"
```
**Expected**: Tool returns `old_str_found: false`

### 3. Chart Not in ArtifactHub
**Test**: Query for non-existent chart
```
What's the latest version of the "totallyfakechart" Helm chart?
```
**Expected**: Tool returns `version: "?", found: false`

### 4. Missing Workspace Context
**Test**: Call tool without workspace ID
**Expected**: Tool returns error about missing WORKSPACE_ID

---

## Success Metrics

### Quantitative
- ✅ All 4 tools callable by AI
- ✅ All tool execution handlers working
- ✅ 100% of test scenarios passing
- ✅ <5s response time for tool calls
- ✅ 0 unhandled exceptions

### Qualitative
- ✅ AI uses tools appropriately
- ✅ Tool results inform AI responses
- ✅ Error messages are clear and actionable
- ✅ Multi-tool workflows complete successfully
- ✅ Database operations maintain consistency

---

## Testing Checklist

- [ ] Test 1: View existing files
- [ ] Test 2: Query chart versions
- [ ] Test 3: Query Kubernetes version
- [ ] Test 4: Create new file
- [ ] Test 5: Modify existing file
- [ ] Test 6: Search for chart dependencies
- [ ] Test 7: Complex multi-tool workflow
- [ ] Error scenario: File not found
- [ ] Error scenario: String not found
- [ ] Error scenario: Chart not found
- [ ] Performance: Tool calls <5s
- [ ] Database: No orphaned records
- [ ] Logs: All operations logged clearly

---

## Next Steps After Verification

If all tests pass:
1. ✅ Mark Tasks #11-12 as complete
2. ✅ Document any discovered issues
3. ✅ Proceed to Task #13: End-to-End Testing
4. ✅ Proceed to Task #14: Frontend Integration
5. ✅ Prepare for Task #15: Production Deployment

If issues found:
1. ❌ Document specific failures
2. ❌ Fix tool implementation issues
3. ❌ Re-run failed test scenarios
4. ❌ Update error handling as needed

---

**Test Plan Created**: 2025-11-23
**Status**: Ready for execution
**Estimated Duration**: 30-45 minutes for full test suite
