package embedding

import (
	"math"
	"strconv"
	"strings"
	"testing"
)

func TestVectorizeProducesNormalizedPgvector(t *testing.T) {
	vector := vectorize("apiVersion: apps/v1 kind: Deployment metadata name: chartsmith")
	values := parseVector(t, vector)
	if len(values) != embeddingDimensions {
		t.Fatalf("expected %d dimensions, got %d", embeddingDimensions, len(values))
	}

	var magnitude float64
	for _, value := range values {
		magnitude += value * value
	}
	if diff := math.Abs(math.Sqrt(magnitude) - 1); diff > 0.0001 {
		t.Fatalf("expected normalized vector, magnitude differs by %f", diff)
	}
}

func TestVectorizeIsDeterministicAndContentSensitive(t *testing.T) {
	first := vectorize("kind: Service")
	if first != vectorize("kind: Service") {
		t.Fatal("expected identical content to produce identical vectors")
	}
	if first == vectorize("kind: Deployment") {
		t.Fatal("expected different content to produce different vectors")
	}
}

func parseVector(t *testing.T, value string) []float64 {
	t.Helper()
	parts := strings.Split(strings.Trim(value, "[]"), ",")
	result := make([]float64, len(parts))
	for i, part := range parts {
		parsed, err := strconv.ParseFloat(part, 64)
		if err != nil {
			t.Fatalf("parse vector value %q: %v", part, err)
		}
		result[i] = parsed
	}
	return result
}
