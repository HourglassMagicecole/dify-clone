#!/bin/bash

# Rollback Script for Dify
# This script implements automated rollback functionality for failed deployments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yaml"
BACKUP_DIR="${PROJECT_DIR}/backups/deployments"
LOG_FILE="${PROJECT_DIR}/logs/rollback.log"

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
Automated Rollback Script

Usage: $0 [OPTIONS] [backup_name]

Options:
    -e, --environment ENV       Target environment (default: production)
    -s, --services SERVICES     Services to rollback (default: "api web redis db")
    -t, --timeout SECONDS       Health check timeout (default: 300)
    -i, --interval SECONDS      Health check interval (default: 5)
    -l, --list                  List available backups
    -d, --dry-run              Show what would be done without executing
    -f, --force                Force rollback without confirmation
    -h, --help                 Show this help message
    --latest                   Rollback to the latest backup
    --db-only                  Rollback database only
    --app-only                 Rollback application only (skip database)

Examples:
    $0                                    # Rollback to latest backup with confirmation
    $0 --latest --force                   # Rollback to latest backup without confirmation
    $0 production_20241226_143000_pre_v1.2.3  # Rollback to specific backup
    $0 --list                            # List available backups
    $0 --db-only --latest               # Rollback database only
    $0 --app-only --latest              # Rollback application only

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
            -l|--list)
                LIST_BACKUPS=1
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=1
                shift
                ;;
            -f|--force)
                FORCE_ROLLBACK=1
                shift
                ;;
            --latest)
                USE_LATEST=1
                shift
                ;;
            --db-only)
                DB_ONLY=1
                SERVICES="db"
                shift
                ;;
            --app-only)
                APP_ONLY=1
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
                if [[ -z "${BACKUP_NAME:-}" ]]; then
                    BACKUP_NAME="$1"
                else
                    log ERROR "Multiple backup arguments provided"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# List available backups
