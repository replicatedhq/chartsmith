import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_TEST_AUTH: process.env.ENABLE_TEST_AUTH,
    NEXT_PUBLIC_ENABLE_TEST_AUTH: process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH,
    envFileLoaded: process.env.HMAC_SECRET ? 'Yes (HMAC_SECRET exists)' : 'No',
  };

  return NextResponse.json(envDebug);
}
