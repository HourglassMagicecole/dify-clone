"""Integration tests for App Copy API with SessionResourceTag preservation.

This module tests the following Integration Verification criteria:
- IV1: Copying an app preserves SessionResourceTag
- IV2: Multiple session tags are correctly copied
- IV3: Apps without session tags can still be copied
"""

import uuid
from datetime import UTC, datetime

import pytest
from flask.testing import FlaskClient

from extensions.ext_database import db
from models import Account, App
from models.education import EducationSession
from models.education.resource_tag import SessionResourceTag


class TestAppCopyIntegration:
    """Integration tests for App Copy with SessionResourceTag."""

    @pytest.fixture
    def edu_session(self, flask_req_ctx, setup_account: Account) -> EducationSession:
        """Create a test education session."""
        from models import TenantAccountJoin

        # Get tenant_id from TenantAccountJoin
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=setup_account.id).first()
        tenant_id = tenant_join.tenant_id if tenant_join else None

        session_obj = EducationSession(
            id=str(uuid.uuid4()),
            session_name="Test Session for Copy",
            session_tag="copy-test-tag",
            tenant_id=tenant_id,
            instructor_account_id=setup_account.id,
            start_date=datetime.now(UTC),
            end_date=None,
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add(session_obj)
        db.session.commit()

        yield session_obj

        # Cleanup
        db.session.query(SessionResourceTag).filter_by(session_id=session_obj.id).delete()
        db.session.query(EducationSession).filter_by(id=session_obj.id).delete()
        db.session.commit()

    @pytest.fixture
    def test_app(self, flask_req_ctx, setup_account: Account, edu_session: EducationSession) -> App:
        """Create a test app with SessionResourceTag."""
        from models import TenantAccountJoin

        # Get tenant_id
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=setup_account.id).first()
        tenant_id = tenant_join.tenant_id if tenant_join else None

        # Create app
        app = App(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Original Test App",
            description="Test app for copy integration",
            mode="chat",
            enable_site=True,
            enable_api=True,
            created_by=setup_account.id,
        )
        db.session.add(app)
        db.session.commit()

        # Add SessionResourceTag
        tag = SessionResourceTag(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            resource_type="app",
            resource_id=str(app.id),
            account_id=setup_account.id,
        )
        db.session.add(tag)
        db.session.commit()

        yield app

        # Cleanup
        db.session.query(SessionResourceTag).filter_by(resource_id=str(app.id)).delete()
        db.session.query(App).filter_by(id=app.id).delete()
        db.session.commit()

    def test_copy_app_preserves_session_tag(
        self,
        test_client: FlaskClient,
        auth_header,
        test_app: App,
        edu_session: EducationSession,
        setup_account: Account,
    ):
        """IV1: Test that copying an app also copies its SessionResourceTag."""
        # Call copy API
        response = test_client.post(
            f"/console/api/apps/{test_app.id}/copy",
            json={
                "name": "Copied App with Tag",
                "description": "Copied app should have session tag",
            },
            headers=auth_header,
        )

        assert response.status_code == 201
        copied_app_data = response.get_json()
        copied_app_id = copied_app_data["id"]

        try:
            # Verify SessionResourceTag was copied
            copied_tag = (
                db.session.query(SessionResourceTag)
                .filter(
                    SessionResourceTag.resource_type == "app",
                    SessionResourceTag.resource_id == copied_app_id,
                    SessionResourceTag.session_id == edu_session.id,
                )
                .first()
            )

            assert copied_tag is not None, "SessionResourceTag should be copied"
            assert copied_tag.session_id == edu_session.id, "Session ID should match original"
            assert copied_tag.resource_id == copied_app_id, "Resource ID should be the new app ID"
            assert copied_tag.account_id == setup_account.id, "Account ID should match"
        finally:
            # Cleanup copied app and tag
            db.session.query(SessionResourceTag).filter_by(resource_id=copied_app_id).delete()
            db.session.query(App).filter_by(id=copied_app_id).delete()
            db.session.commit()

    def test_copy_app_without_session_tag(
        self, test_client: FlaskClient, auth_header, flask_req_ctx, setup_account: Account
    ):
        """IV3: Test that copying an app without SessionResourceTag does not fail."""
        from models import TenantAccountJoin

        # Get tenant_id
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=setup_account.id).first()
        tenant_id = tenant_join.tenant_id if tenant_join else None

        # Create app without SessionResourceTag
        app = App(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="App Without Tag",
            description="No session tag",
            mode="chat",
            enable_site=True,
            enable_api=True,
            created_by=setup_account.id,
        )
        db.session.add(app)
        db.session.commit()

        try:
            # Call copy API
            response = test_client.post(
                f"/console/api/apps/{app.id}/copy",
                json={
                    "name": "Copied App No Tag",
                },
                headers=auth_header,
            )

            assert response.status_code == 201
            copied_app_data = response.get_json()
            assert copied_app_data["name"] == "Copied App No Tag"

            # Cleanup copied app
            copied_app_id = copied_app_data["id"]
            db.session.query(App).filter_by(id=copied_app_id).delete()
            db.session.commit()
        finally:
            # Cleanup original app
            db.session.query(App).filter_by(id=app.id).delete()
            db.session.commit()

    def test_copy_app_multiple_session_tags(
        self, test_client: FlaskClient, auth_header, flask_req_ctx, setup_account: Account
    ):
        """IV2: Test copying an app with multiple SessionResourceTags."""
        from models import TenantAccountJoin

        # Get tenant_id
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=setup_account.id).first()
        tenant_id = tenant_join.tenant_id if tenant_join else None

        # Create two sessions
        session1 = EducationSession(
            id=str(uuid.uuid4()),
            session_name="Session 1",
            session_tag="multi-tag-1",
            tenant_id=tenant_id,
            instructor_account_id=setup_account.id,
            start_date=datetime.now(UTC),
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session2 = EducationSession(
            id=str(uuid.uuid4()),
            session_name="Session 2",
            session_tag="multi-tag-2",
            tenant_id=tenant_id,
            instructor_account_id=setup_account.id,
            start_date=datetime.now(UTC),
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add_all([session1, session2])
        db.session.commit()

        # Create app with two tags
        app = App(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Multi-Tag App",
            mode="chat",
            enable_site=True,
            enable_api=True,
            created_by=setup_account.id,
        )
        db.session.add(app)
        db.session.commit()

        tag1 = SessionResourceTag(
            id=str(uuid.uuid4()),
            session_id=session1.id,
            resource_type="app",
            resource_id=str(app.id),
            account_id=setup_account.id,
        )
        tag2 = SessionResourceTag(
            id=str(uuid.uuid4()),
            session_id=session2.id,
            resource_type="app",
            resource_id=str(app.id),
            account_id=setup_account.id,
        )
        db.session.add_all([tag1, tag2])
        db.session.commit()

        try:
            # Copy app
            response = test_client.post(
                f"/console/api/apps/{app.id}/copy",
                json={"name": "Copied Multi-Tag App"},
                headers=auth_header,
            )

            assert response.status_code == 201
            copied_app_id = response.get_json()["id"]

            # Verify both tags were copied
            copied_tags = (
                db.session.query(SessionResourceTag)
                .filter(
                    SessionResourceTag.resource_type == "app",
                    SessionResourceTag.resource_id == copied_app_id,
                )
                .all()
            )

            assert len(copied_tags) == 2, "Both session tags should be copied"
            session_ids = {tag.session_id for tag in copied_tags}
            assert session1.id in session_ids, "Session 1 tag should be copied"
            assert session2.id in session_ids, "Session 2 tag should be copied"

            # Cleanup copied app and tags
            db.session.query(SessionResourceTag).filter_by(resource_id=copied_app_id).delete()
            db.session.query(App).filter_by(id=copied_app_id).delete()
            db.session.commit()
        finally:
            # Cleanup
            db.session.query(SessionResourceTag).filter(SessionResourceTag.resource_id == str(app.id)).delete()
            db.session.query(App).filter_by(id=app.id).delete()
            db.session.query(EducationSession).filter_by(id=session1.id).delete()
            db.session.query(EducationSession).filter_by(id=session2.id).delete()
            db.session.commit()
