# Migrate Chartsmith to Vercel AI SDK	

## Problem Statement

Chartsmith is an open source AI-powered tool that helps developers build better Helm charts for Kubernetes. The project currently uses a custom implementation for both the chat UI and LLM integration, utilizing the `@anthropic-ai/sdk` directly in both the frontend (TypeScript/Next.js) and backend (Go).

The custom implementation requires maintaining:

- Custom chat UI components with manual message handling and streaming  
- Direct Anthropic SDK integration in multiple places  
- Custom state management for chat interactions  
- Manual streaming protocol implementation

Vercel's AI SDK provides a standardized, well-maintained toolkit that abstracts away these implementation details and offers:

- Pre-built UI hooks for handling conversations  
- Unified API for multiple LLM providers (not just Anthropic)  
- Optimized streaming and state management  
- Framework-native patterns for React/Next.js applications

## What specific problem needs solving?

Replace the custom chat UI and LLM implementation with Vercel AI SDK to:

1. **Simplify the frontend**: Replace custom chat components with Vercel AI SDK UI hooks  
2. **Modernize the backend**: Replace direct Anthropic SDK calls with AI SDK Core's unified API

The migration should maintain all existing functionality while simplifying the codebase.

## Business Context & Impact (Why does this matter?)

- **Reduced maintenance burden**: Using a standard toolkit means less custom code to maintain  
- **Better developer experience**: Vercel AI SDK provides better patterns for chat interfaces  
- **Future-proofing**: Easy to add support for multiple LLM providers  
- **Community support**: Leverage Vercel's documentation and community rather than custom solutions  
- **Performance improvements**: Vercel AI SDK has optimizations for streaming and state management

This is a refactoring project that will make the codebase more maintainable and aligned with modern AI application patterns.

## Technical Requirements

- **Frontend**: TypeScript, Next.js, React  
- **Backend**: The existing Go backend will remain, but may need API adjustments  
- **AI SDK**: Vercel AI SDK (both UI and Core libraries)  
- **LLM Provider**: Any

## Project Context & Environment

### Implementation Details:

This is a refactoring and modernization project. The key areas to migrate are the **Frontend Chat UI** and the **Backend LLM Integration**.

### Access & Resources:

- Open source project: [https://github.com/replicatedhq/chartsmith](https://github.com/replicatedhq/chartsmith)  
- Vercel AI SDK documentation: [https://ai-sdk.dev/docs](https://ai-sdk.dev/docs)  
- Architecture documentation in the repo (`ARCHITECTURE.md`, `chartsmith-app/ARCHITECTURE.md`)  
- Contributing guide with setup instructions: `CONTRIBUTING.md`

## Success Criteria

**Must Have:**

1. Replace custom chat UI with Vercel AI SDK  
2. Migrate from direct `@anthropic-ai/sdk` usage to AI SDK Core  
3. Maintain all existing chat functionality (streaming, messages, history)  
4. Keep the existing system prompts and behavior (user roles, chart context, etc.)  
5. All existing features continue to work (tool calling, file context, etc.)  
6. Tests pass (or are updated to reflect new implementation)

**Nice to Have:**

1. Demonstrate easy provider switching (show how to swap Anthropic for OpenAI)  
2. Improve the streaming experience using AI SDK optimizations  
3. Simplify state management by leveraging AI SDK's built-in patterns

## Additional Considerations

- **Design flexibility**: This is a refactoring project with clear before/after states, but the specific approach is up to the candidate  
- **Architecture decisions**: Candidates should document any significant architectural choices (e.g., keeping Go backend vs moving to Next.js API routes entirely)  
- **Hiring partner availability**: The hiring partner is available to discuss approach, review trade-offs, and answer questions about the existing architecture

## Submission Requirements

1. **Pull Request** into the `replicatedhq/chartsmith` repo  
2. **Documentation**:  
   - Update `ARCHITECTURE.md` or `chartsmith-app/ARCHITECTURE.md` to reflect the new AI SDK integration  
3. **Tests**:  
   - Ensure existing tests pass or update them for the new implementation  
   - Add any new tests if the AI SDK requires different testing patterns  
4. **Demo Video** (quick Loom or similar):  
   - Show the application starting successfully  
   - Demonstrate creating a new chart via chat  
   - Show streaming responses working  
   - Highlight any improvements in the implementation  
   - Walk through 1-2 key code changes in the migration

