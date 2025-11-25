# Google OAuth Configuration Guide

## Issue Diagnosed

The Google OAuth "Error 400: invalid_request" error was caused by two configuration issues:

1. ✅ **FIXED**: Missing `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` environment variable (now set to `http://localhost:3000/auth/google`)
2. ❌ **REQUIRES ACTION**: Invalid `GOOGLE_CLIENT_SECRET` (currently set to "placeholder" - **needs to be retrieved from 1Password**)

## OAuth Flow Architecture

The Chartsmith app uses a popup-based OAuth flow:

1. User clicks "Continue with Google" button (`components/GoogleButton.tsx:30-95`)
2. Button opens Google OAuth consent page in popup window
3. Google redirects to: `http://localhost:3003/auth/google` (callback URL)
4. Callback page (`app/auth/google/page.tsx`) extracts authorization code
5. Code is exchanged for access token via `lib/auth/client.ts:fetchGoogleProfile()`
6. User profile is fetched and session is created
7. JWT token is sent back to parent window via `postMessage`
8. Parent window sets session cookie and redirects user

## Required Environment Variables

Add these to `.env.local`:

```bash
# Google OAuth Client ID (already configured)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com

# Google OAuth Redirect URI (✅ FIXED)
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google

# Google OAuth Client Secret (❌ RETRIEVE FROM 1PASSWORD)
GOOGLE_CLIENT_SECRET=<get from 1password>
```

## Quick Fix (For Team Members with 1Password Access)

If you're a team member with access to the project's 1Password vault:

1. Open 1Password and search for "Chartsmith Google OAuth" or "GOOGLE_CLIENT_SECRET"
2. Copy the client secret value
3. Update `.env.local` in the `chartsmith-app` directory:
   ```bash
   GOOGLE_CLIENT_SECRET=<paste_value_from_1password>
   ```
4. Restart the dev server:
   ```bash
   npm run dev
   ```
5. Try signing in with Google again at http://localhost:3000

The redirect URI has already been fixed in `.env.local` and the dev server is running on the correct port (3000).

## How to Get Google OAuth Credentials (For New Setup)

### Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Click on **OAuth consent screen** in the left sidebar
2. Choose **External** user type (for development)
3. Fill in required fields:
   - App name: ChartSmith Dev
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. For development, you can skip adding scopes
6. Add test users (your email address) if app is in "Testing" mode

### Step 3: Create OAuth 2.0 Client ID

If you already have the client ID `730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe`, you need to:

1. Find this OAuth 2.0 Client ID in the credentials list
2. Click the edit icon (pencil) to edit it
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3003/auth/google
   ```
4. Click **Save**
5. Copy the **Client Secret** value
6. Replace `placeholder` in `.env.local` with the actual client secret

If you need to create a new OAuth client:

1. Click **Create Credentials** > **OAuth client ID**
2. Choose application type: **Web application**
3. Name: `ChartSmith Local Development`
4. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3003
   ```
5. Add **Authorized redirect URIs**:
   ```
   http://localhost:3003/auth/google
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**
8. Update both values in `.env.local`

### Step 4: Verify Configuration

After updating `.env.local`, restart the development server:

```bash
npm run dev
```

Then try signing in with Google again.

## Common Issues and Solutions

### Issue: "Error 400: invalid_request"

**Causes:**
- Client secret is invalid or missing (currently: "placeholder")
- Redirect URI not configured in Google Cloud Console
- Redirect URI mismatch between `.env.local` and Google Cloud Console

**Solution:**
1. Verify `GOOGLE_CLIENT_SECRET` is set to real value (not "placeholder")
2. Ensure redirect URI in Google Cloud Console exactly matches: `http://localhost:3003/auth/google`
3. Restart Next.js dev server after updating `.env.local`

### Issue: "This app hasn't been verified"

**Cause:** App is in development mode and user isn't added as test user

**Solution:**
1. In Google Cloud Console, go to OAuth consent screen
2. Under "Test users", add your email address
3. Click **Save**

### Issue: Port mismatch (app running on different port)

**Cause:** Port 3000 is in use, Next.js uses port 3003 instead

**Solution:**
1. Update redirect URI to match actual port: `http://localhost:XXXX/auth/google`
2. Update both `.env.local` and Google Cloud Console configuration

## Security Notes

- **NEVER commit** `.env.local` to version control
- The `.env.local` file is already in `.gitignore`
- For production, use `NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google`
- Store production secrets in secure environment variable storage (Vercel, AWS Secrets Manager, etc.)

## First User Admin Feature

Once OAuth is working, the first user to sign in will automatically become an admin:

- Implementation: `lib/auth/user.ts:66-84` (`upsertUser` function)
- Logic: Checks if `chartsmith_user` table is empty
- If first user: calls `upsertFirstAdminUser()` which sets `is_admin: true`
- Subsequent users: added to waitlist (unless `acceptingNewUsers` is true)

## Files Modified

- `.env.local` - Added `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` environment variable

## Next Steps

1. Obtain the actual Google Client Secret from Google Cloud Console
2. Replace `placeholder` in `.env.local` with the real client secret
3. Verify redirect URI is configured correctly in Google Cloud Console
4. Restart development server
5. Test Google OAuth login flow
6. Verify first user becomes admin by checking the JWT payload
