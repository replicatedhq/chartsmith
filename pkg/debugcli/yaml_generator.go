package debugcli

import (
	"fmt"
	"math/rand"
	"strings"
	"time"
)

// YAMLComplexity represents the complexity level of generated YAML
type YAMLComplexity string

const (
	ComplexityLow    YAMLComplexity = "low"
	ComplexityMedium YAMLComplexity = "medium"
	ComplexityHigh   YAMLComplexity = "high"
)

// Random value generators
var (
	randomNames = []string{
		"nginx", "frontend", "backend", "database", "redis", "kafka", 
		"prometheus", "grafana", "elasticsearch", "kibana", "mongodb",
		"postgres", "mysql", "api", "auth", "payments", "search", "logging",
		"monitoring", "analytics", "cache", "queue", "worker", "scheduler",
	}

	randomImages = []string{
		"nginx:latest", "redis:6", "postgres:13", "mongo:4", 
		"busybox:1.35", "ubuntu:20.04", "alpine:3.15", "node:16",
		"python:3.9", "golang:1.17", "httpd:2.4", "rabbitmq:3",
	}

	randomPorts = []int{
		80, 443, 8080, 8443, 3000, 3306, 5432, 6379, 
		27017, 9090, 9200, 8000, 8888, 4000, 4040,
	}

	randomEnvVars = []string{
		"DEBUG", "LOG_LEVEL", "NODE_ENV", "ENVIRONMENT", 
		"API_KEY", "SECRET_KEY", "DATABASE_URL", "REDIS_URL",
		"PORT", "HOST", "TIMEOUT", "MAX_CONNECTIONS", "WORKERS",
	}

	randomAnnotations = []string{
		"prometheus.io/scrape", "prometheus.io/port", "fluentd.io/collect",
		"linkerd.io/inject", "sidecar.istio.io/inject", "cluster-autoscaler.kubernetes.io/safe-to-evict",
		"kubernetes.io/ingress-bandwidth", "kubernetes.io/egress-bandwidth",
	}

	randomBooleanValues = []string{"true", "false"}
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// Helper function to get random item from a slice
func getRandomItem[T any](items []T) T {
	return items[rand.Intn(len(items))]
}

// Helper function to get random number within range
func getRandomNumber(min, max int) int {
	return rand.Intn(max-min+1) + min
}

// GenerateRandomYAML generates random YAML content with the specified complexity
func GenerateRandomYAML(complexity YAMLComplexity) string {
	var builder strings.Builder

	// Set complexity level for the generated YAML
	// (The number of fields is controlled by the complexity-specific functions)

	// Add top level comment
	builder.WriteString("# Generated values.yaml for testing\n")
	builder.WriteString(fmt.Sprintf("# Complexity: %s\n\n", complexity))

	// Generate some common fields first
	builder.WriteString(fmt.Sprintf("replicaCount: %d\n\n", getRandomNumber(1, 5)))

	// Image settings
	builder.WriteString("image:\n")
	builder.WriteString(fmt.Sprintf("  repository: %s\n", strings.Split(getRandomItem(randomImages), ":")[0]))
	builder.WriteString(fmt.Sprintf("  tag: \"%s\"\n", "v"+fmt.Sprintf("%d.%d.%d", getRandomNumber(0, 9), getRandomNumber(0, 99), getRandomNumber(0, 999))))
	builder.WriteString(fmt.Sprintf("  pullPolicy: %s\n\n", getRandomItem([]string{"IfNotPresent", "Always", "Never"})))

	// Service settings
	builder.WriteString("service:\n")
	builder.WriteString(fmt.Sprintf("  type: %s\n", getRandomItem([]string{"ClusterIP", "NodePort", "LoadBalancer"})))
	builder.WriteString(fmt.Sprintf("  port: %d\n\n", getRandomItem(randomPorts)))

	// Resources section
	builder.WriteString("resources:\n")
	if rand.Float32() < 0.3 {
		// Sometimes use empty resources
		builder.WriteString("  # No resource limits or requests\n")
		builder.WriteString("  limits: {}\n")
		builder.WriteString("  requests: {}\n\n")
	} else {
		builder.WriteString("  limits:\n")
		builder.WriteString(fmt.Sprintf("    cpu: %dm\n", getRandomNumber(100, 2000)))
		builder.WriteString(fmt.Sprintf("    memory: %dMi\n", getRandomNumber(128, 4096)))
		builder.WriteString("  requests:\n")
		builder.WriteString(fmt.Sprintf("    cpu: %dm\n", getRandomNumber(50, 1000)))
		builder.WriteString(fmt.Sprintf("    memory: %dMi\n\n", getRandomNumber(64, 2048)))
	}

	// Add complexity-specific fields
	switch complexity {
	case ComplexityLow:
		addLowComplexityFields(&builder)
	case ComplexityMedium:
		addLowComplexityFields(&builder)
		addMediumComplexityFields(&builder)
	case ComplexityHigh:
		addLowComplexityFields(&builder)
		addMediumComplexityFields(&builder)
		addHighComplexityFields(&builder)
	}

	return builder.String()
}

// Add simple top-level fields
func addLowComplexityFields(builder *strings.Builder) {
	// Ingress configuration
	builder.WriteString("ingress:\n")
	builder.WriteString(fmt.Sprintf("  enabled: %s\n", getRandomItem(randomBooleanValues)))
	builder.WriteString("  annotations:\n")
	builder.WriteString(fmt.Sprintf("    kubernetes.io/ingress.class: %s\n", getRandomItem([]string{"nginx", "traefik", "istio"})))
	builder.WriteString("  hosts:\n")
	builder.WriteString(fmt.Sprintf("    - host: %s.example.com\n", getRandomItem(randomNames)))
	builder.WriteString("      paths:\n")
	builder.WriteString("        - path: /\n")
	builder.WriteString(fmt.Sprintf("          pathType: %s\n\n", getRandomItem([]string{"Prefix", "Exact", "ImplementationSpecific"})))

	// Simple persistence
	builder.WriteString("persistence:\n")
	builder.WriteString(fmt.Sprintf("  enabled: %s\n", getRandomItem(randomBooleanValues)))
	builder.WriteString(fmt.Sprintf("  size: %dGi\n\n", getRandomNumber(1, 100)))
}

// Add more complex nested structures
func addMediumComplexityFields(builder *strings.Builder) {
	// Environment variables
	builder.WriteString("env:\n")
	numEnvVars := getRandomNumber(3, 8)
	for i := 0; i < numEnvVars; i++ {
		envVar := getRandomItem(randomEnvVars)
		builder.WriteString(fmt.Sprintf("  %s: \"%s\"\n", envVar, generateRandomValue(envVar)))
	}
	builder.WriteString("\n")

	// Pod security context
	builder.WriteString("securityContext:\n")
	builder.WriteString(fmt.Sprintf("  runAsUser: %d\n", getRandomNumber(1000, 9999)))
	builder.WriteString(fmt.Sprintf("  runAsGroup: %d\n", getRandomNumber(1000, 9999)))
	builder.WriteString(fmt.Sprintf("  fsGroup: %d\n", getRandomNumber(1000, 9999)))
	builder.WriteString("  capabilities:\n")
	builder.WriteString("    drop:\n")
	builder.WriteString("      - ALL\n\n")

	// NodeSelector, tolerations, and affinity
	builder.WriteString("nodeSelector:\n")
	builder.WriteString(fmt.Sprintf("  kubernetes.io/os: %s\n", getRandomItem([]string{"linux", "windows"})))
	builder.WriteString(fmt.Sprintf("  kubernetes.io/arch: %s\n\n", getRandomItem([]string{"amd64", "arm64"})))

	// Add tolerations
	builder.WriteString("tolerations: []\n\n")
}

// Add highly complex, deeply nested structures
func addHighComplexityFields(builder *strings.Builder) {
	// Multiple containers
	builder.WriteString("sidecars:\n")
	numSidecars := getRandomNumber(1, 3)
	for i := 0; i < numSidecars; i++ {
		sidecarName := getRandomItem(randomNames)
		builder.WriteString(fmt.Sprintf("  - name: %s-sidecar\n", sidecarName))
		builder.WriteString(fmt.Sprintf("    image: %s\n", getRandomItem(randomImages)))
		builder.WriteString("    resources:\n")
		builder.WriteString("      limits:\n")
		builder.WriteString(fmt.Sprintf("        cpu: %dm\n", getRandomNumber(50, 500)))
		builder.WriteString(fmt.Sprintf("        memory: %dMi\n", getRandomNumber(64, 512)))
		builder.WriteString("      requests:\n")
		builder.WriteString(fmt.Sprintf("        cpu: %dm\n", getRandomNumber(10, 200)))
		builder.WriteString(fmt.Sprintf("        memory: %dMi\n", getRandomNumber(32, 256)))
		builder.WriteString("    env:\n")
		numEnvVars := getRandomNumber(1, 4)
		for j := 0; j < numEnvVars; j++ {
			envVar := getRandomItem(randomEnvVars)
			builder.WriteString(fmt.Sprintf("      - name: %s\n", envVar))
			builder.WriteString(fmt.Sprintf("        value: \"%s\"\n", generateRandomValue(envVar)))
		}
	}
	builder.WriteString("\n")

	// Advanced affinities
	builder.WriteString("affinity:\n")
	builder.WriteString("  podAntiAffinity:\n")
	builder.WriteString("    preferredDuringSchedulingIgnoredDuringExecution:\n")
	builder.WriteString("    - weight: 100\n")
	builder.WriteString("      podAffinityTerm:\n")
	builder.WriteString("        labelSelector:\n")
	builder.WriteString("          matchExpressions:\n")
	builder.WriteString(fmt.Sprintf("          - key: app.kubernetes.io/name\n            operator: In\n            values: [\"%s\"]\n", getRandomItem(randomNames)))
	builder.WriteString("        topologyKey: \"kubernetes.io/hostname\"\n\n")

	// Complex annotations
	builder.WriteString("podAnnotations:\n")
	numAnnotations := getRandomNumber(3, 8)
	for i := 0; i < numAnnotations; i++ {
		annotation := getRandomItem(randomAnnotations)
		builder.WriteString(fmt.Sprintf("  %s: \"%s\"\n", annotation, generateRandomValue(annotation)))
	}
	builder.WriteString("\n")

	// Autoscaling
	builder.WriteString("autoscaling:\n")
	builder.WriteString(fmt.Sprintf("  enabled: %s\n", getRandomItem(randomBooleanValues)))
	builder.WriteString(fmt.Sprintf("  minReplicas: %d\n", getRandomNumber(1, 3)))
	builder.WriteString(fmt.Sprintf("  maxReplicas: %d\n", getRandomNumber(5, 20)))
	builder.WriteString(fmt.Sprintf("  targetCPUUtilizationPercentage: %d\n", getRandomNumber(50, 90)))
	builder.WriteString(fmt.Sprintf("  targetMemoryUtilizationPercentage: %d\n\n", getRandomNumber(50, 90)))

	// Configuration map
	builder.WriteString("configurationFiles:\n")
	configTypes := []string{"nginx.conf", "app.properties", "db.conf", "cache.json"}
	for _, configType := range configTypes[:getRandomNumber(1, len(configTypes))] {
		builder.WriteString(fmt.Sprintf("  %s: |\n", configType))
		lines := getRandomNumber(3, 8)
		for i := 0; i < lines; i++ {
			builder.WriteString(fmt.Sprintf("    # %s line %d\n", configType, i+1))
			builder.WriteString(fmt.Sprintf("    setting_%d = value_%d\n", i+1, getRandomNumber(1, 100)))
		}
	}
}

// Generate random values appropriate for variable names
func generateRandomValue(name string) string {
	switch {
	case strings.Contains(name, "PORT"):
		return fmt.Sprintf("%d", getRandomItem(randomPorts))
	case strings.Contains(name, "DEBUG") || strings.Contains(name, "ENABLE"):
		return getRandomItem(randomBooleanValues)
	case strings.Contains(name, "LEVEL"):
		return getRandomItem([]string{"debug", "info", "warn", "error"})
	case strings.Contains(name, "ENV") || strings.Contains(name, "ENVIRONMENT"):
		return getRandomItem([]string{"development", "staging", "production", "test"})
	case strings.Contains(name, "MAX") || strings.Contains(name, "MIN") || strings.Contains(name, "TIMEOUT"):
		return fmt.Sprintf("%d", getRandomNumber(10, 300))
	case strings.Contains(name, "URL"):
		protocol := getRandomItem([]string{"http", "https"})
		service := getRandomItem(randomNames)
		domain := getRandomItem([]string{"svc.cluster.local", "example.com", "internal"})
		port := getRandomItem(randomPorts)
		return fmt.Sprintf("%s://%s.%s:%d", protocol, service, domain, port)
	case strings.Contains(name, "KEY") || strings.Contains(name, "SECRET"):
		// Generate random alphanumeric string
		chars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		length := getRandomNumber(16, 32)
		result := make([]byte, length)
		for i := range result {
			result[i] = chars[rand.Intn(len(chars))]
		}
		return string(result)
	default:
		return fmt.Sprintf("value-%d", getRandomNumber(1, 1000))
	}
}