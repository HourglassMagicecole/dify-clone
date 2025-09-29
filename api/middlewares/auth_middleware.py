"""
Authentication middleware for education API endpoints.
"""

import os
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Optional

import jwt
from flask import g, jsonify, request

from extensions.ext_database import db
from models.education import EducationUser


def require_auth(f):
    """
    Authentication decorator for education API endpoints.

    Requires Bearer token for authentication.
    X-User-ID header is only allowed in development environment.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None

        # Only allow X-User-ID header in development environment
        if os.getenv("FLASK_ENV") == "development":
            user_id = request.headers.get("X-User-ID")
            if user_id:
                # Log warning in development
                import logging

                logging.warning(
                    "Using X-User-ID header authentication for user %s. This should only be used in development.",
                    user_id,
                )

        # Check for Bearer token (preferred method)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            validated_user_id = validate_token(token)
            if validated_user_id:
                user_id = validated_user_id

        if not user_id:
            return jsonify({"error": "Authentication required", "message": "Please provide a valid Bearer token"}), 401

        # Verify user exists
        user = db.session.query(EducationUser).filter_by(id=user_id).first()
        if not user:
            return jsonify({"error": "Invalid user", "message": "User not found"}), 401

        if not user.is_active:
            return jsonify({"error": "User inactive", "message": "Your account has been deactivated"}), 403

        # Store user in request context
        g.current_user = user

        return f(*args, **kwargs)

    return decorated_function


def require_admin(f):
    """
    Admin authorization decorator for education API endpoints.

    Requires user to have admin role.
    """

    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        if not hasattr(g, "current_user"):
            return jsonify({"error": "Authentication required", "message": "Please authenticate first"}), 401

        if g.current_user.role != "admin":
            return jsonify(
                {"error": "Admin access required", "message": "This endpoint requires admin privileges"}
            ), 403

        return f(*args, **kwargs)

    return decorated_function


def require_instructor(f):
    """
    Instructor authorization decorator for education API endpoints.

    Requires user to have instructor or admin role.
    """

    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        if not hasattr(g, "current_user"):
            return jsonify({"error": "Authentication required", "message": "Please authenticate first"}), 401

        if g.current_user.role not in ["instructor", "admin"]:
            return jsonify(
                {
                    "error": "Instructor access required",
                    "message": "This endpoint requires instructor or admin privileges",
                }
            ), 403

        return f(*args, **kwargs)

    return decorated_function


def validate_token(token: str) -> Optional[str]:
    """
    Validate JWT Bearer token and return user_id.

    Args:
        token: JWT Bearer token string

    Returns:
        User ID if token is valid, None otherwise
    """
    try:
        # Get JWT secret from environment variable
        jwt_secret = os.getenv("JWT_SECRET_KEY", "default-secret-key-change-in-production")

        # Decode and verify the token
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], options={"require": ["exp", "iat", "sub"]})

        # Check if token is expired (handled by jwt.decode, but being explicit)
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=UTC) < datetime.now(UTC):
            return None

        # Return the user_id from the 'sub' claim
        return payload.get("sub")

    except jwt.ExpiredSignatureError:
        # Token has expired
        return None
    except jwt.InvalidTokenError:
        # Token is invalid for any other reason
        return None
    except Exception:
        # Any other error
        return None


def create_token(user_id: str, expires_in: int = 3600) -> str:
    """
    Create a JWT token for a user.

    Args:
        user_id: User ID to encode in the token
        expires_in: Token expiration time in seconds (default: 1 hour)

    Returns:
        JWT token string
    """
    jwt_secret = os.getenv("JWT_SECRET_KEY", "default-secret-key-change-in-production")

    now = datetime.now(UTC)
    payload = {
        "sub": user_id,  # Subject (user_id)
        "iat": now,  # Issued at
        "exp": now + timedelta(seconds=expires_in),  # Expiration
        "type": "access",
    }

    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    return token


def refresh_token(token: str) -> Optional[str]:
    """
    Refresh a JWT token if it's valid but expiring soon.

    Args:
        token: Current JWT token

    Returns:
        New JWT token if refresh is needed, None otherwise
    """
    try:
        jwt_secret = os.getenv("JWT_SECRET_KEY", "default-secret-key-change-in-production")

        # Decode without verification to check expiration
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])

        # Check if token expires within next 5 minutes
        exp = payload.get("exp")
        if exp:
            exp_time = datetime.fromtimestamp(exp, tz=UTC)
            time_until_exp = exp_time - datetime.now(UTC)

            if time_until_exp < timedelta(minutes=5):
                # Create a new token with the same user_id
                return create_token(payload.get("sub"))

        return None

    except Exception:
        return None


def get_current_user() -> Optional[EducationUser]:
    """
    Get the current authenticated user from request context.

    Returns:
        Current user object or None if not authenticated
    """
    return getattr(g, "current_user", None)
