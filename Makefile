WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

# Read versions from VERSION file
CHART_VERSION=$(shell grep CHART_VERSION VERSION | cut -d= -f2)
REPLICATED_VERSION=$(shell grep REPLICATED_VERSION VERSION | cut -d= -f2)

# =============================================================================
# REQUIRED ENVIRONMENT VARIABLES (must be exported by the user)
# =============================================================================
# The following variables MUST be exported before running commands like:
# - make run-worker
# - make bootstrap
# - make run-debug-console
#
# Required variables:
#   - LLM_PROVIDER - anthropic (default) or fireworks
#   - LLM_MODEL - provider model identifier
#   - ANTHROPIC_API_KEY or FIREWORKS_API_KEY - key for the selected provider
#   - CHARTSMITH_PG_URI - PostgreSQL connection string
#   - CHARTSMITH_CENTRIFUGO_ADDRESS - Centrifugo service address
#   - CHARTSMITH_CENTRIFUGO_API_KEY - API key for Centrifugo
# Optional authentication variables:
#   - GOOGLE_CLIENT_ID - Google OAuth client ID
#   - GOOGLE_CLIENT_SECRET - Google OAuth client secret
#
# Example:
#   export LLM_PROVIDER=anthropic
#   export LLM_MODEL=claude-sonnet-5
#   export ANTHROPIC_API_KEY=your-key
#   export CHARTSMITH_PG_URI=postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable
#   export CHARTSMITH_CENTRIFUGO_ADDRESS=http://localhost:8000/api
#   export CHARTSMITH_CENTRIFUGO_API_KEY=api_key
#   export GOOGLE_CLIENT_ID=your-id
#   export GOOGLE_CLIENT_SECRET=your-secret
#   make run-worker
# =============================================================================

# Environment variables checker helper function
define check_env_var
	@if [ -z "$(shell printenv $(1))" ]; then \
		echo "Error: $(1) environment variable is not set"; \
		echo "Please set this in your shell environment:"; \
		echo "  export $(1)='your-$(1)-value'"; \
		echo ""; \
		echo "See CONTRIBUTING.md for more information about required environment variables."; \
		exit 1; \
	fi
endef

# Check required environment variables
.PHONY: check-env
check-env:
	@if [ "$${LLM_PROVIDER:-anthropic}" = "fireworks" ]; then \
		if [ -z "$$FIREWORKS_API_KEY" ]; then echo "Error: FIREWORKS_API_KEY environment variable is not set"; exit 1; fi; \
	else \
		if [ -z "$$ANTHROPIC_API_KEY" ]; then echo "Error: ANTHROPIC_API_KEY environment variable is not set"; exit 1; fi; \
	fi
	$(call check_env_var,CHARTSMITH_PG_URI)
	$(call check_env_var,CHARTSMITH_CENTRIFUGO_ADDRESS)
	$(call check_env_var,CHARTSMITH_CENTRIFUGO_API_KEY)
	@echo "All required environment variables are set"

# =============================================================================
# DATABASE COMMANDS
# =============================================================================

.PHONY: pgvector
pgvector:
	@echo "Ensuring pgvector extension is enabled..."
	@PG_CONTAINER=$$(docker ps --format '{{.Names}}' | grep postgres | head -n1); \
	if [ -z "$$PG_CONTAINER" ]; then \
		echo "Error: No running Postgres container found"; \
		echo "Make sure to start the development environment first:"; \
		echo "  cd hack/chartsmith-dev && docker compose up -d"; \
		exit 1; \
	fi; \
	echo "Using Postgres container: $$PG_CONTAINER"; \
	docker exec -i $$PG_CONTAINER psql -U postgres -d chartsmith -c "CREATE EXTENSION IF NOT EXISTS vector;"; \
	echo "PGVector extension enabled"

