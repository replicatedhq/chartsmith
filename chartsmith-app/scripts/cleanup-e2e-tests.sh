
echo "Cleaning up E2E test environment..."

pkill -f "PORT=3005 npm run dev" || true
pkill -f "make run-worker" || true

if command -v lsof &> /dev/null; then
  lsof -ti:3005 | xargs kill -9 2>/dev/null || true
  lsof -ti:8001 | xargs kill -9 2>/dev/null || true
  lsof -ti:5433 | xargs kill -9 2>/dev/null || true
fi

echo "Stopping docker containers..."
docker stop chartsmith-e2e-postgres chartsmith-e2e-centrifugo 2>/dev/null || true
docker rm chartsmith-e2e-postgres chartsmith-e2e-centrifugo 2>/dev/null || true

echo "Stopping docker-compose services..."
cd ../hack/chartsmith-dev
docker compose -f docker-compose.e2e.yml down -v 2>/dev/null || true

docker volume rm chartsmith-e2e-postgres-data 2>/dev/null || true

echo "E2E test environment cleaned up successfully"
