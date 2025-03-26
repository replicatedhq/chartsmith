package llm

import (
	"testing"
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
			wantErrContent: "String to replace not found in file",
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
			name:        "Real world success - values.yaml ingress section",
			content:     "ingress:\n  annotations: {}\n  # IngressClass used for ingresses created by the okteto installation. By default it's the default ingress class in the cluster\n  oktetoIngressClass: okteto-controlplane-nginx\n  # Okteto will set this as the value of the IngressClass for all the ingress resources managed by okteto. Leave  empty to fallback on your cluster's default ingress class.\n  class:\n  # If enabled, all ingresses deployed in namespaces managed by Okteto will have the ingress class defined in `ingress.class`.\n  forceIngressClass: false\n  # If enabled, all ingresses deployed in namespaces managed by Okteto must match the okteto wildcard subdomain\n  forceIngressSubdomain: false\n  # If using an ingress not managed by okteto, this option lets you configure the traffic to the Okteto API/Registry using the internal network\n  ip: \"\"",
			oldStr:      "ingress:\n  annotations: {}\n  # IngressClass used for ingresses created by the okteto installation. By default it's the default ingress class in the cluster\n  oktetoIngressClass: okteto-controlplane-nginx\n  # Okteto will set this as the value of the IngressClass for all the ingress resources managed by okteto. Leave  empty to fallback on your cluster's default ingress class.\n  class:\n  # If enabled, all ingresses deployed in namespaces managed by Okteto will have the ingress class defined in `ingress.class`.\n  forceIngressClass: false\n  # If enabled, all ingresses deployed in namespaces managed by Okteto must match the okteto wildcard subdomain\n  forceIngressSubdomain: false\n  # If using an ingress not managed by okteto, this option lets you configure the traffic to the Okteto API/Registry using the internal network\n  ip: \"\"",
			newStr:      "ingress:\n  annotations: {}\n  # IngressClass used for ingresses created by the okteto installation\n  oktetoIngressClass: okteto-controlplane-traefik\n  # Okteto will set this as the value of the IngressClass for all the ingress resources managed by okteto\n  class: traefik\n  # If enabled, all ingresses deployed in namespaces managed by Okteto will have the ingress class defined in `ingress.class`\n  forceIngressClass: true\n  # If enabled, all ingresses deployed in namespaces managed by Okteto must match the okteto wildcard subdomain\n  forceIngressSubdomain: false\n  # If using an ingress not managed by okteto, this option lets you configure the traffic to the Okteto API/Registry using the internal network\n  ip: \"\"",
			wantContent: "ingress:\n  annotations: {}\n  # IngressClass used for ingresses created by the okteto installation\n  oktetoIngressClass: okteto-controlplane-traefik\n  # Okteto will set this as the value of the IngressClass for all the ingress resources managed by okteto\n  class: traefik\n  # If enabled, all ingresses deployed in namespaces managed by Okteto will have the ingress class defined in `ingress.class`\n  forceIngressClass: true\n  # If enabled, all ingresses deployed in namespaces managed by Okteto must match the okteto wildcard subdomain\n  forceIngressSubdomain: false\n  # If using an ingress not managed by okteto, this option lets you configure the traffic to the Okteto API/Registry using the internal network\n  ip: \"\"",
			wantSuccess: true,
		},
		{
			name:           "Real world failure - ingress-nginx to traefik conversion 1",
			content:        "subdomain: \"localtest.me\"\nlicense: \"\"\n# if enabled, all leeway for the license limits (seats, expiration, etc) will not\n# be considered and the values defined by the license will be used\nlicenseHardLimits:\n  enabled: false\n## Custom resource configuration\ncrds:\n  # -- Install and upgrade CRDs\n  install: true\n  # -- Keep CRDs on chart uninstall\n  keep: true\n  # -- Annotations to be added to all CRDs\n  annotations: {}\ncluster:\n  endpoint: \"\"\ntheme:\n  primary:\n  seconday:\n  logo:\nglobals:\n  jobs:",
			oldStr:         "ingress-nginx:\n  enabled: true\n  controller:\n    # TODO @jpf-okteto: enableAnnotationValidations\n    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/pkg/flags/flags.go#L161\n    # This property was `false` in v1.11.2 (4.11.2)\n    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/pkg/flags/flags.go#L162\n    # It switched to `true` in v1.12.0 (4.12.0)\n    enableAnnotationValidations: false\n    image:\n      chroot: true\n      registry: docker.io\n      image: okteto/ingress-nginx\n      tag: 1.29.0-rc.2\n      digestChroot: \"\"\n    allowSnippetAnnotations: true\n    admissionWebhooks:\n      enabled: false",
			newStr:         "traefik:\n  enabled: true\n  ingressClass: okteto-controlplane-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n    - \"--entrypoints.web.proxyprotocol.insecure\"\n    - \"--entrypoints.websecure.proxyprotocol.insecure\"\n  resources:\n    requests:\n      cpu: 100m",
			wantContent:    "subdomain: \"localtest.me\"\nlicense: \"\"\n# if enabled, all leeway for the license limits (seats, expiration, etc) will not\n# be considered and the values defined by the license will be used\nlicenseHardLimits:\n  enabled: false\n## Custom resource configuration\ncrds:\n  # -- Install and upgrade CRDs\n  install: true\n  # -- Keep CRDs on chart uninstall\n  keep: true\n  # -- Annotations to be added to all CRDs\n  annotations: {}\ncluster:\n  endpoint: \"\"\ntheme:\n  primary:\n  seconday:\n  logo:\nglobals:\n  jobs:",
			wantSuccess:    true,
			wantErrContent: "String to replace not found in file",
		},
		{
			name:           "Real world failure - ingress-nginx to traefik conversion 2",
			content:        "subdomain: \"localtest.me\"\nlicense: \"\"\n# if enabled, all leeway for the license limits (seats, expiration, etc) will not\n# be considered and the values defined by the license will be used\nlicenseHardLimits:\n  enabled: false\n## Custom resource configuration\ncrds:\n  # -- Install and upgrade CRDs\n  install: true\n  # -- Keep CRDs on chart uninstall\n  keep: true\n  # -- Annotations to be added to all CRDs\n  annotations: {}\ncluster:\n  endpoint: \"\"\ntheme:\n  primary:\n  seconday:\n  logo:\nglobals:\n  jobs:\n    ttlSecondsAfterFinished: 86400 # 24h\n  priorityClassName:\n  nodeSelectors:\n    okteto: {}\n    dev: {}\n  registry:\n  tolerations:\n    okteto: []\n    dev: []\nauth:\n  google:\n    enabled: false\n    clientId: \"\"\n    clientSecret: \"\"\n    allowDomains: []\n  github:\n    enabled: false\n    clientId: \"\"\n    clientSecret: \"\"\n    organization: \"\"\n    allowList: []",
			oldStr:         "ingress-nginx:\n  enabled: true\n  controller:\n    # TODO @jpf-okteto: enableAnnotationValidations\n    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/pkg/flags/flags.go#L161\n    # This property was `false` in v1.11.2 (4.11.2)\n    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/pkg/flags/flags.go#L162\n    # It switched to `true` in v1.12.0 (4.12.0)\n    enableAnnotationValidations: false\n    image:\n      chroot: true\n      registry: docker.io\n      image: okteto/ingress-nginx\n      tag: 1.29.0-rc.2\n      digestChroot: \"\"\n    allowSnippetAnnotations: true\n    admissionWebhooks:\n      enabled: false",
			newStr:         "traefik:\n  enabled: true\n  ingressClass: okteto-controlplane-traefik\n  ingressRoute:\n    dashboard:\n      enabled: false\n  deployment:\n    replicas: 2\n  additionalArguments:\n    - \"--providers.kubernetescrd.allowCrossNamespace=true\"\n    - \"--log.level=INFO\"\n    - \"--accesslog=true\"\n    - \"--accesslog.format=json\"\n    - \"--entrypoints.web.proxyprotocol.insecure\"\n    - \"--entrypoints.websecure.proxyprotocol.insecure\"\n  resources:\n    requests:\n      cpu: 100m",
			wantContent:    "subdomain: \"localtest.me\"\nlicense: \"\"\n# if enabled, all leeway for the license limits (seats, expiration, etc) will not\n# be considered and the values defined by the license will be used\nlicenseHardLimits:\n  enabled: false\n## Custom resource configuration\ncrds:\n  # -- Install and upgrade CRDs\n  install: true\n  # -- Keep CRDs on chart uninstall\n  keep: true\n  # -- Annotations to be added to all CRDs\n  annotations: {}\ncluster:\n  endpoint: \"\"\ntheme:\n  primary:\n  seconday:\n  logo:\nglobals:\n  jobs:\n    ttlSecondsAfterFinished: 86400 # 24h\n  priorityClassName:\n  nodeSelectors:\n    okteto: {}\n    dev: {}\n  registry:\n  tolerations:\n    okteto: []\n    dev: []\nauth:\n  google:\n    enabled: false\n    clientId: \"\"\n    clientSecret: \"\"\n    allowDomains: []\n  github:\n    enabled: false\n    clientId: \"\"\n    clientSecret: \"\"\n    organization: \"\"\n    allowList: []",
			wantSuccess:    false,
			wantErrContent: "String to replace not found in file",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotContent, gotSuccess, gotErr := PerformStringReplacement(tt.content, tt.oldStr, tt.newStr)

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
