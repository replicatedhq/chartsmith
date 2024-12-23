.PHONY: build run clean

# Binary name and build directory
BINARY_NAME=chartsmith-api
BUILD_DIR=bin

# Go build flags
GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

# Build the application
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	@go build -o $(BUILD_DIR)/$(BINARY_NAME) main.go

# Run the application
run: build
	@echo "Running $(BINARY_NAME)..."
	@./$(BUILD_DIR)/$(BINARY_NAME) serve

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@go clean

# Install dependencies
deps:
	@echo "Installing dependencies..."
	@go mod tidy

# Development: run with hot reload (requires air to be installed)
dev:
	@air -c .air.toml
