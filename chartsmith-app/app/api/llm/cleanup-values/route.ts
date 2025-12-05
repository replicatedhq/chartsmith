import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { getModel } from '@/lib/llm/registry';
import { checkApiAuth } from '@/lib/auth/api-guard';
import { logger } from '@/lib/utils/logger';
import { handleApiError } from '@/lib/utils/api-error';

export async function POST(req: NextRequest) {
  try {
    const { valuesYAML, modelId } = await req.json();
    
    const auth = await checkApiAuth(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }
    
    if (!valuesYAML || valuesYAML.trim() === '') {
      logger.info('Empty valuesYAML provided, returning empty result');
      return Response.json({ cleanedYAML: '' });
    }
    
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
    
    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the converted values.yaml file:\n---\n${valuesYAML}\n---` },
      ],
      abortSignal: AbortSignal.timeout(60000),
    });
    
    return Response.json({ cleanedYAML: text });
  } catch (error) {
    return handleApiError(error, 'cleanup values API');
  }
}