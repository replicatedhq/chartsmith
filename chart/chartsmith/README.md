# chartsmith

Chartsmith is an AI-powered tool that helps you build better Helm charts.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.8.0+
- PV provisioner support in the underlying infrastructure
- An Anthropic API key for AI features
- (Optional) Google OAuth credentials for authentication

## Install Chart

```console
# Create namespace
kubectl create namespace chartsmith

# Install with minimal configuration
helm install [RELEASE_NAME] oci://ghcr.io/replicatedhq/charts/chartsmith \
  --namespace chartsmith \
  --set anthropic.apiKey="your-api-key" \
  --set hmac.secret="$(openssl rand -hex 32)" \
  --set centrifugo.tokenHmacSecret.value="$(openssl rand -hex 32)"
```

_See [configuration](#configuration) below._

_See [helm install](https://helm.sh/docs/helm/helm_install/) for command documentation._

## Uninstall Chart

```console
helm uninstall [RELEASE_NAME] --namespace chartsmith
```

This removes all the Kubernetes components associated with the chart and deletes the release.

_See [helm uninstall](https://helm.sh/docs/helm/helm_uninstall/) for command documentation._

## Upgrading Chart

```console
helm upgrade [RELEASE_NAME] oci://ghcr.io/replicatedhq/charts/chartsmith \
  --namespace chartsmith \
  --reuse-values
```

_See [helm upgrade](https://helm.sh/docs/helm/helm_upgrade/) for command documentation._

## Configuration

See [Customizing the Chart Before Installing](https://helm.sh/docs/intro/using_helm/#customizing-the-chart-before-installing). To see all configurable options with detailed comments:

```console
helm show values oci://ghcr.io/replicatedhq/charts/chartsmith
```

### Required Values

The following values must be provided for the chart to function:

```yaml
# Anthropic API key for AI features
anthropic:
  apiKey: "sk-ant-..."  # Required

# HMAC secret for JWT tokens (generate with: openssl rand -hex 32)
hmac:
  secret: "..."  # Required

# Centrifugo token HMAC secret (generate with: openssl rand -hex 32)
centrifugo:
  tokenHmacSecret:
    value: "..."  # Required
```

### Common Configuration Examples

#### Enable Google OAuth Authentication

```yaml
auth:
  google:
    clientId: "your-client-id.apps.googleusercontent.com"
    clientSecret: "your-client-secret"

config:
  googleRedirectUri: "https://chartsmith.example.com/auth/google"
```

#### Use External PostgreSQL Database

```yaml
postgresql:
  enabled: false
  externalUri: "postgres://user:password@host:5432/database?sslmode=require"
```

Note: External PostgreSQL must have the pgvector extension installed.

#### Enable Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: chartsmith.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: chartsmith-tls
      hosts:
        - chartsmith.example.com

config:
  apiEndpoint: "https://chartsmith.example.com/api"
  centrifugoAddress: "wss://chartsmith.example.com/centrifugo/connection"
```

#### Development Mode (No Authentication)

```yaml
auth:
  required: false
  enableTestAuth: true
```

**Warning:** Never use this configuration in production.

### Using Existing Secrets

Instead of passing sensitive values directly, you can reference existing Kubernetes secrets, with an optional custom key:

```yaml
anthropic:
  existingSecret: chartsmith-secrets
  existingSecretKey: ANTHROPIC_API_KEY

hmac:
  existingSecret: chartsmith-secrets
  existingSecretKey: HMAC_SECRET

auth:
  google:
    existingSecret: chartsmith-secrets
    existingSecretClientIdKey: my-google-client-id
    existingSecretClientSecretKey: GOOGLE_CLIENT_SECRET
```

Create the secret:

```console
kubectl create secret generic chartsmith-secrets \
  --namespace chartsmith \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-..." \
  --from-literal=HMAC_SECRET="$(openssl rand -hex 32)" \
  --from-literal=GOOGLE_CLIENT_ID="your-client-id" \
  --from-literal=GOOGLE_CLIENT_SECRET="your-client-secret"
```

## Dependencies

By default this chart installs additional, dependent charts:

- PostgreSQL with pgvector extension (can be disabled)

To disable PostgreSQL and use an external database:

```yaml
postgresql:
  enabled: false
  externalUri: "postgres://..."
```

## Source Code

* <https://github.com/replicatedhq/chartsmith>

## Requirements

Kubernetes: `>=1.19.0-0`

## Support

For issues, questions, or contributions, please use [GitHub Issues](https://github.com/replicatedhq/chartsmith/issues).
