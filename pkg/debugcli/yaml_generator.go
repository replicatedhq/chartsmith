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

// generateRandomValue produces a random appropriate value for a key
func generateRandomValue(key string) string {
	// Analyze the key to provide domain-appropriate values
	switch {
	case strings.Contains(key, "image") || strings.Contains(key, "repository"):
		return getRandomItem(randomImages)
	case strings.Contains(key, "port"):
		return fmt.Sprintf("%d", getRandomItem(randomPorts))
	case strings.Contains(key, "replica") || strings.Contains(key, "count") ||
		strings.Contains(key, "size") || strings.Contains(key, "limit"):
		return fmt.Sprintf("%d", rand.Intn(10)+1)
	case strings.Contains(key, "enabled") || strings.Contains(key, "disabled") ||
		strings.Contains(key, "active"):
		return getRandomItem(randomBooleanValues)
	case strings.Contains(key, "version"):
		return fmt.Sprintf("%d.%d.%d", rand.Intn(10), rand.Intn(20), rand.Intn(100))
	case strings.Contains(key, "env") || strings.Contains(key, "environment"):
		return getRandomItem(randomEnvVars)
	case strings.Contains(key, "name"):
		return getRandomItem(randomNames)
	case strings.Contains(key, "annotation"):
		return getRandomItem(randomAnnotations)
	case strings.Contains(key, "field"):
		// For generic fields like field_1, generate more generic values
		options := []string{"value", "setting", "config"}
		return fmt.Sprintf("%s-%d", getRandomItem(options), rand.Intn(1000))
	default:
		// For unrecognized keys, generate a generic value
		return fmt.Sprintf("value-%d", rand.Intn(1000))
	}
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
		builder.WriteString(fmt.Sprintf("    cpu: %dm\n", getRandomNumber(50, 500)))
		builder.WriteString(fmt.Sprintf("    memory: %dMi\n\n", getRandomNumber(64, 1024)))
	}

	// Add complexity-specific sections
	switch complexity {
	case ComplexityLow:
		generateSimpleYAML(&builder)
	case ComplexityMedium:
		generateMediumComplexityYAML(&builder)
	case ComplexityHigh:
		generateHighComplexityYAML(&builder)
	default:
		// Default to medium complexity
		generateMediumComplexityYAML(&builder)
	}

	return builder.String()
}

// generateSimpleYAML adds a few simple sections to the YAML
func generateSimpleYAML(builder *strings.Builder) {
	// Ingress settings
	builder.WriteString("ingress:\n")
	ingressEnabled := rand.Float32() < 0.7 // 70% chance of enabling ingress
	builder.WriteString(fmt.Sprintf("  enabled: %v\n", ingressEnabled))
	if ingressEnabled {
		builder.WriteString("  hosts:\n")
		builder.WriteString(fmt.Sprintf("    - host: %s.example.com\n", getRandomItem(randomNames)))
		builder.WriteString("      paths:\n")
		builder.WriteString("        - path: /\n")
		builder.WriteString("          pathType: Prefix\n")
	}
	builder.WriteString("\n")

	// Config settings
	builder.WriteString("config:\n")
	builder.WriteString(fmt.Sprintf("  logLevel: %s\n", getRandomItem([]string{"debug", "info", "warn", "error"})))
	builder.WriteString(fmt.Sprintf("  timeout: %d\n\n", getRandomNumber(5, 60)))

	// Add a small environment variables section
	builder.WriteString("env:\n")
	for i := 0; i < getRandomNumber(2, 4); i++ {
		envVar := getRandomItem(randomEnvVars)
		builder.WriteString(fmt.Sprintf("  %s: \"%s\"\n", envVar, fmt.Sprintf("value-%d", getRandomNumber(100, 999))))
	}
}

// generateMediumComplexityYAML adds more complex sections to the YAML
func generateMediumComplexityYAML(builder *strings.Builder) {
	// First add the simple sections
	generateSimpleYAML(builder)

	// Add a persistence section
	builder.WriteString("\npersistence:\n")
	persistenceEnabled := rand.Float32() < 0.6 // 60% chance of enabling persistence
	builder.WriteString(fmt.Sprintf("  enabled: %v\n", persistenceEnabled))
	if persistenceEnabled {
		builder.WriteString(fmt.Sprintf("  storageClass: \"%s\"\n", getRandomItem([]string{"standard", "ssd", "local-path", "managed-nfs-storage", ""})))
		builder.WriteString(fmt.Sprintf("  size: %dGi\n", getRandomNumber(1, 100)))
		builder.WriteString(fmt.Sprintf("  mountPath: \"/data\"\n"))
		builder.WriteString(fmt.Sprintf("  accessMode: %s\n", getRandomItem([]string{"ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany"})))
	}

	// Add security context
	builder.WriteString("\nsecurityContext:\n")
	builder.WriteString(fmt.Sprintf("  runAsUser: %d\n", getRandomNumber(1000, 2000)))
	builder.WriteString(fmt.Sprintf("  runAsGroup: %d\n", getRandomNumber(1000, 2000)))
	builder.WriteString(fmt.Sprintf("  fsGroup: %d\n", getRandomNumber(1000, 2000)))

	// Add probes section
	builder.WriteString("\nprobes:\n")
	builder.WriteString("  liveness:\n")
	builder.WriteString("    httpGet:\n")
	builder.WriteString("      path: /health\n")
	builder.WriteString(fmt.Sprintf("      port: %d\n", getRandomItem(randomPorts)))
	builder.WriteString(fmt.Sprintf("    initialDelaySeconds: %d\n", getRandomNumber(10, 60)))
	builder.WriteString(fmt.Sprintf("    periodSeconds: %d\n", getRandomNumber(5, 30)))
	builder.WriteString("  readiness:\n")
	builder.WriteString("    httpGet:\n")
	builder.WriteString("      path: /ready\n")
	builder.WriteString(fmt.Sprintf("      port: %d\n", getRandomItem(randomPorts)))
	builder.WriteString(fmt.Sprintf("    initialDelaySeconds: %d\n", getRandomNumber(5, 30)))
	builder.WriteString(fmt.Sprintf("    periodSeconds: %d\n", getRandomNumber(5, 15)))
}

