
WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

.PHONY: run-postgres
run-postgres:
	docker run -d --name chartsmith-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=chartsmith -p 5432:5432 postgres:16

.PHONY: schema
schema:
	rm -rf ./db/generated-schema
	mkdir -p ./db/generated-schema/tables
	schemahero plan --driver postgres --uri $(CHARTSMITH_PG_URI) --spec-file ./db/schema/tables --spec-type table --out ./db/generated-schema/tables
	schemahero apply --driver postgres --uri $(CHARTSMITH_PG_URI) --ddl ./db/generated-schema/tables

.PHONY: build
build:
	@echo "Building $(WORKER_BINARY_NAME)..."
	@mkdir -p $(WORKER_BUILD_DIR)
	@go build -o $(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) main.go

.PHONY: run-worker
run-worker: build
	@echo "Running $(WORKER_BINARY_NAME)..."
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) run --

.PHONY: bootstrap
bootstrap: build
	@echo "Bootstrapping chart..."
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) bootstrap \
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

.PHONY: validate
validate:
	dagger call validate \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain

.POHNY: okteto-dev
okteto-dev:
	@go mod download -x
	@make build
	@printf "\n\n To build and run this project, run: \n\n   # make run-worker\n   # make run-debug-console\n\n"

.PHONY: run-debug-console
run-debug-console:
	DB_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable" go run main.go debug-console

.PHONY: release
release:
	dagger call release \
		--version $(version) \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain

.PHONY: replicated
replicated:
	dagger call release \
		--version $(version) \
		--build=false \
		--staging=false \
		--production=false \
		--replicated=true \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain

.PHONY: production
production:
	dagger call release \
		--version $(version) \
		--build=false \
		--staging=false \
		--production=true \
		--replicated=false \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain
