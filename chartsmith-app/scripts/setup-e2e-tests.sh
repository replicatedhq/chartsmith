#!/bin/bash
set -e

# Get the absolute path to the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Clean up any existing test environment
"$SCRIPT_DIR/cleanup-e2e-tests.sh" || true

echo "Starting services with docker compose for E2E tests..."
cd "$SCRIPT_DIR/../../hack/chartsmith-dev"

# Start the Docker containers
docker compose -f docker-compose.e2e.yml down -v || true
docker compose -f docker-compose.e2e.yml up -d

cd "$SCRIPT_DIR/.."

echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if docker exec chartsmith-e2e-postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL is ready"
    break
  fi
  echo "Waiting for PostgreSQL to start... ($i/30)"
  sleep 1
  
  if [ $i -eq 30 ]; then
    echo "PostgreSQL failed to start after 30 attempts"
    "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
    exit 1
  fi
done

echo "Creating chartsmith database if it doesn't exist..."
docker exec -u postgres chartsmith-e2e-postgres psql -c 'CREATE DATABASE chartsmith;' || echo "Database already exists, continuing..."

echo "Installing vector extension..."
for i in {1..10}; do
  if docker exec -u postgres chartsmith-e2e-postgres psql -d chartsmith -c 'CREATE EXTENSION IF NOT EXISTS vector;'; then
    echo "Vector extension installed successfully"
    break
  fi
  
  echo "Waiting for vector extension to be available... ($i/10)"
  sleep 2
  
  if [ $i -eq 10 ]; then
    echo "Failed to install vector extension after 10 attempts"
    "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
    exit 1
  fi
done

if ! command -v helm &> /dev/null; then
    echo "Installing helm..."
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "Setting up environment variables..."
export CHARTSMITH_PG_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export DB_URI="postgres://postgres:password@localhost:5433/chartsmith?sslmode=disable"
export HMAC_SECRET="test-secret-for-playwright-tests"
export NEXT_PUBLIC_CENTRIFUGO_ADDRESS="http://localhost:8001"
export CENTRIFUGO_ADDRESS="http://localhost:8001"
export CENTRIFUGO_URL="http://localhost:8001"
export CHARTSMITH_CENTRIFUGO_ADDRESS="http://localhost:8001/api"
export CENTRIFUGO_API_KEY="api_key"
export CHARTSMITH_CENTRIFUGO_API_KEY="api_key"
export NEXT_PUBLIC_API_ENDPOINT="http://localhost:3005/api"
export NEXT_PUBLIC_ENABLE_TEST_AUTH="true"
export ENABLE_TEST_AUTH="true"

if [ -n "$VOYAGE_API_KEY" ]; then
  export CHARTSMITH_VOYAGE_API_KEY="$VOYAGE_API_KEY"
else
  echo "Warning: Using mock VOYAGE_API_KEY for tests"
  export VOYAGE_API_KEY="sk-test-mock-key"
  export CHARTSMITH_VOYAGE_API_KEY="sk-test-mock-key"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
  export CHARTSMITH_ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
else
  echo "Warning: Using mock ANTHROPIC_API_KEY for tests"
  export ANTHROPIC_API_KEY="sk-ant-mock-key"
  export CHARTSMITH_ANTHROPIC_API_KEY="sk-ant-mock-key"
fi

if [ -n "$GROQ_API_KEY" ]; then
  export CHARTSMITH_GROQ_API_KEY="$GROQ_API_KEY"
else
  echo "Warning: Using mock GROQ_API_KEY for tests"
  export GROQ_API_KEY="gsk_mock_key"
  export CHARTSMITH_GROQ_API_KEY="gsk_mock_key"
fi

echo "Running database schema setup..."
make schema
if [ $? -ne 0 ]; then
  echo "Failed to apply database schema"
  "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
  exit 1
fi

echo "Starting backend worker..."
make run-worker &
WORKER_PID=$!

echo "Creating default workspace record..."
docker exec chartsmith-e2e-postgres psql -U postgres -d chartsmith -c "INSERT INTO bootstrap_workspace (id, name, current_revision) VALUES ('default', 'default-workspace', 0) ON CONFLICT (id) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create default workspace record"
  "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
  exit 1
fi

echo "Ensuring test user exists and is not in waitlist..."
docker exec chartsmith-e2e-postgres psql -U postgres -d chartsmith -c "DELETE FROM waitlist WHERE email = 'playwright@chartsmith.ai';"

docker exec chartsmith-e2e-postgres psql -U postgres -d chartsmith -c "INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at, is_admin) VALUES ('ZO6igAzj2yzJ', 'playwright@chartsmith.ai', 'Playwright Test User', 'https://randomuser.me/api/portraits/lego/3.jpg', NOW(), NOW(), NOW(), false) ON CONFLICT (email) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create test user"
  "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
  exit 1
fi

echo "Creating a sample workspace for the test user..."
docker exec chartsmith-e2e-postgres psql -U postgres -d chartsmith -c "INSERT INTO workspace (id, name, created_by_user_id, created_at, last_updated_at, created_type, current_revision_number) VALUES ('test-workspace-1', 'Test Workspace', 'ZO6igAzj2yzJ', NOW(), NOW(), 'MANUAL', 0) ON CONFLICT (id) DO NOTHING;"
if [ $? -ne 0 ]; then
  echo "Failed to create sample workspace"
  "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
  exit 1
fi

echo "Starting frontend server..."
cd chartsmith-app
PORT=3005 npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend server to be ready..."
timeout=60
counter=0
while ! curl -s http://localhost:3005 > /dev/null; do
  if [ $counter -ge $timeout ]; then
    echo "Timed out waiting for frontend server to start"
    "$SCRIPT_DIR/cleanup-e2e-tests.sh" || true
    exit 1
  fi
  echo "Waiting for frontend server to start... ($counter/$timeout)"
  sleep 1
  counter=$((counter+1))
done

echo "Environment ready for E2E tests"
echo "Worker PID: $WORKER_PID"
echo "Frontend PID: $FRONTEND_PID"
