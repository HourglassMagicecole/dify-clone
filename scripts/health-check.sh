#!/bin/bash

# Health Check Script for Dify Services
# This script performs comprehensive health checks for all Dify services

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yaml"
LOG_FILE="${PROJECT_DIR}/logs/health-check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
TIMEOUT=${TIMEOUT:-30}
RETRY_COUNT=${RETRY_COUNT:-3}
RETRY_DELAY=${RETRY_DELAY:-5}
VERBOSE=${VERBOSE:-0}
QUIET=${QUIET:-0}

# Service endpoints and health check configurations
declare -A SERVICE_ENDPOINTS=(
    ["api"]="http://localhost:5001/health"
    ["web"]="http://localhost:3000/api/health"
    ["web-edu"]="http://localhost:3001/api/health"
)

declare -A SERVICE_PORTS=(
    ["api"]="5001"
    ["web"]="3000"
    ["web-edu"]="3001"
    ["redis"]="6379"
    ["db"]="5432"
)

declare -A SERVICE_COMMANDS=(
    ["redis"]="redis-cli ping"
    ["db"]="pg_isready -h localhost -p 5432 -U postgres"
)

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [[ $QUIET -eq 0 ]]; then
        case $level in
            ERROR)   echo -e "${RED}[ERROR]${NC} ${message}" ;;
            SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} ${message}" ;;
            WARNING) echo -e "${YELLOW}[WARNING]${NC} ${message}" ;;
            INFO)    echo -e "${BLUE}[INFO]${NC} ${message}" ;;
        esac
    fi

    # Always log to file if verbose or error
    if [[ $VERBOSE -eq 1 || $level == "ERROR" ]]; then
        echo -e "${timestamp} [${level}] ${message}" >> "${LOG_FILE}" 2>/dev/null || true
    fi
}

# Help function
show_help() {
    cat << EOF
Health Check Script for Dify Services

Usage: $0 [OPTIONS] [SERVICE]

Options:
    -s, --service SERVICE       Check specific service (api, web, web-edu, redis, db, all)
    -t, --timeout SECONDS       Request timeout in seconds (default: 30)
    -r, --retry COUNT           Number of retry attempts (default: 3)
    -d, --delay SECONDS         Delay between retries in seconds (default: 5)
    -v, --verbose               Enable verbose logging
    -q, --quiet                 Suppress output (useful for scripts)
    -j, --json                  Output results in JSON format
    -c, --continuous            Run continuous health checks
    -i, --interval SECONDS      Interval for continuous checks (default: 60)
    -h, --help                  Show this help message

Services:
    api                         Dify API service
    web                         Dify Web UI
    web-edu                     Dify Education Platform
    redis                       Redis cache/broker
    db                          PostgreSQL database
    all                         Check all services (default)

Examples:
    $0                          # Check all services
    $0 --service api            # Check API service only
    $0 --service all --verbose  # Check all services with verbose output
    $0 --quiet --service db     # Check database quietly (for scripts)
    $0 --json                   # Output results in JSON format
    $0 --continuous             # Run continuous health checks

Exit Codes:
    0 - All checks passed
    1 - Some checks failed
    2 - Script error or invalid arguments

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--service)
                SERVICE="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -r|--retry)
                RETRY_COUNT="$2"
                shift 2
                ;;
            -d|--delay)
                RETRY_DELAY="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -q|--quiet)
                QUIET=1
                shift
                ;;
            -j|--json)
                JSON_OUTPUT=1
                QUIET=1
                shift
                ;;
            -c|--continuous)
                CONTINUOUS=1
                shift
                ;;
            -i|--interval)
                INTERVAL="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                log ERROR "Unknown option: $1"
                show_help
                exit 2
                ;;
            *)
                if [[ -z "${SERVICE:-}" ]]; then
                    SERVICE="$1"
                else
                    log ERROR "Multiple service arguments provided"
                    show_help
                    exit 2
                fi
                shift
                ;;
        esac
    done

    # Set defaults
    SERVICE=${SERVICE:-all}
    INTERVAL=${INTERVAL:-60}
}

