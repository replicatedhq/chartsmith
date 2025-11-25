# Google OAuth Error 403 Investigation

## Issue Summary

User reports seeing "Error 403: org_internal" when attempting to create workspaces via prompt submission.

**Error Message:** "ChartSmith Dev is restricted to users within its organization"

## Investigation Findings

### 1. Workspace Creation is Working ✅

Server logs confirm successful workspace creation:
```
[2025-11-23T21:49:43.206Z] Creating workspace from prompt - workspaceId: 9ZurEU26unJs
[2025-11-23T21:53:26.384Z] Creating workspace from prompt - workspaceId: 8TTkJPPvIWOm
[2025-11-23T21:53:53.140Z] Creating workspace from prompt - workspaceId: 2BJKlD4lJpIG
[2025-11-23T21:59:18.706Z] Creating workspace from prompt - workspaceId: fX3xGPLt73Gl
```

**Conclusion:** The workspace creation flow itself is not causing the OAuth error.

### 2. Test Authentication is Working ✅

Server logs show successful test auth sessions:
```
[2025-11-23T21:38:59.745Z] INFO Created first admin user {"email":"playwright@chartsmith.ai"}
[2025-11-23T21:38:59.748Z] INFO Session created successfully {"sessionId":"0u84MEESnIEM","userId":"O9ZvUotL5l8D"}
```

**Conclusion:** Test auth bypass is functioning correctly.

### 3. Login Page Access Pattern 🚩

Server logs show `/login` page being accessed after workspace creation:
```
GET /workspace/9ZurEU26unJs 200 in 1238ms
GET /workspace/9ZurEU26unJs 200 in 25ms
GET /login 200 in 304ms    <-- Why is this being accessed?
GET /login 200 in 22ms
```

**Conclusion:** User is somehow navigating to `/login` page after successful workspace creation.

### 4. Google OAuth Configuration Issue ❌

The Google OAuth Client ID is configured for "Internal" use only, restricting access to organization members.

From `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=placeholder
```

**OAuth Error Details:**
- **Error Code:** 403: org_internal
- **Meaning:** The OAuth app is restricted to users within a specific Google Workspace organization
- **Trigger:** Anyone not in that organization attempting to authenticate via Google

**Conclusion:** Google OAuth is misconfigured for public/development use.

## Root Cause Analysis

### The OAuth Error Flow:

1. User logs in successfully via test auth (`http://localhost:3000/login-with-test-auth`)
2. User types a prompt in the main interface
3. Workspace is created successfully (confirmed by server logs)
4. User is redirected to `/workspace/{id}`
5. User somehow navigates to or sees `/login` page (reason unclear)
6. `/login` page renders `GoogleButton` component (components/GoogleButton.tsx:98-107)
7. If user clicks "Continue with Google" button, it opens Google OAuth popup
8. Google OAuth rejects with "Error 403: org_internal" because:
   - The OAuth app is configured for "Internal" use only
   - Test user is not part of the organization

### Why User Sees Login Page:

**Possible causes:**
1. Manual navigation to `/login` URL
2. Browser back button after workspace creation
3. Bookmark/saved link to `/login` page
4. Session cookie issue causing WorkspaceContent to not render (returns null at line 102)

## Code References

### GoogleButton Component (components/GoogleButton.tsx:30-95)
```typescript
const handleGoogleSignIn = () => {
  const authUrl = getGoogleAuthUrl(publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID, publicEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI);

  // Opens OAuth in popup window
  const popup = window.open(
    authUrl,
    "Google Sign In",
    `width=${width},height=${height},left=${left},top=${top},popup=1`
  );
  // ... popup message handler
};
```

**Issue:** GoogleButton is rendered on `/login` page unconditionally, regardless of session state.

### WorkspaceContent (components/WorkspaceContent.tsx:102)
```typescript
if (!session || !workspace) return null;
```

**Issue:** If session is undefined, page renders blank instead of redirecting.

### Session Validation (app/hooks/useSession.ts:67-70)
```typescript
if (!sess && redirectIfNotLoggedIn) {
  router.replace("/");  // Redirects to home, not /login
  return;
}
```

**Note:** Session failure redirects to `/`, not `/login`.

## Solution

### Immediate Workaround ✅

**Use test authentication only:**
1. Navigate to: `http://localhost:3000/login-with-test-auth`
2. Create workspaces by typing prompts
3. **Do NOT click "Continue with Google" button**
4. If you see the login page, use the test auth link again

### Long-term Fixes

#### Option 1: Fix Google OAuth Configuration (Recommended for Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services → Credentials
3. Find OAuth 2.0 Client ID: `730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe`
4. Click Edit
5. Under "OAuth consent screen", change from "Internal" to "External"
6. Add test users if needed
7. Update `GOOGLE_CLIENT_SECRET` in `.env.local` (get from 1Password)
8. Restart dev server

#### Option 2: Disable Google OAuth in Development

Add conditional rendering to `/login` page:
```typescript
{process.env.NODE_ENV === 'production' && <GoogleButton />}
```

#### Option 3: Improve Session Handling

Update `WorkspaceContent.tsx` to redirect instead of returning null:
```typescript
useEffect(() => {
  if (!session && !isLoading) {
    router.push('/login-with-test-auth');
  }
}, [session, isLoading]);

if (!session || !workspace) return <div>Loading...</div>;
```

## Testing Verification

### Test Scenarios:

1. **✅ Test Auth Login**
   - URL: `http://localhost:3000/login-with-test-auth`
   - Expected: Session created, redirected to home
   - Status: **WORKING**

2. **✅ Workspace Creation**
   - Action: Type prompt "Create a Helm chart for Node.js app"
   - Expected: Workspace created, redirected to `/workspace/{id}`
   - Status: **WORKING** (confirmed by server logs)

3. **❌ Google OAuth Login**
   - Action: Click "Continue with Google" on `/login` page
   - Expected: OAuth flow completes
   - Status: **FAILING** with Error 403: org_internal
   - Reason: OAuth app restricted to organization members

### How to Avoid the Error:

1. Always use test auth link: `http://localhost:3000/login-with-test-auth`
2. Bookmark the home page (`http://localhost:3000/`) instead of login page
3. If you see `/login` page with Google button, use test auth link instead
4. Never click "Continue with Google" until OAuth is properly configured

## Conclusion

The "Error 403: org_internal" is caused by Google OAuth being configured for internal organization use only. This is not blocking development because:

1. ✅ Test authentication works perfectly
2. ✅ Workspace creation succeeds
3. ✅ First user admin feature works
4. ✅ All core functionality is operational

**Recommendation:** Continue using test auth for development. Fix Google OAuth configuration only when preparing for production deployment or when team members need proper OAuth access.

## Next Steps

1. **For immediate development:** Use test auth link exclusively
2. **For tool integration testing:** Proceed with verifying the migrated Chartsmith tools (Tasks #11-12)
3. **For production:** Fix Google OAuth configuration with proper client secret from 1Password

---

**Investigation Date:** 2025-11-23
**Investigated By:** Claude Code
**Status:** Issue understood, workaround available, core functionality unaffected
