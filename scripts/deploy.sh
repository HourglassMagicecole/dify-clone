#!/bin/bash

# Blue-Green Deployment Script for Dify
# This script implements zero-downtime deployment using Blue-Green strategy

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yaml"
BACKUP_DIR="${PROJECT_DIR}/backups/deployments"
LOG_FILE="${PROJECT_DIR}/logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT=${ENVIRONMENT:-production}
SERVICES=${SERVICES:-"api web redis db"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-5}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"

    case $level in
        ERROR)   echo -e "${RED}[ERROR]${NC} ${message}" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} ${message}" ;;
        WARNING) echo -e "${YELLOW}[WARNING]${NC} ${message}" ;;
        INFO)    echo -e "${BLUE}[INFO]${NC} ${message}" ;;
    esac
}

# Help function
show_help() {
    cat << EOF
Blue-Green Deployment Script

Usage: $0 [OPTIONS] <new_version>

Options:
    -e, --environment ENV       Target environment (default: production)
    -s, --services SERVICES     Services to deploy (default: "api web redis db")
    -t, --timeout SECONDS       Health check timeout (default: 300)
    -i, --interval SECONDS      Health check interval (default: 5)
    -d, --dry-run              Show what would be done without executing
    -h, --help                 Show this help message
    --skip-backup              Skip database backup
    --skip-health-check        Skip health checks (not recommended)
    --force                    Force deployment even if health checks fail

Examples:
    $0 v1.2.3                           # Deploy version v1.2.3 to production
    $0 -e staging v1.2.3                # Deploy to staging environment
    $0 --services "api web" v1.2.3      # Deploy only API and Web services
    $0 --dry-run v1.2.3                 # Show deployment plan without executing

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--services)
                SERVICES="$2"
                shift 2
                ;;
            -t|--timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            -i|--interval)
                HEALTH_CHECK_INTERVAL="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=1
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=1
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=1
                shift
                ;;
            --force)
                FORCE_DEPLOY=1
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                log ERROR "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                if [[ -z "${NEW_VERSION:-}" ]]; then
                    NEW_VERSION="$1"
                else
                    log ERROR "Multiple version arguments provided"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "${NEW_VERSION:-}" ]]; then
        log ERROR "Version argument is required"
        show_help
        exit 1
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log INFO "Starting pre-deployment checks..."

    # Check if required files exist
    local required_files=("$COMPOSE_FILE" "${SCRIPT_DIR}/health-check.sh")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log ERROR "Required file not found: $file"
            exit 1
        fi
    done

    # Check if Docker is running
    if ! docker info &>/dev/null; then
        log ERROR "Docker is not running or not accessible"
        exit 1
    fi

    # Check if docker-compose is available
    if ! command -v docker-compose &>/dev/null; then
        log ERROR "docker-compose is not installed or not in PATH"
        exit 1
    fi

    # Create necessary directories
    mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log ERROR "Invalid environment: $ENVIRONMENT. Must be development, staging, or production"
        exit 1
    fi

    # Check if new version images exist
    for service in $SERVICES; do
        if [[ "$service" == "db" || "$service" == "redis" ]]; then
            continue # Skip infrastructure services
        fi

        local image="ghcr.io/$(git config --get remote.origin.url | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git/\1/')/${service}:${NEW_VERSION}"
        if [[ -z "${DRY_RUN:-}" ]]; then
            if ! docker manifest inspect "$image" &>/dev/null; then
                log ERROR "Image not found: $image"
                exit 1
            fi
        fi
        log INFO "Verified image exists: $image"
    done

    log SUCCESS "Pre-deployment checks completed"
}

