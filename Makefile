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
#   - ANTHROPIC_API_KEY - API key for Anthropic services
#   - GROQ_API_KEY - API key for Groq services
#   - VOYAGE_API_KEY - API key for Voyage services
#   - CHARTSMITH_PG_URI - PostgreSQL connection string
#   - CHARTSMITH_CENTRIFUGO_ADDRESS - Centrifugo service address
#   - CHARTSMITH_CENTRIFUGO_API_KEY - API key for Centrifugo
#   - GOOGLE_CLIENT_ID - Google OAuth client ID
#   - GOOGLE_CLIENT_SECRET - Google OAuth client secret
#
# Example:
#   export ANTHROPIC_API_KEY=your-key
#   export GROQ_API_KEY=your-key
#   export VOYAGE_API_KEY=your-key
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
	$(call check_env_var,ANTHROPIC_API_KEY)
	$(call check_env_var,GROQ_API_KEY)
	$(call check_env_var,VOYAGE_API_KEY)
	$(call check_env_var,CHARTSMITH_PG_URI)
	$(call check_env_var,CHARTSMITH_CENTRIFUGO_ADDRESS)
	$(call check_env_var,CHARTSMITH_CENTRIFUGO_API_KEY)
	$(call check_env_var,GOOGLE_CLIENT_ID)
	$(call check_env_var,GOOGLE_CLIENT_SECRET)
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

# Requires: ANTHROPIC_API_KEY, GROQ_API_KEY, VOYAGE_API_KEY
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
validate:
	dagger call validate \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain

.PHONY: okteto-dev
okteto-dev:
	@go mod download -x
	@make build
	@printf "\n\n To build and run this project, run: \n\n   # make run-worker\n   # make run-debug-console\n\n"

# Requires: ANTHROPIC_API_KEY, GROQ_API_KEY, VOYAGE_API_KEY
.PHONY: run-debug-console
run-debug-console:
	@echo "Running debug console with environment variables from shell..."
	@# We set DB_URI to maintain compatibility with existing code
	export DB_URI=$(CHARTSMITH_PG_URI) && go run main.go debug-console

# Requires: GITHUB_TOKEN, OP_SERVICE_ACCOUNT_PRODUCTION
.PHONY: release
release:
	dagger call release \
		--version $(version) \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT_PRODUCTION \
		--progress plain

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
	MIN_MAJOR=0; MIN_MINOR=123; MIN_PATCH=0; \
	if [ $$MAJOR -lt $$MIN_MAJOR ] || \
	   ([ $$MAJOR -eq $$MIN_MAJOR ] && [ $$MINOR -lt $$MIN_MINOR ]) || \
	   ([ $$MAJOR -eq $$MIN_MAJOR ] && [ $$MINOR -eq $$MIN_MINOR ] && [ $$PATCH -lt $$MIN_PATCH ]); then \
		echo "Error: replicated CLI version $$REPLICATED_VERSION is below minimum required version 0.123.0"; \
		echo "Please update your replicated CLI: https://docs.replicated.com/reference/replicated-cli-installing"; \
		exit 1; \
	fi; \
	echo "replicated CLI version check passed (>=0.123.0)"

# Release to Replicated
.PHONY: release-replicated
release-replicated: check-replicated-cli
	@echo "Using versions from VERSION file:"
	@echo "  Chart Version: $(CHART_VERSION)"
	@echo "  Replicated Release Version: $(REPLICATED_VERSION)"
	@echo ""
	@echo "Updating chart version in Chart.yaml..."
	@sed -i.bak 's/^version:.*/version: $(CHART_VERSION)/' chart/chartsmith/Chart.yaml && rm chart/chartsmith/Chart.yaml.bak
	@echo "Updating chart version in helmchart.yaml..."
	@sed -i.bak 's/chartVersion:.*/chartVersion: $(CHART_VERSION)/' replicated/helmchart.yaml && rm replicated/helmchart.yaml.bak
	@echo "Verifying 'chartsmith' app exists..."
	@if ! replicated app ls 2>&1 | grep -q "chartsmith"; then \
		echo "Error: 'chartsmith' app not found in replicated apps list"; \
		echo "Please ensure you are authenticated and have access to the chartsmith app"; \
		echo "Run: replicated app ls"; \
		exit 1; \
	fi
	@echo "Found 'chartsmith' app"
	@echo "Getting proxy registry hostname..."
	@PROXY_HOSTNAME=$$(/Users/marccampbell/go/src/github.com/replicatedhq/replicated/bin/replicated app hostname ls --output json 2>&1 | jq -r '.proxy' 2>/dev/null); \
	if [ -z "$$PROXY_HOSTNAME" ] || [ "$$PROXY_HOSTNAME" = "null" ]; then \
		echo "Error: Could not determine proxy hostname from replicated app hostname ls"; \
		replicated app hostname ls --output json || true; \
		exit 1; \
	fi
	@echo "Proxy hostname: $$PROXY_HOSTNAME"
	@echo "Backing up values.yaml..."
	@cp chart/chartsmith/values.yaml chart/chartsmith/values.yaml.bak
	@echo "Replacing proxy.replicated.com with proxy hostname in values.yaml..."
	@PROXY_HOSTNAME=$$(/Users/marccampbell/go/src/github.com/replicatedhq/replicated/bin/replicated app hostname ls --output json 2>&1 | jq -r '.proxy' 2>/dev/null) && \
	sed -i.tmp "s|proxy.replicated.com|$$PROXY_HOSTNAME|g" chart/chartsmith/values.yaml && \
	rm chart/chartsmith/values.yaml.tmp
	@echo "Packaging Helm chart..."
	@cd chart/chartsmith && helm dependency update && helm package --version $(CHART_VERSION) --app-version $(CHART_VERSION) .
	@echo "Creating release $(REPLICATED_VERSION) and promoting to Unstable channel..."
	@cd chart/chartsmith && replicated release create --promote Unstable --version $(REPLICATED_VERSION); \
	RELEASE_STATUS=$$?; \
	cd ../..; \
	mv chart/chartsmith/values.yaml.bak chart/chartsmith/values.yaml; \
	if [ $$RELEASE_STATUS -ne 0 ]; then \
		echo "Error: Release creation failed"; \
		exit $$RELEASE_STATUS; \
	fi
	@echo "Release $(REPLICATED_VERSION) created and promoted to Unstable channel successfully"

# Requires: GITHUB_TOKEN, OP_SERVICE_ACCOUNT_PRODUCTION
.PHONY: production
production:
	dagger call release \
		--version $(version) \
		--build=false \
		--staging=false \
		--production=true \
		--replicated=false \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT_PRODUCTION \
		--progress plain

