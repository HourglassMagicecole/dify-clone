"""Education-related Celery tasks."""

from tasks.education.session_resource_cleanup_task import delete_session_resources_task

__all__ = ["delete_session_resources_task"]
