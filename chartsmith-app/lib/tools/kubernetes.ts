/**
 * Kubernetes Version Helpers
 *
 * Fetches the current stable Kubernetes version information.
 * Used by latestKubernetesVersionTool.
 */

interface K8sVersionInfo {
  major: string;
  minor: string;
  patch: string;
  full: string;
}

const REQUEST_TIMEOUT = 5000; // 5 seconds

// Cache for K8s version (expires after 1 hour)
let cachedVersion: K8sVersionInfo | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the latest stable Kubernetes version from the official K8s release API
 *
 * @returns K8s version info with major, minor, patch components
 */
export async function fetchLatestK8sVersion(): Promise<K8sVersionInfo> {
  // Check cache first
  if (cachedVersion && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedVersion;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Official Kubernetes release API endpoint
      const response = await fetch('https://dl.k8s.io/release/stable.txt', {
        method: 'GET',
        headers: {
          'User-Agent': 'Chartsmith/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn('[Kubernetes] Failed to fetch from dl.k8s.io');
        return getFallbackK8sVersion();
      }

      const versionString = await response.text();
      const version = parseK8sVersion(versionString.trim());

      if (version) {
        // Cache the result
        cachedVersion = version;
        cacheTimestamp = Date.now();

        return version;
      }

      return getFallbackK8sVersion();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Kubernetes] Version fetch timeout');
    } else {
      console.warn('[Kubernetes] Error fetching version:', error);
    }
    return getFallbackK8sVersion();
  }
}

/**
 * Parse Kubernetes version string (e.g., "v1.32.1") into components
 *
 * @param versionString - Version string like "v1.32.1"
 * @returns Parsed version info or null if parsing fails
 */
function parseK8sVersion(versionString: string): K8sVersionInfo | null {
  try {
    // Remove leading 'v' if present
    const normalized = versionString.replace(/^v/, '');

    // Split by dots to get components
    const parts = normalized.split('.');

    if (parts.length < 2) {
      return null;
    }

    const major = parts[0];
    const minor = parts[1];
    const patch = parts[2] || '0';

    return {
      major,
      minor: `${major}.${minor}`,
      patch: `${major}.${minor}.${patch}`,
      full: normalized,
    };
  } catch (error) {
    console.error('[Kubernetes] Parse error:', error);
    return null;
  }
}

/**
 * Get fallback/hardcoded Kubernetes version
 * Used when API fetch fails or is unavailable
 *
 * Matches current Go implementation: K8s 1.32.1 (February 2025)
 */
function getFallbackK8sVersion(): K8sVersionInfo {
  const version: K8sVersionInfo = {
    major: '1',
    minor: '1.32',
    patch: '1.32.1',
    full: '1.32.1',
  };

  return version;
}

/**
 * Get specific version component
 *
 * @param field - Which version component to return: 'major', 'minor', or 'patch'
 * @returns Version string for the requested component
 */
export async function getK8sVersionComponent(
  field: 'major' | 'minor' | 'patch'
): Promise<string> {
  const version = await fetchLatestK8sVersion();

  switch (field) {
    case 'major':
      return version.major;
    case 'minor':
      return version.minor;
    case 'patch':
      return version.patch;
    default:
      return version.full;
  }
}
