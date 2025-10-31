# Variables
DOCKER_REGISTRY=langgenius
WEB_IMAGE=$(DOCKER_REGISTRY)/dify-web
API_IMAGE=$(DOCKER_REGISTRY)/dify-api
VERSION=latest

# Default target - show help
.DEFAULT_GOAL := help

# Backend Development Environment Setup
.PHONY: dev-setup prepare-docker prepare-web prepare-api prepare-web-edu

# Dev setup target
dev-setup: prepare-docker prepare-web prepare-api prepare-web-edu
	@echo "✅ Full development environment setup complete!"

# Step 1: Prepare Docker middleware
prepare-docker:
	@echo "🐳 Setting up Docker middleware..."
	@cp -n docker/middleware.env.example docker/middleware.env 2>/dev/null || echo "Docker middleware.env already exists"
	@cd docker && docker compose -f docker-compose.middleware.yaml --env-file middleware.env -p dify-middlewares-dev up -d
	@echo "✅ Docker middleware started"

# Initialize Docker production environment
init-docker-env:
	@echo "🔧 Initializing Docker production environment..."
	@./docker/init-env.sh

# Start Docker production environment (with auto-initialization)
docker-up: init-docker-env
	@echo "🚀 Starting Docker containers..."
	@cd docker && docker-compose up -d
	@echo "✅ Docker containers started successfully!"
	@echo ""
	@echo "📝 Next steps:"
	@echo "   - Check logs: cd docker && docker-compose logs -f"
	@echo "   - Access EduAI: http://localhost"
	@echo "   - Access Dify (test): http://localhost:8080"
	@echo "   - Access API: http://localhost/v1"

# Rebuild Docker images without cache (slower but ensures fresh build)
docker-rebuild: init-docker-env
	@echo "🔨 Rebuilding Docker images without cache..."
	@cd docker && docker-compose build --no-cache
	@cd docker && docker-compose up -d
	@echo "✅ Docker images rebuilt and containers started!"
	@echo ""
	@echo "📝 Next steps:"
	@echo "   - Check logs: cd docker && docker-compose logs -f"
	@echo "   - Access EduAI: http://localhost"
	@echo "   - Access Dify (test): http://localhost:8080"

# Stop Docker production environment
docker-down:
	@echo "🛑 Stopping Docker containers..."
	@cd docker && docker-compose down
	@echo "✅ Docker containers stopped"

# Restart Docker production environment
docker-restart:
	@echo "🔄 Restarting Docker containers..."
	@cd docker && docker-compose restart
	@echo "✅ Docker containers restarted"

# Clean Docker containers and volumes
docker-clean:
	@echo "⚠️  WARNING: This will remove all containers and volumes (including user data)!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read dummy
	@echo "🧹 Cleaning Docker containers and volumes..."
	@cd docker && docker-compose down -v
	@echo "🗑️  Removing volume directories..."
	@rm -rf docker/volumes/app
	@rm -rf docker/volumes/db
	@rm -rf docker/volumes/redis
	@rm -rf docker/volumes/weaviate
	@rm -rf docker/volumes/plugin_daemon
	@rm -rf docker/volumes/certbot
	@echo "✅ Docker containers and volumes removed"

# Clean everything (containers, volumes, images, admin credentials)
docker-clean-all:
	@echo "⚠️  WARNING: This will remove ALL Docker resources AND reset admin credentials!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read dummy
	@echo "🧹 Cleaning all Docker resources..."
	@cd docker && docker-compose down -v --rmi all
	@echo "🗑️  Removing volume directories..."
	@rm -rf docker/volumes/app
	@rm -rf docker/volumes/db
	@rm -rf docker/volumes/redis
	@rm -rf docker/volumes/weaviate
	@rm -rf docker/volumes/plugin_daemon
	@rm -rf docker/volumes/certbot
	@echo "🔧 Resetting admin credentials in docker/.env..."
	@if [ -f docker/.env ]; then \
		perl -pi -e 's/^INITIAL_ADMIN_EMAIL=.*/INITIAL_ADMIN_EMAIL=/' docker/.env; \
		perl -pi -e 's/^INITIAL_ADMIN_PASSWORD=.*/INITIAL_ADMIN_PASSWORD=/' docker/.env; \
		perl -pi -e 's/^INITIAL_ADMIN_NAME=.*/INITIAL_ADMIN_NAME=/' docker/.env; \
		echo "✅ Admin credentials reset"; \
	else \
		echo "ℹ️  docker/.env not found (skipped)"; \
	fi
	@echo "✅ All Docker resources removed and admin credentials reset"
	@echo ""
	@echo "💡 Next steps:"
	@echo "   Run 'make docker-rebuild' to rebuild without cache (recommended after clean-all)"
	@echo "   Or  'make docker-up' for faster start (uses cache if available)"

