package llm

import (
	"fmt"
	"testing"
	"time"
)

func TestPerformStringReplacement(t *testing.T) {
	tests := []struct {
		name           string
		content        string
		oldStr         string
		newStr         string
		wantContent    string
		wantSuccess    bool
		wantErrContent string
	}{
		{
			name:        "Simple match case",
			content:     "Hello, world! This is a test.",
			oldStr:      "Hello, world!",
			newStr:      "Greetings, planet!",
			wantContent: "Greetings, planet! This is a test.",
			wantSuccess: true,
		},
		{
			name:           "String not found",
			content:        "Hello, world! This is a test.",
			oldStr:         "This text doesn't exist",
			newStr:         "Replacement text",
			wantContent:    "Hello, world! This is a test.", // Content should remain unchanged
			wantSuccess:    false,
			wantErrContent: "Approximate match for replacement not found",
		},
		{
			name:        "Multiple replacements",
			content:     "The quick brown fox jumps over the lazy dog. The quick brown fox is quick.",
			oldStr:      "quick",
			newStr:      "fast",
			wantContent: "The fast brown fox jumps over the lazy dog. The fast brown fox is fast.",
			wantSuccess: true,
		},
		{
			name:        "Replace with empty string",
			content:     "Hello, world! This is a test.",
			oldStr:      "This is ",
			newStr:      "",
			wantContent: "Hello, world! a test.",
			wantSuccess: true,
		},
		{
			name:        "Real world success - Chart.yaml dependencies",
			content:     "dependencies:\n- condition: ingress-nginx.enabled\n  name: ingress-nginx\n  repository: https://kubernetes.github.io/ingress-nginx\n  version: 4.12.0\n- alias: okteto-nginx\n  condition: okteto-nginx.enabled\n  name: ingress-nginx\n  repository: https://kubernetes.github.io/ingress-nginx\n  version: 4.12.0",
			oldStr:      "dependencies:\n- condition: ingress-nginx.enabled\n  name: ingress-nginx\n  repository: https://kubernetes.github.io/ingress-nginx\n  version: 4.12.0\n- alias: okteto-nginx\n  condition: okteto-nginx.enabled\n  name: ingress-nginx\n  repository: https://kubernetes.github.io/ingress-nginx\n  version: 4.12.0",
			newStr:      "dependencies:\n- condition: traefik.enabled\n  name: traefik\n  repository: https://helm.traefik.io/traefik\n  version: 23.1.0\n- alias: okteto-traefik\n  condition: okteto-traefik.enabled\n  name: traefik\n  repository: https://helm.traefik.io/traefik\n  version: 23.1.0",
			wantContent: "dependencies:\n- condition: traefik.enabled\n  name: traefik\n  repository: https://helm.traefik.io/traefik\n  version: 23.1.0\n- alias: okteto-traefik\n  condition: okteto-traefik.enabled\n  name: traefik\n  repository: https://helm.traefik.io/traefik\n  version: 23.1.0",
			wantSuccess: true,
		},
		{
			name:        "Real world fuzzy match - replace ingress-nginx with traefik config",
			content:     "ingress-nginx:\n  enabled: true\n  controller:\n    enableAnnotationValidations: false\n    image:\n      chroot: true\n      registry: docker.io\n      image: okteto/ingress-nginx\n      tag: 1.29.0-rc.2\n      digestChroot: \"\"\n    allowSnippetAnnotations: true\n    admissionWebhooks:\n      enabled: false\n      namespaceSelector:\n        matchLabels:\n          dev.okteto.com: \"true\"\n    replicaCount: 2\n    affinity:\n      nodeAffinity:\n        preferredDuringSchedulingIgnoredDuringExecution:\n          - preference:\n              matchExpressions:\n                - key: dev.okteto.com/overloaded\n                  operator: DoesNotExist\n            weight: 50\n      podAntiAffinity:\n        preferredDuringSchedulingIgnoredDuringExecution:\n          - weight: 100\n            podAffinityTerm:\n              labelSelector:\n                matchExpressions:\n                  - key: app.kubernetes.io/component\n                    operator: In\n                    values:\n                      - controller\n                  - key: app.kubernetes.io/name\n                    operator: In\n                    values:\n                      - ingress-nginx\n              topologyKey: kubernetes.io/hostname\n    config:\n      annotation-value-word-blocklist: load_module,lua_package,_by_lua,root,serviceaccount\n      log-format-escape-json: \"true\"\n      log-format-upstream: '{\"time\": \"$time_iso8601\", \"remote_addr\": \"$remote_addr\", \"x_forward_for\": \"$proxy_add_x_forwarded_for\", \"request_id\": \"$req_id\", \"remote_user\": \"$remote_user\", \"bytes_sent\": $bytes_sent, \"request_time\": $request_time, \"status\": $status, \"vhost\": \"$host\", \"request_proto\": \"$server_protocol\", \"path\": \"$uri\", \"request_query\": \"$args\", \"request_length\": $request_length, \"duration\": $request_time,\"method\": \"$request_method\", \"http_referrer\": \"$http_referer\", \"http_user_agent\": \"$http_user_agent\" }'\n      ignore-invalid-headers: \"false\"\n      enable-underscores-in-headers: \"true\"\n      proxy-buffer-size: 64K\n      allow-cross-namespace-resources: \"true\"\n      strict-validate-path-type: \"false\"\n      ssl-ciphers: \"ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:AES128-GCM-SHA256:AES128-GCM-SHA384\"\n    extraArgs:\n      default-ssl-certificate: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n      default-backend-service: $(POD_NAMESPACE)/$(OKTETO_INGRESS_NGINX_DEFAULT_BACKEND)\n    service:\n      externalTrafficPolicy: Local\n      type: LoadBalancer\n    ingressClass: okteto-controlplane-nginx\n    ingressClassResource:\n      name: okteto-controlplane-nginx\n      enabled: true\n      default: false\n      controllerValue: \"k8s.io/okteto-controlplane-nginx\"\n    extraEnvs:\n      - name: OKTETO_INGRESS_NGINX_DEFAULT_BACKEND\n        valueFrom:\n          configMapKeyRef:\n            key: defaultbackendservice\n            name: okteto-ingress-config\n    priorityClassName:\n  defaultBackend:\n    enabled: false",
			oldStr:      "ingress-nginx:\n  enabled: true\n  controller:\n    enableAnnotationValidations: false\n    image:\n      chroot: true\n      registry: docker.io\n      image: okteto/ingress-nginx\n      tag: 1.29.0-rc.2\n      digestChroot: \"\"\n    allowSnippetAnnotations: true\n    admissionWebhooks:\n      enabled: false\n      namespaceSelector:\n        matchLabels:\n          dev.okteto.com: \"true\"\n    replicaCount: 2\n    affinity:\n      nodeAffinity:\n        preferredDuringSchedulingIgnoredDuringExecution:\n          - preference:\n              matchExpressions:\n                - key: dev.okteto.com/overloaded\n                  operator: DoesNotExist\n            weight: 50\n      podAntiAffinity:\n        preferredDuringSchedulingIgnoredDuringExecution:\n          - weight: 100\n            podAffinityTerm:\n              labelSelector:\n                matchExpressions:\n                  - key: app.kubernetes.io/component\n                    operator: In\n                    values:\n                      - controller\n                  - key: app.kubernetes.io/name\n                    operator: In\n                    values:\n                      - ingress-nginx\n              topologyKey: kubernetes.io/hostname\n    config:\n      annotation-value-word-blocklist: load_module,lua_package,_by_lua,root,serviceaccount\n      log-format-escape-json: \"true\"\n      log-format-upstream: '{\"time\": \"$time_iso8601\", \"remote_addr\": \"$remote_addr\", \"x_forward_for\": \"$proxy_add_x_forwarded_for\", \"request_id\": \"$req_id\", \"remote_user\": \"$remote_user\", \"bytes_sent\": $bytes_sent, \"request_time\": $request_time, \"status\": $status, \"vhost\": \"$host\", \"request_proto\": \"$server_protocol\", \"path\": \"$uri\", \"request_query\": \"$args\", \"request_length\": $request_length, \"duration\": $request_time,\"method\": \"$request_method\", \"http_referrer\": \"$http_referer\", \"http_user_agent\": \"$http_user_agent\" }'\n      ignore-invalid-headers: \"false\"\n      enable-underscores-in-headers: \"true\"\n      proxy-buffer-size: 64K\n      allow-cross-namespace-resources: \"true\"\n      strict-validate-path-type: \"false\"\n      ssl-ciphers: \"ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:AES128-GCM-SHA256:AES128-GCM-SHA384\"\n    extraArgs:\n      default-ssl-certificate: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n      default-backend-service: $(POD_NAMESPACE)/$(OKTETO_INGRESS_NGINX_DEFAULT_BACKEND)\n    service:\n      externalTrafficPolicy: Local\n      type: LoadBalancer\n    ingressClass: okteto-controlplane-nginx\n    ingressClassResource:\n      name: okteto-controlplane-nginx\n      enabled: true\n      default: false\n      controllerValue: \"k8s.io/okteto-controlplane-nginx\"\n    extraEnvs:\n      - name: OKTETO_INGRESS_NGINX_DEFAULT_BACKEND\n        valueFrom:\n          configMapKeyRef:\n            key: defaultbackendservice\n            name: okteto-ingress-config\n    priorityClassName:\n  defaultBackend:\n    enabled: false",
			newStr:      "traefik:\n  enabled: true\n  ingressClass: okteto-controlplane-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n    - \"--entrypoints.web.proxyprotocol.insecure\"\n    - \"--entrypoints.websecure.proxyprotocol.insecure\"\n  resources:\n    requests:\n      cpu: 100m\n      memory: 50Mi\n    limits:\n      memory: 128Mi\n  affinity:\n    nodeAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - preference:\n            matchExpressions:\n              - key: dev.okteto.com/overloaded\n                operator: DoesNotExist\n          weight: 50\n    podAntiAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 100\n          podAffinityTerm:\n            labelSelector:\n              matchExpressions:\n                - key: app.kubernetes.io/name\n                  operator: In\n                  values:\n                    - traefik\n            topologyKey: kubernetes.io/hostname\n  service:\n    type: LoadBalancer\n    externalTrafficPolicy: Local\n  ports:\n    web:\n      port: 80\n      expose: true\n      exposedPort: 80\n      protocol: TCP\n    websecure:\n      port: 443\n      expose: true\n      exposedPort: 443\n      protocol: TCP\n      tls:\n        enabled: true\n        options: \"default\"\n  ssl:\n    enabled: true\n    defaultCert: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n    defaultKey: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n  persistence:\n    enabled: true\n    size: 128Mi\n    storageClass: standard\n  logs:\n    general:\n      level: INFO\n    access:\n      enabled: true\n      format: json\nokteto-traefik:\n  enabled: true\n  ingressClass: okteto-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n  resources:\n    requests:\n      cpu: 100m\n      memory: 50Mi\n    limits:\n      memory: 128Mi\n  affinity:\n    nodeAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - preference:\n            matchExpressions:\n              - key: dev.okteto.com/overloaded\n                operator: DoesNotExist\n          weight: 50\n    podAntiAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 100\n          podAffinityTerm:\n            labelSelector:\n              matchExpressions:\n                - key: app.kubernetes.io/name\n                  operator: In\n                  values:\n                    - okteto-traefik\n            topologyKey: kubernetes.io/hostname\n  service:\n    type: ClusterIP\n  ports:\n    websecure:\n      port: 443\n      expose: true\n      exposedPort: 443\n      protocol: TCP\n      tls:\n        enabled: true\n        options: \"default\"\n  ssl:\n    enabled: true\n    defaultCert: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n    defaultKey: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n  persistence:\n    enabled: true\n    size: 128Mi\n    storageClass: standard\n  logs:\n    general:\n      level: INFO\n    access:\n      enabled: true\n      format: json",
			wantContent: "traefik:\n  enabled: true\n  ingressClass: okteto-controlplane-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n    - \"--entrypoints.web.proxyprotocol.insecure\"\n    - \"--entrypoints.websecure.proxyprotocol.insecure\"\n  resources:\n    requests:\n      cpu: 100m\n      memory: 50Mi\n    limits:\n      memory: 128Mi\n  affinity:\n    nodeAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - preference:\n            matchExpressions:\n              - key: dev.okteto.com/overloaded\n                operator: DoesNotExist\n          weight: 50\n    podAntiAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 100\n          podAffinityTerm:\n            labelSelector:\n              matchExpressions:\n                - key: app.kubernetes.io/name\n                  operator: In\n                  values:\n                    - traefik\n            topologyKey: kubernetes.io/hostname\n  service:\n    type: LoadBalancer\n    externalTrafficPolicy: Local\n  ports:\n    web:\n      port: 80\n      expose: true\n      exposedPort: 80\n      protocol: TCP\n    websecure:\n      port: 443\n      expose: true\n      exposedPort: 443\n      protocol: TCP\n      tls:\n        enabled: true\n        options: \"default\"\n  ssl:\n    enabled: true\n    defaultCert: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n    defaultKey: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n  persistence:\n    enabled: true\n    size: 128Mi\n    storageClass: standard\n  logs:\n    general:\n      level: INFO\n    access:\n      enabled: true\n      format: json\nokteto-traefik:\n  enabled: true\n  ingressClass: okteto-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n  resources:\n    requests:\n      cpu: 100m\n      memory: 50Mi\n    limits:\n      memory: 128Mi\n  affinity:\n    nodeAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - preference:\n            matchExpressions:\n              - key: dev.okteto.com/overloaded\n                operator: DoesNotExist\n          weight: 50\n    podAntiAffinity:\n      preferredDuringSchedulingIgnoredDuringExecution:\n        - weight: 100\n          podAffinityTerm:\n            labelSelector:\n              matchExpressions:\n                - key: app.kubernetes.io/name\n                  operator: In\n                  values:\n                    - okteto-traefik\n            topologyKey: kubernetes.io/hostname\n  service:\n    type: ClusterIP\n  ports:\n    websecure:\n      port: 443\n      expose: true\n      exposedPort: 443\n      protocol: TCP\n      tls:\n        enabled: true\n        options: \"default\"\n  ssl:\n    enabled: true\n    defaultCert: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n    defaultKey: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned\n  persistence:\n    enabled: true\n    size: 128Mi\n    storageClass: standard\n  logs:\n    general:\n      level: INFO\n    access:\n      enabled: true\n      format: json",
			wantSuccess: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()
			gotContent, gotSuccess, gotErr := PerformStringReplacement(tt.content, tt.oldStr, tt.newStr)
			end := time.Now()
			fmt.Printf("Time taken: %v\n", end.Sub(start))

			// Check success flag
			if gotSuccess != tt.wantSuccess {
				t.Errorf("PerformStringReplacement() success = %v, want %v", gotSuccess, tt.wantSuccess)
			}

			// Check content
			if gotContent != tt.wantContent {
				t.Errorf("PerformStringReplacement() content = %v, want %v", gotContent, tt.wantContent)
			}

			// Check error
			if tt.wantSuccess {
				if gotErr != nil {
					t.Errorf("PerformStringReplacement() unexpected error: %v", gotErr)
				}
			} else {
				if gotErr == nil {
					t.Errorf("PerformStringReplacement() expected error but got nil")
				} else if tt.wantErrContent != "" && gotErr.Error() != tt.wantErrContent {
					t.Errorf("PerformStringReplacement() error = %v, want error containing %v", gotErr, tt.wantErrContent)
				}
			}
		})
	}
}
