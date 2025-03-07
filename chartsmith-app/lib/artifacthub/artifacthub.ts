import { getDB } from "@/lib/data/db";
import { logger } from "@/lib/utils/logger";
import { getParam } from "../data/param";

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
    const results = Array.from(chartMap.values()).map(chart => {
      return `https://artifacthub.io/packages/helm/${chart.repository}/${chart.name}`;
    });

    logger.debug(`Found ${results.length} charts matching "${query}"`);
    return results;
  } catch (error) {
    logger.error('Error in searchArtifactHubCharts', { error });
    return [];
  }
}

export async function getArtifactHubChart(org: string, name: string): Promise<ArtifactHubChart | null> {
  try {
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