# Step 2: Prepare web environment
prepare-web:
	@echo "🌐 Setting up web environment..."
	@cp -n web/.env.example web/.env 2>/dev/null || echo "Web .env already exists"
	@cd web && pnpm install
	@cd web && pnpm build
	@echo "✅ Web environment prepared (not started)"

# Step 3: Prepare API environment
prepare-api:
	@echo "🔧 Setting up API environment..."
	@cp -n api/.env.example api/.env 2>/dev/null || echo "API .env already exists"
	@awk -v key="$$(openssl rand -base64 42)" '/^SECRET_KEY=/ {sub(/=.*/, "=" key)} 1' api/.env > api/temp_env && mv api/temp_env api/.env
	@cd api && uv sync --dev
	@awk -v key="$$(cd api && uv run python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')" '/^API_KEY_ENCRYPTION_KEY=/ {sub(/=.*/, "=" key)} 1' api/.env > api/temp_env && mv api/temp_env api/.env
	@cd api && uv run flask db upgrade
	@echo "👤 Creating initial tenant (development default)..."
	@cd api && uv run flask init-tenant --email admin@test.com --password Test1234! --name "Admin" 2>/dev/null || echo "ℹ️  Tenant already exists (skipped)"
	@echo "🔌 Installing model provider plugins..."
	@cd api && uv run flask provider install-plugins || echo "⚠️  Plugin installation failed (will retry on API Key creation)"
	@echo "✅ API environment prepared (not started)"
	@echo ""
	@echo "📝 Development Credentials:"
	@echo "   Email: admin@test.com"
	@echo "   Password: Test1234!"

# Step 4: Prepare web-edu environment
prepare-web-edu:
	@echo "🎓 Setting up web-edu environment..."
	@cp -n web-edu/.env.example web-edu/.env.local 2>/dev/null || echo "Web-edu .env.local already exists"
	@cd web-edu && pnpm install
	@echo "✅ Web-edu environment prepared (not started)"

# Clean dev environment (quick cleanup - preserves data)
dev-clean:
	@echo "🧹 Cleaning development environment (preserving data)..."
	@echo "⚠️  Stopping Docker middleware containers..."
	@cd docker && docker compose -f docker-compose.middleware.yaml --env-file middleware.env -p dify-middlewares-dev down
	@echo "🗑️  Removing build artifacts..."
	@rm -rf web/node_modules web/.next
	@rm -rf web-edu/node_modules web-edu/.next
	@rm -rf api/.venv api/storage
	@echo "✅ Cleanup complete"
	@echo ""
	@echo "📝 Preserved:"
	@echo "   - docker/volumes/ (database data)"
	@echo "   - .env files (SECRET_KEY, API_KEY_ENCRYPTION_KEY)"
	@echo "   - Docker images (faster rebuild)"
	@echo ""
	@echo "💡 Next: Run 'make dev-setup' to rebuild"

# Clean everything in dev environment (complete reset)
dev-clean-all:
	@echo "⚠️  WARNING: This will remove ALL dev resources AND environment files!"
	@echo "This includes:"
	@echo "  - All Docker containers, volumes, and images"
	@echo "  - All database data (PostgreSQL, Redis, Weaviate)"
	@echo "  - All build artifacts (node_modules, .next, .venv)"
	@echo "  - All .env files (web/.env, web-edu/.env.local, api/.env)"
	@echo ""
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read dummy
	@echo "🧹 Cleaning all dev resources..."
	@cd docker && docker compose -f docker-compose.middleware.yaml --env-file middleware.env -p dify-middlewares-dev down -v --rmi all
	@echo "🗑️  Removing volume directories..."
	@rm -rf docker/volumes/db
	@rm -rf docker/volumes/redis
	@rm -rf docker/volumes/plugin_daemon
	@rm -rf docker/volumes/weaviate
	@echo "🗑️  Removing build artifacts and .env files..."
	@rm -rf web/node_modules web/.next web/.env
	@rm -rf web-edu/node_modules web-edu/.next web-edu/.env.local
	@rm -rf api/.venv api/storage api/.env
	@echo "✅ All dev resources removed and environment reset"
	@echo ""
	@echo "💡 Next steps:"
	@echo "   Run 'make dev-setup' to start fresh with new keys"

