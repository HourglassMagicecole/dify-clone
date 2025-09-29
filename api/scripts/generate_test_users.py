#!/usr/bin/env python
"""Generate test users for education platform testing."""

import json
import random
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

# Sample data for generating realistic users
FIRST_NAMES = [
    "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
    "John", "Emma", "Michael", "Sophia", "William", "Olivia", "James", "Ava",
    "Robert", "Isabella", "David", "Mia", "Richard", "Charlotte", "Joseph", "Amelia"
]

LAST_NAMES = [
    "민준", "서연", "예준", "서윤", "도윤", "서현", "시우", "하은", "주원", "하윤",
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin"
]

ORGANIZATIONS = [
    "서울대학교", "연세대학교", "고려대학교", "KAIST", "포항공과대학교",
    "삼성전자", "LG전자", "네이버", "카카오", "쿠팡",
    "Stanford University", "MIT", "Harvard", "Berkeley", "CMU",
    "Google", "Microsoft", "Amazon", "Apple", "Meta"
]

ROLES = ["student", "instructor", "teaching_assistant", "admin", "observer"]


def generate_user(index: int) -> dict[str, Any]:
    """Generate a test user with educational profile."""
    # Determine user locale
    is_korean = index < 25  # First half Korean users

    if is_korean:
        first_name = FIRST_NAMES[index % 10]
        last_name = LAST_NAMES[index % 10]
        full_name = f"{first_name}{last_name}"
        email = f"user{index+1}@example.co.kr"
        locale = "ko"
        timezone = "Asia/Seoul"
    else:
        first_name = FIRST_NAMES[10 + (index % 16)]
        last_name = LAST_NAMES[10 + (index % 16)]
        full_name = f"{first_name} {last_name}"
        email = f"{first_name.lower()}.{last_name.lower()}{index}@example.com"
        locale = "en"
        timezone = "America/Los_Angeles"

    # Assign role with distribution
    if index < 5:
        role = "admin"
    elif index < 15:
        role = "instructor"
    elif index < 25:
        role = "teaching_assistant"
    else:
        role = "student"

    # Generate user data
    created_date = datetime.utcnow() - timedelta(days=random.randint(1, 365))
    last_login = created_date + timedelta(days=random.randint(0, (datetime.utcnow() - created_date).days))

    user = {
        "id": str(uuid4()),
        "email": email,
        "username": f"user{index+1}",
        "full_name": full_name,
        "role": role,
        "organization": ORGANIZATIONS[index % len(ORGANIZATIONS)],
        "locale": locale,
        "timezone": timezone,
        "created_at": created_date.isoformat(),
        "updated_at": last_login.isoformat(),
        "last_login": last_login.isoformat(),
        "is_active": index != 49,  # One inactive user for testing
        "email_verified": index < 45,  # 5 unverified users
        "profile": generate_user_profile(role, index),
        "education_progress": generate_education_progress(role, index),
        "api_usage": generate_api_usage(role, index),
        "preferences": {
            "theme": random.choice(["light", "dark", "auto"]),
            "language": locale,
            "notifications": {
                "email": index < 40,
                "push": index < 30,
                "in_app": True,
            },
            "tutorial_completed": index < 35,
        },
    }

    return user


def generate_user_profile(role: str, index: int) -> dict[str, Any]:
    """Generate user profile based on role."""
    profiles = {
        "student": {
            "level": random.choice(["beginner", "intermediate"]),
            "courses_enrolled": random.randint(1, 5),
            "completed_lessons": random.randint(0, 20),
            "study_hours": random.randint(0, 100),
            "certification_target": random.choice(["AI Agent Builder", "Workflow Designer", None]),
        },
        "instructor": {
            "level": "expert",
            "courses_teaching": random.randint(1, 3),
            "students_count": random.randint(10, 50),
            "rating": round(random.uniform(4.0, 5.0), 1),
            "specialization": random.choice(["LLM", "Agent Design", "RAG", "Workflow"]),
        },
        "teaching_assistant": {
            "level": "advanced",
            "assisting_courses": random.randint(1, 2),
            "support_tickets_resolved": random.randint(0, 50),
            "lab_sessions_conducted": random.randint(0, 20),
        },
        "admin": {
            "level": "expert",
            "permissions": ["user_management", "course_management", "system_config", "analytics"],
            "managed_users": random.randint(50, 500),
            "system_role": random.choice(["super_admin", "org_admin", "course_admin"]),
        },
        "observer": {
            "level": "viewer",
            "observation_purpose": random.choice(["evaluation", "audit", "research"]),
            "access_level": "read_only",
        },
    }

    return profiles.get(role, profiles["student"])


