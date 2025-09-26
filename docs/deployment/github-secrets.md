# GitHub Secrets Configuration Guide

This document provides guidance on setting up GitHub Secrets for the Dify CI/CD pipeline.

## Overview

GitHub Secrets are used to store sensitive information that should not be exposed in your repository. The CI/CD pipeline uses these secrets to deploy to different environments securely.

## Required Secrets

### Database Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `DB_HOST` | Database hostname | `db.example.com` | All |
| `DB_PORT` | Database port | `5432` | All |
| `DB_DATABASE` | Database name | `dify_prod` | All |
| `DB_USERNAME` | Database username | `dify_user` | All |
| `DB_PASSWORD` | Database password | `secure_password_123` | All |

### Redis Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `REDIS_HOST` | Redis hostname | `redis.example.com` | All |
| `REDIS_PORT` | Redis port | `6379` | All |
| `REDIS_PASSWORD` | Redis password | `redis_password_123` | All |
| `CELERY_BROKER_URL` | Celery broker URL | `redis://redis.example.com:6379/1` | All |

### Security Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `SECRET_KEY` | Flask secret key | `sk-prod-very-secure-key-here` | All |
| `INIT_PASSWORD` | Initial admin password | `admin_password_123` | All |
| `EDU_SESSION_SECRET` | Education session secret | `edu-session-secret-key` | All |

### External Services

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` | All |
| `OPENAI_API_BASE` | OpenAI API base URL | `https://api.openai.com/v1` | All |
| `SENTRY_DSN` | Sentry DSN for error tracking | `https://...@sentry.io/...` | Staging/Prod |

### File Storage (AWS S3)

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key ID | `AKIAIOSFODNN7EXAMPLE` | Staging/Prod |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `wJalrXUtnFEMI/K7MDENG/...` | Staging/Prod |
| `STORAGE_S3_BUCKET` | S3 bucket name | `dify-storage-prod` | Staging/Prod |
| `STORAGE_S3_REGION` | S3 bucket region | `us-east-1` | Staging/Prod |

### Email Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `SMTP_SERVER` | SMTP server hostname | `smtp.example.com` | Staging/Prod |
| `SMTP_PORT` | SMTP server port | `587` | Staging/Prod |
| `SMTP_USERNAME` | SMTP username | `noreply@example.com` | Staging/Prod |
| `SMTP_PASSWORD` | SMTP password | `smtp_password_123` | Staging/Prod |
| `MAIL_DEFAULT_SEND_FROM` | Default sender email | `noreply@example.com` | Staging/Prod |

### Application URLs

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `CONSOLE_API_URL` | Console API URL | `https://api.dify.com` | Staging/Prod |
| `CONSOLE_WEB_URL` | Console web URL | `https://app.dify.com` | Staging/Prod |
| `APP_API_URL` | Application API URL | `https://api.dify.com/api` | Staging/Prod |
| `APP_WEB_URL` | Application web URL | `https://app.dify.com` | Staging/Prod |
| `FILES_URL` | Files service URL | `https://files.dify.com` | Staging/Prod |

### Educational Platform

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `EDU_CORS_ORIGINS` | CORS origins for EDU | `https://edu.dify.com,https://app.dify.com` | All |
| `EDU_MAX_USERS` | Maximum EDU users | `50` | Staging/Prod |
| `EDU_API_RATE_LIMIT` | EDU API rate limit | `1000` | Staging/Prod |

### Deployment Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `API_IMAGE_TAG` | API Docker image tag | `v1.2.3` | All |
| `WEB_IMAGE_TAG` | Web Docker image tag | `v1.2.3` | All |
| `WEB_EDU_IMAGE_TAG` | Web-EDU Docker image tag | `v1.2.3` | All |

### Notification Configuration

| Secret Name | Description | Example | Environment |
|-------------|-------------|---------|-------------|
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | `https://hooks.slack.com/services/...` | Optional |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | `https://discord.com/api/webhooks/...` | Optional |

## Environment-Specific Secrets

### Development Environment
For development, most secrets can use default values or be omitted. The pipeline will use the `.env.development` template.

### Staging Environment
Staging should use production-like values but with staging-specific endpoints:
- Use staging database and Redis instances
- Use staging domain names
- Enable additional logging and monitoring

### Production Environment
Production requires all secrets to be properly configured:
- Use production database and Redis instances
- Use production domain names
- Enable all security features
- Configure proper monitoring and alerting

## Setting Up Secrets

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Set a single secret
gh secret set SECRET_NAME --body "secret_value"

# Set secrets from a file
gh secret set SECRET_NAME < secret_file.txt

# Set multiple secrets interactively
gh secret set SECRET_NAME
# Enter the secret value when prompted
```

### Bulk Secret Setup Script

Create a script to set multiple secrets:

```bash
#!/bin/bash

# secrets.sh - Bulk secret setup script

set -euo pipefail

