#!/bin/bash
set -e

echo "Starting PostgreSQL..."
cd ..
make run-postgres || true  # Ignore error if container already exists

echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "Running database schema setup..."
cd chartsmith-app
export CHARTSMITH_PG_URI="postgres://postgres:postgres@localhost:5432/chartsmith?sslmode=disable"
cd ..
make schema || true  # Ignore error if schema already exists

echo "Starting backend worker..."
make run-worker &
WORKER_PID=$!

echo "Environment ready for E2E tests"
echo "Worker PID: $WORKER_PID"
