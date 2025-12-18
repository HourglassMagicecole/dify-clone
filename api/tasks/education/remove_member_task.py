"""Celery task for removing session member with their resources."""

import logging
import time

import click
from celery import shared_task
from sqlalchemy.exc import SQLAlchemyError

from extensions.ext_database import db
from models import Account, App
from models.education.resource_tag import SessionResourceTag
from models.education.session_member import EducationSessionMember, MemberStatus
from services.app_service import AppService
from services.dataset_service import DatasetService

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue="app_deletion", max_retries=3, ignore_result=False)
def remove_session_member_with_resources_task(
    self,
    session_id: str,
    member_account_id: str,
    tenant_id: str,
    user_id: str,
) -> dict:
    """
    Remove a session member and delete all their resources.

    This task:
    1. Deletes all apps created by the member in this session
    2. Deletes all datasets created by the member in this session
    3. Updates member status to REMOVED

    Note: LLM usage logs are preserved for audit/billing purposes.

    Args:
        self: Celery task instance (bound)
        session_id: The session UUID
        member_account_id: Account UUID of the member to remove
        tenant_id: Tenant UUID for the resources
        user_id: Account UUID of the user requesting removal (for permission checks)

    Returns:
        Dictionary with removal results:
            - status: "completed" or "failed"
            - deleted_apps: Number of apps deleted
            - deleted_datasets: Number of datasets deleted
            - member_removed: Whether member was successfully removed
            - errors: List of any errors encountered
    """
    logger.info(
        click.style(
            f"Starting member removal with resources: session={session_id}, member={member_account_id}",
            fg="green",
        )
    )
    start_at = time.perf_counter()

    result = {
        "status": "completed",
        "deleted_apps": 0,
        "deleted_datasets": 0,
        "member_removed": False,
        "errors": [],
    }

    try:
        # Get resources to delete for this member
        resources = _get_member_resources(session_id, member_account_id)
        app_ids = resources["apps"]
        dataset_ids = resources["datasets"]

        total_items = len(app_ids) + len(dataset_ids) + 1  # +1 for member removal
        current = 0

        # Phase 1: Delete Apps
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": 0,
                "deleted_datasets": 0,
                "member_removed": False,
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
                "member_removed": False,
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

        # Phase 3: Remove member
        self.update_state(
            state="PROGRESS",
            meta={
                "current": current,
                "total": total_items,
                "deleted_apps": deleted_apps,
                "deleted_datasets": deleted_datasets,
                "member_removed": False,
                "phase": "removing_member",
            },
        )

        member_removed = _remove_member(session_id, member_account_id)
        result["member_removed"] = member_removed

        end_at = time.perf_counter()
        logger.info(
            click.style(
                f"Member removal completed: session={session_id}, member={member_account_id}, "
                f"apps={deleted_apps}, datasets={deleted_datasets}, removed={member_removed}, "
                f"latency={end_at - start_at:.2f}s",
                fg="green",
            )
        )

        return result

    except SQLAlchemyError as e:
        logger.exception(
            click.style(
                f"Database error during member removal: session={session_id}, member={member_account_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Database error: {e!s}")
        raise self.retry(exc=e, countdown=60)

    except Exception as e:
        logger.exception(
            click.style(
                f"Error during member removal: session={session_id}, member={member_account_id}",
                fg="red",
            )
        )
        result["status"] = "failed"
        result["errors"].append(f"Unexpected error: {e!s}")
        raise self.retry(exc=e, countdown=60)


def _get_member_resources(
    session_id: str,
    account_id: str,
) -> dict[str, list[str]]:
    """
    Get resource IDs for a specific member in a session.

    Args:
        session_id: The session UUID
        account_id: The member's account UUID

    Returns:
        Dictionary with "apps" and "datasets" keys containing lists of IDs
    """
    tags = (
        db.session.query(SessionResourceTag)
        .filter(
            SessionResourceTag.session_id == session_id,
            SessionResourceTag.account_id == account_id,
        )
        .all()
    )

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


def _remove_member(session_id: str, account_id: str) -> bool:
    """
    Remove member from session (soft delete).

    Args:
        session_id: The session UUID
        account_id: The member's account UUID

    Returns:
        True if member was removed, False otherwise
    """
    from datetime import UTC, datetime

    try:
        member = (
            db.session.query(EducationSessionMember)
            .filter(
                EducationSessionMember.session_id == session_id,
                EducationSessionMember.account_id == account_id,
            )
            .first()
        )

        if not member:
            logger.warning("Member %s not found in session %s", account_id, session_id)
            return False

        member.status = MemberStatus.REMOVED.value
        member.updated_at = datetime.now(UTC)
        db.session.commit()

        logger.info(click.style(f"Removed member {account_id} from session {session_id}", fg="green"))
        return True

    except Exception:
        db.session.rollback()
        logger.exception(click.style(f"Failed to remove member {account_id}", fg="red"))
        return False
