package llm

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	llmtypes "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/param"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func TestExecuteAction(t *testing.T) {
	// This is an integration test that makes real LLM API calls via the Next.js server.
	// LLM API keys are configured in the Next.js server's .env.local.
	// The test will skip if the Next.js server is not available.

	// Skip if Next.js server is not available
	// This test requires the Next.js API to be running
	baseURL := os.Getenv("NEXTJS_API_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	
	// Quick check if Next.js server is available (with very short timeout)
	client := &http.Client{Timeout: 1 * time.Second}
	req, _ := http.NewRequest("GET", baseURL+"/api/llm/execute-action", nil)
	req.Header.Set("X-Internal-API-Key", "dev-internal-key")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("")
		fmt.Println("⚠️  NOTICE: TestExecuteAction SKIPPED - Next.js server not available")
		fmt.Println("   This test requires the Next.js dev server to be running on", baseURL)
		fmt.Println("   Start it with: cd chartsmith-app && npm run dev")
		fmt.Println("   Error:", err.Error())
		fmt.Println("")
		t.Skip("Skipping: Next.js server not available")
	}
	if resp != nil {
		resp.Body.Close()
		// If we get a 405 (Method Not Allowed) or 400, server is up but endpoint expects POST
		// That's fine - server is available
		if resp.StatusCode == 404 {
			fmt.Println("")
			fmt.Println("⚠️  NOTICE: TestExecuteAction SKIPPED - Next.js API endpoint not found")
			fmt.Println("   The server is running but /api/llm/execute-action endpoint is not available")
			fmt.Println("")
			t.Skip("Skipping: API endpoint not available")
		}
	}

	// Add a timeout of 5 minutes for this test
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	tests := []struct {
		name               string
		actionPlanWithPath llmtypes.ActionPlanWithPath
		plan               *workspacetypes.Plan
		currentContent     string
		want               string
		wantErr            bool
	}{
		{
			name: "update values.yaml file",
			actionPlanWithPath: llmtypes.ActionPlanWithPath{
				ActionPlan: llmtypes.ActionPlan{
					Action: "update",
				},
				Path: "values.yaml",
			},
			plan: &workspacetypes.Plan{
				Description: `# Plan to Edit Helm Chart for Traefik Integration

I'll outline a comprehensive plan to modify the existing Okteto Helm chart to use Traefik as the default ingress controller instead of the current nginx-based solution.

## Analysis of Current State

The current chart heavily relies on NGINX Ingress Controller through two key dependencies:
- ` + "`ingress-nginx`" + ` (enabled by default)
- ` + "`okteto-nginx`" + ` (an alias for ingress-nginx, also enabled by default)

These ingress controllers are used for managing several ingress resources throughout the chart, including:
- Main application ingress
- Wildcard ingress
- Registry ingress
- Buildkit ingress
- Kubernetes endpoint ingress

## Key Modification Areas

1. **Chart Dependencies**:
   - Remove or disable the existing nginx dependencies
   - Add Traefik as a new dependency

2. **Ingress Resources**:
   - Update all ingress resources with appropriate Traefik-specific annotations
   - Update ingressClassName references

3. **Values File**:
   - Add Traefik configuration section
   - Modify ingress-related configuration values
   - Ensure backward compatibility for users

4. **Ingress Configuration**:
   - Adapt existing NGINX-specific configurations (like proxy buffer sizes, SSL termination) to Traefik equivalents

5. **Default Backend**:
   - Address how the default backend is configured as Traefik handles this differently from NGINX

6. **IngressClass Resource**:
   - Replace NGINX IngressClass with Traefik

## Specific Changes Required

- Update Chart.yaml to include Traefik as a dependency
- Modify templates/_helpers.tpl to accommodate Traefik-specific functions
- Update ingress annotations in all ingress resources
- Reconfigure the wildcard ingress handling
- Ensure TLS configuration is appropriate for Traefik
- Update diagnostic templates for Traefik compatibility

## Considerations

- Maintain backward compatibility where possible
- Preserve all existing functionality while adapting to Traefik's architecture
- Ensure the security aspects are properly configured
- Update documentation to reflect the new ingress controller

This approach ensures a comprehensive transition from NGINX to Traefik while preserving the existing functionality and providing a smooth upgrade path for users.`,
			},
			currentContent: `subdomain: "localtest.me"
license: ""
# if enabled, all leeway for the license limits (seats, expiration, etc) will not
# be considered and the values defined by the license will be used
licenseHardLimits:
  enabled: false
## Custom resource configuration
crds:
  # -- Install and upgrade CRDs
  install: true
  # -- Keep CRDs on chart uninstall
  keep: true
  # -- Annotations to be added to all CRDs
  annotations: {}
cluster:
  endpoint: ""
theme:
  primary:
  seconday:
  logo:
globals:
  jobs:
    ttlSecondsAfterFinished: 86400 # 24h
  priorityClassName:
  nodeSelectors:
    okteto: {}
    dev: {}
  registry:
  tolerations:
    okteto: []
    dev: []
auth:
  google:
    enabled: false
    clientId: ""
    clientSecret: ""
    allowDomains: []
  github:
    enabled: false
    clientId: ""
    clientSecret: ""
    organization: ""
    allowList: []
  bitbucket:
    enabled: false
    clientId: ""
    clientSecret: ""
    workspace: ""
  openid:
    enabled: false
    clientId: ""
    clientSecret: ""
    endpoints:
      # Canonical URL of the openID provider, also used for configuration discovery.
      # This value MUST match the value returned in the provider config discovery.
      issuer: ""
      # Authorization URL of the openID provider.
      # This value MUST match the value returned in the provider config discovery.
      authorization: ""
    # Limits authentication to users that belong to the group (optinal)
    group: ""
    mapping:
      # The set claim is used as the external user id.
      externalIDKey: "nickname"
      # The set claim is used as the name of the user.
      nameKey: "name"
      # The set claim is used as the emai of the user.
      emailKey: "email"
      # The set claim is used as the picture of the user (optional).
      pictureKey: "picture"
      # The set claim is used as the groups of the user (optional).
      groupsKey: "groups"
  token:
    enabled: true
    # The token you can use to log in as an admin. It must have 40 characters. If empty, it will be automatically generated.
    adminToken: ""
internalCertificate:
  durationDays: 3650
wildcardCertificate:
  create: true
  name: default-ssl-certificate
  annotations: {}
  # if using a private CA, specify the name of the TLS secret that stores the certificate
  privateCA:
    enabled: false
    secret:
      name: "okteto-ca"
      key: "ca.crt"
cookie:
  hash:
  secret:
cloud:
  enabled: true
  secret:
    name: "okteto-cloud-secret"
    key: "key"
    token: "token"
  provider:
    aws:
      enabled: false
      region: "us-west-2"
      bucket:
      iam:
        enabled: true
        accessKeyID: ""
    digitalocean:
      enabled: false
      region: "SFO1"
      space:
        name:
        accessKeyID:
    gcp:
      enabled: false
      project: ""
      bucket:
      workloadIdentity:
        enabled: false
    azure:
      enabled: false
      storage:
        container: ""
        accountName: ""
pullPolicy: IfNotPresent
backend:
  image:
    repository: okteto/backend
    tag: 1.29.0-rc.2
  bin:
    image:
api:
  prometheus:
    enabled: false
  annotations: {}
  labels: {}
  extraEnv: []
  port: 8080
  replicaCount: 2
  resources:
    requests:
      cpu: 50m
      memory: 100Mi
    limits:
      memory: 800Mi
  priorityClassName:
webhook:
  hostNetwork: false
  annotations: {}
  labels: {}
  extraEnv: []
  replicaCount: 2
  port: 443
  internalCertificate:
    annotations: {}
  # timeout value must be between 1 and 30 seconds
  timeout: 30
  priorityClassName:
  resources:
    requests:
      cpu: 10m
      memory: 10Mi
frontend:
  annotations: {}
  labels: {}
  extraEnv: []
  image:
    repository: okteto/frontend
    tag: 1.29.0-rc.2
  replicaCount: 2
  port: 8080
  resources:
    requests:
      cpu: 10m
      memory: 10Mi
  priorityClassName:
buildkit:
  enabled: true
  annotations: {}
  tolerations: []
  nodeSelectors: {}
  labels: {}
  extraEnv: []
  image:
    repository: okteto/buildkit
    tag: 1.29.0-rc.2
  rootless:
    enabled: false
    image:
      repository: okteto/buildkit
      tag: 1.29.0-rc.2-rootless
  replicaCount: 1
  hpa:
    # Ref: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
    enabled: false
    min: 1
    max: 2
    cpu: 50
    behavior: {}
    metrics: []
  podManagementPolicy: OrderedReady
  ingress:
    enabled: true
    annotations:
      nginx.ingress.kubernetes.io/service-upstream: "true"
      nginx.ingress.kubernetes.io/proxy-body-size: "0"
      nginx.ingress.kubernetes.io/backend-protocol: "GRPCS"
      nginx.ingress.kubernetes.io/proxy-read-timeout: "1800"
      nginx.ingress.kubernetes.io/configuration-snippet: |
        grpc_intercept_errors off;
        grpc_buffer_size 64k;
      # If empty, okteto will default to the wildcard certificate
  service:
    type: ClusterIP
    sessionAffinity:
    loadBalancerIP:
    labels: {}
    annotations: {}
    port: 443
  network:
    mode: auto
  resources:
    requests:
      cpu: 1
      memory: 4Gi
  persistence:
    enabled: true
    class:
    size: 100Gi
    cacheRatio: 0.5
    accessModes: ["ReadWriteOnce"]
  serviceAccount:
    create: true
    name: okteto-buildkit
    annotations: {}
    labels: {}
  priorityClassName:
namespace:
  # Custom annotations added to okteto managed namespaces
  annotations: {}
  # Custom labels added to okteto managed namespaces
  labels: {}
  ingress:
    # Custom annotations added to ingresses created in okteto managed namespaces
    annotations: {}
    # Custom labels added to ingresses created in okteto managed namespaces.
    labels: {}
  autoRoleBinding:
    enabled: true
registry:
  annotations: {}
  labels: {}
  extraEnv: []
  enabled: true
  replicaCount: 1
  port: 5000
  pullPolicy: cluster
  priorityClassName:
  ingress:
    enabled: true
    annotations:
      nginx.ingress.kubernetes.io/proxy-body-size: "0"
      nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  service:
    type: ClusterIP
    sessionAffinity:
    loadBalancerIP:
  image:
    repository: okteto/registry
    tag: 1.29.0-rc.2
  log:
    level: info
    formatter: json
  secret:
    name: okteto-registry-secret
    accessKey: "accessKey"
    secretKey: "secretKey"
  storage:
    filesystem:
      enabled: true
      persistence:
        enabled: false
        claimName: ""
        accessMode: ReadWriteOnce
        storageClass: ""
        size: 40Gi
    provider:
      aws:
        enabled: false
        region: "us-west-2"
        bucket:
        iam:
          enabled: true
          accessKeyID: ""
      digitalocean:
        enabled: false
        region: "SFO1"
        space:
          name:
          accessKeyID:
      gcp:
        enabled: false
        project: ""
        bucket:
        workloadIdentity:
          enabled: false
      azure:
        enabled: false
        storage:
          container: ""
          accountName: ""
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
  serviceAccountName: ""
  serviceAccount:
    annotations: {}
  haShared: okteto
  gc:
    enabled: false
    annotations: {}
    labels: {}
    schedule: "@hourly"
    timeoutInSeconds: 3300
    metrics:
      enabled: false
      pushgatewayAddr:
gc:
  annotations: {}
  labels: {}
  enabled: true
  slackWebhook:
  schedule: "@hourly"
  timeoutInSeconds: 3300
  upSessionByLastSyncedFile: false
  priorityClassName:
# Enables a cron job to check and label if nodes are ready to receive new pods
nodeReadinessChecker:
  enabled: false
  schedule: "*/1 * * * *"
  # app.kubernetes.io/component label values of daemonset to check
  components:
    - daemon
  priorityClassName:
autoscaler:
  enabled: false
  annotations: {}
  labels: {}
  image: busybox
  replicaCount: 1
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
  slackWebhook:
  schedule: 300
  up: 0
  down: 0
  cpu:
    up: 60
    down: 40
  memory:
    up: 70
    down: 50
  pods:
    up: 90
    down: 80
  volumes:
    up: 90
    down: 80
  nodes:
    increment: 1
    min: 1
    max: 10
    poolLabel:
  priorityClassName:
migration:
  annotations: {}
  labels: {}
  enabled: true
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
  priorityClassName:
telemetry:
  enabled: true
  annotations: {}
  extraEnv: []
  labels: {}
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
  priorityClassName:
daemonset:
  enabled: true
  annotations: {}
  extraEnv: []
  labels: {}
  image:
    repository: okteto/daemon
    tag: 1.29.0-rc.2
  configurePrivateRegistriesInNodes:
    enabled: false
  resources:
    requests:
      cpu: 10m
      memory: 10Mi
  priorityClassName:
sshAgent:
  annotations: {}
  extraEnv: []
  labels: {}
  port: 3000
  priorityClassName:
  replicaCount: 2
  resources:
    requests:
      cpu: 10m
      memory: 10Mi
# Advanced Configuration Settings
serviceAccounts:
  # Custom annotations added to the service account created by okteto to every user
  annotations: {}
  # Custom labels added to service account created by okteto to every user
  labels: {}
  roleBindings:
    # Okteto will assing this cluster role to every member of namespace and admins via a namespace-scoped role binding within each namespace.
    namespaces: cluster-admin
    # Okteto will assing this cluster role to every user via a namespace-scoped role binding for global previews
    previews: view
  # Okteto will assing this cluster role to every user via a clusterrole binding.
  clusterRoleBinding: ""
  # Set of role bindings to the service account created by okteto to every user
  extraRoleBindings: {}
# Converts services with type LoadBalancer into ClusterIP and automatically create an ingress.
convertLoadBalancedServices:
  enabled: true
imagePullSecrets: []
secret:
  # A list of annotations to include in the secret created by the chart.
  annotations: {}
  # A list of labels to include in the secret created by the chart.
  labels: {}
# Annotations to add to all the deployed pods
podAnnotations: {}
# Labels to add to all the deployed pods
podLabels: {}
# A list of private registries and its corresponding credentials. The kubelet will use them when pulling images.
privateRegistry: {}
# Overrides the registry hostname resolution to use internal IPs. This requires permission to mount and modify the cluster nodes' /etc/hosts file.
overrideRegistryResolution:
  enabled: true
# Overrides the default kernel values for file watchers. Recommended if you're running databases, or if you plan on using "okteto up" on the cluster. This requires permission to mount and modify /proc values.
overrideFileWatchers:
  enabled: true
  # The maximum number of allowed inotify watchers.
  maxUserWatches: 10048576
  # The maximum number of memory map areas a process may have.
  maxMapCount: 262144
  # The maximum number of allowable concurrent IO requests.
  aioMaxNR: 1000000
tolerations:
  oktetoPool:
  buildPool:
  devPool:
affinity:
  required: false
  oktetoPool:
    preferredDuringSchedulingIgnoredDuringExecution:
      - preference:
          matchExpressions:
            - key: dev.okteto.com/overloaded
              operator: DoesNotExist
        weight: 50
  devPool:
  upPool:
  installerPool:
pullAlways:
  enabled: true
externalNames:
  enabled: true
autowake:
  enabled: true
networkPolicies:
  enabled: false
  ingress: []
  egress: []
  blockedCIDRs:
    - "169.254.169.254/32" # link-local address commonly used by cloud instances for metadata
ingressLimits:
  enabled: false
  connections: 40
  rps: 40
  rpm: 400
volumeSnapshots:
  enabled: false
  driver:
  class:
  storageClass:
  enableNamespaceAccessValidation: false
  allowIDAnnotation: true
# Force all dev PVCs (the ones created with okteto up command) to have the configured storageClass. If volumeSnapshots setting is enabled, cloned volumes from snapshot will have the storage class configured for that setting
devStorageClass:
  enabled: false
  storageClass:
quotas:
  resources:
    enabled: false
    maxNamespaces: "3"
    maxPods: "-1"
    maxServices: "-1"
    maxLoadBalancers: "0"
    maxNodePorts: "0"
    maxReplicationControllers: "-1"
    maxSecrets: "-1"
    maxConfigMaps: "-1"
    maxPVCs: "-1"
    maxVolumeSnapshots: "-1"
    maxIngresses: "-1"
    maxJobs: "-1"
    maxCronjobs: "-1"
  bandwidth:
    enabled: false
    ingress: "800M"
    egress: "800M"
    up:
      enabled: false
      ingress: "800M"
      egress: "800M"
  requests:
    enabled: false
    cpu: "1"
    memory: "2Gi"
    storage: "20Gi"
  limits:
    enabled: false
    cpu: "4"
    memory: "8Gi"
    storage: "20Gi"
  limitranges:
    max:
      enabled: false
      cpu: "3"
      memory: "12Gi"
    requests:
      enabled: true
      limitRequestRatio: 0
      cpu: "10m"
      memory: "50Mi"
    limits:
      enabled: true
      cpu: "2"
      memory: "8Gi"
ingress:
  annotations: {}
  # IngressClass used for ingresses created by the okteto installation. By default it's the default ingress class in the cluster
  oktetoIngressClass: okteto-controlplane-nginx
  # Okteto will set this as the value of the IngressClass for all the ingress resources managed by okteto. Leave  empty to fallback on your cluster's default ingress class.
  class:
  # If enabled, all ingresses deployed in namespaces managed by Okteto will have the ingress class defined in ` + "`ingress.class`" + `.
  forceIngressClass: false
  # If enabled, all ingresses deployed in namespaces managed by Okteto must match the okteto wildcard subdomain
  forceIngressSubdomain: false
  # If using an ingress not managed by okteto, this option lets you configure the traffic to the Okteto API/Registry using the internal network
  ip: ""
# Dependencies
ingress-nginx:
  enabled: true
  controller:
    # TODO @jpf-okteto: enableAnnotationValidations
    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/pkg/flags/flags.go#L161
    # This property was ` + "`false`" + ` in v1.11.2 (4.11.2)
    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/pkg/flags/flags.go#L162
    # It switched to ` + "`true`" + ` in v1.12.0 (4.12.0)
    enableAnnotationValidations: false
    image:
      chroot: true
      registry: docker.io
      image: okteto/ingress-nginx
      tag: 1.29.0-rc.2
      digestChroot: ""
    allowSnippetAnnotations: true
    admissionWebhooks:
      enabled: false
      namespaceSelector:
        matchLabels:
          dev.okteto.com: "true"
    replicaCount: 2
    affinity:
      nodeAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - preference:
              matchExpressions:
                - key: dev.okteto.com/overloaded
                  operator: DoesNotExist
            weight: 50
      podAntiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                  - key: app.kubernetes.io/component
                    operator: In
                    values:
                      - controller
                  - key: app.kubernetes.io/name
                    operator: In
                    values:
                      - ingress-nginx
              topologyKey: kubernetes.io/hostname
    config:
      # The private endpoints requires "location" and "proxy_pass" in a server-snippet, so this parameter must have a value and not include neither "location" nor "proxy_pass". To use other options, they must be removed from list.
      annotation-value-word-blocklist: load_module,lua_package,_by_lua,root,serviceaccount
      log-format-escape-json: "true"
      log-format-upstream: '{"time": "$time_iso8601", "remote_addr": "$remote_addr", "x_forward_for": "$proxy_add_x_forwarded_for", "request_id": "$req_id", "remote_user": "$remote_user", "bytes_sent": $bytes_sent, "request_time": $request_time, "status": $status, "vhost": "$host", "request_proto": "$server_protocol", "path": "$uri", "request_query": "$args", "request_length": $request_length, "duration": $request_time,"method": "$request_method", "http_referrer": "$http_referer", "http_user_agent": "$http_user_agent" }'
      ignore-invalid-headers: "false"
      enable-underscores-in-headers: "true"
      proxy-buffer-size: 64K
      # TODO @jpf-okteto: allow-cross-namespace-resources
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/internal/ingress/controller/config/config.go#L784
      # This property was ` + "`true`" + ` in v1.11.2 (4.11.2)
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/internal/ingress/controller/config/config.go#L754
      # It switched to ` + "`false`" + ` in v1.12.0 (4.12.0)
      allow-cross-namespace-resources: "true"
      # TODO @jpf-okteto: strict-validate-path-type
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/internal/ingress/controller/config/config.go#L932
      # This property was ` + "`false`" + ` in v1.11.2 (4.11.2)
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/internal/ingress/controller/config/config.go#L897
      # It switched to ` + "`true`" + ` in v1.12.0 (4.12.0)
      strict-validate-path-type: "false"
      annotations-risk-level: Critical
      ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:AES128-GCM-SHA256:AES128-GCM-SHA384"
    extraArgs:
      default-ssl-certificate: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned
      default-backend-service: $(POD_NAMESPACE)/$(OKTETO_INGRESS_NGINX_DEFAULT_BACKEND)
    service:
      externalTrafficPolicy: Local
      type: LoadBalancer
    ingressClass: okteto-controlplane-nginx
    ingressClassResource:
      name: okteto-controlplane-nginx
      enabled: true
      default: false
      controllerValue: "k8s.io/okteto-controlplane-nginx"
    extraEnvs:
      - name: OKTETO_INGRESS_NGINX_DEFAULT_BACKEND
        valueFrom:
          configMapKeyRef:
            key: defaultbackendservice
            name: okteto-ingress-config
    priorityClassName:
  defaultBackend:
    enabled: false
okteto-nginx:
  enabled: true
  controller:
    # TODO @jpf-okteto: enableAnnotationValidations
    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/pkg/flags/flags.go#L161
    # This property was ` + "`false`" + ` in v1.11.2 (4.11.2)
    # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/pkg/flags/flags.go#L162
    # It switched to ` + "`true`" + ` in v1.12.0 (4.12.0)
    enableAnnotationValidations: false
    image:
      chroot: true
      registry: docker.io
      image: okteto/ingress-nginx
      tag: 1.29.0-rc.2
      digestChroot: ""
    allowSnippetAnnotations: true
    enableHttp: false
    admissionWebhooks:
      enabled: false
      namespaceSelector:
        matchLabels:
          dev.okteto.com: "true"
    replicaCount: 2
    affinity:
      nodeAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - preference:
              matchExpressions:
                - key: dev.okteto.com/overloaded
                  operator: DoesNotExist
            weight: 50
      podAntiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                  - key: app.kubernetes.io/component
                    operator: In
                    values:
                      - controller
                  - key: app.kubernetes.io/name
                    operator: In
                    values:
                      - okteto-nginx
              topologyKey: kubernetes.io/hostname
    config:
      # The private endpoints requires "location" and "proxy_pass" in a server-snippet, so this parameter must have a value and not include neither "location" nor "proxy_pass". To use other options, they must be removed from list.
      annotation-value-word-blocklist: load_module,lua_package,_by_lua,root,serviceaccount
      log-format-escape-json: "true"
      log-format-upstream: '{"time": "$time_iso8601", "remote_addr": "$remote_addr", "x_forward_for": "$proxy_add_x_forwarded_for", "request_id": "$req_id", "remote_user": "$remote_user", "bytes_sent": $bytes_sent, "request_time": $request_time, "status": $status, "vhost": "$host", "request_proto": "$server_protocol", "path": "$uri", "request_query": "$args", "request_length": $request_length, "duration": $request_time,"method": "$request_method", "http_referrer": "$http_referer", "http_user_agent": "$http_user_agent" }'
      ignore-invalid-headers: "false"
      enable-underscores-in-headers: "true"
      proxy-buffer-size: 64K
      annotations-risk-level: Critical
      # TODO @jpf-okteto: allow-cross-namespace-resources
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/internal/ingress/controller/config/config.go#L784
      # This property was ` + "`true`" + ` in v1.11.2 (4.11.2)
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/internal/ingress/controller/config/config.go#L754
      # It switched to ` + "`false`" + ` in v1.12.0 (4.12.0)
      allow-cross-namespace-resources: "true"
      # TODO @jpf-okteto: strict-validate-path-type
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.11.2/internal/ingress/controller/config/config.go#L932
      # This property was ` + "`false`" + ` in v1.11.2 (4.11.2)
      # https://github.com/kubernetes/ingress-nginx/blob/controller-v1.12.0/internal/ingress/controller/config/config.go#L897
      # It switched to true in v1.12.0 (4.12.0)
      strict-validate-path-type: "false"
    service:
      type: ClusterIP
    ingressClass: okteto-nginx
    ingressClassResource:
      name: okteto-nginx
      enabled: true
      default: false
      controllerValue: "k8s.io/okteto-ingress-nginx"
    extraArgs:
      default-backend-service: $(POD_NAMESPACE)/$(OKTETO_INGRESS_NGINX_DEFAULT_BACKEND)
    extraEnvs:
      - name: OKTETO_INGRESS_NGINX_DEFAULT_BACKEND
        valueFrom:
          configMapKeyRef:
            key: defaultbackendservice
            name: okteto-ingress-config
    priorityClassName:
  defaultBackend:
    enabled: false
# Redis is a dependency of the Resource Manager (installed when resourceManager.enabled is true)
redis:
  # TODO @jpf-okteto
  # bitnami/charts redis 20.0.2 defaults to bitnami/containers redis 7.4.0-debian-12-r1
  # https://github.com/bitnami/charts/commit/582b058c032a83ad74eed87c9e9665ca4252f0ce#diff-5063c6dcbc478573073c2f1b280610c29b86379ce92e6dc3ce04b51eeb0c8fd6R105
  # bitnami/container history for redis 7.4 debian-12
  # https://github.com/bitnami/containers/commits/main/bitnami/redis/7.4/debian-12
  # bitnami/container diff between 7.4.0-debian-12-r1 and 7.4.2-debian-12-r0:
  # - 7.4.0-debian-12-r1: f061348b27a96953c3f1b2122d974c6e48ec631b
  # - 7.4.2-debian-12-r0: db3c7a09741909259bc18ca6797bc1991d8298c6
  # commands:
  # - cd $(mktemp)
  # - git clone https://github.com/bitnami/containers
  # - cd containers
  # - git diff f061348b27a96953c3f1b2122d974c6e48ec631b...db3c7a09741909259bc18ca6797bc1991d8298c6 -- bitnami/redis
  image:
    tag: 1.29.0-rc.2 # fixes CVE-2024-31449 & CVE-2024-46981
    repository: okteto/redis
  global:
    security:
      allowInsecureImages: true
  auth:
    enabled: false
  architecture: standalone
  master:
    persistence:
      enabled: false
    disableCommands: []
    resources:
      requests:
        cpu: 100m
        memory: 128M
defaultBackend:
  enabled: true
  priorityClassName:
  labels: {}
  annotations: {}
  extraEnvs: []
  resources: {}
  tolerations: []
  nodeSelector:
    kubernetes.io/os: linux
  image:
    repository: okteto/backend
    tag: 1.29.0-rc.2
  replicaCount: 2
  port: 8080
debugServer:
  enabled: false
store:
  personalAccessToken:
    max: 5
  provider:
    k8s:
      enabled: true
    gcp:
      enabled: false
cli:
  image:
    registry: ""
    repository: okteto/okteto
# Specific config for the installer
installer:
  annotations: {}
  labels: {}
  extraEnv: []
  runner:
    repository: okteto/pipeline-runner
    tag: 1.29.0-rc.2
  # user to be used when cloning git repos using ssh
  gitSSHUser: git
  sshSecretName: "okteto-ssh"
  securityContext:
  # Maximum duration of git pipeline jobs in seconds
  activeDeadlineSeconds: 1800
  resources:
    requests:
      cpu: 10m
      memory: 50Mi
  priorityClassName:
# Enable a cron to detect git, stack and helm stucked deploys
installerChecker:
  enabled: true
  schedule: "*/5 * * * *"
  priorityClassName:
# Specific config for github integration
github:
  enabled: false
# Specific termination grace period
maxTerminationGracePeriodSeconds:
  enabled: false
  limit: 30
# If you want to add the affinity to the pods for same user
userPodAffinity:
  enabled: true
  antiAffinity:
    enabled: false
reloader:
  reloader:
    enabled: true
    watchGlobally: false
    ignoreConfigMaps: true
    serviceAccount:
      create: true
      name: reloader
    deployment:
      resources:
        requests:
          cpu: 10m
          memory: 10Mi
      image:
        name: okteto/reloader
        tag: 1.29.0-rc.2
# Configuration related to Volumes
volumes:
  # Configuration related to PVCs validation
  validate:
    enabled: false
    # List of allowed storage classes
    supportedStorageClasses: []
    # Indicates if a valid storage class has to be enforced in case an invalid storage class is specified. The enforced value will be the first element on volumes.validate.supportedStorageClasses
    forceStorageClass: false
    # List of supported access modes for PVCs
    supportedAccessModes: []
# Flag to specify if the admin is automatically assigned to the first registered user in the Okteto instance or not
autoAdmin:
  enabled: true
# Disable if you want to enforce using the username as a suffix on namespaces and ingress hosts. Enabled by default.
userDefinedNamespaces: true
# Enable Destroy All for namespaces
namespaceDestroyAll:
  priorityClassName:
  checker:
    schedule: "*/3 * * * *"
    timeoutInSeconds: 120 # 2 mins
    priorityClassName:
# Feature to configure the daemonset to check if CNI pods are healthy or not. Available since okteto/daemon:0.0.7 version
checkCNIPodHealth:
  enabled: false
  restartCountThreshold: 3
  backOffIntervalInMinutes: 1
  slackWebhook:
virtualServices:
  enabled: false
openshift:
  enabled: false
namespaceDevLabelValue: "true"
privateEndpoints:
  port: 8080
  resources: {}
  replicaCount: 1
  clientID:
  clientSecret:
  annotations: {}
  priorityClassName:
kubetoken:
  lifetimeSeconds: 86400
insights:
  enabled: false
  bearerSecret:
    name: okteto-insights
    key: bearer
  buildkitExporter:
    extraEnv: []
  eventsExporter:
    priorityClassName:
    podLabels: {}
    podAnnotations: {}
    resources:
      requests:
        cpu: 50m
        memory: 20Mi
      limits:
        memory: 100Mi
  metrics:
    schedule: "*/5 * * * *"
    priorityClassName:
    labels: {}
    annotations: {}
    resources: {}
clusterMetrics:
  priorityClassName:
  labels: {}
  annotations: {}
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
periodicMetrics:
  priorityClassName:
  labels: {}
  annotations: {}
  resources:
    requests:
      cpu: 10m
      memory: 100Mi
oktetoBotUser: "okteto-bot"
regcredsManager:
  priorityClassName:
  pullSecrets:
    enabled: true
  debug: false
  internalCertificate:
    annotations: {}
  podLabels: {}
  podAnnotations: {}
  webhookTimeout: 30
  replicas: 2
  resources:
    requests:
      cpu: 50m
      memory: 100Mi
    limits:
      memory: 800Mi
resourceManager:
  enabled: true
  schedule: "*/5 * * * *"
  deletePeriodDays: 15
  recommendations:
    weight: 0.9
    correction: 1.1
    min:
      cpu: 5m
      memory: 10Mi
  priorityClassName:
  labels: {}
  annotations: {}
  resources: {}
oidc:
  strictIssuerCheck:
    enabled: true
okta:
  events:
    enabled: false
    authSecret: ""
# Experimental
unsupported:
  installationBoard:
    enabled: true
  ingressProxyBodySize: "60M"
  injectDockerconfigInGitDeploys: true
  autoSetDefaultLimits: false
  showVolumes: true
  forcePodsInVolumeZone: true
  forceNodeToPodsWithSamePVCs: true
  ingressReloadDelay: 0
  webhook:
    skipNsAnnotationIfNoChanges: false
  defaultPlan: enterprise
  opentracing:
    enabled: false
    agent:
      host:
      port:
    sampler:
      type: const
      param: 1
  metricserverRbac:
    enabled: false
  staticIPs: false
  scaleDownPersistentResources: false
  metrics:
    enabled: false
    url:
    headers: {}
    events: {}
  allowDaemonsetsForUsers: false
  disableSystemEvents: false
  kubeclient: {}
  allowDevPushToGlobalRegistry:
    enabled: true
  externalIdMapping:
    enabled: false
  emulatePodSecurityPolicies:
    enabled: false
  sleepingIngressClass:
    enabled: false
    name: okteto-sleeping
  restrictGroupUserRoleBindings: false
  externalEndpoints: []
  grafana:
    enabled: false
    endpoint:
  frontend:
    sentry:
      enabled: false
      dsn:
      env: ""`,
		},
	}

	if err := param.Init(nil); err != nil {
		t.Fatalf("failed to initialize param: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Use buffered channel to prevent blocking when ExecuteAction sends interim content
			patchStreamCh := make(chan string, 100)
			
			// Drain the channel in a goroutine to prevent blocking
			go func() {
				for range patchStreamCh {
					// Discard interim updates in tests
				}
			}()
			
			got, err := ExecuteAction(ctx, tt.actionPlanWithPath, tt.plan, tt.currentContent, patchStreamCh)
			close(patchStreamCh) // Signal goroutine to exit
			
			if (err != nil) != tt.wantErr {
				t.Errorf("ExecuteAction() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			fmt.Printf("got: %s\n", got)
		})
	}
}
