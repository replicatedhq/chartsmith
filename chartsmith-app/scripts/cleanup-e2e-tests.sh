#!/bin/bash
# This script ensures all E2E test resources are properly cleaned up

echo "Cleaning up E2E test environment..."

# Kill frontend and worker processes
pkill -f "PORT=3005 npm run dev" 2>/dev/null || true
pkill -f "make run-worker" 2>/dev/null || true

if command -v lsof &> /dev/null; then
  pid=$(lsof -ti:3005 2>/dev/null || echo "")
  if [ -n "$pid" ]; then
    echo "Killing frontend process $pid using port 3005"
    kill $pid 2>/dev/null || true
    sleep 1
    if ps -p $pid > /dev/null; then
      echo "Frontend process still running, using SIGKILL"
      kill -9 $pid 2>/dev/null || true
    fi
  fi
fi

# Stop and remove docker containers with specific names
echo "Stopping docker containers..."
for container in chartsmith-e2e-postgres chartsmith-e2e-centrifugo; do
  if docker ps -a | grep -q $container; then
    echo "Stopping and removing container $container"
    docker stop $container 2>/dev/null || true
    docker rm $container 2>/dev/null || true
  fi
done

# Also try docker-compose down as a fallback
echo "Stopping docker-compose services..."
if [ -f "../hack/chartsmith-dev/docker-compose.e2e.yml" ]; then
  cd ../hack/chartsmith-dev
  docker compose -f docker-compose.e2e.yml down -v 2>/dev/null || true
else
  echo "docker-compose.e2e.yml not found, skipping docker-compose down"
fi

# Remove the volume explicitly
docker volume rm chartsmith-e2e-postgres-data 2>/dev/null || true

echo "E2E test environment cleaned up successfully"
