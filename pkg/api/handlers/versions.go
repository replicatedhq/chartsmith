// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/recommendations"
	"go.uber.org/zap"
)

// SubchartVersionRequest represents a request to get the latest subchart version
type SubchartVersionRequest struct {
	ChartName  string `json:"chartName"`
	Repository string `json:"repository,omitempty"`
}

// SubchartVersionResponse represents the response for subchart version lookup
type SubchartVersionResponse struct {
	Success bool   `json:"success"`
	Version string `json:"version"`
	Name    string `json:"name"`
}

// GetSubchartVersion handles requests to look up the latest version of a Helm subchart
// POST /api/tools/versions/subchart
func GetSubchartVersion(w http.ResponseWriter, r *http.Request) {
	var req SubchartVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Debug("Failed to decode subchart version request", zap.Error(err))
		writeBadRequest(w, "Invalid request body")
		return
	}
	
	// Validate required fields
	if req.ChartName == "" {
		writeBadRequest(w, "chartName is required")
		return
	}
	
	logger.Debug("Looking up subchart version", zap.String("chartName", req.ChartName))
	
	// Use existing recommendations package to get the version
	version, err := recommendations.GetLatestSubchartVersion(req.ChartName)
	if err != nil {
		// Return "?" for unknown charts (matches existing behavior)
		logger.Debug("Failed to get subchart version", 
			zap.String("chartName", req.ChartName),
			zap.Error(err))
		
		writeJSON(w, http.StatusOK, SubchartVersionResponse{
			Success: true,
			Version: "?",
			Name:    req.ChartName,
		})
		return
	}
	
	writeJSON(w, http.StatusOK, SubchartVersionResponse{
		Success: true,
		Version: version,
		Name:    req.ChartName,
	})
}

// KubernetesVersionRequest represents a request to get Kubernetes version info
type KubernetesVersionRequest struct {
	SemverField string `json:"semverField,omitempty"` // major, minor, patch
}

// KubernetesVersionResponse represents the response for Kubernetes version lookup
type KubernetesVersionResponse struct {
	Success bool   `json:"success"`
	Version string `json:"version"`
	Field   string `json:"field"`
}

// Hardcoded Kubernetes version values (intentional for stability)
const (
	k8sVersionMajor = "1"
	k8sVersionMinor = "1.32"
	k8sVersionPatch = "1.32.1"
)

// GetKubernetesVersion handles requests to get Kubernetes version information
// POST /api/tools/versions/kubernetes
func GetKubernetesVersion(w http.ResponseWriter, r *http.Request) {
	var req KubernetesVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Empty body is OK, we'll default to patch
		req.SemverField = "patch"
	}
	
	// Default to patch if not specified
	if req.SemverField == "" {
		req.SemverField = "patch"
	}
	
	var version string
	switch req.SemverField {
	case "major":
		version = k8sVersionMajor
	case "minor":
		version = k8sVersionMinor
	case "patch":
		version = k8sVersionPatch
	default:
		// Default to patch for unknown fields
		version = k8sVersionPatch
		req.SemverField = "patch"
	}
	
	logger.Debug("Returning Kubernetes version", 
		zap.String("field", req.SemverField),
		zap.String("version", version))
	
	writeJSON(w, http.StatusOK, KubernetesVersionResponse{
		Success: true,
		Version: version,
		Field:   req.SemverField,
	})
}