.PHONY: schema
schema: pgvector
	@echo "Running schema commands..."
	rm -rf ./db/generated-schema

	mkdir -p ./db/generated-schema/extensions
	schemahero plan --driver postgres --uri $(CHARTSMITH_PG_URI) --spec-file ./db/schema/extensions --spec-type extension --out ./db/generated-schema/extensions
	schemahero apply --driver postgres --uri $(CHARTSMITH_PG_URI) --ddl ./db/generated-schema/extensions

	mkdir -p ./db/generated-schema/tables
	schemahero plan --driver postgres --uri "$(CHARTSMITH_PG_URI)" --spec-file ./db/schema/tables --spec-type table --out ./db/generated-schema/tables
	schemahero apply --driver postgres --uri "$(CHARTSMITH_PG_URI)" --ddl ./db/generated-schema/tables

# =============================================================================
# DEVELOPMENT COMMANDS
# =============================================================================

.PHONY: build
build:
	@echo "Building $(WORKER_BINARY_NAME)..."
	@mkdir -p $(WORKER_BUILD_DIR)
	@go build -o $(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) main.go

# Requires the API key for the selected LLM provider.
.PHONY: run-worker
run-worker: build
	@echo "Running $(WORKER_BINARY_NAME) with environment variables from shell..."
	./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) run --

.PHONY: bootstrap
bootstrap: build
	@echo "Bootstrapping chart..."
	./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) bootstrap \
		--force

.PHONY: test-data
test-data: build
	rm -rf ./testdata/gen-data
	mkdir -p ./testdata/gen-data
	@echo "Generating test data..."
	./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) test-data

.PHONY: integration-test
integration-test: build
	@echo "Generating schema for integration tests..."
	rm -rf ./testdata/schema.sql
	schemahero fixtures --dbname test-db --driver postgres --input-dir ./db/schema/tables --output-dir ./testdata
	mv ./testdata/fixtures.sql ./testdata/02-fixtures.sql
	@echo "Running integration tests..."
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) integration

# =============================================================================
# CI/CD AND DEPLOYMENT COMMANDS
# =============================================================================

.PHONY: validate
validate: validate-schema test

.PHONY: validate-schema
validate-schema:
	@tmp_file=$$(mktemp); \
	trap 'rm -f "$$tmp_file"' EXIT; \
	./scripts/render-migrations.sh "$$tmp_file"; \
	test -s "$$tmp_file"; \
	echo "Schema migrations rendered successfully"

.PHONY: test
test: test-worker test-app

.PHONY: test-worker
test-worker:
	go test ./...

.PHONY: test-app
test-app:
	cd chartsmith-app && npm ci && npm run test:unit && npm run build

.PHONY: render-migrations
render-migrations:
	./scripts/render-migrations.sh "$(if $(output),$(output),-)"

.PHONY: build-images
build-images:
	./scripts/build-images.sh "$(version)"

.PHONY: okteto-dev
okteto-dev:
	@go mod download -x
	@make build
	@printf "\n\n To build and run this project, run: \n\n   # make run-worker\n   # make run-debug-console\n\n"

# Requires the API key for the selected LLM provider.
.PHONY: run-debug-console
run-debug-console:
	@echo "Running debug console with environment variables from shell..."
	@# We set DB_URI to maintain compatibility with existing code
	export DB_URI=$(CHARTSMITH_PG_URI) && go run main.go debug-console

# Requires: GITHUB_TOKEN, OP_SERVICE_ACCOUNT_PRODUCTION, and the release CLIs
.PHONY: release
release:
	./scripts/release.sh --version "$(version)"

