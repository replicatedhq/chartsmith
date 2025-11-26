import { getDB } from "@/lib/data/db";
import { logger } from "@/lib/utils/logger";
import { getParam } from "../data/param";

const ARTIFACTHUB_API = 'https://artifacthub.io/api/v1';

interface ArtifactHubSearchResponse {
  packages?: Array<{
    package_id: string;
    name: string;
    normalized_name: string;
    version: string;
    repository: {
      name: string;
      url: string;
    };
    description?: string;
  }>;
}

export interface ArtifactHubChart {
  name: string;
  version: string;
  repository: string;
  content_url: string;
}

export async function searchArtifactHubCharts(query: string): Promise<string[]> {
  try {
    // Handle URL or org/name pattern directly
    if (query.includes("artifacthub.io/packages/helm/")) {
      return [query];
    }

    if (query.includes("/")) {
      const [org, name] = query.split("/");
      if (org.indexOf(".") === -1 && name.indexOf(".") === -1) {
        // If the input is org/name, assume it's a package and put the URL prefix on
        return [`https://artifacthub.io/packages/helm/${query}`];
      }
    }

    // If search query is too short, return empty results
    if (!query || query.trim().length < 2) {
      return [];
    }

    // First, try the local cache
    try {
      const db = getDB(await getParam("DB_URI"));

      // Search our local cache for matching chart names
      const searchResults = await db.query(
        `SELECT name, version, repository, content_url
         FROM artifacthub_chart
         WHERE name ILIKE $1
         ORDER BY name ASC, version DESC
         LIMIT 20`,
        [`%${query}%`]
      );

      if (searchResults.rows.length > 0) {
        // Group results by chart name and only take the latest version of each
        const chartMap = new Map();

        for (const row of searchResults.rows) {
          if (!chartMap.has(row.name) ||
              compareVersions(row.version, chartMap.get(row.name).version) > 0) {
            chartMap.set(row.name, row);
          }
        }

        // Convert to array and format for frontend
        const results = Array.from(chartMap.values()).map(chart => {
          return `https://artifacthub.io/packages/helm/${chart.repository}/${chart.name}`;
        });

        logger.debug(`Found ${results.length} charts matching "${query}" from local cache`);
        return results;
      }
    } catch (dbError) {
      logger.warn('Local cache search failed, falling back to live API', { error: dbError });
    }

    // Fallback: Query the live ArtifactHub API directly
    logger.debug(`Searching ArtifactHub API for "${query}"`);
    const results = await searchArtifactHubLive(query);
    return results;
  } catch (error) {
    logger.error('Error in searchArtifactHubCharts', { error });
    return [];
  }
}

/**
 * Search ArtifactHub live API directly
 */
async function searchArtifactHubLive(query: string): Promise<string[]> {
  try {
    const url = new URL(`${ARTIFACTHUB_API}/packages/search`);
    url.searchParams.append('kind', '0'); // Helm charts only
    url.searchParams.append('ts_query_web', query.trim());
    url.searchParams.append('limit', '20');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Chartsmith/1.0',
      },
      // 5 second timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn(`ArtifactHub API returned ${response.status} for query "${query}"`);
      return [];
    }

    const data: ArtifactHubSearchResponse = await response.json();

    if (!data.packages || data.packages.length === 0) {
      logger.debug(`No packages found for "${query}"`);
      return [];
    }

    // Group by chart name to deduplicate (take first/latest of each)
    const seenNames = new Set<string>();
    const results: string[] = [];

    for (const pkg of data.packages) {
      if (!seenNames.has(pkg.name)) {
        seenNames.add(pkg.name);
        results.push(`https://artifacthub.io/packages/helm/${pkg.repository.name}/${pkg.name}`);
      }
    }

    logger.debug(`Found ${results.length} charts matching "${query}" from live API`);
    return results;
  } catch (error) {
    logger.error('Error searching ArtifactHub live API', { error, query });
    return [];
  }
}

export async function getArtifactHubChart(org: string, name: string): Promise<ArtifactHubChart | null> {
  try {
    const db = getDB(await getParam("DB_URI"));
    
    const result = await db.query(
      `SELECT name, version, repository, content_url
       FROM artifacthub_chart
       WHERE repository = $1 AND name = $2
       ORDER BY version DESC
       LIMIT 1`,
      [org, name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as ArtifactHubChart;
  } catch (error) {
    logger.error('Error getting ArtifactHub chart', { error, org, name });
    return null;
  }
}

// Simple semver comparison (not full spec compliant)
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  const bParts = b.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) {
      return aVal > bVal ? 1 : -1;
    }
  }

  return 0;
}
