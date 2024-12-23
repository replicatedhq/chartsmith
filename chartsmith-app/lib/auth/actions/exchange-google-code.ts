"use server"

import { fetchGoogleProfile } from "../client"
import { GoogleUserProfile } from "../types"

export async function exchangeGoogleCode(code: string): Promise<GoogleUserProfile> {
  try {
    const profile = await fetchGoogleProfile(code)
    return profile
  } catch (error) {
    console.error('Google auth error:', error)
    throw error
  }
}