# Check replicated CLI is installed and meets minimum version requirement
.PHONY: check-replicated-cli
check-replicated-cli:
	@echo "Checking for replicated CLI..."
	@if ! command -v replicated >/dev/null 2>&1; then \
		echo "Error: replicated CLI is not installed"; \
		echo "Please install it from: https://docs.replicated.com/reference/replicated-cli-installing"; \
		exit 1; \
	fi
	@echo "Checking replicated CLI version..."
	@REPLICATED_VERSION=$$(replicated version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1); \
	if [ -z "$$REPLICATED_VERSION" ]; then \
		echo "Error: Could not determine replicated CLI version"; \
		exit 1; \
	fi; \
	echo "Found replicated CLI version: $$REPLICATED_VERSION"; \
	MAJOR=$$(echo $$REPLICATED_VERSION | cut -d. -f1); \
	MINOR=$$(echo $$REPLICATED_VERSION | cut -d. -f2); \
	PATCH=$$(echo $$REPLICATED_VERSION | cut -d. -f3); \
	MIN_MAJOR=0; MIN_MINOR=124; MIN_PATCH=0; \
	if [ $$MAJOR -lt $$MIN_MAJOR ] || \
	   ([ $$MAJOR -eq $$MIN_MAJOR ] && [ $$MINOR -lt $$MIN_MINOR ]) || \
	   ([ $$MAJOR -eq $$MIN_MAJOR ] && [ $$MINOR -eq $$MIN_MINOR ] && [ $$PATCH -lt $$MIN_PATCH ]); then \
		echo "Error: replicated CLI version $$REPLICATED_VERSION is below minimum required version 0.124.0"; \
		echo "Please update your replicated CLI: https://docs.replicated.com/reference/replicated-cli-installing"; \
		exit 1; \
	fi; \
	echo "replicated CLI version check passed (>=0.124.0)"

# Bump the Replicated release and chart versions together. The Helm appVersion is
# the Chartsmith container version and is intentionally managed separately.
.PHONY: bump-replicated-patch
bump-replicated-patch:
	@CHART_VERSION=$$(grep '^CHART_VERSION=' VERSION | cut -d= -f2); \
	REPLICATED_VERSION=$$(grep '^REPLICATED_VERSION=' VERSION | cut -d= -f2); \
	if [ "$$CHART_VERSION" != "$$REPLICATED_VERSION" ]; then \
		echo "Error: CHART_VERSION ($$CHART_VERSION) and REPLICATED_VERSION ($$REPLICATED_VERSION) must match"; \
		exit 1; \
	fi; \
	if ! echo "$$CHART_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: version $$CHART_VERSION is not a semantic version in x.y.z format"; \
		exit 1; \
	fi; \
	MAJOR=$$(echo "$$CHART_VERSION" | cut -d. -f1); \
	MINOR=$$(echo "$$CHART_VERSION" | cut -d. -f2); \
	PATCH=$$(echo "$$CHART_VERSION" | cut -d. -f3); \
	NEXT_VERSION="$$MAJOR.$$MINOR.$$((PATCH + 1))"; \
	sed -i.bak "s/^CHART_VERSION=.*/CHART_VERSION=$$NEXT_VERSION/" VERSION && rm VERSION.bak; \
	sed -i.bak "s/^REPLICATED_VERSION=.*/REPLICATED_VERSION=$$NEXT_VERSION/" VERSION && rm VERSION.bak; \
	sed -i.bak "s/^version:.*/version: $$NEXT_VERSION/" chart/chartsmith/Chart.yaml && rm chart/chartsmith/Chart.yaml.bak; \
	sed -i.bak "s/chartVersion:.*/chartVersion: $$NEXT_VERSION/" replicated/helmchart.yaml && rm replicated/helmchart.yaml.bak; \
	echo "Bumped Replicated release and chart version: $$CHART_VERSION -> $$NEXT_VERSION"

.PHONY: prepare-replicated-release
prepare-replicated-release: check-replicated-cli
	@$(MAKE) --no-print-directory bump-replicated-patch

