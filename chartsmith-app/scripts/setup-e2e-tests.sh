#!/bin/bash
set -e

echo "Starting services with docker compose for E2E tests..."
cd ../hack/chartsmith-dev

docker compose -f docker-compose.e2e.yml up -d

cd ../../

echo "Waiting for PostgreSQL to be ready..."
until docker exec chartsmith-dev-postgres-1 pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done

echo "Creating chartsmith database if it doesn't exist..."
docker exec -u postgres chartsmith-dev-postgres-1 psql -c 'CREATE DATABASE chartsmith;'

echo "Installing vector extension..."
docker exec -u postgres chartsmith-dev-postgres-1 psql -d chartsmith -c 'CREATE EXTENSION IF NOT EXISTS vector;'
if [ $? -ne 0 ]; then
  echo "Failed to install vector extension"
  exit 1
fi

echo "Running database schema setup..."
cd chartsmith-app
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8001"
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
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8001"
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

echo "Ensuring test user exists and is not in waitlist..."
docker exec chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "DELETE FROM waitlist WHERE email = 'playwright@chartsmith.ai';"

docker exec chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at, is_admin) VALUES ('ZO6igAzj2yzJ', 'playwright@chartsmith.ai', 'Playwright Test User', 'https://randomuser.me/api/portraits/lego/3.jpg', NOW(), NOW(), NOW(), false) ON CONFLICT (email) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create test user"
  exit 1
fi

echo "Creating a sample workspace for the test user..."
docker exec chartsmith-dev-postgres-1 psql -U postgres -d chartsmith -c "INSERT INTO workspace (id, name, created_by_user_id, created_at, last_updated_at, created_type, current_revision_number) VALUES ('test-workspace-1', 'Test Workspace', 'ZO6igAzj2yzJ', NOW(), NOW(), 'MANUAL', 0) ON CONFLICT (id) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create sample workspace"
  exit 1
fi

echo "Starting frontend server..."
cd chartsmith-app
export NEXT_PUBLIC_ENABLE_TEST_AUTH=true
export ENABLE_TEST_AUTH=true
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8001"
export CENTRIFUGO_API_KEY="test-api-key"
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3005/api"
PORT=3005 npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend server to be ready..."
timeout=60
counter=0
while ! curl -s http://localhost:3005 > /dev/null; do
  if [ $counter -ge $timeout ]; then
    echo "Timed out waiting for frontend server to start"
    exit 1
  fi
  echo "Waiting for frontend server to start... ($counter/$timeout)"
  sleep 1
  counter=$((counter+1))
done

echo "Environment ready for E2E tests"
echo "Worker PID: $WORKER_PID"
echo "Frontend PID: $FRONTEND_PID"
