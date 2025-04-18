#!/bin/bash
set -e

echo "Starting services with docker compose..."
cd ../hack/chartsmith-dev

if lsof -i:8000 > /dev/null 2>&1; then
  echo "Port 8000 is already in use. Assuming Centrifugo is already running."
  
  if ! docker ps | grep -q chartsmith-dev-postgres; then
    cp docker-compose.yml docker-compose.yml.bak
    grep -v "centrifugo" docker-compose.yml.bak > docker-compose.yml.temp
    mv docker-compose.yml.temp docker-compose.yml
    
    docker compose up -d
    
    mv docker-compose.yml.bak docker-compose.yml
  else
    echo "PostgreSQL is already running. Skipping docker compose."
  fi
else
  docker compose up -d
fi

cd ../../

echo "Waiting for PostgreSQL to be ready..."
until docker exec chartsmith-dev-postgres-1 pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done

echo "Installing vector extension..."
docker exec -u postgres chartsmith-dev-postgres-1 psql -d chartsmith -c 'CREATE EXTENSION IF NOT EXISTS vector;'
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
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3005/api"
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
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3005/api"
export NEXT_PUBLIC_ENABLE_TEST_AUTH="true"
export ENABLE_TEST_AUTH="true"
make run-worker &
WORKER_PID=$!

echo "Creating default workspace record..."
docker exec chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "INSERT INTO bootstrap_workspace (id, name, current_revision) VALUES ('default', 'default-workspace', 0) ON CONFLICT (id) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create default workspace record"
  exit 1
fi

echo "Starting frontend server..."
cd chartsmith-app
export NEXT_PUBLIC_ENABLE_TEST_AUTH=true
export ENABLE_TEST_AUTH=true
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5432/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8000"
export CENTRIFUGO_API_KEY="test-api-key"
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3005/api"
npm run dev &
FRONTEND_PID=$!

echo "Environment ready for E2E tests"
echo "Worker PID: $WORKER_PID"
echo "Frontend PID: $FRONTEND_PID"
