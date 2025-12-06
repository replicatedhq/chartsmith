import { logger } from "@/lib/utils/logger";

export async function getLatestSubchartVersion(chartName: string): Promise<string> {
    // Hardcoded overrides matching Go implementation
    const subchartVersion: Record<string, string> = {
        "subchart-name": "0.0.0",
    };

    if (subchartVersion[chartName]) {
        return subchartVersion[chartName];
    }

    if (chartName.toLowerCase().includes("replicated")) {
        return getReplicatedSubchartVersion();
    }

    try {
        const response = await fetch(
            `https://artifacthub.io/api/v1/packages/search?offset=0&limit=20&facets=false&ts_query_web=${encodeURIComponent(chartName)}&kind=0&deprecated=false&sort=relevance`,
            {
                headers: {
                    "User-Agent": "chartsmith/1.0",
                    "Accept": "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Artifact Hub API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.packages && data.packages.length > 0) {
            return data.packages[0].version;
        }
    } catch (err) {
        logger.error("Failed to search artifact hub", { err });
    }

    return "?";
}

let replicatedSubchartVersion = "0.0.0";
let replicatedSubchartVersionNextFetch = new Date(0);

async function getReplicatedSubchartVersion(): Promise<string> {
    if (replicatedSubchartVersionNextFetch > new Date()) {
        return replicatedSubchartVersion;
    }

    try {
        const response = await fetch("https://api.github.com/repos/replicatedhq/replicated-sdk/releases/latest", {
            headers: {
                "User-Agent": "chartsmith/1.0",
                "Accept": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        replicatedSubchartVersion = data.tag_name;
        replicatedSubchartVersionNextFetch = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes

        return replicatedSubchartVersion;
    } catch (err) {
        logger.error("Failed to get replicated sdk version", { err });
        return replicatedSubchartVersion;
    }
}