list_backups() {
    log INFO "Available backups for environment: $ENVIRONMENT"
    echo
    echo "📦 Backup List:"
    echo "==============="

    if [[ ! -d "$BACKUP_DIR" ]]; then
        log WARNING "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi

    local backups=()
    while IFS= read -r -d '' backup; do
        backups+=("$(basename "$backup")")
    done < <(find "$BACKUP_DIR" -name "${ENVIRONMENT}_*" -type d -print0 | sort -z)

    if [[ ${#backups[@]} -eq 0 ]]; then
        log WARNING "No backups found for environment: $ENVIRONMENT"
        return 1
    fi

    local count=1
    for backup in "${backups[@]}"; do
        local backup_path="${BACKUP_DIR}/${backup}"
        local info_file="${backup_path}/backup_info.txt"
        local timestamp=""
        local version=""

        if [[ -f "$info_file" ]]; then
            timestamp=$(grep "Timestamp:" "$info_file" | cut -d: -f2- | xargs)
            version=$(grep "New Version:" "$info_file" | cut -d: -f2 | xargs)
        fi

        printf "%2d. %s\n" "$count" "$backup"
        [[ -n "$timestamp" ]] && printf "    📅 %s\n" "$timestamp"
        [[ -n "$version" ]] && printf "    🏷️  Version: %s\n" "$version"

        # Check if this is the latest backup
        if [[ -f "${BACKUP_DIR}/latest_backup.txt" ]]; then
            local latest_backup=$(cat "${BACKUP_DIR}/latest_backup.txt" 2>/dev/null | xargs basename 2>/dev/null || echo "")
            if [[ "$backup" == "$latest_backup" ]]; then
                printf "    ⭐ Latest backup\n"
            fi
        fi

        echo
        ((count++))
    done

    return 0
}

# Get backup to use
get_backup_to_use() {
    if [[ -n "${LIST_BACKUPS:-}" ]]; then
        list_backups
        exit 0
    fi

    if [[ -n "${USE_LATEST:-}" ]] || [[ -z "${BACKUP_NAME:-}" ]]; then
        if [[ -f "${BACKUP_DIR}/latest_backup.txt" ]]; then
            BACKUP_PATH=$(cat "${BACKUP_DIR}/latest_backup.txt")
            BACKUP_NAME=$(basename "$BACKUP_PATH")
            log INFO "Using latest backup: $BACKUP_NAME"
        else
            log ERROR "No latest backup reference found. Please specify a backup name."
            list_backups
            exit 1
        fi
    else
        BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
    fi

    if [[ ! -d "$BACKUP_PATH" ]]; then
        log ERROR "Backup not found: $BACKUP_PATH"
        log INFO "Available backups:"
        list_backups
        exit 1
    fi

    log INFO "Selected backup: $BACKUP_NAME"
    log INFO "Backup path: $BACKUP_PATH"
}

# Confirm rollback
confirm_rollback() {
    if [[ -n "${FORCE_ROLLBACK:-}" || -n "${DRY_RUN:-}" ]]; then
        return 0
    fi

    local info_file="${BACKUP_PATH}/backup_info.txt"
    if [[ -f "$info_file" ]]; then
        echo
        echo "📋 Backup Information:"
        echo "====================="
        cat "$info_file"
        echo
    fi

    echo -e "${YELLOW}⚠️  WARNING: This will rollback the following:${NC}"
    echo "   Environment: $ENVIRONMENT"
    echo "   Services: $SERVICES"
    echo "   Backup: $BACKUP_NAME"

    if [[ -z "${APP_ONLY:-}" ]]; then
        echo "   🗄️  Database will be restored (DATA LOSS POSSIBLE)"
    fi

    echo
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log INFO "Rollback cancelled by user"
        exit 0
    fi
}

# Pre-rollback checks
pre_rollback_checks() {
    log INFO "Starting pre-rollback checks..."

    # Check if required files exist
    local required_files=("${SCRIPT_DIR}/health-check.sh")
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

    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"

    # Check if backup contains necessary files
    local backup_files=()
    [[ -z "${APP_ONLY:-}" ]] && backup_files+=("${BACKUP_PATH}/database.sql")
    backup_files+=("${BACKUP_PATH}/docker-compose.yaml.backup")

    for file in "${backup_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log ERROR "Backup file not found: $file"
            exit 1
        fi
    done

    log SUCCESS "Pre-rollback checks completed"
}

# Create rollback backup
create_rollback_backup() {
    log INFO "Creating backup of current state before rollback..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would create rollback backup"
        return 0
    fi

    local rollback_timestamp=$(date '+%Y%m%d_%H%M%S')
    local rollback_backup_name="${ENVIRONMENT}_${rollback_timestamp}_pre_rollback"
    local rollback_backup_path="${BACKUP_DIR}/${rollback_backup_name}"

    mkdir -p "$rollback_backup_path"

    # Backup current database
    if [[ -z "${APP_ONLY:-}" ]]; then
        log INFO "Backing up current database..."
        if "${SCRIPT_DIR}/backup_education_db.sh" -o "${rollback_backup_path}/database.sql"; then
            log SUCCESS "Current database backed up"
        else
            log ERROR "Failed to backup current database"
            exit 1
        fi
    fi

    # Backup current configuration
    cp "$COMPOSE_FILE" "${rollback_backup_path}/docker-compose.yaml.backup" 2>/dev/null || true
    cp "${PROJECT_DIR}/.env" "${rollback_backup_path}/.env.backup" 2>/dev/null || true

    # Store rollback backup information
    cat > "${rollback_backup_path}/backup_info.txt" << EOF
Rollback Backup Information
===========================
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Environment: ${ENVIRONMENT}
Purpose: Pre-rollback backup
Original Backup: ${BACKUP_NAME}
Services: ${SERVICES}
Backup Path: ${rollback_backup_path}
EOF

    log SUCCESS "Rollback backup created: $rollback_backup_name"
}

# Rollback database
rollback_database() {
    if [[ -n "${APP_ONLY:-}" ]]; then
        log INFO "Skipping database rollback (--app-only specified)"
        return 0
    fi

    log INFO "Rolling back database..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would rollback database from: ${BACKUP_PATH}/database.sql"
        return 0
    fi

    local db_backup="${BACKUP_PATH}/database.sql"
    if [[ ! -f "$db_backup" ]]; then
        log ERROR "Database backup file not found: $db_backup"
        return 1
    fi

    # Stop services that depend on database
    log INFO "Stopping services for database rollback..."
    for service in api worker; do
        if [[ "$SERVICES" == *"$service"* ]]; then
            docker-compose -f "$COMPOSE_FILE" stop "$service" 2>/dev/null || true
        fi
    done

    # Restore database
    log INFO "Restoring database from backup..."
    if "${SCRIPT_DIR}/restore_education_db.sh" -i "$db_backup"; then
        log SUCCESS "Database rollback completed"
    else
        log ERROR "Database rollback failed"
        return 1
    fi
}

# Rollback application services
rollback_application() {
    if [[ -n "${DB_ONLY:-}" ]]; then
        log INFO "Skipping application rollback (--db-only specified)"
        return 0
    fi

    log INFO "Rolling back application services..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would rollback application services"
        return 0
    fi

    # Restore configuration files
    local config_backup="${BACKUP_PATH}/docker-compose.yaml.backup"
    local env_backup="${BACKUP_PATH}/.env.backup"

    if [[ -f "$config_backup" ]]; then
        cp "$config_backup" "$COMPOSE_FILE"
        log INFO "Docker Compose configuration restored"
    fi

    if [[ -f "$env_backup" ]]; then
        cp "$env_backup" "${PROJECT_DIR}/.env"
        log INFO "Environment configuration restored"
    fi

    # Rollback services
    for service in $SERVICES; do
        if [[ "$service" == "db" ]]; then
            continue # Database already handled
        fi

        rollback_service "$service"
    done

    log SUCCESS "Application rollback completed"
}

# Rollback individual service
rollback_service() {
    local service=$1
    log INFO "Rolling back service: $service"

    # Stop current service
    docker-compose -f "$COMPOSE_FILE" stop "$service" 2>/dev/null || true

    # Remove current containers
    docker-compose -f "$COMPOSE_FILE" rm -f "$service" 2>/dev/null || true

    # Start service with restored configuration
    log INFO "Starting rolled back service: $service"
    if docker-compose -f "$COMPOSE_FILE" up -d "$service"; then
        log INFO "Service $service rolled back successfully"

        # Wait for service to be ready
        wait_for_service_health "$service"
    else
        log ERROR "Failed to start rolled back service: $service"
        return 1
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
    return 1
}

# Post-rollback verification
post_rollback_verification() {
    log INFO "Starting post-rollback verification..."

    if [[ -n "${DRY_RUN:-}" ]]; then
        log INFO "[DRY RUN] Would perform post-rollback verification"
        return 0
    fi

    # Run health checks
    local failed_services=()
    for service in $SERVICES; do
        if [[ "$service" == "db" ]]; then
            # For database, check if it's running and accessible
            if ! docker-compose -f "$COMPOSE_FILE" exec db pg_isready -U postgres &>/dev/null; then
                failed_services+=("$service")
            fi
        else
            if ! "${SCRIPT_DIR}/health-check.sh" --service "$service" --quiet; then
                failed_services+=("$service")
            fi
        fi
    done

    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log ERROR "Health checks failed for services: ${failed_services[*]}"
        return 1
    fi

    # Verify rollback version
    verify_rollback_version

    log SUCCESS "Post-rollback verification completed"
}

# Verify rollback version
verify_rollback_version() {
    log INFO "Verifying rollback version..."

    local info_file="${BACKUP_PATH}/backup_info.txt"
    if [[ -f "$info_file" ]]; then
        local expected_version=$(grep "Previous Version:" "$info_file" | cut -d: -f2 | xargs)
        if [[ -n "$expected_version" && "$expected_version" != "unknown" ]]; then
            log INFO "Expected version after rollback: $expected_version"

            for service in $SERVICES; do
                if [[ "$service" == "db" || "$service" == "redis" ]]; then
                    continue
                fi

                local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null)
                if [[ -n "$container_id" ]]; then
                    local deployed_version=$(docker inspect "$container_id" --format='{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null || echo "unknown")
                    if [[ "$deployed_version" == "$expected_version" ]]; then
                        log SUCCESS "Service $service rollback verified: $deployed_version"
                    else
                        log WARNING "Service $service version unexpected. Expected: $expected_version, Actual: $deployed_version"
                    fi
                fi
            done
        fi
    fi
}

# Main rollback function
main() {
    local start_time=$(date +%s)

    log INFO "Starting rollback process"
    log INFO "Environment: $ENVIRONMENT"
    log INFO "Services: $SERVICES"

    if [[ -n "${DRY_RUN:-}" ]]; then
        log WARNING "DRY RUN MODE - No actual changes will be made"
    fi

    # Execute rollback steps
    get_backup_to_use
    confirm_rollback
    pre_rollback_checks
    create_rollback_backup
    rollback_database
    rollback_application
    post_rollback_verification

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log SUCCESS "Rollback completed successfully in ${duration} seconds"

    # Show rollback summary
    cat << EOF

🔄 Rollback Summary
==================
Environment: ${ENVIRONMENT}
Services: ${SERVICES}
Backup Used: ${BACKUP_NAME}
Duration: ${duration} seconds
Status: SUCCESS

The system has been rolled back to the previous state.
Please verify functionality and monitor logs:
- docker-compose logs -f

EOF
}

# Handle script termination
trap 'log ERROR "Rollback interrupted"; exit 1' INT TERM

# Parse arguments and run main function
parse_arguments "$@"
main