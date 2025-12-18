"""Celery task for cleaning up session resources."""

import logging
import time

import click
from celery import shared_task
from sqlalchemy.exc import SQLAlchemyError

from extensions.ext_database import db
from models import Account, App
from models.education.resource_tag import SessionResourceTag
from services.app_service import AppService
from services.dataset_service import DatasetService

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue="app_deletion", max_retries=3, ignore_result=False)
def delete_session_resources_task(
    self,
    session_id: str,
    account_id: str | None,
    tenant_id: str,
    user_id: str,
) -> dict:
    """
    Delete all resources associated with a session.

    This task deletes apps and datasets for a given session.
    SessionResourceTags are automatically cleaned up by event handlers when
    apps/datasets are deleted.

    Note: LLM usage logs are preserved for audit/billing purposes.

    Args:
        self: Celery task instance (bound)
        session_id: The session UUID
        account_id: Optional filter for specific account's resources
        tenant_id: Tenant UUID for the resources
        user_id: Account UUID of the user requesting deletion (for permission checks)

    Returns:
        Dictionary with deletion results:
            - status: "completed" or "failed"
            - deleted_apps: Number of apps deleted
            - deleted_datasets: Number of datasets deleted
            - errors: List of any errors encountered
    """
    logger.info(
        click.style(
            f"Starting session resource cleanup: session={session_id}, account={account_id}",
            fg="green",
        )
    )
    start_at = time.perf_counter()

    result = {
        "status": "completed",
        "deleted_apps": 0,
        "deleted_datasets": 0,
        "verified_tags_remaining": 0,
        "errors": [],
    }

    try:
        # Get resources to delete
        resources = _get_resources_to_delete(session_id, account_id)
        app_ids = resources["apps"]
        dataset_ids = resources["datasets"]

        total_items = len(app_ids) + len(dataset_ids)
        current = 0

        # Phase 1: Delete Apps
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": 0,
                "deleted_datasets": 0,
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
                "phase": "deleting_datasets",
            },
        )

        # Get user for dataset deletion permission check
        user = db.session.query(Account).filter(Account.id == user_id).first()
        if user:
            # Set tenant context for permission checks
            user.set_tenant_id(tenant_id)
        deleted_datasets, dataset_errors = _delete_datasets(dataset_ids, user)
        result["deleted_datasets"] = deleted_datasets
        result["errors"].extend(dataset_errors)
        current += len(dataset_ids)

        # Phase 3: Verify cleanup (tags should be auto-deleted by event handlers)
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": deleted_apps,
                "deleted_datasets": deleted_datasets,
                "phase": "cleanup",
            },
        )

        remaining_tags = _verify_resource_tags_cleanup(session_id, account_id)
        result["verified_tags_remaining"] = remaining_tags

        end_at = time.perf_counter()
        logger.info(
            click.style(
                f"Session resource cleanup completed: session={session_id}, "
                f"apps={deleted_apps}, datasets={deleted_datasets}, "
                f"latency={end_at - start_at:.2f}s",
                fg="green",
            )
        )

        return result

    except SQLAlchemyError as e:
        logger.exception(
            click.style(
                f"Database error during session resource cleanup: {session_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Database error: {e!s}")
        raise self.retry(exc=e, countdown=60)

    except Exception as e:
        logger.exception(
            click.style(
                f"Error during session resource cleanup: {session_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Unexpected error: {e!s}")
        raise self.retry(exc=e, countdown=60)


def _get_resources_to_delete(
    session_id: str,
    account_id: str | None,
) -> dict[str, list[str]]:
    """
    Get resource IDs to delete for a session.

    Args:
        session_id: The session UUID
        account_id: Optional filter for specific account

    Returns:
        Dictionary with "apps" and "datasets" keys containing lists of IDs
    """
    query = db.session.query(SessionResourceTag).filter(SessionResourceTag.session_id == session_id)

    if account_id:
        query = query.filter(SessionResourceTag.account_id == account_id)

    tags = query.all()

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
            # Get the app first
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

            # Use AppService to properly delete app with events
            # This triggers app_was_deleted event for SessionResourceTag cleanup
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
            # DatasetService.delete_dataset sends dataset_was_deleted signal
            # which triggers SessionResourceTag cleanup via event handler
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


def _verify_resource_tags_cleanup(
    session_id: str,
    account_id: str | None,
) -> int:
    """
    Verify that SessionResourceTags were cleaned up by event handlers.

    This is a verification step - tags should be automatically deleted when
    apps/datasets are deleted via their respective event handlers.

    Args:
        session_id: The session UUID
        account_id: Optional filter for specific account

    Returns:
        Number of remaining tags (should be 0 if cleanup was successful)
    """
    query = db.session.query(SessionResourceTag).filter(SessionResourceTag.session_id == session_id)

    if account_id:
        query = query.filter(SessionResourceTag.account_id == account_id)

    remaining = query.count()

    if remaining > 0:
        logger.warning(
            click.style(
                f"Found {remaining} orphan SessionResourceTags after cleanup "
                f"(session={session_id}, account={account_id})",
                fg="yellow",
            )
        )

    return remaining
