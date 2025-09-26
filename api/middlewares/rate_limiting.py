"""
Rate limiting middleware for education API endpoints.
"""

import logging
import os
import time
from functools import wraps
from typing import Any, Optional

from flask import g, jsonify, request

# Try to import Redis, fallback to in-memory if not available
try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logging.warning("Redis not available, falling back to in-memory rate limiting (not recommended for production)")


class RedisRateLimiter:
    """
    Redis-based rate limiter for API endpoints.

    This implementation uses Redis to store rate limit data,
    preventing memory leaks and supporting distributed systems.
    """

    def __init__(self, redis_client: Optional["redis.Redis"] = None):
        """Initialize the rate limiter with Redis client."""
        if redis_client:
            self.redis = redis_client
        else:
            # Try to connect to Redis using environment variables
            try:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                self.redis = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.redis.ping()
            except Exception as e:
                logging.exception("Failed to connect to Redis")
                self.redis = None

    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, dict[str, Any]]:
        """
        Check if request is allowed within rate limit using Redis.

        Args:
            key: Unique identifier (e.g., user_id, IP address)
            limit: Maximum number of requests allowed
            window: Time window in seconds

        Returns:
            Tuple of (is_allowed, info_dict)
        """
        if not self.redis:
            # Fallback: always allow if Redis is not available (log warning)
            logging.warning("Redis not available for rate limiting - allowing request")
            return True, {"limit": limit, "remaining": limit, "reset": int(time.time() + window)}

        try:
            now = time.time()
            pipeline = self.redis.pipeline()

            # Use Redis sorted set to store request timestamps
            redis_key = f"rate_limit:{key}"

            # Remove old entries outside the window
            pipeline.zremrangebyscore(redis_key, "-inf", now - window)

            # Count current requests in the window
            pipeline.zcard(redis_key)

            # Add current request with timestamp as score
            pipeline.zadd(redis_key, {str(now): now})

            # Set expiry on the key (cleanup)
            pipeline.expire(redis_key, window + 1)

            # Execute pipeline
            results = pipeline.execute()

            # results[1] is the count before adding current request
            current_requests = results[1]

            if current_requests >= limit:
                # Get the oldest request time to calculate retry_after
                oldest_request = self.redis.zrange(redis_key, 0, 0, withscores=True)
                if oldest_request:
                    oldest_time = oldest_request[0][1]
                    retry_after = int(oldest_time + window - now)
                else:
                    retry_after = window

                # Remove the current request we just added since it's not allowed
                self.redis.zrem(redis_key, str(now))

                return False, {"limit": limit, "remaining": 0, "reset": int(now + window), "retry_after": retry_after}

            return True, {"limit": limit, "remaining": limit - current_requests - 1, "reset": int(now + window)}

        except Exception as e:
            logging.exception("Redis rate limiting error")
            # Fallback: allow request but log the error
            return True, {"limit": limit, "remaining": limit, "reset": int(time.time() + window)}


class InMemoryRateLimiter:
    """
    Fallback in-memory rate limiter for when Redis is not available.

    WARNING: This implementation can cause memory leaks in production.
    It should only be used for development or as a last resort.
    """

    def __init__(self):
        self.requests: dict[str, list] = {}
        self._cleanup_counter = 0
        self._cleanup_interval = 100  # Clean up every 100 requests

    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, dict[str, Any]]:
        """
        Check if request is allowed within rate limit (in-memory).

        Args:
            key: Unique identifier (e.g., user_id, IP address)
            limit: Maximum number of requests allowed
            window: Time window in seconds

        Returns:
            Tuple of (is_allowed, info_dict)
        """
        now = time.time()
        cutoff = now - window

        # Periodic cleanup to prevent unbounded memory growth
        self._cleanup_counter += 1
        if self._cleanup_counter >= self._cleanup_interval:
            self._cleanup_old_entries(cutoff)
            self._cleanup_counter = 0

        # Initialize key if not exists
        if key not in self.requests:
            self.requests[key] = []

        # Remove old requests outside the window
        self.requests[key] = [req_time for req_time in self.requests[key] if req_time > cutoff]

        # Check if limit exceeded
        if len(self.requests[key]) >= limit:
            # Calculate time until next request allowed
            oldest_request = self.requests[key][0]
            retry_after = int(oldest_request + window - now)

            return False, {
                "limit": limit,
                "remaining": 0,
                "reset": int(oldest_request + window),
                "retry_after": retry_after,
            }

        # Add current request
        self.requests[key].append(now)

        return True, {"limit": limit, "remaining": limit - len(self.requests[key]), "reset": int(now + window)}

    def _cleanup_old_entries(self, cutoff: float) -> None:
        """Remove old entries from all keys to prevent memory growth."""
        keys_to_remove = []
        for key, timestamps in self.requests.items():
            # Remove old timestamps
            self.requests[key] = [t for t in timestamps if t > cutoff]
            # Mark empty keys for removal
            if not self.requests[key]:
                keys_to_remove.append(key)

        # Remove empty keys
        for key in keys_to_remove:
            del self.requests[key]


# Global rate limiter instance - prefer Redis, fallback to in-memory
if REDIS_AVAILABLE:
    rate_limiter = RedisRateLimiter()
else:
    logging.warning("Using in-memory rate limiter - not suitable for production!")
    rate_limiter = InMemoryRateLimiter()


def rate_limit(requests_per_minute: int = 50):
    """
    Rate limiting decorator for API endpoints.

    Args:
        requests_per_minute: Maximum requests allowed per minute (default: 50)
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get rate limit key (user_id if authenticated, else IP)
            if hasattr(g, "current_user") and g.current_user:
                key = f"user:{g.current_user.id}"
            else:
                # Use IP address for unauthenticated requests
                key = f"ip:{request.remote_addr}"

            # Check rate limit
            is_allowed, info = rate_limiter.is_allowed(key, requests_per_minute, 60)

            # Add rate limit headers to response
            @wraps(f)
            def add_headers(response):
                response.headers["X-RateLimit-Limit"] = str(info["limit"])
                response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
                response.headers["X-RateLimit-Reset"] = str(info["reset"])

                if not is_allowed:
                    response.headers["Retry-After"] = str(info["retry_after"])

                return response

            if not is_allowed:
                return add_headers(
                    jsonify(
                        {
                            "error": "Rate limit exceeded",
                            "message": f"Too many requests. Please retry after {info['retry_after']} seconds",
                            "retry_after": info["retry_after"],
                        }
                    )
                ), 429

            # Execute the original function
            result = f(*args, **kwargs)

            # Add headers to successful response
            if hasattr(result, "headers"):
                result.headers["X-RateLimit-Limit"] = str(info["limit"])
                result.headers["X-RateLimit-Remaining"] = str(info["remaining"])
                result.headers["X-RateLimit-Reset"] = str(info["reset"])

            return result

        return decorated_function

    return decorator


def rate_limit_by_key(key_func, limit: int = 50, window: int = 60):
    """
    Advanced rate limiting decorator with custom key function.

    Args:
        key_func: Function to generate rate limit key from request
        limit: Maximum requests allowed
        window: Time window in seconds
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Generate rate limit key
            key = key_func()

            # Check rate limit
            is_allowed, info = rate_limiter.is_allowed(key, limit, window)

            if not is_allowed:
                return jsonify(
                    {
                        "error": "Rate limit exceeded",
                        "message": f"Too many requests. Please retry after {info['retry_after']} seconds",
                        "retry_after": info["retry_after"],
                    }
                ), 429

            return f(*args, **kwargs)

        return decorated_function

    return decorator
