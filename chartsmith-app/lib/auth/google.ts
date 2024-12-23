// Google OAuth configuration and utilities
export const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth`

export function getGoogleAuthUrl() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Google Client ID is not configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: typeof window !== 'undefined' ? `${process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI}` : '',
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'consent'
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}
