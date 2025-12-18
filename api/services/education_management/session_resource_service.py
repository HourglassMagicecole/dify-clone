"""Session resource management service for education sessions."""

from datetime import UTC

from sqlalchemy.orm import joinedload

from extensions.ext_database import db
from models import Account, App
from models.dataset import Dataset
from models.education.resource_tag import SessionResourceTag


class SessionResourceService:
    """
    Service for managing session resources.

    Provides methods to query and retrieve resources (apps, datasets) associated
    with education sessions, including filtering by resource type and account.
    """

    def get_session_resources(
        self,
        session_id: str,
        resource_type: str | None = None,
        account_id: str | None = None,
    ) -> dict[str, list[dict] | dict[str, int]]:
        """
        Get all resources associated with a session.

        Args:
            session_id: The session UUID to query resources for.
            resource_type: Optional filter for resource type ("app" or "dataset").
            account_id: Optional filter for specific account's resources.

        Returns:
            Dictionary containing:
                - apps: List of app resource details
                - datasets: List of dataset resource details
                - summary: Dict with total_apps and total_datasets counts
        """
        # Build base query
        query = db.session.query(SessionResourceTag).filter(SessionResourceTag.session_id == session_id)

        # Apply account filter if specified
        if account_id:
            query = query.filter(SessionResourceTag.account_id == account_id)

        # Apply resource type filter if specified
        if resource_type:
            query = query.filter(SessionResourceTag.resource_type == resource_type)

        # Execute query with eager loading of account relationship
        tags = query.options(joinedload(SessionResourceTag.account)).all()

        # Separate tags by resource type
        app_tags = [t for t in tags if t.resource_type == "app"]
        dataset_tags = [t for t in tags if t.resource_type == "dataset"]

        # Get app and dataset details
        app_ids = [t.resource_id for t in app_tags]
        dataset_ids = [t.resource_id for t in dataset_tags]

        app_details = self._get_app_details(app_ids) if app_ids else {}
        dataset_details = self._get_dataset_details(dataset_ids) if dataset_ids else {}

        # Build response
        apps = []
        for tag in app_tags:
            app_info = app_details.get(tag.resource_id)
            if app_info:
                apps.append(
                    {
                        "resource_id": tag.resource_id,
                        "resource_name": app_info["name"],
                        "account_id": tag.account_id,
                        "account_name": tag.account.name if tag.account else None,
                        "account_email": tag.account.email if tag.account else None,
                        "tagged_at": tag.tagged_at.replace(tzinfo=UTC).isoformat() if tag.tagged_at else None,
                        "created_at": app_info["created_at"],
                    }
                )

        datasets = []
        for tag in dataset_tags:
            dataset_info = dataset_details.get(tag.resource_id)
            if dataset_info:
                datasets.append(
                    {
                        "resource_id": tag.resource_id,
                        "resource_name": dataset_info["name"],
                        "account_id": tag.account_id,
                        "account_name": tag.account.name if tag.account else None,
                        "account_email": tag.account.email if tag.account else None,
                        "tagged_at": tag.tagged_at.replace(tzinfo=UTC).isoformat() if tag.tagged_at else None,
                        "created_at": dataset_info["created_at"],
                    }
                )

        return {
            "apps": apps,
            "datasets": datasets,
            "summary": {
                "total_apps": len(apps),
                "total_datasets": len(datasets),
            },
        }

    def _get_app_details(self, resource_ids: list[str]) -> dict[str, dict]:
        """
        Get app details for given resource IDs.

        Args:
            resource_ids: List of app UUIDs to fetch.

        Returns:
            Dictionary mapping resource_id to app details (name, created_at).
        """
        if not resource_ids:
            return {}

        apps = db.session.query(App).filter(App.id.in_(resource_ids)).all()

        return {
            app.id: {
                "name": app.name,
                "created_at": app.created_at.replace(tzinfo=UTC).isoformat() if app.created_at else None,
            }
            for app in apps
        }

    def _get_dataset_details(self, resource_ids: list[str]) -> dict[str, dict]:
        """
        Get dataset details for given resource IDs.

        Args:
            resource_ids: List of dataset UUIDs to fetch.

        Returns:
            Dictionary mapping resource_id to dataset details (name, created_at).
        """
        if not resource_ids:
            return {}

        datasets = db.session.query(Dataset).filter(Dataset.id.in_(resource_ids)).all()

        return {
            dataset.id: {
                "name": dataset.name,
                "created_at": dataset.created_at.replace(tzinfo=UTC).isoformat() if dataset.created_at else None,
            }
            for dataset in datasets
        }

    def get_resources_to_delete(
        self,
        session_id: str,
        account_id: str | None = None,
    ) -> dict[str, list[str]]:
        """
        Get resource IDs to delete for a session.

        Args:
            session_id: The session UUID.
            account_id: Optional filter for specific account's resources.

        Returns:
            Dictionary with keys "apps" and "datasets" containing lists of resource IDs.
        """
        query = db.session.query(SessionResourceTag).filter(SessionResourceTag.session_id == session_id)

        if account_id:
            query = query.filter(SessionResourceTag.account_id == account_id)

        tags = query.all()

        return {
            "apps": [t.resource_id for t in tags if t.resource_type == "app"],
            "datasets": [t.resource_id for t in tags if t.resource_type == "dataset"],
        }

    def get_unique_accounts(self, session_id: str) -> list[dict]:
        """
        Get unique accounts that have resources in a session.

        Args:
            session_id: The session UUID.

        Returns:
            List of dictionaries with account_id, name, and email.
        """
        # Get distinct account IDs from resource tags
        account_ids_query = (
            db.session.query(SessionResourceTag.account_id)
            .filter(SessionResourceTag.session_id == session_id)
            .distinct()
        )
        account_ids = [row[0] for row in account_ids_query.all()]

        if not account_ids:
            return []

        accounts = db.session.query(Account).filter(Account.id.in_(account_ids)).all()

        return [
            {
                "account_id": account.id,
                "name": account.name,
                "email": account.email,
            }
            for account in accounts
        ]
