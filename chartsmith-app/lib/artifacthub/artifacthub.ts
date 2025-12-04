import { getDB } from "@/lib/data/db";
import { logger } from "@/lib/utils/logger";
import { getParam } from "../data/param";

export interface ArtifactHubChart {
  name: string;
  version: string;
  repository: string;
  content_url: string;
}

// Search Artifact Hub API directly
async function searchArtifactHubAPI(query: string): Promise<string[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://artifacthub.io/api/v1/packages/search?offset=0&limit=20&facets=false&ts_query_web=${encodedQuery}&kind=0&deprecated=false&sort=relevance`,
      {
        headers: {
          'User-Agent': 'chartsmith/1.0',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      logger.error('Artifact Hub API search failed', { status: response.status });
      return [];
    }

    const data = await response.json();
    
    if (!data.packages || data.packages.length === 0) {
      return [];
    }

    // Convert API results to URLs
    return data.packages.map((pkg: { repository: { name: string }; name: string }) => 
      `https://artifacthub.io/packages/helm/${pkg.repository.name}/${pkg.name}`
    );
  } catch (error) {
    logger.error('Error searching Artifact Hub API', { error });
    return [];
  }
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

    // First try local cache
    let results: string[] = [];
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

      // Group results by chart name and only take the latest version of each
      const chartMap = new Map();

      for (const row of searchResults.rows) {
        if (!chartMap.has(row.name) ||
            compareVersions(row.version, chartMap.get(row.name).version) > 0) {
          chartMap.set(row.name, row);
        }
      }

      // Convert to array and format for frontend
      results = Array.from(chartMap.values()).map(chart => {
        return `https://artifacthub.io/packages/helm/${chart.repository}/${chart.name}`;
      });

      logger.debug(`Found ${results.length} charts in local cache matching "${query}"`);
    } catch (cacheError) {
      logger.warn('Local cache search failed, will fall back to API', { error: cacheError });
    }

    // If no results from local cache, fall back to Artifact Hub API
    if (results.length === 0) {
      logger.debug(`No local cache results for "${query}", searching Artifact Hub API`);
      results = await searchArtifactHubAPI(query);
      logger.debug(`Found ${results.length} charts from Artifact Hub API matching "${query}"`);
    }

    return results;
  } catch (error) {
    logger.error('Error in searchArtifactHubCharts', { error });
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