# Database secrets
gh secret set DB_HOST --body "your-db-host"
gh secret set DB_PORT --body "5432"
gh secret set DB_DATABASE --body "dify_prod"
gh secret set DB_USERNAME --body "dify_user"
gh secret set DB_PASSWORD --body "your-db-password"

# Redis secrets
gh secret set REDIS_HOST --body "your-redis-host"
gh secret set REDIS_PORT --body "6379"
gh secret set REDIS_PASSWORD --body "your-redis-password"
gh secret set CELERY_BROKER_URL --body "redis://your-redis-host:6379/1"

# Security secrets
gh secret set SECRET_KEY --body "your-flask-secret-key"
gh secret set INIT_PASSWORD --body "your-admin-password"
gh secret set EDU_SESSION_SECRET --body "your-edu-session-secret"

# External services
gh secret set OPENAI_API_KEY --body "your-openai-api-key"
gh secret set SENTRY_DSN --body "your-sentry-dsn"

# Add more secrets as needed...

echo "✅ All secrets have been set successfully!"
```

## Environment Variables Validation

The CI/CD pipeline includes validation to ensure all required secrets are present:

```yaml
# In .github/workflows/backend-ci.yml
- name: Validate environment variables
  run: |
    required_vars=("DB_HOST" "DB_PASSWORD" "SECRET_KEY" "REDIS_HOST")
    for var in "${required_vars[@]}"; do
      if [[ -z "${!var:-}" ]]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
      fi
    done
    echo "✅ All required environment variables are set"
```

## Security Best Practices

### Secret Management

1. **Use Strong Values**: Generate cryptographically secure random values for secrets
2. **Regular Rotation**: Rotate secrets regularly, especially for production
3. **Least Privilege**: Only grant access to secrets that are actually needed
4. **Environment Separation**: Use different secrets for different environments

### Secret Generation

```bash
# Generate secure random passwords
openssl rand -base64 32

# Generate Flask secret keys
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate UUID-based secrets
uuidgen | tr -d '\n' | sha256sum | cut -d' ' -f1
```

### Access Control

1. **Repository Settings**: Ensure only authorized users can modify secrets
2. **Branch Protection**: Require reviews for changes to deployment workflows
3. **Audit Logs**: Regularly review secret access logs
4. **Monitoring**: Set up alerts for secret usage anomalies

## Troubleshooting

### Common Issues

#### Secret Not Available in Workflow
```bash
# Check if secret is properly referenced
- name: Check secret
  run: |
    if [[ -z "${{ secrets.SECRET_NAME }}" ]]; then
      echo "❌ Secret SECRET_NAME is not available"
      exit 1
    fi
```

#### Environment-Specific Secrets
```yaml
# Use different secrets per environment
- name: Set environment variables
  run: |
    if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      echo "DB_HOST=${{ secrets.PROD_DB_HOST }}" >> $GITHUB_ENV
    else
      echo "DB_HOST=${{ secrets.STAGING_DB_HOST }}" >> $GITHUB_ENV
    fi
```

#### Secret Validation
```bash
# Validate secret format
- name: Validate database URL
  run: |
    if [[ ! "${{ secrets.DATABASE_URL }}" =~ ^postgresql:// ]]; then
      echo "❌ Invalid database URL format"
      exit 1
    fi
```

### Debugging Steps

1. **Check Secret Names**: Ensure secret names match exactly (case-sensitive)
2. **Verify Permissions**: Confirm the workflow has access to secrets
3. **Test Locally**: Use environment files to test configurations locally
4. **Review Logs**: Check workflow logs for secret-related errors
5. **Validate Values**: Ensure secret values are correct and properly formatted

## Maintenance

### Regular Tasks

1. **Secret Rotation**: Plan quarterly rotation for critical secrets
2. **Access Review**: Review who has access to modify secrets
3. **Cleanup**: Remove unused or deprecated secrets
4. **Documentation**: Keep this documentation updated with new secrets

### Monitoring

Set up monitoring for:
- Failed deployments due to missing/invalid secrets
- Unusual secret access patterns
- Expired certificates or credentials
- Database connection failures

## Emergency Procedures

### Secret Compromise

1. **Immediate Action**: Rotate the compromised secret immediately
2. **Update GitHub**: Update the secret in GitHub Secrets
3. **Redeploy**: Trigger a new deployment to use the new secret
4. **Audit**: Review access logs to understand the scope of compromise
5. **Communication**: Notify relevant team members

### Deployment Failure

1. **Check Logs**: Review deployment logs for secret-related errors
2. **Validate Secrets**: Ensure all required secrets are present and valid
3. **Test Connection**: Verify external services are accessible
4. **Rollback**: Use rollback procedures if necessary
5. **Fix and Retry**: Correct issues and retry deployment

## Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Docker Secrets Management](https://docs.docker.com/engine/swarm/secrets/)
- [Security Hardening Guide](./security-hardening.md)