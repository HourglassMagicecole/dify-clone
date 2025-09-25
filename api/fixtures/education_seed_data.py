"""
Education seed data generation script for testing.

This script generates test data for the education platform:
- 50 test users with education roles
- Sample education sessions
- Sample enrollments and progress
- Sample templates and achievements

Usage:
    flask seed-education-data
"""

import random
import uuid
from datetime import datetime, timedelta

from faker import Faker

from models.education import (
    EducationAchievement,
    EducationActivityLog,
    EducationApiKey,
    EducationEnrollment,
    EducationSession,
    EducationTemplate,
    EducationUsageLimit,
    EducationUsageStats,
    LearningProgress,
    ResourceTag,
    UserEducationRole,
)
from models.engine import db

fake = Faker(['ko_KR', 'en_US'])


class EducationSeedData:
    """Education platform seed data generator."""

    def __init__(self):
        self.fake = fake
        self.created_users = []
        self.created_sessions = []
        self.created_templates = []

    def generate_test_users(self, count: int = 50) -> list[uuid.UUID]:
        """Generate test user IDs and roles."""
        print(f"Generating {count} test users...")

        users = []
        for i in range(count):
            user_id = uuid.uuid4()
            users.append(user_id)

            # Assign random education roles
            role_type = random.choice(['student', 'instructor', 'admin', 'moderator'])
            if i < 5:  # First 5 users are instructors
                role_type = 'instructor'
            elif i < 8:  # Next 3 users are admins
                role_type = 'admin'

            # Create user education role
            role = UserEducationRole(
                user_id=user_id,
                role=role_type,
                scope_type='global',
                permissions=['view_dashboard', 'participate_sessions'] if role_type == 'student' else ['*'],
                status='active',
                assigned_by=users[0] if users else user_id  # First user assigns others
            )
            db.session.add(role)

        self.created_users = users
        return users

    def generate_education_sessions(self, count: int = 10) -> list[uuid.UUID]:
        """Generate sample education sessions."""
        print(f"Generating {count} education sessions...")

        sessions = []
        session_types = ['Agent Builder', 'Workflow Designer', 'RAG Pipeline', 'API Integration', 'Advanced Concepts']

        for i in range(count):
            session_id = uuid.uuid4()
            session_type = random.choice(session_types)

            session = EducationSession(
                id=session_id,
                session_code=f"EDU-{2025}-{i+1:03d}",
                title=f"{session_type} 교육 #{i+1}",
                description=self.fake.paragraph(nb_sentences=3),
                config={
                    "duration_hours": random.randint(2, 8),
                    "difficulty": random.choice(["beginner", "intermediate", "advanced"]),
                    "prerequisites": [],
                    "materials": [f"material_{j}.pdf" for j in range(1, random.randint(2, 5))],
                    "hands_on": random.choice([True, False])
                },
                status=random.choice(['draft', 'active', 'completed']),
                max_participants=random.randint(10, 30),
                start_date=datetime.utcnow() + timedelta(days=random.randint(-30, 30)),
                end_date=datetime.utcnow() + timedelta(days=random.randint(31, 90)),
                created_by=random.choice(self.created_users) if self.created_users else uuid.uuid4()
            )
            sessions.append(session_id)
            db.session.add(session)

        self.created_sessions = sessions
        return sessions

    def generate_enrollments_and_progress(self):
        """Generate enrollments and learning progress."""
        print("Generating enrollments and progress...")

        if not self.created_users or not self.created_sessions:
            print("Warning: No users or sessions available for enrollments")
            return

        # Create enrollments (each user enrolls in 1-5 sessions)
        for user_id in self.created_users:
            num_sessions = random.randint(1, min(5, len(self.created_sessions)))
            enrolled_sessions = random.sample(self.created_sessions, num_sessions)

            for session_id in enrolled_sessions:
                enrollment = EducationEnrollment(
                    user_id=user_id,
                    session_id=session_id,
                    enrollment_status=random.choice(['enrolled', 'completed', 'dropped']),
                    role=random.choice(['participant', 'assistant']) if random.random() > 0.1 else 'instructor',
                    enrolled_at=datetime.utcnow() - timedelta(days=random.randint(1, 60)),
                    completed_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)) if random.random() > 0.3 else None,
                    last_activity_at=datetime.utcnow() - timedelta(hours=random.randint(1, 24))
                )
                db.session.add(enrollment)

                # Create learning progress for each enrollment
                modules = ['agent_builder', 'workflow_editor', 'rag_pipeline', 'api_integration', 'testing']
                for module in modules:
                    if random.random() > 0.2:  # 80% chance to have progress in each module
                        progress = LearningProgress(
                            user_id=user_id,
                            session_id=session_id,
                            module_type=module,
                            module_id=f"{module}_{random.randint(1, 5)}",
                            module_name=f"{module.replace('_', ' ').title()} Module",
                            progress_percentage=round(random.uniform(0, 100), 2),
                            status=random.choice(['not_started', 'in_progress', 'completed', 'failed']),
                            time_spent_minutes=random.randint(10, 240),
                            attempts=random.randint(1, 5),
                            current_score=round(random.uniform(60, 100), 2) if random.random() > 0.3 else None,
                            best_score=round(random.uniform(70, 100), 2) if random.random() > 0.3 else None,
                            progress_data={
                                "checkpoints": [f"checkpoint_{i}" for i in range(random.randint(1, 8))],
                                "completed_exercises": random.randint(0, 10),
                                "total_exercises": 10
                            },
                            started_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                            last_activity_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48)),
                            completed_at=datetime.utcnow() - timedelta(days=random.randint(1, 15)) if random.random() > 0.5 else None
                        )
                        db.session.add(progress)

    def generate_education_templates(self, count: int = 15) -> list[uuid.UUID]:
        """Generate education templates."""
        print(f"Generating {count} education templates...")

        templates = []
        template_types = ['agent', 'workflow', 'rag', 'assessment', 'exercise']
        categories = ['AI Basics', 'Advanced AI', 'Integration', 'Best Practices', 'Troubleshooting']

        for i in range(count):
            template_id = uuid.uuid4()
            template_type = random.choice(template_types)
            category = random.choice(categories)

            template = EducationTemplate(
                id=template_id,
                template_type=template_type,
                name=f"{template_type.title()} Template #{i+1}",
                description=self.fake.paragraph(nb_sentences=2),
                content=self.fake.text(max_nb_chars=2000),
                config={
                    "steps": [f"Step {j+1}: {self.fake.sentence()}" for j in range(random.randint(3, 8))],
                    "estimated_time": random.randint(15, 120),
                    "tools_required": [self.fake.word() for _ in range(random.randint(1, 4))]
                },
                category=category,
                tags=random.sample(['beginner', 'intermediate', 'advanced', 'hands-on', 'theory', 'practical'], k=random.randint(1, 4)),
                difficulty_level=random.choice(['beginner', 'intermediate', 'advanced']),
                estimated_duration_minutes=random.randint(30, 240),
                status=random.choice(['draft', 'published', 'archived']),
                usage_count=random.randint(0, 100),
                published_at=datetime.utcnow() - timedelta(days=random.randint(1, 365)) if random.random() > 0.3 else None,
                created_by=random.choice(self.created_users) if self.created_users else uuid.uuid4()
            )
            templates.append(template_id)
            db.session.add(template)

        self.created_templates = templates
        return templates

    def generate_resource_tags(self):
        """Generate resource tags."""
        print("Generating resource tags...")

        resources = [
            ('session', self.created_sessions),
            ('template', self.created_templates),
            ('user', self.created_users[:10])  # Tag first 10 users
        ]

        tag_names = ['priority', 'category', 'level', 'status', 'department', 'skill']

        for resource_type, resource_ids in resources:
            for resource_id in resource_ids:
                # Add 1-4 tags per resource
                num_tags = random.randint(1, 4)
                selected_tags = random.sample(tag_names, min(num_tags, len(tag_names)))

                for tag_name in selected_tags:
                    tag_value = self._get_tag_value(tag_name)
                    tag = ResourceTag(
                        resource_type=resource_type,
                        resource_id=resource_id,
                        tag_name=tag_name,
                        tag_value=tag_value,
                        category='system' if tag_name in ['status', 'level'] else 'user',
                        description=f"{tag_name} tag for {resource_type}",
                        created_by=random.choice(self.created_users) if self.created_users else uuid.uuid4()
                    )
                    db.session.add(tag)

    def _get_tag_value(self, tag_name: str) -> str:
        """Get appropriate tag value based on tag name."""
        tag_values = {
            'priority': ['high', 'medium', 'low'],
            'category': ['technical', 'business', 'creative', 'analytical'],
            'level': ['beginner', 'intermediate', 'advanced', 'expert'],
            'status': ['active', 'inactive', 'pending', 'completed'],
            'department': ['engineering', 'marketing', 'sales', 'hr', 'finance'],
            'skill': ['python', 'javascript', 'ai', 'data-science', 'design']
        }
        return random.choice(tag_values.get(tag_name, ['unknown']))

    def generate_api_keys(self):
        """Generate sample API keys."""
        print("Generating API keys...")

        key_types = ['openai', 'anthropic', 'google', 'azure', 'dify']

        for i, key_type in enumerate(key_types):
            api_key = EducationApiKey(
                key_name=f"{key_type.upper()} Education Key #{i+1}",
                key_type=key_type,
                api_key=f"edu_{key_type}_{uuid.uuid4().hex[:16]}",  # Mock encrypted key
                endpoint_url=f"https://api.{key_type}.com/v1" if key_type != 'dify' else None,
                scope='education',
                allowed_models=[f"{key_type}_model_{j}" for j in range(1, 4)],
                usage_count=random.randint(0, 1000),
                last_used_at=datetime.utcnow() - timedelta(hours=random.randint(1, 72)),
                rate_limit_per_minute=random.choice([10, 60, 100]),
                rate_limit_per_day=random.choice([1000, 5000, 10000]),
                status='active',
                expires_at=datetime.utcnow() + timedelta(days=random.randint(30, 365)),
                created_by=self.created_users[0] if self.created_users else uuid.uuid4(),  # First user (admin)
                session_id=random.choice(self.created_sessions) if random.random() > 0.7 else None
            )
            db.session.add(api_key)

    def generate_usage_data(self):
        """Generate usage limits and statistics."""
        print("Generating usage limits and statistics...")

        # Usage limits
        limit_types = ['user', 'session', 'global']
        resource_types = ['api_calls', 'tokens', 'requests', 'storage']

        for limit_type in limit_types:
            for resource_type in resource_types:
                usage_limit = EducationUsageLimit(
                    limit_type=limit_type,
                    resource_type=resource_type,
                    target_id=random.choice(self.created_users) if limit_type == 'user' else None,
                    target_name=f"{limit_type}_{resource_type}_limit",
                    daily_limit=random.randint(100, 10000),
                    monthly_limit=random.randint(3000, 300000),
                    soft_daily_limit=random.randint(80, 8000),
                    soft_monthly_limit=random.randint(2400, 240000),
                    daily_cost_limit=round(random.uniform(10, 100), 2),
                    monthly_cost_limit=round(random.uniform(300, 3000), 2),
                    status='active',
                    effective_from=datetime.utcnow() - timedelta(days=30),
                    created_by=self.created_users[0] if self.created_users else uuid.uuid4()
                )
                db.session.add(usage_limit)

        # Usage statistics
        for i in range(20):  # Generate 20 sample stats
            usage_stat = EducationUsageStats(
                stat_type=random.choice(limit_types),
                resource_type=random.choice(resource_types),
                target_id=random.choice(self.created_users) if random.random() > 0.5 else None,
                period_type=random.choice(['hourly', 'daily', 'monthly']),
                period_start=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                period_end=datetime.utcnow() - timedelta(days=random.randint(0, 29)),
                usage_count=random.randint(10, 5000),
                estimated_cost=round(random.uniform(1, 50), 4),
                actual_cost=round(random.uniform(0.8, 55), 4),
                metrics={
                    "peak_usage": random.randint(50, 200),
                    "avg_response_time": round(random.uniform(0.1, 2.0), 2),
                    "error_rate": round(random.uniform(0, 5), 2)
                }
            )
            db.session.add(usage_stat)

    def generate_activity_logs(self):
        """Generate activity logs."""
        print("Generating activity logs...")

        activity_types = ['login', 'logout', 'module_start', 'module_complete', 'error', 'admin']
        actions = ['user_login', 'session_join', 'progress_update', 'template_use', 'api_call', 'achievement_earn']

        for i in range(200):  # Generate 200 activity logs
            log = EducationActivityLog(
                user_id=random.choice(self.created_users) if random.random() > 0.1 else None,
                session_id=random.choice(self.created_sessions) if random.random() > 0.3 else None,
                activity_type=random.choice(activity_types),
                activity_category=random.choice(['learning', 'admin', 'system', 'error']),
                action=random.choice(actions),
                description=f"User performed {random.choice(actions)} action",
                resource_type=random.choice(['session', 'template', 'user', 'api_key']),
                resource_id=str(uuid.uuid4()),
                details={
                    "ip_address": self.fake.ipv4(),
                    "user_agent": self.fake.user_agent(),
                    "duration_ms": random.randint(100, 5000),
                    "success": random.choice([True, False])
                },
                status=random.choice(['success', 'error', 'warning', 'info']),
                error_message=self.fake.sentence() if random.random() > 0.8 else None,
                duration_ms=random.randint(50, 3000),
                ip_address=self.fake.ipv4(),
                user_agent=self.fake.user_agent(),
                created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 720))  # Last 30 days
            )
            db.session.add(log)

    def generate_achievements(self):
        """Generate achievements."""
        print("Generating achievements...")

        achievement_types = ['completion', 'mastery', 'participation', 'creativity', 'collaboration']
        achievement_names = [
            'First Steps', 'Quick Learner', 'Perfectionist', 'Team Player', 'Creative Mind',
            'Problem Solver', 'Mentor', 'Expert', 'Pioneer', 'Innovator'
        ]
        levels = ['bronze', 'silver', 'gold', 'platinum', 'diamond']
        rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']

        # Create achievements for some users
        for user_id in self.created_users[:30]:  # First 30 users get achievements
            num_achievements = random.randint(1, 5)

            for i in range(num_achievements):
                achievement = EducationAchievement(
                    user_id=user_id,
                    session_id=random.choice(self.created_sessions) if random.random() > 0.5 else None,
                    achievement_type=random.choice(achievement_types),
                    achievement_name=random.choice(achievement_names),
                    description=f"Earned for {random.choice(achievement_types)} in education platform",
                    badge_icon=f"badge_{random.choice(achievement_types)}.png",
                    badge_color=random.choice(['#FFD700', '#C0C0C0', '#CD7F32', '#E5E4E2', '#B9F2FF']),
                    criteria={
                        "required_actions": random.randint(1, 10),
                        "time_limit_days": random.randint(7, 30),
                        "min_score": random.randint(70, 95)
                    },
                    level=random.choice(levels),
                    rarity=random.choice(rarities),
                    points=random.randint(10, 1000),
                    rewards={"bonus_points": random.randint(50, 500), "badge_display": True},
                    progress_current=random.randint(1, 10),
                    progress_total=10,
                    status=random.choice(['in_progress', 'completed', 'expired']),
                    started_at=datetime.utcnow() - timedelta(days=random.randint(1, 60)),
                    completed_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)) if random.random() > 0.3 else None,
                    verified_by=self.created_users[0] if random.random() > 0.7 else None  # Admin verification
                )
                db.session.add(achievement)

    def run_seed(self):
        """Run the complete seed data generation process."""
        print("Starting education seed data generation...")

        try:
            # Generate all seed data
            self.generate_test_users(50)
            self.generate_education_sessions(10)
            self.generate_enrollments_and_progress()
            self.generate_education_templates(15)
            self.generate_resource_tags()
            self.generate_api_keys()
            self.generate_usage_data()
            self.generate_activity_logs()
            self.generate_achievements()

            # Commit all changes
            db.session.commit()
            print("✅ Education seed data generation completed successfully!")

            # Print summary
            self._print_summary()

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error generating seed data: {e}")
            raise

    def _print_summary(self):
        """Print summary of generated data."""
        print("\n" + "="*50)
        print("SEED DATA SUMMARY")
        print("="*50)

        # Count records
        counts = {}
        tables = [
            ('Users (Roles)', UserEducationRole),
            ('Sessions', EducationSession),
            ('Enrollments', EducationEnrollment),
            ('Learning Progress', LearningProgress),
            ('Templates', EducationTemplate),
            ('Resource Tags', ResourceTag),
            ('API Keys', EducationApiKey),
            ('Usage Limits', EducationUsageLimit),
            ('Usage Stats', EducationUsageStats),
            ('Activity Logs', EducationActivityLog),
            ('Achievements', EducationAchievement)
        ]

        for name, model in tables:
            count = db.session.query(model).count()
            print(f"{name:<20}: {count:>5} records")

        print("="*50)
        print("🎓 Ready for education platform testing!")


def seed_education_data():
    """Flask command to seed education data."""
    seeder = EducationSeedData()
    seeder.run_seed()


if __name__ == "__main__":
    # For direct execution
    seed_education_data()