# Contributing

This doc is a guide for how engineers at Replicated contribute to this project.

## Development Environment Setup

### Prerequisites

- macOS
- Docker Desktop
- Go 1.24 or later
- Node.js 18
- npm
- [Schemahero](https://schemahero.io/docs/installation/) (but rename the binary to schemahero and put on path)

### Required Secrets

Before starting, ensure you have the following secrets configured locally on your mac:

- `ANTHROPIC_API_KEY`: Get your own key
- `GROQ_API_KEY`: Get your own key
- `VOYAGE_API_KEY`: Get your own key
- `CHARTSMITH_PG_URI=postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable`
- `CHARTSMITH_CENTRIFUGO_ADDRESS=http://localhost:8000/api`
- `CHARTSMITH_CENTRIFUGO_API_KEY=api_key`
- `CHARTSMITH_TOKEN_ENCRYPTION=`
- `CHARTSMITH_SLACK_TOKEN=`
- `CHARTSMITH_SLACK_CHANNEL=`

You should also create a .env.local file in the chartsmith-app directory with some of the same content:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google
GOOGLE_CLIENT_SECRET=<get from 1password>
DB_URI=postgresql://postgres:password@localhost:5432/chartsmith?connect_timeout=10&application_name=chartsmith&sslmode=disable
HMAC_SECRET=not-secure
CENTRIFUGO_TOKEN_HMAC_SECRET=change.me
NEXT_PUBLIC_CENTRIFUGO_ADDRESS=ws://localhost:8000/connection/websocket
TOKEN_ENCRYPTION=H5984PaaBSbFZTMKjHiqshqRCG4dg49JAs0dDdLbvEs=
NEXT_PUBLIC_REPLICATED_REDIRECT_URI=https://vendor-web-<youruser>.okteto.repldev.com/chartsmith-login?redirect_uri=https://chartsmith-app-<youruser>.okteto.repldev.com/auth/replicated
ANTHROPIC_API_KEY=
NEXT_PUBLIC_ENABLE_TEST_AUTH=true
ENABLE_TEST_AUTH=true

```

### Setup Steps

1. **Start the Development Environment**

   ```bash
   cd hack/chartsmith-dev
   docker compose up -d
   ```

2. **Open Four Terminal Windows**

   You'll need to run multiple services simultaneously. Open four separate terminal windows and navigate to the project root in each.

3. **Terminal 1: Frontend Development**
   ```bash
   cd chartsmith-app
   npm install
   npm run dev
   ```
   This starts the frontend development server.

4. **Terminal 2: Backend Worker**
   ```bash
   make run-worker
   ```
   This runs the backend worker service.

5. **Terminal 3: Database Schema**
   ```bash
   make schema
   ```
   This deploys the Schemahero migrations to set up the database schema.

6. **Terminal 4: Claude Integration**
   ```bash
   # Use Claude for development assistance
   ```

### Additional Commands

- To rebuild the worker:
  ```bash
  make run-worker
  ```


### Troubleshooting

If you encounter any issues:

1. Ensure Docker is running and all containers are up
2. Verify all required secrets are properly configured
3. Check that Schemahero is installed and accessible in your PATH
4. Make sure all dependencies are installed (both Go and npm packages)

### Development Workflow

1. Make changes to the code
2. The frontend will automatically reload with changes
3. The worker will need to be restarted if you make backend changes
4. Use Claude for code assistance and development guidance

### Notes

- The development environment uses PostgreSQL running in Docker
- Schemahero is used for database migrations
- The frontend runs on the default Next.js port
- The worker runs on a separate process

## Release

All releases are automated using various Dagger functions.


The validate function will run all the tests and linting checks.

```
make release version=[patch|minor|major]
```

The release function will create a new release tag and push all container images to the appropriate registries and the K8s manifests to gitops repo.
