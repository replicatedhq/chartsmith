/**
 * ArtifactHub API Client
 *
 * Queries ArtifactHub (https://artifacthub.io) for Helm chart information.
 * Used by latestSubchartVersionTool to find latest versions of Helm charts.
 */

interface ArtifactHubPackage {
  name: string;
  version: string;
  repository: string;
  description?: string;
  stars?: number;
}

interface ArtifactHubSearchResponse {
  packages?: Array<{
    name: string;
    version: string;
    repository?: {
      name?: string;
      url?: string;
    };
    description?: string;
    stars?: number;
  }>;
  error?: string;
}

const ARTIFACTHUB_API = 'https://artifacthub.io/api/v1';
const REQUEST_TIMEOUT = 5000; // 5 seconds

/**
 * Fetch the latest version of a Helm chart from ArtifactHub
 *
 * @param chartName - Name of the chart to search for (e.g., "redis", "postgresql")
 * @returns Version string (e.g., "7.8.1") or "?" if not found
 */
export async function fetchLatestSubchartVersion(
  chartName: string
): Promise<string> {
  try {
    // Validate input
    if (!chartName || chartName.trim().length === 0) {
      return '?';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Query ArtifactHub API for Helm charts (kind=0 = Helm)
      const url = new URL(`${ARTIFACTHUB_API}/packages/search`);
      url.searchParams.append('kind', '0'); // Helm chart type
      url.searchParams.append('name', chartName.trim());

      console.log(`[ArtifactHub] Searching for: ${chartName}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Chartsmith/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(
          `[ArtifactHub] API returned ${response.status} for ${chartName}`
        );
        return '?';
      }

      const data: ArtifactHubSearchResponse = await response.json();

      // Find exact match (case-insensitive)
      const exactMatch = data.packages?.find((pkg) =>
        pkg.name.toLowerCase() === chartName.toLowerCase()
      );

      if (exactMatch && exactMatch.version) {
        console.log(
          `[ArtifactHub] Found ${chartName} version ${exactMatch.version}`
        );
        return exactMatch.version;
      }

      // If no exact match, try partial match (first result)
      if (data.packages && data.packages.length > 0) {
        const firstMatch = data.packages[0];
        if (firstMatch.version) {
          console.warn(
            `[ArtifactHub] Exact match not found for ${chartName}, using first result: ${firstMatch.name}@${firstMatch.version}`
          );
          return firstMatch.version;
        }
      }

      console.warn(`[ArtifactHub] No packages found for ${chartName}`);
      return '?';
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[ArtifactHub] Request timeout for ${chartName}`);
      return '?';
    }

    console.error(`[ArtifactHub] Error fetching ${chartName}:`, error);
    return '?';
  }
}

/**
 * Fetch recommended Helm charts based on a requirement
 *
 * @param query - User requirement (e.g., "Redis cache", "PostgreSQL")
 * @returns Array of matching charts with versions
 */
export async function searchArtifactHub(
  query: string
): Promise<ArtifactHubPackage[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const url = new URL(`${ARTIFACTHUB_API}/packages/search`);
      url.searchParams.append('kind', '0'); // Helm charts
      url.searchParams.append('ts_query_web', query.trim());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Chartsmith/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data: ArtifactHubSearchResponse = await response.json();

      if (!data.packages || data.packages.length === 0) {
        return [];
      }

      // Convert to our interface
      return data.packages
        .slice(0, 10) // Limit to top 10 results
        .map((pkg) => ({
          name: pkg.name,
          version: pkg.version,
          repository: pkg.repository?.name || 'Unknown',
          description: pkg.description,
          stars: pkg.stars,
        }));
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`[ArtifactHub] Search error for "${query}":`, error);
    return [];
  }
}
