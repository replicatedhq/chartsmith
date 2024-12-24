
WORKER_BINARY_NAME=chartsmith-worker
WORKER_BUILD_DIR=bin

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

.PHONY: postgres
postgres:
	docker run --name chartsmith-postgres \
	    -e POSTGRES_PASSWORD=password \
	    -d -p5433:5432 \
	    postgres:16



.PHONY: schema
schema:
	rm -rf ./db/generated-schema
	mkdir -p ./db/generated-schema/tables
	schemahero plan --driver postgres --uri $(CHARTSMITH_PG_URI) --spec-file ./db/schema/tables --spec-type table --out ./db/generated-schema/tables
	schemahero apply --driver postgres --uri $(CHARTSMITH_PG_URI) --ddl ./db/generated-schema/tables

.PHONY: build-worker
build-worker:
	@echo "Building $(WORKER_BINARY_NAME)..."
	@mkdir -p $(WORKER_BUILD_DIR)
	@go build -o $(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) main.go

.PHONY: run-worker
run-worker: build-worker
	@echo "Running $(WORKER_BINARY_NAME)..."
	@./$(WORKER_BUILD_DIR)/$(WORKER_BINARY_NAME) run --pg-uri="$(CHARTSMITH_PG_URI)"
