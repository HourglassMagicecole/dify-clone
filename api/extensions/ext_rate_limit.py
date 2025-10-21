"""Rate limiting extension using Flask-Limiter."""

from collections.abc import Callable
from typing import TYPE_CHECKING

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from dify_app import DifyApp

if TYPE_CHECKING:
    # Type checking only - limiter is guaranteed to be initialized by init_app
    limiter: Limiter
else:
    limiter: Limiter | None = None


def init_app(app: DifyApp) -> None:
    """Initialize Flask-Limiter with Redis storage."""
    global limiter

    # Build Redis storage URI
    redis_host = app.config.get("REDIS_HOST", "localhost")
    redis_port = app.config.get("REDIS_PORT", 6379)
    redis_db = app.config.get("REDIS_DB", 0)
    storage_uri = f"redis://{redis_host}:{redis_port}/{redis_db}"

    # Initialize limiter with Redis as storage backend
    limiter = Limiter(
        get_remote_address,
        app=app,
        storage_uri=storage_uri,
        storage_options={
            "password": app.config.get("REDIS_PASSWORD"),
            "socket_connect_timeout": 30,
            "socket_keepalive": True,
        },
        default_limits=[],  # No default limits, we'll apply specific limits to endpoints
        strategy="fixed-window",  # Use fixed window strategy
    )

    app.extensions["limiter"] = limiter


def rate_limit(limit_string: str) -> Callable:
    """
    Lazy rate limit decorator that works in test environments.

    Args:
        limit_string: Rate limit string (e.g., "10 per minute")

    Returns:
        Decorated function
    """

    def decorator(f: Callable) -> Callable:
        # Get limiter from current app if available
        if limiter is not None:
            # Use the global limiter instance (initialized by init_app)
            return limiter.limit(limit_string)(f)
        else:
            # No limiter configured (test environment), return function as-is
            return f

    return decorator