# Check if service is running in Docker
is_service_running() {
    local service=$1
    local container_id

    container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)

    if [[ -z "$container_id" ]]; then
        return 1
    fi

    # Check if container is actually running
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "not_found")

    [[ "$status" == "running" ]]
}

# Check HTTP endpoint
check_http_endpoint() {
    local service=$1
    local endpoint=${SERVICE_ENDPOINTS[$service]}
    local attempt=1

    while [[ $attempt -le $RETRY_COUNT ]]; do
        log INFO "Checking HTTP endpoint for $service (attempt $attempt/$RETRY_COUNT): $endpoint"

        local response_code
        local response_time
        local start_time
        local end_time

        start_time=$(date +%s.%N)

        # Use curl with timeout and capture response code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout "$TIMEOUT" \
            --max-time "$TIMEOUT" \
            --retry 0 \
            "$endpoint" 2>/dev/null || echo "000")

        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")

        if [[ "$response_code" == "200" ]]; then
            log SUCCESS "$service endpoint is healthy (${response_code}, ${response_time}s)"
            return 0
        elif [[ "$response_code" == "000" ]]; then
            log WARNING "$service endpoint unreachable (attempt $attempt/$RETRY_COUNT)"
        else
            log WARNING "$service endpoint returned status ${response_code} (attempt $attempt/$RETRY_COUNT)"
        fi

        if [[ $attempt -lt $RETRY_COUNT ]]; then
            log INFO "Waiting ${RETRY_DELAY}s before retry..."
            sleep "$RETRY_DELAY"
        fi

        ((attempt++))
    done

    log ERROR "$service endpoint health check failed after $RETRY_COUNT attempts"
    return 1
}

# Check service with custom command
check_service_command() {
    local service=$1
    local command=${SERVICE_COMMANDS[$service]}
    local attempt=1

    while [[ $attempt -le $RETRY_COUNT ]]; do
        log INFO "Checking $service with command (attempt $attempt/$RETRY_COUNT): $command"

        if timeout "$TIMEOUT" bash -c "$command" &>/dev/null; then
            log SUCCESS "$service is healthy"
            return 0
        fi

        log WARNING "$service health check failed (attempt $attempt/$RETRY_COUNT)"

        if [[ $attempt -lt $RETRY_COUNT ]]; then
            log INFO "Waiting ${RETRY_DELAY}s before retry..."
            sleep "$RETRY_DELAY"
        fi

        ((attempt++))
    done

    log ERROR "$service health check failed after $RETRY_COUNT attempts"
    return 1
}

# Get service metrics
get_service_metrics() {
    local service=$1
    local container_id

    container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)

    if [[ -z "$container_id" ]]; then
        echo "Container not found"
        return 1
    fi

    # Get container stats
    local stats
    stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" "$container_id" 2>/dev/null || echo "N/A")

    echo "$stats"
}

# Check individual service
check_service() {
    local service=$1
    local start_time
    local check_result=0

    start_time=$(date +%s)

    log INFO "Checking service: $service"

    # Check if service is running
    if ! is_service_running "$service"; then
        log ERROR "$service is not running"
        return 1
    fi

    log SUCCESS "$service container is running"

    # Perform service-specific health checks
    if [[ -n "${SERVICE_ENDPOINTS[$service]:-}" ]]; then
        # HTTP endpoint check
        if ! check_http_endpoint "$service"; then
            check_result=1
        fi
    elif [[ -n "${SERVICE_COMMANDS[$service]:-}" ]]; then
        # Command-based check
        if ! check_service_command "$service"; then
            check_result=1
        fi
    else
        # Port-based check for services without specific commands
        local port=${SERVICE_PORTS[$service]:-}
        if [[ -n "$port" ]]; then
            if timeout 5 bash -c "</dev/tcp/localhost/$port" &>/dev/null; then
                log SUCCESS "$service port $port is accessible"
            else
                log ERROR "$service port $port is not accessible"
                check_result=1
            fi
        fi
    fi

    # Get service metrics if verbose
    if [[ $VERBOSE -eq 1 && $check_result -eq 0 ]]; then
        log INFO "$service metrics:"
        local metrics
        metrics=$(get_service_metrics "$service")
        log INFO "$metrics"
    fi

    local end_time
    local duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))

    if [[ $check_result -eq 0 ]]; then
        log SUCCESS "$service health check completed successfully (${duration}s)"
    else
        log ERROR "$service health check failed (${duration}s)"
    fi

    return $check_result
}

