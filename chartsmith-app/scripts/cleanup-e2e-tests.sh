#!/bin/bash
# This script ensures all E2E test resources are properly cleaned up

echo "Cleaning up E2E test environment..."

# Kill frontend and worker processes
pkill -f "PORT=3005 npm run dev" 2>/dev/null || true
pkill -f "make run-worker" 2>/dev/null || true

# Check for processes using our test ports, but don't kill Docker processes
if command -v lsof &> /dev/null; then
  for port in 3005 8001 5433; do
    pid=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ -n "$pid" ]; then
      if ps -p $pid -o comm= | grep -v -E 'docker|containerd' > /dev/null; then
        echo "Killing non-Docker process $pid using port $port"
        kill $pid 2>/dev/null || true
        sleep 1
        if ps -p $pid > /dev/null && ps -p $pid -o comm= | grep -v -E 'docker|containerd' > /dev/null; then
          echo "Process still running, using SIGKILL"
          kill -9 $pid 2>/dev/null || true
        fi
      else
        echo "Skipping Docker-related process $pid using port $port"
      fi
    fi
  done
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
