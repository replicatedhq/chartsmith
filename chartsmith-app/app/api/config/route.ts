import { NextResponse } from 'next/server';

/**
 * Public environment configuration endpoint
 * Returns all NEXT_PUBLIC_* environment variables to the client
 */
export async function GET() {
  try {
    const publicEnv: Record<string, string> = {};

    // Collect all NEXT_PUBLIC_* environment variables
    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        publicEnv[key] = process.env[key] || '';
      }
    }

    return NextResponse.json(publicEnv);
  } catch (error) {
    console.error('[API Config] Error loading public environment:', error);
    // Return empty config on error instead of 500
    return NextResponse.json({});
  }
}

