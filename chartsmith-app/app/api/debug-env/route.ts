import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    error: 'Debug environment endpoint is disabled for security reasons',
  }, { status: 403 });
}
