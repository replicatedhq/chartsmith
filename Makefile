WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

# =============================================================================
# DEFAULT ENVIRONMENT VARIABLES (can be overridden by exporting in your shell)
# =============================================================================

# Database and service connections - these have sensible defaults for local development
CHARTSMITH_PG_URI?=postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable
CHARTSMITH_CENTRIFUGO_ADDRESS?=http://localhost:8000/api
CHARTSMITH_CENTRIFUGO_API_KEY?=api_key
DB_URI?=$(CHARTSMITH_PG_URI)

# Google OAuth settings - default values for local development
# For production use, override these through environment variables
NEXT_PUBLIC_GOOGLE_CLIENT_ID=730758876435-8v7frmnqtt7k7v65edpc6u3hso9olqbe.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google

# =============================================================================
# REQUIRED ENVIRONMENT VARIABLES (must be exported by the user)
# =============================================================================
# The following variables MUST be exported before running commands like:
# - make run-worker
# - make bootstrap
# - make run-debug-console
#
# Example:
#   export ANTHROPIC_API_KEY=your-key
#   export GROQ_API_KEY=your-key
#   export VOYAGE_API_KEY=your-key
#   export GOOGLE_CLIENT_ID=your-id (optional for some commands)
#   export GOOGLE_CLIENT_SECRET=your-secret (optional for some commands)
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

# Check only essential environment variables that can't have defaults
.PHONY: check-env
check-env:
	$(call check_env_var,ANTHROPIC_API_KEY)
	$(call check_env_var,GROQ_API_KEY)
	$(call check_env_var,VOYAGE_API_KEY)
	@if [ -z "$(GOOGLE_CLIENT_ID)" ] || [ -z "$(GOOGLE_CLIENT_SECRET)" ]; then \
		echo "Warning: Google OAuth credentials (GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET) are not set."; \
		echo "These are required for authentication. See CONTRIBUTING.md for details."; \
		exit 1; \
	fi
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
	mkdir -p ./db/generated-schema/tables
	schemahero plan --driver postgres --uri "postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable" --spec-file ./db/schema/tables --spec-type table --out ./db/generated-schema/tables
	schemahero apply --driver postgres --uri "postgresql://postgres:password@localhost:5432/chartsmith?sslmode=disable" --ddl ./db/generated-schema/tables

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
run-worker: build check-env
	@echo "Running $(WORKER_BINARY_NAME) with environment variables from shell and Makefile..."
	CHARTSMITH_PG_URI="$(CHARTSMITH_PG_URI)" \
	CHARTSMITH_CENTRIFUGO_ADDRESS="$(CHARTSMITH_CENTRIFUGO_ADDRESS)" \
	CHARTSMITH_CENTRIFUGO_API_KEY="$(CHARTSMITH_CENTRIFUGO_API_KEY)" \
	DB_URI="$(DB_URI)" \
	./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) run --

.PHONY: bootstrap
bootstrap: build check-env
	@echo "Bootstrapping chart..."
	CHARTSMITH_PG_URI="$(CHARTSMITH_PG_URI)" \
	CHARTSMITH_CENTRIFUGO_ADDRESS="$(CHARTSMITH_CENTRIFUGO_ADDRESS)" \
	CHARTSMITH_CENTRIFUGO_API_KEY="$(CHARTSMITH_CENTRIFUGO_API_KEY)" \
	DB_URI="$(DB_URI)" \
	./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) bootstrap \
		--force

# Creates an admin user for local development
.PHONY: create-admin
create-admin:
	@read -p "Enter email: " email; \
	read -p "Enter name: " name; \
	if [ -z "$$email" ] || [ -z "$$name" ]; then \
		echo "Error: Email and name are required"; \
		exit 1; \
	fi; \
	image="https://randomuser.me/api/portraits/lego/3.jpg"; \
	echo "Creating admin user for local development..."; \
	PG_CONTAINER=$$(docker ps --format '{{.Names}}' | grep postgres | head -n1); \
	if [ -z "$$PG_CONTAINER" ]; then \
		echo "Error: No running Postgres container found"; \
		echo "Make sure to start the development environment first:"; \
		echo "  cd hack/chartsmith-dev && docker compose up -d"; \
		exit 1; \
	fi; \
	echo "Using Postgres container: $$PG_CONTAINER"; \
	docker exec -i $$PG_CONTAINER psql -U postgres -d chartsmith -c "INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at, is_admin) \
		VALUES (md5(random()::text), '$$email', '$$name', '$$image', now(), now(), now(), false) \
		ON CONFLICT (email) DO NOTHING;"; \
	docker exec -i $$PG_CONTAINER psql -U postgres -d chartsmith -c "UPDATE chartsmith_user SET is_admin = true WHERE email = '$$email';"; \
	echo "Admin user created: $$email"; \
	echo "Log in at: http://localhost:3000/login?test-auth=true"

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
run-debug-console: check-env
	@echo "Running debug console with environment variables from shell and Makefile..."
	CHARTSMITH_PG_URI="$(CHARTSMITH_PG_URI)" \
	CHARTSMITH_CENTRIFUGO_ADDRESS="$(CHARTSMITH_CENTRIFUGO_ADDRESS)" \
	CHARTSMITH_CENTRIFUGO_API_KEY="$(CHARTSMITH_CENTRIFUGO_API_KEY)" \
	DB_URI="$(DB_URI)" \
	go run main.go debug-console

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
