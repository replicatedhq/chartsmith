import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`Error in ${context}`, { 
    error: message,
    stack,
  });
  
  return NextResponse.json(
    { 
      error: 'Internal Server Error',
      message,
    },
    { 
      status: 500,
    }
  );
}