# Create one versioned release and initially promote it to Unstable.
.PHONY: release-replicated
release-replicated: prepare-replicated-release
	@echo "Using versions from VERSION file:"
	@echo "  Chart Version: $(CHART_VERSION)"
	@echo "  Replicated Release Version: $(REPLICATED_VERSION)"
	@echo "Verifying 'chartsmith' app exists..."
	@if ! replicated app ls 2>&1 | grep -q "chartsmith"; then \
		echo "Error: 'chartsmith' app not found in replicated apps list"; \
		echo "Please ensure you are authenticated and have access to the chartsmith app"; \
		echo "Run: replicated app ls"; \
		exit 1; \
	fi
	@echo "Found 'chartsmith' app"
	@set -e; \
	PROXY_HOSTNAME=$$(replicated app hostname ls --output json 2>&1 | jq -r '.proxy' 2>/dev/null); \
	if [ -z "$$PROXY_HOSTNAME" ] || [ "$$PROXY_HOSTNAME" = "null" ]; then \
		echo "Error: Could not determine proxy hostname from replicated app hostname ls"; \
		replicated app hostname ls --output json || true; \
		exit 1; \
	fi; \
	echo "Using proxy hostname: $$PROXY_HOSTNAME"; \
	REPO_ROOT=$$(pwd); \
	VALUES_FILE="$$REPO_ROOT/chart/chartsmith/values.yaml"; \
	VALUES_BACKUP=$$(mktemp "$${TMPDIR:-/tmp}/chartsmith-values.XXXXXX"); \
	cp "$$VALUES_FILE" "$$VALUES_BACKUP"; \
	trap 'mv "$$VALUES_BACKUP" "$$VALUES_FILE"' EXIT HUP INT TERM; \
	sed -i.tmp "s|proxy.replicated.com|$$PROXY_HOSTNAME|g" "$$VALUES_FILE"; \
	rm "$$VALUES_FILE.tmp"; \
	cd chart/chartsmith; \
	helm dependency update; \
	echo "Creating release $(REPLICATED_VERSION) and promoting to Unstable channel..."; \
	replicated release create --promote Unstable --version $(REPLICATED_VERSION); \
	trap - EXIT HUP INT TERM; \
	mv "$$VALUES_BACKUP" "$$VALUES_FILE"
	@echo "Release $(REPLICATED_VERSION) created and promoted to Unstable channel successfully"
	@echo "Promote this same release with: make promote-beta sequence=<release-sequence>"

# Promote an existing release sequence. A release is built once, then advanced
# through Beta and Stable without creating duplicate releases.
.PHONY: promote-replicated promote-beta promote-stable
promote-replicated: check-replicated-cli
	@if ! echo "$(sequence)" | grep -Eq '^[0-9]+$$'; then \
		echo "Error: sequence is required and must be a release sequence number"; \
		echo "Usage: make promote-beta sequence=123"; \
		exit 1; \
	fi
	@if [ "$(channel)" != "Beta" ] && [ "$(channel)" != "Stable" ]; then \
		echo "Error: channel must be Beta or Stable"; \
		exit 1; \
	fi
	@APP_ID=$$(replicated app ls chartsmith --output json | jq -r '.[] | select(.app.slug == "chartsmith") | .app.id'); \
	if [ -z "$$APP_ID" ] || [ "$$APP_ID" = "null" ]; then \
		echo "Error: could not resolve the Chartsmith app ID"; \
		exit 1; \
	fi; \
	RELEASE_VERSION=$$(replicated release inspect "$(sequence)" --app "$$APP_ID" --output json | jq -r '.charts[] | select(.name == "chartsmith" and .status == "pushed") | .version' | head -n1); \
	if ! echo "$$RELEASE_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: could not resolve a semantic chart version for release $(sequence)"; \
		exit 1; \
	fi; \
	echo "Promoting existing release sequence $(sequence) to $(channel) as $$RELEASE_VERSION..."; \
	replicated release promote "$(sequence)" "$(channel)" --app "$$APP_ID" --version "$$RELEASE_VERSION"

promote-beta:
	@$(MAKE) --no-print-directory promote-replicated sequence="$(sequence)" channel=Beta

promote-stable:
	@$(MAKE) --no-print-directory promote-replicated sequence="$(sequence)" channel=Stable

# Promote an already-built version to production.
# Requires: GITHUB_TOKEN, OP_SERVICE_ACCOUNT_PRODUCTION, and the release CLIs
.PHONY: production
production:
	./scripts/release.sh \
		--version "$(version)" \
		--no-build \
		--no-staging \
		--production
