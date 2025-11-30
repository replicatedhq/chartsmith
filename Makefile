WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

# Load environment variables from .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

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

# Requires: GITHUB_TOKEN, OP_SERVICE_ACCOUNT_PRODUCTION
.PHONY: replicated
replicated:
	mkdir -p chart/chartsmith/db/schema/extensions
	mkdir -p chart/chartsmith/db/schema/tables
	cp db/schema/extensions/*.yaml chart/chartsmith/db/schema/extensions/
	cp db/schema/tables/*.yaml chart/chartsmith/db/schema/tables/
	dagger call release \
		--version $(version) \
		--build=false \
		--staging=false \
		--production=false \
		--replicated=true \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT_PRODUCTION \
		--progress plain

# Requires: REPLICATED_API_TOKEN
.PHONY: replicated-dev
replicated-dev:
	dagger call release-dev-replicated \
		--version $(version) \
		--endpoint=https://vendor-api-$(okteto-namespace).okteto.repldev.com \
		--proxy-registry-domain=proxy-registry-$(okteto-namespace).okteto.repldev.com \
		--api-token env:REPLICATED_API_TOKEN \
		--progress plain

# Requires: REPLICATED_API_TOKEN
.PHONY: replicated-prod
replicated-prod:
	dagger call release-dev-replicated \
		--version $(version) \
		--app-slug $(app-slug) \
		--api-token env:REPLICATED_API_TOKEN \
		--progress plain

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

.PHONY: devin
devin:
	direnv exec ~/repos/chartsmith bash -c '\
		cd hack/chartsmith-dev && \
		docker compose down && \
		docker compose up -d && \
		echo "Waiting for Postgres..." && \
		until docker exec chartsmith-dev-postgres-1 pg_isready -U postgres > /dev/null 2>&1; do \
			sleep 1; \
		done && \
		echo "Postgres is ready" && \
		docker exec -u postgres chartsmith-dev-postgres-1 psql -d chartsmith -c '\''CREATE EXTENSION IF NOT EXISTS vector;'\'' && \
		cd ../.. && \
		make schema && \
		go mod download && \
		cd chartsmith-app && \
		npm install \
	'
