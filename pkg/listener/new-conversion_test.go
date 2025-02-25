package listener

import (
	"testing"

	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/stretchr/testify/assert"
)

func TestSortByConversionOrder(t *testing.T) {
	tests := []struct {
		name     string
		files    []types.ConversionFile
		expected []types.ConversionFile
	}{
		{
			name: "mixed resources sorted correctly",
			files: []types.ConversionFile{
				{
					FileContent: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment`,
				},
				{
					FileContent: `apiVersion: v1
kind: ConfigMap
metadata:
  name: a-config`,
				},
			},
			expected: []types.ConversionFile{
				{
					FileContent: `apiVersion: v1
kind: ConfigMap
metadata:
  name: a-config`,
				},
				{
					FileContent: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment`,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sortByConversionOrder(tt.files)
			assert.Equal(t, len(tt.expected), len(result), "result and expected should have same length")

			for i := range result {
				assert.Equal(t, tt.expected[i].FileContent, result[i].FileContent,
					"file at index %d should match expected", i)
			}
		})
	}
}

func TestExtractGVKAndName(t *testing.T) {
	tests := []struct {
		name         string
		content      string
		expectedGVK  string
		expectedName string
	}{
		{
			name: "valid configmap",
			content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config`,
			expectedGVK:  "v1/ConfigMap",
			expectedName: "my-config",
		},
		{
			name: "valid secret",
			content: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret`,
			expectedGVK:  "v1/Secret",
			expectedName: "my-secret",
		},
		{
			name: "deployment with apps/v1",
			content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment`,
			expectedGVK:  "apps/v1/Deployment",
			expectedName: "my-deployment",
		},
		{
			name:         "invalid yaml",
			content:      `this is not valid yaml`,
			expectedGVK:  "",
			expectedName: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gvk, name := extractGVKAndName(tt.content)
			assert.Equal(t, tt.expectedGVK, gvk, "GVK should match expected")
			assert.Equal(t, tt.expectedName, name, "Name should match expected")
		})
	}
}

func TestGetGVKPriority(t *testing.T) {
	tests := []struct {
		name     string
		gvk      string
		expected int
	}{
		{
			name:     "configmap has priority 0",
			gvk:      "v1/ConfigMap",
			expected: 0,
		},
		{
			name:     "secret has priority 1",
			gvk:      "v1/Secret",
			expected: 1,
		},
		{
			name:     "service has priority 2",
			gvk:      "v1/Service",
			expected: 2,
		},
		{
			name:     "deployment has priority 2",
			gvk:      "apps/v1/Deployment",
			expected: 2,
		},
		{
			name:     "empty string has priority 2",
			gvk:      "",
			expected: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			priority := getGVKPriority(tt.gvk)
			assert.Equal(t, tt.expected, priority, "priority should match expected")
		})
	}
}
