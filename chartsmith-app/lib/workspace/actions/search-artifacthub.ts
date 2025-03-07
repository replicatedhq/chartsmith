"use server"

import { logger } from '@/lib/utils/logger';
import { searchArtifactHubCharts } from '@/lib/artifacthub/artifacthub';

export async function searchArtifactHubAction(query: string): Promise<string[]> {
  try {
    return await searchArtifactHubCharts(query);
  } catch (error) {
    logger.error('Error in searchArtifactHubAction', { error });
    return [];
  }
}
