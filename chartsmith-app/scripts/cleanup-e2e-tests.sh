set -e

echo "Cleaning up E2E test environment..."

if [ -n "$FRONTEND_PID" ]; then
  echo "Killing frontend process (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID || true
fi

if [ -n "$WORKER_PID" ]; then
  echo "Killing worker process (PID: $WORKER_PID)..."
  kill $WORKER_PID || true
fi

echo "Stopping docker-compose services..."
cd ../hack/chartsmith-dev
docker compose -f docker-compose.e2e.yml down

echo "E2E test environment cleaned up successfully"