def generate_education_progress(role: str, index: int) -> dict[str, Any]:
    """Generate education progress data."""
    if role not in ["student", "teaching_assistant"]:
        return {}

    progress = {
        "current_module": random.choice([
            "Introduction to LLMs",
            "Building Your First Agent",
            "Advanced Prompt Engineering",
            "Workflow Design Patterns",
            "RAG Implementation",
        ]),
        "completed_modules": random.randint(0, 10),
        "total_modules": 15,
        "achievements": generate_achievements(index),
        "skill_levels": {
            "prompt_engineering": random.randint(1, 10),
            "agent_building": random.randint(1, 10),
            "workflow_design": random.randint(1, 10),
            "rag_implementation": random.randint(1, 10),
        },
        "quiz_scores": {
            "average": random.randint(60, 100),
            "best": random.randint(70, 100),
            "attempts": random.randint(1, 20),
        },
    }

    return progress


def generate_achievements(index: int) -> list[str]:
    """Generate user achievements."""
    all_achievements = [
        "First Agent Created",
        "Workflow Master",
        "Prompt Engineer",
        "RAG Expert",
        "10 Agents Built",
        "Perfect Quiz Score",
        "Week Streak",
        "Helper Badge",
        "Early Adopter",
        "Bug Reporter",
    ]

    num_achievements = min(index // 5, len(all_achievements))
    return random.sample(all_achievements, num_achievements)


def generate_api_usage(role: str, index: int) -> dict[str, Any]:
    """Generate API usage statistics."""
    base_limit = {
        "admin": 100000,
        "instructor": 50000,
        "teaching_assistant": 20000,
        "student": 5000,
        "observer": 1000,
    }

    usage = {
        "api_key": f"sk-edu-{str(uuid4())[:8]}",
        "monthly_limit": base_limit.get(role, 5000),
        "current_usage": random.randint(0, base_limit.get(role, 5000) // 2),
        "last_request": (datetime.utcnow() - timedelta(hours=random.randint(0, 72))).isoformat(),
        "requests_today": random.randint(0, 100),
        "endpoints_used": {
            "agent_create": random.randint(0, 50),
            "workflow_run": random.randint(0, 100),
            "rag_query": random.randint(0, 200),
            "llm_completion": random.randint(0, 500),
        },
        "rate_limit_hits": random.randint(0, 5),
    }

    return usage


def main() -> None:
    """Generate and save test users."""
    users = []

    print("Generating 50 test users...")
    print("\nRole distribution:")
    role_counts = {"admin": 0, "instructor": 0, "teaching_assistant": 0, "student": 0, "observer": 0}

    for i in range(50):
        user = generate_user(i)
        users.append(user)
        role_counts[user["role"]] += 1

    # Print statistics
    for role, count in role_counts.items():
        print(f"  - {role.title()}: {count}")

    # Save to file
    output_file = "test_users.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

    print("\n✅ Successfully generated 50 test users")
    print(f"📁 Saved to: {output_file}")
    print(f"🌍 Locales: {len([u for u in users if u['locale'] == 'ko'])} Korean, {len([u for u in users if u['locale'] == 'en'])} English")
    print(f"✓ Active users: {len([u for u in users if u['is_active']])}")
    print(f"✉ Verified emails: {len([u for u in users if u['email_verified']])}")


if __name__ == "__main__":
    main()