#!/bin/bash
set -e

echo "Starting services with docker-compose..."
cd ../hack/chartsmith-dev
docker-compose up -d
cd ../../

echo "Waiting for PostgreSQL to be ready..."
until docker exec chartsmith-postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done

echo "Installing vector extension..."
docker exec -u postgres chartsmith-postgres psql -d chartsmith -c 'CREATE EXTENSION IF NOT EXISTS vector;'
if [ $? -ne 0 ]; then
  echo "Failed to install vector extension"
  exit 1
fi

echo "Running database schema setup..."
cd chartsmith-app
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8000"
export CENTRIFUGO_API_KEY="test-api-key"
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3000/api"
export NEXT_PUBLIC_ENABLE_TEST_AUTH="true"
export ENABLE_TEST_AUTH="true"
cd ..
make schema
if [ $? -ne 0 ]; then
  echo "Failed to apply database schema"
  exit 1
fi

echo "Starting backend worker..."
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8000"
export CENTRIFUGO_API_KEY="test-api-key"
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3000/api"
export NEXT_PUBLIC_ENABLE_TEST_AUTH="true"
export ENABLE_TEST_AUTH="true"
make run-worker &
WORKER_PID=$!

echo "Environment ready for E2E tests"
echo "Worker PID: $WORKER_PID"
