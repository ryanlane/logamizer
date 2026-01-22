#!/bin/bash
# Logamizer development setup script

set -e

echo "=== Logamizer Development Setup ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Copy .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Build and start services
echo "Starting Docker services..."
docker-compose -f infra/docker-compose.yml up -d postgres redis minio

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 5

# Run migrations
echo "Running database migrations..."
docker-compose -f infra/docker-compose.yml run --rm api alembic -c infra/migrations/alembic.ini upgrade head

# Start all services
echo "Starting all services..."
docker-compose -f infra/docker-compose.yml up -d

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Services:"
echo "  - API:        http://localhost:8000"
echo "  - API Docs:   http://localhost:8000/docs"
echo "  - MinIO:      http://localhost:9001 (admin: minioadmin/minioadmin)"
echo "  - Nginx:      http://localhost:8080"
echo ""
echo "To view logs:  docker-compose -f infra/docker-compose.yml logs -f"
echo "To stop:       docker-compose -f infra/docker-compose.yml down"
