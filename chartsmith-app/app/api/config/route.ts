import { NextRequest, NextResponse } from 'next/server';
import { getPublicEnv } from '@/lib/utils/env';

export async function GET(req: NextRequest) {
  const runtimeConfig = getPublicEnv();
  return NextResponse.json(runtimeConfig);
}