"""Clean up SessionResourceTag when resources are deleted."""

import logging

from sqlalchemy import delete

from events.app_event import app_was_deleted
from events.dataset_event import dataset_was_deleted
from extensions.ext_database import db
from models.education.resource_tag import SessionResourceTag

logger = logging.getLogger(__name__)


@dataset_was_deleted.connect
def handle_dataset_deleted(sender, **kwargs):
    """Clean up SessionResourceTag when a dataset is deleted."""
    dataset = sender
    try:
        # Delete all SessionResourceTag records for this dataset
        stmt = delete(SessionResourceTag).where(
            SessionResourceTag.resource_type == "dataset", SessionResourceTag.resource_id == dataset.id
        )
        result = db.session.execute(stmt)
        db.session.commit()

        if result.rowcount > 0:
            logger.info("Deleted %d SessionResourceTag records for dataset %s", result.rowcount, dataset.id)
    except Exception as e:
        logger.error("Failed to delete SessionResourceTag for dataset %s: %s", dataset.id, e, exc_info=True)
        db.session.rollback()


@app_was_deleted.connect
def handle_app_deleted(sender, **kwargs):
    """Clean up SessionResourceTag when an app is deleted."""
    app = sender
    try:
        # Delete all SessionResourceTag records for this app
        stmt = delete(SessionResourceTag).where(
            SessionResourceTag.resource_type == "app", SessionResourceTag.resource_id == app.id
        )
        result = db.session.execute(stmt)
        db.session.commit()

        if result.rowcount > 0:
            logger.info("Deleted %d SessionResourceTag records for app %s", result.rowcount, app.id)
    except Exception as e:
        logger.error("Failed to delete SessionResourceTag for app %s: %s", app.id, e, exc_info=True)
        db.session.rollback()