# Create backup
create_backup() {
    if [[ -n "${SKIP_BACKUP:-}" ]]; then
        log WARNING "Skipping backup as requested"
        return 0
    fi

    log INFO "Creating backup before deployment..."

    local backup_timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_name="${ENVIRONMENT}_${backup_timestamp}_pre_${NEW_VERSION}"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    mkdir -p "$backup_path"

    # Backup database
    if [[ "$SERVICES" == *"db"* ]] || [[ "$SERVICES" == *"api"* ]]; then
        log INFO "Backing up database..."
        if [[ -n "${DRY_RUN:-}" ]]; then
            log INFO "[DRY RUN] Would backup database to: ${backup_path}/database.sql"
        else
            if "${SCRIPT_DIR}/backup_education_db.sh" -o "${backup_path}/database.sql"; then
                log SUCCESS "Database backup completed"
            else
                log ERROR "Database backup failed"
                exit 1
            fi
        fi
    fi

    # Backup current docker-compose configuration
    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would backup docker-compose configuration"
    else
        cp "$COMPOSE_FILE" "${backup_path}/docker-compose.yaml.backup"
        cp "${PROJECT_DIR}/.env" "${backup_path}/.env.backup" 2>/dev/null || true
        log SUCCESS "Configuration backup completed"
    fi

    # Store backup information
    cat > "${backup_path}/backup_info.txt" << EOF
Backup Information
==================
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Environment: ${ENVIRONMENT}
Previous Version: $(docker-compose -f "$COMPOSE_FILE" config | grep -m1 'image:' | cut -d: -f3 || echo "unknown")
New Version: ${NEW_VERSION}
Services: ${SERVICES}
Backup Path: ${backup_path}
EOF

    echo "$backup_path" > "${BACKUP_DIR}/latest_backup.txt"
    log SUCCESS "Backup created: $backup_name"

    # Cleanup old backups
    cleanup_old_backups
}

