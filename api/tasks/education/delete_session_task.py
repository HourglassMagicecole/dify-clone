"""Celery task for deleting session with all resources."""

import logging
import time

import click
from celery import shared_task
from sqlalchemy.exc import SQLAlchemyError

from extensions.ext_database import db
from models import Account, App
from models.education.resource_tag import SessionResourceTag
from models.education.session import EducationSession
from services.app_service import AppService
from services.dataset_service import DatasetService

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue="app_deletion", max_retries=3, ignore_result=False)
def delete_session_with_resources_task(
    self,
    session_id: str,
    tenant_id: str,
    user_id: str,
) -> dict:
    """
    Delete a session and all its resources.

    This task:
    1. Deletes all apps created by members in this session
    2. Deletes all datasets created by members in this session
    3. Deletes the session (members are deleted via CASCADE)

    Note: LLM usage logs are preserved for audit/billing purposes.

    Args:
        self: Celery task instance (bound)
        session_id: The session UUID to delete
        tenant_id: Tenant UUID for the resources
        user_id: Account UUID of the user requesting deletion (for permission checks)

    Returns:
        Dictionary with deletion results:
            - status: "completed" or "failed"
            - deleted_apps: Number of apps deleted
            - deleted_datasets: Number of datasets deleted
            - session_deleted: Whether session was successfully deleted
            - errors: List of any errors encountered
    """
    logger.info(
        click.style(
            f"Starting session deletion with resources: session={session_id}",
            fg="green",
        )
    )
    start_at = time.perf_counter()

    result = {
        "status": "completed",
        "deleted_apps": 0,
        "deleted_datasets": 0,
        "session_deleted": False,
        "errors": [],
    }

    try:
        # Get all resources for this session (all members)
        resources = _get_session_resources(session_id)
        app_ids = resources["apps"]
        dataset_ids = resources["datasets"]

        total_items = len(app_ids) + len(dataset_ids) + 1  # +1 for session deletion
        current = 0

        # Phase 1: Delete Apps
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": 0,
                "deleted_datasets": 0,
                "session_deleted": False,
                "phase": "deleting_apps",
            },
        )

        deleted_apps, app_errors = _delete_apps(app_ids, tenant_id)
        result["deleted_apps"] = deleted_apps
        result["errors"].extend(app_errors)
        current += len(app_ids)

        # Phase 2: Delete Datasets
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": deleted_apps,
                "deleted_datasets": 0,
                "session_deleted": False,
                "phase": "deleting_datasets",
            },
        )

        # Get user for dataset deletion permission check
        user = db.session.query(Account).filter(Account.id == user_id).first()
        if user:
            user.set_tenant_id(tenant_id)
        deleted_datasets, dataset_errors = _delete_datasets(dataset_ids, user)
        result["deleted_datasets"] = deleted_datasets
        result["errors"].extend(dataset_errors)
        current += len(dataset_ids)

        # Phase 3: Delete session (members are deleted via CASCADE)
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": deleted_apps,
                "deleted_datasets": deleted_datasets,
                "session_deleted": False,
                "phase": "deleting_session",
            },
        )

        session_deleted = _delete_session(session_id)
        result["session_deleted"] = session_deleted

        end_at = time.perf_counter()
        logger.info(
            click.style(
                f"Session deletion completed: session={session_id}, "
                f"apps={deleted_apps}, datasets={deleted_datasets}, deleted={session_deleted}, "
                f"latency={end_at - start_at:.2f}s",
                fg="green",
            )
        )

        return result

    except SQLAlchemyError as e:
        logger.exception(
            click.style(
                f"Database error during session deletion: session={session_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Database error: {e!s}")
        raise self.retry(exc=e, countdown=60)

    except Exception as e:
        logger.exception(
            click.style(
                f"Error during session deletion: session={session_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Unexpected error: {e!s}")
        raise self.retry(exc=e, countdown=60)


def _get_session_resources(session_id: str) -> dict[str, list[str]]:
    """
    Get all resource IDs for a session (all members).

    Args:
        session_id: The session UUID

    Returns:
        Dictionary with "apps" and "datasets" keys containing lists of IDs
    """
    tags = db.session.query(SessionResourceTag).filter(SessionResourceTag.session_id == session_id).all()

    return {
        "apps": [t.resource_id for t in tags if t.resource_type == "app"],
        "datasets": [t.resource_id for t in tags if t.resource_type == "dataset"],
    }


def _delete_apps(app_ids: list[str], tenant_id: str) -> tuple[int, list[str]]:
    """
    Delete apps using AppService.

    Args:
        app_ids: List of app UUIDs to delete
        tenant_id: Tenant UUID

    Returns:
        Tuple of (deleted_count, error_list)
    """
    deleted = 0
    errors = []
    app_service = AppService()

    for app_id in app_ids:
        try:
            app = (
                db.session.query(App)
                .filter(
                    App.id == app_id,
                    App.tenant_id == tenant_id,
                )
                .first()
            )

            if not app:
                logger.warning("App %s not found or already deleted", app_id)
                continue

            app_service.delete_app(app)
            deleted += 1
            logger.info(click.style(f"Deleted app {app_id}", fg="green"))
        except Exception as e:
            error_msg = f"Failed to delete app {app_id}: {e!s}"
            logger.exception(click.style(error_msg, fg="red"))
            errors.append(error_msg)

    return deleted, errors


def _delete_datasets(
    dataset_ids: list[str],
    user: Account | None,
) -> tuple[int, list[str]]:
    """
    Delete datasets using DatasetService.

    Args:
        dataset_ids: List of dataset UUIDs to delete
        user: Account instance for permission checks

    Returns:
        Tuple of (deleted_count, error_list)
    """
    deleted = 0
    errors = []

    if not user:
        errors.append("User not found for dataset deletion")
        return deleted, errors

    for dataset_id in dataset_ids:
        try:
            result = DatasetService.delete_dataset(dataset_id, user)
            if result:
                deleted += 1
                logger.info(click.style(f"Deleted dataset {dataset_id}", fg="green"))
            else:
                logger.warning("Dataset %s not found or already deleted", dataset_id)
        except Exception as e:
            error_msg = f"Failed to delete dataset {dataset_id}: {e!s}"
            logger.exception(click.style(error_msg, fg="red"))
            errors.append(error_msg)

    return deleted, errors


def _delete_session(session_id: str) -> bool:
    """
    Delete session from database.

    Members are automatically deleted via CASCADE.

    Args:
        session_id: The session UUID

    Returns:
        True if session was deleted, False otherwise
    """
    try:
        session = db.session.query(EducationSession).filter(EducationSession.id == session_id).first()

        if not session:
            logger.warning("Session %s not found", session_id)
            return False

        if session.is_default:
            logger.warning("Cannot delete default session %s", session_id)
            return False

        db.session.delete(session)
        db.session.commit()

        logger.info(click.style(f"Deleted session {session_id}", fg="green"))
        return True

    except Exception:
        db.session.rollback()
        logger.exception(click.style(f"Failed to delete session {session_id}", fg="red"))
        return False
