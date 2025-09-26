#!/usr/bin/env python3
"""
Script to generate Postman collection for Education API.
"""

import json
import uuid
from datetime import datetime
from typing import Any


def generate_postman_collection() -> dict[str, Any]:
    """
    Generate a complete Postman collection for the Education API.

    Returns:
        Dict[str, Any]: Postman collection JSON
    """

    # Collection metadata
    collection = {
        "info": {
            "name": "Dify Education API",
            "description": "Educational platform APIs for user management, sessions, progress tracking, templates, and API key management",
            "version": "1.0.0",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "_postman_id": str(uuid.uuid4()),
            "_exporter_id": str(uuid.uuid4()),
        },
        "item": [],
        "variable": [
            {
                "key": "base_url",
                "value": "http://localhost:5000/edu/api",
                "type": "string",
                "description": "Base URL for the Education API",
            },
            {"key": "user_id", "value": "user-123", "type": "string", "description": "Mock user ID for authentication"},
        ],
    }

    # Health Check endpoints
    health_folder = {
        "name": "Health Check",
        "description": "Health check endpoints",
        "item": [
            {
                "name": "Health Check",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {"raw": "{{base_url}}/health", "host": ["{{base_url}}"], "path": ["health"]},
                    "description": "Check API health status",
                },
                "response": [],
            }
        ],
    }

    # User Management endpoints
    users_folder = {
        "name": "User Management",
        "description": "User management endpoints",
        "item": [
            {
                "name": "List Users",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/users?page=1&per_page=20&search=",
                        "host": ["{{base_url}}"],
                        "path": ["users"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "per_page", "value": "20"},
                            {"key": "search", "value": ""},
                        ],
                    },
                    "description": "Get paginated list of users",
                },
                "response": [],
            },
            {
                "name": "Create User",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {"name": "John Doe", "email": "john.doe@example.com", "password": "secure_password"},
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/users", "host": ["{{base_url}}"], "path": ["users"]},
                    "description": "Create a new user",
                },
                "response": [],
            },
            {
                "name": "Get User",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/users/{{user_id}}",
                        "host": ["{{base_url}}"],
                        "path": ["users", "{{user_id}}"],
                    },
                    "description": "Get user by ID",
                },
                "response": [],
            },
            {
                "name": "Update User",
                "request": {
                    "method": "PUT",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({"name": "John Updated", "email": "john.updated@example.com"}, indent=2),
                    },
                    "url": {
                        "raw": "{{base_url}}/users/{{user_id}}",
                        "host": ["{{base_url}}"],
                        "path": ["users", "{{user_id}}"],
                    },
                    "description": "Update user information",
                },
                "response": [],
            },
            {
                "name": "Delete User",
                "request": {
                    "method": "DELETE",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/users/{{user_id}}",
                        "host": ["{{base_url}}"],
                        "path": ["users", "{{user_id}}"],
                    },
                    "description": "Delete user",
                },
                "response": [],
            },
            {
                "name": "Bulk Create Users",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "users": [
                                    {"name": "User One", "email": "user1@example.com"},
                                    {"name": "User Two", "email": "user2@example.com"},
                                ]
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/users/bulk", "host": ["{{base_url}}"], "path": ["users", "bulk"]},
                    "description": "Create multiple users in bulk",
                },
                "response": [],
            },
        ],
    }

    # Group Management endpoints
    groups_folder = {
        "name": "Group Management",
        "description": "Group management endpoints",
        "item": [
            {
                "name": "List Groups",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/groups?page=1&per_page=20",
                        "host": ["{{base_url}}"],
                        "path": ["groups"],
                        "query": [{"key": "page", "value": "1"}, {"key": "per_page", "value": "20"}],
                    },
                    "description": "Get paginated list of groups",
                },
                "response": [],
            },
            {
                "name": "Create Group",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "X-User-ID", "value": "{{user_id}}"},
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {"name": "Development Team", "description": "Group for development team members"}, indent=2
                        ),
                    },
                    "url": {"raw": "{{base_url}}/groups", "host": ["{{base_url}}"], "path": ["groups"]},
                    "description": "Create a new group",
                },
                "response": [],
            },
            {
                "name": "Add Member to Group",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {"mode": "raw", "raw": json.dumps({"user_id": "user-456", "role": "member"}, indent=2)},
                    "url": {
                        "raw": "{{base_url}}/groups/group123/members",
                        "host": ["{{base_url}}"],
                        "path": ["groups", "group123", "members"],
                    },
                    "description": "Add a member to group",
                },
                "response": [],
            },
        ],
    }

    # Session Management endpoints
    sessions_folder = {
        "name": "Session Management",
        "description": "Educational session management endpoints",
        "item": [
            {
                "name": "List Sessions",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/sessions?page=1&per_page=20&status=active",
                        "host": ["{{base_url}}"],
                        "path": ["sessions"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "per_page", "value": "20"},
                            {"key": "status", "value": "active"},
                        ],
                    },
                    "description": "Get paginated list of sessions",
                },
                "response": [],
            },
            {
                "name": "Create Session",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "X-User-ID", "value": "{{user_id}}"},
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "title": "Advanced Workflow Development",
                                "description": "Learn to build complex workflows",
                                "start_date": "2025-10-01T10:00:00Z",
                                "end_date": "2025-10-01T16:00:00Z",
                                "max_participants": 20,
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/sessions", "host": ["{{base_url}}"], "path": ["sessions"]},
                    "description": "Create a new session",
                },
                "response": [],
            },
            {
                "name": "Enroll in Session",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({"user_id": "user-456", "role": "participant"}, indent=2),
                    },
                    "url": {
                        "raw": "{{base_url}}/sessions/session123/participants",
                        "host": ["{{base_url}}"],
                        "path": ["sessions", "session123", "participants"],
                    },
                    "description": "Enroll user in session",
                },
                "response": [],
            },
            {
                "name": "Get Session Stats",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/sessions/session123/stats",
                        "host": ["{{base_url}}"],
                        "path": ["sessions", "session123", "stats"],
                    },
                    "description": "Get session statistics",
                },
                "response": [],
            },
        ],
    }

    # Progress Tracking endpoints
    progress_folder = {
        "name": "Progress Tracking",
        "description": "Learning progress tracking endpoints",
        "item": [
            {
                "name": "Record Progress",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "user_id": "user-123",
                                "session_id": "session-456",
                                "activity_type": "workflow",
                                "activity_id": "workflow-789",
                                "completion_status": "in_progress",
                                "progress_data": {
                                    "steps_completed": 3,
                                    "total_steps": 10,
                                    "current_step": "data_processing",
                                },
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/progress", "host": ["{{base_url}}"], "path": ["progress"]},
                    "description": "Record learning progress",
                },
                "response": [],
            },
            {
                "name": "Get User Progress",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/users/{{user_id}}/progress?session_id=session123&activity_type=workflow",
                        "host": ["{{base_url}}"],
                        "path": ["users", "{{user_id}}", "progress"],
                        "query": [
                            {"key": "session_id", "value": "session123"},
                            {"key": "activity_type", "value": "workflow"},
                        ],
                    },
                    "description": "Get user's progress records",
                },
                "response": [],
            },
            {
                "name": "Get Progress Analytics",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/sessions/session123/progress/analytics",
                        "host": ["{{base_url}}"],
                        "path": ["sessions", "session123", "progress", "analytics"],
                    },
                    "description": "Get progress analytics for session",
                },
                "response": [],
            },
        ],
    }

    # Template Management endpoints
    templates_folder = {
        "name": "Template Management",
        "description": "Educational template management endpoints",
        "item": [
            {
                "name": "List Templates",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/templates?page=1&per_page=20&type=workflow&is_public=true&tags=beginner",
                        "host": ["{{base_url}}"],
                        "path": ["templates"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "per_page", "value": "20"},
                            {"key": "type", "value": "workflow"},
                            {"key": "is_public", "value": "true"},
                            {"key": "tags", "value": "beginner"},
                        ],
                    },
                    "description": "Get filtered list of templates",
                },
                "response": [],
            },
            {
                "name": "Create Template",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "X-User-ID", "value": "{{user_id}}"},
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "name": "Basic Data Processing Workflow",
                                "description": "A simple workflow for data processing",
                                "template_type": "workflow",
                                "content": {
                                    "nodes": [
                                        {"id": "start", "type": "start"},
                                        {"id": "process", "type": "data_processor"},
                                        {"id": "end", "type": "end"},
                                    ],
                                    "connections": [
                                        {"from": "start", "to": "process"},
                                        {"from": "process", "to": "end"},
                                    ],
                                },
                                "is_public": False,
                                "tags": ["beginner", "data-processing"],
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/templates", "host": ["{{base_url}}"], "path": ["templates"]},
                    "description": "Create a new template",
                },
                "response": [],
            },
            {
                "name": "Clone Template",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "X-User-ID", "value": "{{user_id}}"},
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "new_name": "My Custom Workflow",
                                "description": "Customized version of the original template",
                            },
                            indent=2,
                        ),
                    },
                    "url": {
                        "raw": "{{base_url}}/templates/template123/clone",
                        "host": ["{{base_url}}"],
                        "path": ["templates", "template123", "clone"],
                    },
                    "description": "Clone an existing template",
                },
                "response": [],
            },
            {
                "name": "Get Popular Templates",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/templates/popular?limit=10&type=workflow",
                        "host": ["{{base_url}}"],
                        "path": ["templates", "popular"],
                        "query": [{"key": "limit", "value": "10"}, {"key": "type", "value": "workflow"}],
                    },
                    "description": "Get popular templates",
                },
                "response": [],
            },
        ],
    }

    # API Key Management endpoints
    api_keys_folder = {
        "name": "API Key Management",
        "description": "API key and usage management endpoints",
        "item": [
            {
                "name": "List API Keys",
                "request": {
                    "method": "GET",
                    "header": [{"key": "X-User-ID", "value": "{{user_id}}"}],
                    "url": {
                        "raw": "{{base_url}}/api-keys?page=1&per_page=20&type=openai&is_active=true",
                        "host": ["{{base_url}}"],
                        "path": ["api-keys"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "per_page", "value": "20"},
                            {"key": "type", "value": "openai"},
                            {"key": "is_active", "value": "true"},
                        ],
                    },
                    "description": "Get list of API keys",
                },
                "response": [],
            },
            {
                "name": "Create API Key",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "X-User-ID", "value": "{{user_id}}"},
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "key_name": "OpenAI Production Key",
                                "key_type": "openai",
                                "api_key": "sk-proj-1234567890abcdef...",
                                "expires_at": "2025-12-31T23:59:59Z",
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/api-keys", "host": ["{{base_url}}"], "path": ["api-keys"]},
                    "description": "Create a new API key",
                },
                "response": [],
            },
            {
                "name": "Record Usage",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps(
                            {
                                "user_id": "user-123",
                                "session_id": "session-456",
                                "api_key_id": "key-789",
                                "usage_type": "tokens",
                                "usage_count": 1500,
                                "usage_data": {"model": "gpt-4", "prompt_tokens": 1000, "completion_tokens": 500},
                            },
                            indent=2,
                        ),
                    },
                    "url": {"raw": "{{base_url}}/usage", "host": ["{{base_url}}"], "path": ["usage"]},
                    "description": "Record API usage",
                },
                "response": [],
            },
            {
                "name": "Get Usage Summary",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/usage/summary?user_id={{user_id}}&period=week",
                        "host": ["{{base_url}}"],
                        "path": ["usage", "summary"],
                        "query": [{"key": "user_id", "value": "{{user_id}}"}, {"key": "period", "value": "week"}],
                    },
                    "description": "Get usage summary for a period",
                },
                "response": [],
            },
            {
                "name": "Check Usage Limits",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/usage/limits/check?user_id={{user_id}}&limit_type=tokens",
                        "host": ["{{base_url}}"],
                        "path": ["usage", "limits", "check"],
                        "query": [{"key": "user_id", "value": "{{user_id}}"}, {"key": "limit_type", "value": "tokens"}],
                    },
                    "description": "Check current usage against limits",
                },
                "response": [],
            },
        ],
    }

    # Add all folders to collection
    collection["item"] = [
        health_folder,
        users_folder,
        groups_folder,
        sessions_folder,
        progress_folder,
        templates_folder,
        api_keys_folder,
    ]

    return collection


def main():
    """Generate and save Postman collection."""
    collection = generate_postman_collection()

    filename = f"dify-education-api-{datetime.now().strftime('%Y%m%d')}.postman_collection.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)

    print(f"✓ Postman collection generated: {filename}")
    print(f"✓ Collection contains {len(collection['item'])} folders")

    # Count total requests
    total_requests = sum(len(folder["item"]) for folder in collection["item"])
    print(f"✓ Total API requests: {total_requests}")


if __name__ == "__main__":
    main()
