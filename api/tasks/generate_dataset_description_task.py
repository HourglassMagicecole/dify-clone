import logging

import click
from celery import shared_task
from sqlalchemy import select

from extensions.ext_database import db
from models.dataset import Dataset, DocumentSegment

logger = logging.getLogger(__name__)


@shared_task(queue="dataset")
def generate_dataset_description_task(dataset_id: str):
    """
    Generate an auto-description for a dataset using LLM based on sample segments.

    Skips if the dataset already has a description (user-provided).
    Failures are silently logged — description remains empty.

    Usage: generate_dataset_description_task.delay(dataset_id)
    """
    dataset = db.session.query(Dataset).where(Dataset.id == dataset_id).first()
    if not dataset:
        logger.info(click.style(f"Dataset not found for description generation: {dataset_id}", fg="yellow"))
        db.session.close()
        return

    # Do not overwrite user-provided descriptions
    if dataset.description:
        logger.info(
            click.style(f"Dataset {dataset_id} already has a description, skipping auto-generation", fg="green")
        )
        db.session.close()
        return

    try:
        # Fetch sample segments (first 10 by position) from completed segments
        segments = db.session.scalars(
            select(DocumentSegment)
            .where(
                DocumentSegment.dataset_id == dataset_id,
                DocumentSegment.status == "completed",
            )
            .order_by(DocumentSegment.position.asc())
            .limit(10)
        ).all()

        if not segments:
            logger.info(click.style(f"No completed segments found for dataset: {dataset_id}", fg="yellow"))
            db.session.close()
            return

        chunk_contents = [segment.content for segment in segments if segment.content]
        if not chunk_contents:
            logger.info(click.style(f"No segment content found for dataset: {dataset_id}", fg="yellow"))
            db.session.close()
            return

        from core.llm_generator.llm_generator import LLMGenerator

        description = LLMGenerator.generate_dataset_description(
            tenant_id=dataset.tenant_id,
            chunk_contents=chunk_contents,
        )

        if description:
            dataset.description = description
            db.session.commit()
            logger.info(
                click.style(f"Auto-generated description for dataset {dataset_id}: {description[:80]}...", fg="green")
            )
        else:
            logger.info(click.style(f"LLM returned empty description for dataset: {dataset_id}", fg="yellow"))

    except Exception:
        logger.exception("Failed to generate dataset description for dataset_id: %s", dataset_id)
    finally:
        db.session.close()
