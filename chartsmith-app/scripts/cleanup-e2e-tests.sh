set -e

echo "Cleaning up E2E test environment..."

pkill -f "PORT=3005 npm run dev" || true
pkill -f "make run-worker" || true

lsof -ti:3005 | xargs kill -9 || true

lsof -ti:8001 | xargs kill -9 || true

lsof -ti:5433 | xargs kill -9 || true

echo "Stopping docker-compose services..."
cd ../hack/chartsmith-dev
docker compose -f docker-compose.e2e.yml down -v

echo "E2E test environment cleaned up successfully"
