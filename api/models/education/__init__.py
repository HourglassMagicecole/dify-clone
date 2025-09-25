"""
Education models package for Dify educational platform.

This package contains all educational-related database models including:
- EducationSession: Education session management
- EducationEnrollment: Session participant management
- ResourceTag: Resource tagging for multi-tenant support
- LearningProgress: Learning progress tracking
- EducationTemplate: Educational material templates
- EducationApiKey: API key central management
- EducationUsage: Usage limit and statistics models
- EducationActivity: Activity log tracking
- UserEducationRole: Education role/permission management
- EducationAchievement: Achievement/badge system
"""

from .education_achievement import EducationAchievement
from .education_activity import EducationActivityLog
from .education_api_key import EducationApiKey
from .education_enrollment import EducationEnrollment
from .education_session import EducationSession
from .education_template import EducationTemplate
from .education_usage import EducationUsageLimit, EducationUsageStats
from .learning_progress import LearningProgress
from .resource_tag import ResourceTag
from .user_education_role import UserEducationRole

__all__ = [
    "EducationAchievement",
    "EducationActivityLog",
    "EducationApiKey",
    "EducationEnrollment",
    "EducationSession",
    "EducationTemplate",
    "EducationUsageLimit",
    "EducationUsageStats",
    "LearningProgress",
    "ResourceTag",
    "UserEducationRole",
]