# Cleanup old backups
cleanup_old_backups() {
    log INFO "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would cleanup old backups"
        return 0
    fi

    find "$BACKUP_DIR" -name "${ENVIRONMENT}_*" -type d -mtime +${BACKUP_RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true
    log INFO "Backup cleanup completed"
}

# Deploy new version (Blue-Green strategy)
deploy_new_version() {
    log INFO "Starting Blue-Green deployment for version: $NEW_VERSION"

    # Update environment variables for new version
    local env_file="${PROJECT_DIR}/.env"
    local temp_env_file="${env_file}.deploy.tmp"

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would update environment variables for version $NEW_VERSION"
    else
        # Update version tags in environment file
        if [[ -f "$env_file" ]]; then
            cp "$env_file" "$temp_env_file"

            # Update image tags
            for service in $SERVICES; do
                if [[ "$service" == "db" || "$service" == "redis" ]]; then
                    continue
                fi

                local var_name=$(echo "${service}_IMAGE_TAG" | tr '[:lower:]' '[:upper:]')
                if grep -q "^${var_name}=" "$temp_env_file"; then
                    sed -i "s/^${var_name}=.*/${var_name}=${NEW_VERSION}/" "$temp_env_file"
                else
                    echo "${var_name}=${NEW_VERSION}" >> "$temp_env_file"
                fi
            done

            mv "$temp_env_file" "$env_file"
            log INFO "Environment variables updated"
        fi
    fi

    # Deploy services using blue-green strategy
    for service in $SERVICES; do
        deploy_service "$service"
    done

    log SUCCESS "Blue-Green deployment completed"
}

# Deploy individual service
deploy_service() {
    local service=$1
    log INFO "Deploying service: $service"

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would deploy service: $service"
        return 0
    fi

    # Create new service with -green suffix
    local green_service="${service}-green"

    # Start green service
    log INFO "Starting green service: $green_service"
    docker-compose -f "$COMPOSE_FILE" up -d "$green_service" 2>/dev/null || {
        # If green service doesn't exist, update the existing service
        log INFO "Green service not configured, updating existing service: $service"
        docker-compose -f "$COMPOSE_FILE" up -d "$service"
    }

    # Wait for service to be ready
    if [[ -z "${SKIP_HEALTH_CHECK:-}" ]]; then
        wait_for_service_health "$service"
    fi
}

# Wait for service health check
wait_for_service_health() {
    local service=$1
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=1

    log INFO "Waiting for service health check: $service"

    while [[ $attempt -le $max_attempts ]]; do
        if "${SCRIPT_DIR}/health-check.sh" --service "$service" --quiet; then
            log SUCCESS "Service $service is healthy"
            return 0
        fi

        log INFO "Health check attempt $attempt/$max_attempts for $service..."
        sleep "$HEALTH_CHECK_INTERVAL"
        ((attempt++))
    done

    log ERROR "Health check failed for service: $service"

    if [[ -n "${FORCE_DEPLOY:-}" ]]; then
        log WARNING "Continuing deployment despite health check failure (--force used)"
        return 0
    fi

    return 1
}

# Switch traffic (Blue-Green cutover)
switch_traffic() {
    log INFO "Switching traffic to new version..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would switch traffic to new version"
        return 0
    fi

    # Update load balancer or proxy configuration
    # This would typically involve updating nginx configuration,
    # service mesh configuration, or cloud load balancer rules

    # For this implementation, we'll update the main service labels
    for service in $SERVICES; do
        if docker-compose -f "$COMPOSE_FILE" ps "${service}-green" &>/dev/null; then
            log INFO "Switching traffic from $service to ${service}-green"

            # Stop old service
            docker-compose -f "$COMPOSE_FILE" stop "$service"

            # Rename green service to main service
            docker-compose -f "$COMPOSE_FILE" stop "${service}-green"
            docker-compose -f "$COMPOSE_FILE" up -d "$service"
        fi
    done

    log SUCCESS "Traffic switched to new version"
}

# Post-deployment verification
post_deployment_verification() {
    log INFO "Starting post-deployment verification..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would perform post-deployment verification"
        return 0
    fi

    # Run comprehensive health checks
    if [[ -z "${SKIP_HEALTH_CHECK:-}" ]]; then
        for service in $SERVICES; do
            if ! "${SCRIPT_DIR}/health-check.sh" --service "$service"; then
                log ERROR "Post-deployment health check failed for: $service"
                return 1
            fi
        done
    fi

    # Verify service versions
    verify_deployment_version

    log SUCCESS "Post-deployment verification completed"
}

# Verify deployment version
verify_deployment_version() {
    log INFO "Verifying deployed version..."

    for service in $SERVICES; do
        if [[ "$service" == "db" || "$service" == "redis" ]]; then
            continue
        fi

        local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service")
        if [[ -n "$container_id" ]]; then
            local deployed_version=$(docker inspect "$container_id" --format='{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null || echo "unknown")
            if [[ "$deployed_version" == "$NEW_VERSION" ]]; then
                log SUCCESS "Service $service is running version: $deployed_version"
            else
                log WARNING "Service $service version mismatch. Expected: $NEW_VERSION, Actual: $deployed_version"
            fi
        fi
    done
}

# Cleanup old containers
cleanup() {
    log INFO "Cleaning up old containers and images..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would cleanup old containers and images"
        return 0
    fi

    # Remove old containers
    docker-compose -f "$COMPOSE_FILE" ps -a | grep -E "(Exit|Created)" | awk '{print $1}' | xargs -r docker rm 2>/dev/null || true

    # Remove dangling images
    docker image prune -f &>/dev/null || true

    log SUCCESS "Cleanup completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)

    log INFO "Starting Blue-Green deployment"
    log INFO "Environment: $ENVIRONMENT"
    log INFO "Services: $SERVICES"
    log INFO "New Version: $NEW_VERSION"

    if [[ -n "${DRY_RUN:-}" ]]; then
        log WARNING "DRY RUN MODE - No actual changes will be made"
    fi

    # Execute deployment steps
    pre_deployment_checks
    create_backup
    deploy_new_version

    if [[ -z "${SKIP_HEALTH_CHECK:-}" ]]; then
        # Wait a bit for services to stabilize
        if [[ -z "${DRY_RUN:-}" ]]; then
            log INFO "Waiting for services to stabilize..."
            sleep 10
        fi
    fi

    switch_traffic
    post_deployment_verification
    cleanup

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log SUCCESS "Deployment completed successfully in ${duration} seconds"
    log INFO "New version $NEW_VERSION is now live in $ENVIRONMENT environment"

    # Show deployment summary
    cat << EOF

🚀 Deployment Summary
===================
Environment: ${ENVIRONMENT}
Version: ${NEW_VERSION}
Services: ${SERVICES}
Duration: ${duration} seconds
Status: SUCCESS

Next steps:
- Monitor application logs: docker-compose logs -f
- Check metrics and alerts
- Verify user-facing functionality
- Keep backup for rollback if needed: $(cat "${BACKUP_DIR}/latest_backup.txt" 2>/dev/null || echo "N/A")

EOF
}

# Handle script termination
trap 'log ERROR "Deployment interrupted"; exit 1' INT TERM

# Parse arguments and run main function
parse_arguments "$@"
main