# Check all services
check_all_services() {
    local services=("api" "web" "redis" "db")
    local failed_services=()
    local passed_services=()
    local start_time
    local end_time

    start_time=$(date +%s)

    log INFO "Starting health check for all services..."

    # Check if web-edu exists and add it to services
    if docker-compose -f "$COMPOSE_FILE" config --services | grep -q "web-edu"; then
        services+=("web-edu")
    fi

    for service in "${services[@]}"; do
        if check_service "$service"; then
            passed_services+=("$service")
        else
            failed_services+=("$service")
        fi
    done

    end_time=$(date +%s)
    local total_duration=$((end_time - start_time))

    # Summary
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log SUCCESS "All services are healthy (${total_duration}s)"
        log INFO "Healthy services: ${passed_services[*]}"
        return 0
    else
        log ERROR "${#failed_services[@]}/${#services[@]} services failed health check (${total_duration}s)"
        log ERROR "Failed services: ${failed_services[*]}"
        [[ ${#passed_services[@]} -gt 0 ]] && log INFO "Healthy services: ${passed_services[*]}"
        return 1
    fi
}

# Generate JSON output
generate_json_output() {
    local services=("api" "web" "redis" "db")
    local json_results=()

    # Check if web-edu exists and add it to services
    if docker-compose -f "$COMPOSE_FILE" config --services | grep -q "web-edu"; then
        services+=("web-edu")
    fi

    for service in "${services[@]}"; do
        local status="healthy"
        local message="Service is running"
        local response_time="0"

        if ! check_service "$service" &>/dev/null; then
            status="unhealthy"
            message="Service health check failed"
        fi

        json_results+=("\"$service\":{\"status\":\"$status\",\"message\":\"$message\",\"response_time\":\"${response_time}s\"}")
    done

    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    echo "{\"timestamp\":\"$timestamp\",\"services\":{$(IFS=,; echo "${json_results[*]}")}}"
}

# Continuous health check
continuous_health_check() {
    log INFO "Starting continuous health check (interval: ${INTERVAL}s)"
    log INFO "Press Ctrl+C to stop"

    while true; do
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running health check..."

        if [[ "$SERVICE" == "all" ]]; then
            check_all_services
        else
            check_service "$SERVICE"
        fi

        echo "Next check in ${INTERVAL} seconds..."
        echo "----------------------------------------"

        sleep "$INTERVAL"
    done
}

# Main health check function
main() {
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"

    log INFO "Starting health check"
    log INFO "Service: $SERVICE"
    log INFO "Timeout: ${TIMEOUT}s"
    log INFO "Retry count: $RETRY_COUNT"

    # Check if Docker is accessible
    if ! docker info &>/dev/null; then
        log ERROR "Docker is not running or not accessible"
        exit 2
    fi

    # Check if docker-compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log ERROR "Docker Compose file not found: $COMPOSE_FILE"
        exit 2
    fi

    local exit_code=0

    if [[ -n "${JSON_OUTPUT:-}" ]]; then
        generate_json_output
        return 0
    fi

    if [[ -n "${CONTINUOUS:-}" ]]; then
        continuous_health_check
        return 0
    fi

    # Perform health checks
    if [[ "$SERVICE" == "all" ]]; then
        if ! check_all_services; then
            exit_code=1
        fi
    else
        # Validate service name
        if [[ ! " api web web-edu redis db " =~ " $SERVICE " ]]; then
            log ERROR "Invalid service name: $SERVICE"
            log ERROR "Valid services: api, web, web-edu, redis, db, all"
            exit 2
        fi

        if ! check_service "$SERVICE"; then
            exit_code=1
        fi
    fi

    if [[ $exit_code -eq 0 ]]; then
        log SUCCESS "Health check completed successfully"
    else
        log ERROR "Health check completed with failures"
    fi

    exit $exit_code
}

# Handle script termination
trap 'log INFO "Health check interrupted"; exit 1' INT TERM

# Parse arguments and run main function
parse_arguments "$@"
main