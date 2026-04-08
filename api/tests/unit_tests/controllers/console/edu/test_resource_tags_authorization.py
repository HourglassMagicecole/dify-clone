"""Tests for resource_tags.py IDOR defense, session membership, and delete authorization.

Validates:
- create_tag uses current_user.id, ignoring request body account_id
- create_tag rejects non-session-members (403)
- delete_tag rejects non-creator non-admin (403)
- delete_tag allows admin to delete any tag
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def app():
    """Create a minimal Flask app with the resource_tags blueprint."""
    from flask import Flask

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"

    # Patch setup_required and account_initialization_required to be no-ops
    with patch("controllers.console.edu.resource_tags.setup_required", lambda f: f), \
            patch("controllers.console.edu.resource_tags.account_initialization_required", lambda f: f), \
            patch("controllers.console.edu.resource_tags.login_required", lambda f: f):
        from controllers.console.edu.resource_tags import bp
        app.register_blueprint(bp)

    return app


@pytest.fixture
def mock_current_user():
    """Create a mock current_user."""
    user = MagicMock()
    user.id = str(uuid.uuid4())
    return user


class TestCreateTagIDOR:
    """Test that create_tag uses current_user.id, not request body account_id."""

    def test_account_id_in_body_is_ignored(self, app, mock_current_user):
        """Even if attacker includes account_id in body, current_user.id is used."""
        attacker_target_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        resource_id = str(uuid.uuid4())

        mock_membership = MagicMock()
        mock_membership.status = "active"

        mock_tag = MagicMock()
        mock_tag.id = str(uuid.uuid4())
        mock_tag.session_id = session_id
        mock_tag.resource_type = "app"
        mock_tag.resource_id = resource_id
        mock_tag.account_id = mock_current_user.id  # Should be current_user.id
        mock_tag.tagged_at = None

        with app.test_request_context():
            with patch("controllers.console.edu.resource_tags.current_user", mock_current_user), \
                    patch("controllers.console.edu.resource_tags.db") as mock_db, \
                    patch("controllers.console.edu.resource_tags.ResourceTaggingService") as mock_service_cls:
                # Membership check passes
                mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_membership
                mock_service_cls.return_value.add_tag.return_value = mock_tag

                with app.test_client() as client:
                    response = client.post(
                        "/console/api/edu/resource-tags",
                        json={
                            "session_id": session_id,
                            "resource_type": "app",
                            "resource_id": resource_id,
                            "account_id": attacker_target_id,  # IDOR attempt
                        },
                        content_type="application/json",
                    )

                    assert response.status_code == 201
                    # Verify add_tag was called with current_user.id, NOT the attacker's target
                    call_kwargs = mock_service_cls.return_value.add_tag.call_args
                    assert call_kwargs is not None
                    # Check that account_id passed to service is current_user.id
                    if call_kwargs.kwargs:
                        assert call_kwargs.kwargs["account_id"] == str(mock_current_user.id)
                    else:
                        # positional args: session_id, resource_type, resource_id, account_id
                        assert call_kwargs.args[3] == str(mock_current_user.id)


class TestCreateTagSessionMembership:
    """Test that create_tag rejects non-session-members."""

    def test_non_member_gets_403(self, app, mock_current_user):
        """User who is not a member of the session should get 403."""
        session_id = str(uuid.uuid4())
        resource_id = str(uuid.uuid4())

        with app.test_request_context():
            with patch("controllers.console.edu.resource_tags.current_user", mock_current_user), \
                    patch("controllers.console.edu.resource_tags.db") as mock_db:
                # Membership check returns None (not a member)
                mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

                with app.test_client() as client:
                    response = client.post(
                        "/console/api/edu/resource-tags",
                        json={
                            "session_id": session_id,
                            "resource_type": "app",
                            "resource_id": resource_id,
                        },
                        content_type="application/json",
                    )

                    assert response.status_code == 403
                    data = response.get_json()
                    assert "not a member" in data["message"]


class TestDeleteTagAuthorization:
    """Test delete_tag authorization: creator or admin only."""

    def test_non_creator_non_admin_gets_403(self, app, mock_current_user):
        """User who didn't create the tag and is not admin should get 403."""
        tag_id = str(uuid.uuid4())
        other_user_id = str(uuid.uuid4())

        # Mock tag owned by someone else
        mock_tag = MagicMock()
        mock_tag.id = tag_id
        mock_tag.account_id = other_user_id  # Different from current_user

        # Mock tenant_join with 'normal' role (not privileged)
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = "normal"

        with app.test_request_context():
            with patch("controllers.console.edu.resource_tags.current_user", mock_current_user), \
                    patch("controllers.console.edu.resource_tags.db") as mock_db:
                # Mock tag lookup via select/scalar
                mock_db.session.scalar.return_value = mock_tag
                # Mock TenantAccountJoin query for role check
                mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join

                with app.test_client() as client:
                    response = client.delete(f"/console/api/edu/resource-tags/{tag_id}")

                    assert response.status_code == 403
                    data = response.get_json()
                    assert "creator or admin" in data["message"]

    def test_admin_can_delete_others_tag(self, app, mock_current_user):
        """Admin should be able to delete tags created by other users."""
        tag_id = str(uuid.uuid4())
        other_user_id = str(uuid.uuid4())

        mock_tag = MagicMock()
        mock_tag.id = tag_id
        mock_tag.account_id = other_user_id  # Different from current_user

        # Mock tenant_join with 'admin' role (privileged)
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = "admin"

        with app.test_request_context():
            with patch("controllers.console.edu.resource_tags.current_user", mock_current_user), \
                    patch("controllers.console.edu.resource_tags.db") as mock_db, \
                    patch("controllers.console.edu.resource_tags.ResourceTaggingService") as mock_service_cls:
                mock_db.session.scalar.return_value = mock_tag
                mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join
                mock_service_cls.return_value.remove_tag.return_value = None

                with app.test_client() as client:
                    response = client.delete(f"/console/api/edu/resource-tags/{tag_id}")

                    assert response.status_code == 200
                    data = response.get_json()
                    assert data["result"] == "success"
