
WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

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
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) run

.PHONY: bootstrap
bootstrap: build
	@echo "Bootstrapping chart..."
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) bootstrap \
		--force

.PHONY: test-data
test-data:
	rm -rf ./testdata/gen-data
	mkdir -p ./testdata/gen-data
	pg_dump -h localhost -p 5432 -U chartsmith --table=bootstrap_meta --data-only --column-inserts --no-comments chartsmith | awk '/^INSERT/,/;/' | sed 's/public\.//g' > ./testdata/gen-data/bootstrap_meta.sql
	pg_dump -h localhost -p 5432 -U chartsmith --table=bootstrap_file --data-only --column-inserts --no-comments chartsmith | awk '/^INSERT/,/;/' | sed 's/public\.//g' > ./testdata/gen-data/bootstrap_file.sql
	pg_dump -h localhost -p 5432 -U chartsmith --table=bootstrap_gvk --data-only --column-inserts --no-comments chartsmith | awk '/^INSERT/,/;/' | sed 's/public\.//g' > ./testdata/gen-data/bootstrap_gvk.sql


.PHONY: integration-test
integration-test: build
	@echo "Generating schema for integration tests..."
	rm -rf ./testdata/schema.sql
	schemahero fixtures --dbname test-db --driver postgres --input-dir ./db/schema/tables --output-dir ./testdata
	@echo "Running integratioan tests..."
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
	@printf "\n\n To build and run this project, run: \n\n   # make run-worker\n\n"

.PHONY: release
release:
	dagger call release \
		--version $(version) \
		--github-token env:GITHUB_TOKEN \
		--op-service-account env:OP_SERVICE_ACCOUNT \
		--progress plain
