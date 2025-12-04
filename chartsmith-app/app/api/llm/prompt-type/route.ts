import { NextRequest, NextResponse } from 'next/server';
import { promptType } from '@/lib/llm/prompt-type';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    const type = await promptType(message);
    
    return NextResponse.json({ type });
  } catch (error) {
    console.error('Error determining prompt type:', error);
    return NextResponse.json(
      { error: 'Failed to determine prompt type' },
      { status: 500 }
    );
  }
}

