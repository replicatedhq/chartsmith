package recommendations

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// subchartVersion is a map of subchart names to their latest version
// if an item is here, it will override the search in artifact hub
// so this is our place to prevent the latest version or pin a version if we want
var subchartVersion = map[string]string{
	"subchart-name": "0.0.0",
}

func GetLatestSubchartVersion(chartName string) (string, error) {
	if version, ok := subchartVersion[chartName]; ok {
		return version, nil
	}

	if strings.Contains(strings.ToLower(chartName), "replicated") {
		return getReplicatedSubchartVersion()
	}

	bestArtifactHubChart, err := searchArtifactHubForChart(chartName)
	if err != nil {
		return "", fmt.Errorf("failed to search artifact hub: %w", err)
	}

	if bestArtifactHubChart == nil {
		return "", ErrNoArtifactHubPackage
	}

	return bestArtifactHubChart.Version, nil
}

type ArtifactHubPackage struct {
	Name       string `json:"name"`
	Version    string `json:"version"`
	AppVersion string `json:"app_version"`
}

var ErrNoArtifactHubPackage = errors.New("no artifact hub package found")

func searchArtifactHubForChart(chartName string) (*ArtifactHubPackage, error) {
	// make an API request to artifact hub
	encodedChartName := url.QueryEscape(chartName)
	req, err := http.NewRequest("GET", fmt.Sprintf("https://artifacthub.io/api/v1/packages/search?offset=0&limit=20&facets=false&ts_query_web=%s&kind=0&deprecated=false&sort=relevance", encodedChartName), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "chartsmith/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var artifactHubResponse struct {
		Packages []ArtifactHubPackage `json:"packages"`
	}

	if err := json.Unmarshal(body, &artifactHubResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response body: %w", err)
	}

	if len(artifactHubResponse.Packages) == 0 {
		return nil, ErrNoArtifactHubPackage
	}

	return &artifactHubResponse.Packages[0], nil
}

var (
	replicatedSubchartVersion          = "0.0.0"
	replicatedSubchartVersionNextFetch = time.Now()
)

func getReplicatedSubchartVersion() (string, error) {
	if replicatedSubchartVersionNextFetch.After(time.Now()) {
		return replicatedSubchartVersion, nil
	}

	// get the version from github api
	req, err := http.NewRequest("GET", "https://api.github.com/repos/replicatedhq/replicated-sdk/releases/latest", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "chartsmith/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	var release struct {
		TagName string `json:"tag_name"`
	}

	if err := json.Unmarshal(body, &release); err != nil {
		return "", fmt.Errorf("failed to unmarshal response body: %w", err)
	}

	replicatedSubchartVersion = release.TagName
	replicatedSubchartVersionNextFetch = time.Now().Add(time.Minute * 45)

	return replicatedSubchartVersion, nil
}
