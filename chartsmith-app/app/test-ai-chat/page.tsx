/**
 * AI Chat Test Page
 * 
 * A simple test page to manually verify the AI SDK chat implementation.
 * Navigate to /test-ai-chat to test the chat component.
 * 
 * Requirements:
 * - OPENROUTER_API_KEY must be set in environment
 * - Run: npm run dev
 * - Navigate to: http://localhost:3000/test-ai-chat
 */

import { AIChat } from "@/components/chat";

export default function TestAIChatPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-white">
            AI Chat Test Page
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            PR1 Manual Testing - Vercel AI SDK Integration
          </p>
        </div>
      </header>

      {/* Test Instructions */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
          <h2 className="text-sm font-medium text-gray-300 mb-2">
            Test Checklist:
          </h2>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>✓ Provider selector shows Claude Sonnet 4 as default</li>
            <li>✓ Can switch provider before sending message</li>
            <li>✓ Provider locks after first message</li>
            <li>✓ Messages stream in real-time</li>
            <li>✓ Stop button works during streaming</li>
            <li>✓ Regenerate button works after response</li>
            <li>✓ Error states display correctly</li>
            <li>✓ No console errors in browser devtools</li>
          </ul>
        </div>
      </div>

      {/* Chat Component */}
      <div className="max-w-4xl mx-auto px-6 pb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden h-[600px]">
          <AIChat 
            onConversationStart={() => {
              console.log('[Test] Conversation started - provider should now be locked');
            }}
          />
        </div>
      </div>

      {/* Debug Info */}
      <div className="max-w-4xl mx-auto px-6 pb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-medium text-gray-300 mb-2">
            Environment Check:
          </h2>
          <div className="text-xs font-mono text-gray-400">
            <p>API Route: /api/chat</p>
            <p>Default Provider: anthropic</p>
            <p>Default Model: anthropic/claude-sonnet-4</p>
            <p className="mt-2 text-yellow-500">
              Note: OPENROUTER_API_KEY must be set in .env.local
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

