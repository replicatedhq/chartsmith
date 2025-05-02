# Chartsmith

Build Better Helm Charts

## Overview

Chartsmith is an AI-powered tool that helps you build better Helm charts.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup instructions.

## Authentication

### Extension Authentication

The VS Code extension authenticates using a token-based mechanism:

1. When a user clicks "Login" in the extension, it opens a browser window to the authentication page
2. After successful authentication, the app generates an extension token and sends it to the extension
3. The extension stores this token and uses it for API requests with a Bearer token header
4. Token validation happens via the `/api/auth/status` endpoint

