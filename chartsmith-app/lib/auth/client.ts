import { AppError } from "../utils/error";
import { GoogleUserProfile } from "./types";

export async function fetchGoogleProfile(code: string): Promise<GoogleUserProfile> {
  try {
    if (!code || typeof code !== "string") {
      throw new AppError("Invalid authorization code", "INVALID_CODE");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new AppError("Failed to exchange Google code for token", "TOKEN_ERROR", error);
    }

    const { access_token } = await tokenResponse.json();

    // Use access token to get user profile
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      throw new AppError("Failed to fetch Google profile", "PROFILE_ERROR", error);
    }

    const profile = await profileResponse.json();

    if (!profile.email) {
      throw new AppError("Invalid profile data", "INVALID_PROFILE", profile);
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      verified_email: profile.verified_email,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to authenticate with Google", "AUTH_ERROR", error);
  }
}
