import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  
  // Pass the error object to the logger so it can extract message/stack properly
  // If not an Error instance, pass context with the stringified error
  if (error instanceof Error) {
    logger.error(`Error in ${context}`, error);
  } else {
    logger.error(`Error in ${context}`, undefined, { error: String(error) });
  }
  
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

