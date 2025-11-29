import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/llm/cleanup-values
 * 
 * Cleans up converted values.yaml files
 * This replaces pkg/llm/cleanup-converted-values.go
 * 
 * Request body:
 * - valuesYAML: string - The values.yaml content to clean up
 * - modelId?: string - Optional model override
 * 
 * Returns: JSON with cleaned values.yaml
 */
export async function POST(req: NextRequest) {
  try {
    const { valuesYAML, modelId } = await req.json();
    
    // Auth check
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!valuesYAML) {
      return new Response('valuesYAML required', { status: 400 });
    }
    
    // Get model instance
    const model = getModel(modelId);
    
    const systemPrompt = `<cleanup_instructions>
  - Given a values.yaml for a new Helm chart, it has errors.
  - Find and clean up the errors.
  - Merge duplicate keys and values.
  - Make sure this is valid YAML.
  - Remove any stray and leftover patch markers.
  - Remove any comments that show it was added or merged.
  - Leave comments that explain the values only.
</cleanup_instructions>

Return the cleaned values.yaml wrapped in a <chartsmithArtifact> tag with path="values.yaml".`;
    
    logger.info('Cleaning up values.yaml via Vercel AI SDK', {
      modelId: modelId || 'default',
      contentLength: valuesYAML.length,
    });
    
    // Use generateText for non-streaming completion
    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the converted values.yaml file:\n---\n${valuesYAML}\n---` },
      ],
    });
    
    return Response.json({ cleanedYAML: text });
  } catch (error) {
    logger.error('Error in cleanup values API', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error)
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}