// generateHighComplexityYAML adds advanced sections to the YAML
func generateHighComplexityYAML(builder *strings.Builder) {
	// First add the medium complexity sections
	generateMediumComplexityYAML(builder)

	// Add a global section with advanced settings
	builder.WriteString("\nglobal:\n")
	builder.WriteString("  # Global settings apply to all charts\n")
	builder.WriteString(fmt.Sprintf("  environment: %s\n", getRandomItem([]string{"development", "staging", "production", "testing"})))
	builder.WriteString("  labels:\n")
	builder.WriteString(fmt.Sprintf("    app: %s\n", getRandomItem(randomNames)))
	builder.WriteString(fmt.Sprintf("    version: \"%s\"\n", fmt.Sprintf("v%d.%d.%d", getRandomNumber(0, 9), getRandomNumber(0, 99), getRandomNumber(0, 999))))
	builder.WriteString(fmt.Sprintf("    managed-by: %s\n", getRandomItem([]string{"helm", "argocd", "kustomize", "flux"})))

	// Add advanced networking
	builder.WriteString("\nnetworking:\n")
	builder.WriteString("  # Network configuration\n")
	builder.WriteString("  podNetworkCidr: \"10.244.0.0/16\"\n")
	builder.WriteString("  serviceNetworkCidr: \"10.96.0.0/12\"\n")
	builder.WriteString(fmt.Sprintf("  dnsPolicy: %s\n", getRandomItem([]string{"ClusterFirst", "Default", "ClusterFirstWithHostNet"})))

	// Add monitoring integration
	builder.WriteString("\nmonitoring:\n")
	monitoringEnabled := rand.Float32() < 0.8 // 80% chance of enabling monitoring
	builder.WriteString(fmt.Sprintf("  enabled: %v\n", monitoringEnabled))
	if monitoringEnabled {
		builder.WriteString("  prometheus:\n")
		builder.WriteString("    annotations:\n")
		for _, annotation := range randomAnnotations[:3] {
			if strings.Contains(annotation, "prometheus") {
				builder.WriteString(fmt.Sprintf("      %s: \"true\"\n", annotation))
			}
		}
		builder.WriteString(fmt.Sprintf("    scrapeInterval: %ds\n", getRandomNumber(10, 60)))
		builder.WriteString("  grafana:\n")
		builder.WriteString(fmt.Sprintf("    enabled: %v\n", rand.Float32() < 0.7))
		builder.WriteString(fmt.Sprintf("    dashboards: %v\n", rand.Float32() < 0.8))
	}

	// Add autoscaling settings
	builder.WriteString("\nautoscaling:\n")
	autoscalingEnabled := rand.Float32() < 0.7 // 70% chance of enabling autoscaling
	builder.WriteString(fmt.Sprintf("  enabled: %v\n", autoscalingEnabled))
	if autoscalingEnabled {
		builder.WriteString(fmt.Sprintf("  minReplicas: %d\n", getRandomNumber(1, 3)))
		builder.WriteString(fmt.Sprintf("  maxReplicas: %d\n", getRandomNumber(5, 20)))
		builder.WriteString(fmt.Sprintf("  targetCPUUtilizationPercentage: %d\n", getRandomNumber(50, 90)))
		builder.WriteString("  behavior:\n")
		builder.WriteString("    scaleDown:\n")
		builder.WriteString(fmt.Sprintf("      stabilizationWindowSeconds: %d\n", getRandomNumber(60, 600)))
		builder.WriteString("    scaleUp:\n")
		builder.WriteString(fmt.Sprintf("      stabilizationWindowSeconds: %d\n", getRandomNumber(0, 30)))
	}

	// Add a detailed config map
	builder.WriteString("\nconfigMap:\n")
	builder.WriteString("  data:\n")
	for i := 0; i < getRandomNumber(5, 10); i++ {
		key := fmt.Sprintf("CONFIG_%d", i+1)
		builder.WriteString(fmt.Sprintf("    %s: \"%s\"\n", key, fmt.Sprintf("value-%d", getRandomNumber(100, 999))))
	}

	// Add multi-container pod settings
	builder.WriteString("\nsidecars:\n")
	for i := 0; i < getRandomNumber(1, 3); i++ {
		sidecarName := fmt.Sprintf("%s-sidecar", getRandomItem(randomNames))
		builder.WriteString(fmt.Sprintf("  - name: %s\n", sidecarName))
		builder.WriteString(fmt.Sprintf("    image: %s\n", getRandomItem(randomImages)))
		builder.WriteString("    resources:\n")
		builder.WriteString("      limits:\n")
		builder.WriteString(fmt.Sprintf("        cpu: %dm\n", getRandomNumber(50, 500)))
		builder.WriteString(fmt.Sprintf("        memory: %dMi\n", getRandomNumber(64, 512)))
		builder.WriteString("      requests:\n")
		builder.WriteString(fmt.Sprintf("        cpu: %dm\n", getRandomNumber(10, 100)))
		builder.WriteString(fmt.Sprintf("        memory: %dMi\n", getRandomNumber(32, 128)))
	}
}
