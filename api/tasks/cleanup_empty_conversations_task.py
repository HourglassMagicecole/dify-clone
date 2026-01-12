"""
Celery task to clean up empty conversations.

Empty conversations are those that were created but never received any messages.
This typically happens when a user creates a new conversation but closes the tab
before sending their first message.
"""

import logging
import time

import click
from celery import shared_task

from services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


@shared_task(queue="ops_trace")
def cleanup_empty_conversations_task(max_age_minutes: int = 5) -> dict:
    """
    Celery task to clean up empty conversations older than max_age_minutes.

    Args:
        max_age_minutes: Maximum age in minutes for empty conversations to be kept.
                        Default is 5 minutes.

    Returns:
        Dictionary with cleanup results.
    """
    start_time = time.perf_counter()

    try:
        deleted_count = ConversationService.cleanup_empty_conversations(max_age_minutes)

        elapsed_time = time.perf_counter() - start_time
        logger.info(
            "Empty conversations cleanup completed: deleted=%d, elapsed_time=%.2fs",
            deleted_count,
            elapsed_time,
        )

        return {
            "status": "success",
            "deleted_count": deleted_count,
            "elapsed_time": elapsed_time,
        }

    except Exception as e:
        logger.exception("Empty conversations cleanup failed")
        return {
            "status": "error",
            "error": str(e),
        }


@click.command("cleanup-empty-conversations", help="Clean up empty conversations")
@click.option("--max-age", default=5, help="Maximum age in minutes for empty conversations")
def cleanup_empty_conversations_command(max_age: int):
    """CLI command to manually trigger empty conversation cleanup."""
    click.echo(f"Starting cleanup of empty conversations older than {max_age} minutes...")

    try:
        deleted_count = ConversationService.cleanup_empty_conversations(max_age)
        click.echo(f"Cleanup completed. Deleted {deleted_count} empty conversations.")
    except Exception as e:
        click.echo(f"Cleanup failed: {str(e)}", err=True)
        raise
