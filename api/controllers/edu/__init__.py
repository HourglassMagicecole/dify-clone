from flask import Blueprint
from flask_restx import Namespace

from libs.external_api import ExternalApi
from middlewares.rate_limiting import rate_limit

bp = Blueprint("edu", __name__, url_prefix="/edu/api")

# Apply rate limiting to all education API endpoints
@bp.before_request
@rate_limit(requests_per_minute=50)
def apply_rate_limit():
    """Apply rate limiting to all education API endpoints."""
    pass

api = ExternalApi(
    bp,
    version="1.0",
    title="Education API",
    description="Educational platform APIs for user management, sessions, progress tracking, "
                "templates, and API key management",
    doc="/docs",  # Enable Swagger UI at /edu/api/docs
)

# Create namespace
edu_ns = Namespace("education", description="Educational platform operations", path="/")

from . import (
    api_keys,
    groups,
    health,
    progress,
    sessions,
    templates,
    usage,
    users,
)
