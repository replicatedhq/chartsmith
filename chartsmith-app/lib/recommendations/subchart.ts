// Subchart version lookup utilities
// Ported from pkg/recommendations/subchart.go

interface ArtifactHubPackage {
  name: string;
  version: string;
  app_version: string;
}

interface ArtifactHubResponse {
  packages: ArtifactHubPackage[];
}

// Override map for pinned versions
const subchartVersion: Record<string, string> = {
  'subchart-name': '0.0.0',
};

// Cache for Replicated subchart version
let replicatedSubchartVersion = '0.0.0';
let replicatedSubchartVersionNextFetch = new Date();

export async function getLatestSubchartVersion(chartName: string): Promise<string> {
  // Check override map first
  if (subchartVersion[chartName]) {
    return subchartVersion[chartName];
  }

  // Special handling for Replicated charts
  if (chartName.toLowerCase().includes('replicated')) {
    return getReplicatedSubchartVersion();
  }

  // Search Artifact Hub
  const bestChart = await searchArtifactHubForChart(chartName);
  if (!bestChart) {
    throw new Error('No artifact hub package found');
  }

  return bestChart.version;
}

async function searchArtifactHubForChart(chartName: string): Promise<ArtifactHubPackage | null> {
  const encodedChartName = encodeURIComponent(chartName);
  const url = `https://artifacthub.io/api/v1/packages/search?offset=0&limit=20&facets=false&ts_query_web=${encodedChartName}&kind=0&deprecated=false&sort=relevance`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'chartsmith/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search Artifact Hub: ${response.statusText}`);
  }

  const data: ArtifactHubResponse = await response.json();

  if (data.packages.length === 0) {
    return null;
  }

  return data.packages[0];
}

async function getReplicatedSubchartVersion(): Promise<string> {
  // Return cached version if still valid
  if (replicatedSubchartVersionNextFetch > new Date()) {
    return replicatedSubchartVersion;
  }

  // Fetch latest release from GitHub
  const response = await fetch('https://api.github.com/repos/replicatedhq/replicated-sdk/releases/latest', {
    headers: {
      'User-Agent': 'chartsmith/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Replicated version: ${response.statusText}`);
  }

  const release = await response.json();
  replicatedSubchartVersion = release.tag_name;

  // Cache for 45 minutes
  replicatedSubchartVersionNextFetch = new Date(Date.now() + 45 * 60 * 1000);

  return replicatedSubchartVersion;
}
