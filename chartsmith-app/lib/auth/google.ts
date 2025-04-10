// Google OAuth configuration and utilities
export const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth`;

export function getGoogleAuthUrl(clientID: string, redirectURI: string) {
  if (!clientID) {
    throw new Error("Google Client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: typeof window !== "undefined" ? `${redirectURI}` : "",
    response_type: "code",
    scope: "email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
