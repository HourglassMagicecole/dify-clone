#!/bin/bash

set -e

# Set UTF-8 encoding to address potential encoding issues in containerized environments
export LANG=${LANG:-en_US.UTF-8}
export LC_ALL=${LC_ALL:-en_US.UTF-8}
export PYTHONIOENCODING=${PYTHONIOENCODING:-utf-8}

# Generate API Key Encryption Key if not set
if [ -z "$API_KEY_ENCRYPTION_KEY" ]; then
    echo "⚠️  WARNING: API_KEY_ENCRYPTION_KEY not set!"
    echo "🔑 Generating new encryption key..."
    export API_KEY_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    echo "✅ Generated API_KEY_ENCRYPTION_KEY"
    echo ""
    echo "⚠️  CRITICAL: Save this key immediately!"
    echo "   Add to docker/.env file:"
    echo "   API_KEY_ENCRYPTION_KEY=$API_KEY_ENCRYPTION_KEY"
    echo ""
    echo "💡 TIP: Use 'make init-docker-env' before first deployment to avoid this warning"
    echo "   This will automatically save the key to docker/.env"
    echo ""
else
    echo "✅ API_KEY_ENCRYPTION_KEY is set"
fi

if [[ "${MIGRATION_ENABLED}" == "true" ]]; then
  echo "Running migrations"
  flask upgrade-db
  # Pure migration mode
  if [[ "${MODE}" == "migration" ]]; then
  echo "Migration completed, exiting normally"
  exit 0
  fi
fi

# Initialize Tenant Owner and install plugins only in API mode
# This prevents race conditions when multiple containers start simultaneously
if [[ "${MODE}" == "api" ]] || [[ -z "${MODE}" ]]; then
    # Initialize Tenant Owner if environment variables are set
    # Security Note: Remove or comment out INITIAL_ADMIN_* environment variables
    # after first deployment to avoid password exposure in docker-compose.yaml or .env files
    if [ ! -z "$INITIAL_ADMIN_EMAIL" ] && [ ! -z "$INITIAL_ADMIN_PASSWORD" ]; then
        echo "Checking initial admin setup..."
        if flask init-tenant \
            --email "$INITIAL_ADMIN_EMAIL" \
            --password "$INITIAL_ADMIN_PASSWORD" \
            --name "${INITIAL_ADMIN_NAME:-Admin}" 2>/dev/null; then
            echo "✅ Initial admin account created successfully"
            echo "   Email: $INITIAL_ADMIN_EMAIL"
            echo "   Name: ${INITIAL_ADMIN_NAME:-Admin}"
        else
            echo "ℹ️  Initial admin already exists (skipped)"
        fi
    else
        echo "ℹ️  INITIAL_ADMIN_EMAIL not set, skipping automatic tenant setup."
    fi

    # Install model provider plugins (OpenAI, Anthropic, Cohere, Gemini)
    # These are required for EduAI Console API Key management
    echo "🔌 Installing model provider plugins..."
    if flask provider install-plugins 2>/dev/null; then
        echo "✅ Provider plugins installed"
    else
        echo "⚠️  Plugin installation failed or already installed (will auto-install on first API Key creation)"
    fi
fi

if [[ "${MODE}" == "worker" ]]; then

  # Get the number of available CPU cores
  if [ "${CELERY_AUTO_SCALE,,}" = "true" ]; then
    # Set MAX_WORKERS to the number of available cores if not specified
    AVAILABLE_CORES=$(nproc)
    MAX_WORKERS=${CELERY_MAX_WORKERS:-$AVAILABLE_CORES}
    MIN_WORKERS=${CELERY_MIN_WORKERS:-1}
    CONCURRENCY_OPTION="--autoscale=${MAX_WORKERS},${MIN_WORKERS}"
  else
    CONCURRENCY_OPTION="-c ${CELERY_WORKER_AMOUNT:-1}"
  fi

  exec celery -A celery_entrypoint.celery worker -P ${CELERY_WORKER_CLASS:-gevent} $CONCURRENCY_OPTION \
    --max-tasks-per-child ${MAX_TASKS_PER_CHILD:-50} --loglevel ${LOG_LEVEL:-INFO} \
    -Q ${CELERY_QUEUES:-dataset,generation,pipeline,mail,ops_trace,app_deletion,plugin,workflow_storage,conversation}

elif [[ "${MODE}" == "beat" ]]; then
  exec celery -A app.celery beat --loglevel ${LOG_LEVEL:-INFO}
else
  if [[ "${DEBUG}" == "true" ]]; then
    exec flask run --host=${DIFY_BIND_ADDRESS:-0.0.0.0} --port=${DIFY_PORT:-5001} --debug
  else
    exec gunicorn \
      --bind "${DIFY_BIND_ADDRESS:-0.0.0.0}:${DIFY_PORT:-5001}" \
      --workers ${SERVER_WORKER_AMOUNT:-1} \
      --worker-class ${SERVER_WORKER_CLASS:-gevent} \
      --worker-connections ${SERVER_WORKER_CONNECTIONS:-10} \
      --timeout ${GUNICORN_TIMEOUT:-200} \
      app:app
  fi
fi