# Backend Code Quality Commands
format:
	@echo "🎨 Running ruff format..."
	@uv run --project api --dev ruff format ./api
	@echo "✅ Code formatting complete"

check:
	@echo "🔍 Running ruff check..."
	@uv run --project api --dev ruff check ./api
	@echo "✅ Code check complete"

lint:
	@echo "🔧 Running ruff format, check with fixes, and import linter..."
	@uv run --project api --dev sh -c 'ruff format ./api && ruff check --fix ./api'
	@uv run --directory api --dev lint-imports
	@echo "✅ Linting complete"

type-check:
	@echo "📝 Running type check with basedpyright..."
	@uv run --directory api --dev basedpyright
	@echo "✅ Type check complete"

# Build Docker images
build-web:
	@echo "Building web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker build -t $(WEB_IMAGE):$(VERSION) ./web
	@echo "Web Docker image built successfully: $(WEB_IMAGE):$(VERSION)"

build-api:
	@echo "Building API Docker image: $(API_IMAGE):$(VERSION)..."
	docker build -t $(API_IMAGE):$(VERSION) ./api
	@echo "API Docker image built successfully: $(API_IMAGE):$(VERSION)"

# Push Docker images
push-web:
	@echo "Pushing web Docker image: $(WEB_IMAGE):$(VERSION)..."
	docker push $(WEB_IMAGE):$(VERSION)
	@echo "Web Docker image pushed successfully: $(WEB_IMAGE):$(VERSION)"

push-api:
	@echo "Pushing API Docker image: $(API_IMAGE):$(VERSION)..."
	docker push $(API_IMAGE):$(VERSION)
	@echo "API Docker image pushed successfully: $(API_IMAGE):$(VERSION)"

# Build all images
build-all: build-web build-api

# Push all images
push-all: push-web push-api

build-push-api: build-api push-api
build-push-web: build-web push-web

# Build and push all images
build-push-all: build-all push-all
	@echo "All Docker images have been built and pushed."

# Help target
help:
	@echo "Development Setup Targets:"
	@echo "  make dev-setup       - Run all setup steps for full dev environment"
	@echo "  make prepare-docker  - Set up Docker middleware"
	@echo "  make prepare-web     - Set up web environment"
	@echo "  make prepare-api     - Set up API environment"
	@echo "  make prepare-web-edu - Set up web-edu environment"
	@echo "  make dev-clean       - Quick cleanup (preserves data & configs)"
	@echo "  make dev-clean-all   - Complete reset (removes everything)"
	@echo ""
	@echo "Docker Production Setup:"
	@echo "  make init-docker-env - Initialize Docker production environment (generate keys & admin account)"
	@echo "  make docker-up       - Start Docker containers (auto-initialize if needed)"
	@echo "  make docker-rebuild  - Rebuild images without cache and start (slower, ensures fresh build)"
	@echo "  make docker-down     - Stop Docker containers"
	@echo "  make docker-restart  - Restart Docker containers"
	@echo "  make docker-clean    - Remove containers, volumes, and volume directories"
	@echo "  make docker-clean-all - Remove all Docker resources + reset admin credentials"
	@echo ""
	@echo "Backend Code Quality:"
	@echo "  make format         - Format code with ruff"
	@echo "  make check          - Check code with ruff"
	@echo "  make lint           - Format and fix code with ruff"
	@echo "  make type-check     - Run type checking with basedpyright"
	@echo ""
	@echo "Docker Build Targets:"
	@echo "  make build-web      - Build web Docker image"
	@echo "  make build-api      - Build API Docker image"
	@echo "  make build-all      - Build all Docker images"
	@echo "  make push-all       - Push all Docker images"
	@echo "  make build-push-all - Build and push all Docker images"

# Phony targets
.PHONY: build-web build-api push-web push-api build-all push-all build-push-all dev-setup prepare-docker prepare-web prepare-api prepare-web-edu init-docker-env docker-up docker-rebuild docker-down docker-restart docker-clean docker-clean-all dev-clean dev-clean-all help format check lint type-check
