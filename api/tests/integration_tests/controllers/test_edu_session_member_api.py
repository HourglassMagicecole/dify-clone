"""Integration tests for Session Membership Management API (Task 8).

This module tests the following Integration Verification criteria:
- IV1: Session members can access their session roles
- IV2: Non-members receive 403 when accessing session roles
- IV4: Member management APIs (add/remove/list) work correctly
"""

import uuid
from datetime import UTC, datetime

import pytest
from flask.testing import FlaskClient

from extensions.ext_database import db
from models import Account, TenantAccountJoin
from models.education import EducationSession, EducationSessionMember, EduUserRole


@pytest.fixture
def edu_session(flask_req_ctx, setup_account: Account) -> EducationSession:
    """Create a test education session."""
    from sqlalchemy.orm import Session

    # Get tenant_id from TenantAccountJoin
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=setup_account.id).first()
    tenant_id = tenant_join.tenant_id if tenant_join else None

    session_obj = EducationSession(
        id=str(uuid.uuid4()),
        session_name="Test Session",
        session_tag="test-tag",
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

    # Grant admin role to setup_account
    admin_role = EduUserRole(
        id=str(uuid.uuid4()),
        session_id=session_obj.id,
        account_id=setup_account.id,
        role="admin",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.session.add(admin_role)
    db.session.commit()

    # Query with expire_on_commit=False to prevent detached instance errors
    with Session(bind=db.engine, expire_on_commit=False) as session:
        edu_session = session.query(EducationSession).filter_by(id=session_obj.id).one()

    yield edu_session

    # Cleanup
    db.session.query(EducationSessionMember).filter_by(session_id=edu_session.id).delete()
    db.session.query(EduUserRole).filter_by(session_id=edu_session.id).delete()
    db.session.query(EducationSession).filter_by(id=edu_session.id).delete()
    db.session.commit()


@pytest.fixture
def member_account(flask_req_ctx) -> Account:
    """Create a test account to be used as a member."""
    account = Account(
        id=str(uuid.uuid4()),
        name="Member User",
        email=f"member-{uuid.uuid4()}@example.com",
        password="hashed_password",
        password_salt="salt",
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.session.add(account)
    db.session.commit()

    yield account

    # Cleanup
    db.session.query(Account).filter_by(id=account.id).delete()
    db.session.commit()


@pytest.fixture
def non_member_account(flask_req_ctx) -> Account:
    """Create a test account that is NOT a member."""
    account = Account(
        id=str(uuid.uuid4()),
        name="Non-Member User",
        email=f"non-member-{uuid.uuid4()}@example.com",
        password="hashed_password",
        password_salt="salt",
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.session.add(account)
    db.session.commit()

    yield account

    # Cleanup
    db.session.query(Account).filter_by(id=account.id).delete()
    db.session.commit()


class TestGetUserRoleMembershipVerification:
    """Test membership verification in get_user_role endpoint (IV1, IV2)."""

    def test_get_user_role_member_success(
        self,
        test_client: FlaskClient,
        auth_header: dict[str, str],
        edu_session: EducationSession,
        setup_account: Account,
    ):
        """
        Test IV1: Session members can successfully access their role.

        Given:
            - Education session exists
            - User is a member of the session
            - User has a role assigned
        When:
            - GET /console/api/edu/user/role?session_id=xxx
        Then:
            - 200 OK
            - Role information is returned
        """
        # Arrange: Add user as a member
        member = EducationSessionMember(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=setup_account.id,
            status="active",
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add(member)

        # Arrange: Assign a role
        role = EduUserRole(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=setup_account.id,
            role="admin",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add(role)
        db.session.commit()

        # Act: Call the API
        response = test_client.get(f"/console/api/edu/user/role?session_id={edu_session.id}", headers=auth_header)

        # Assert
        assert response.status_code == 200
        data = response.json
        assert data["result"] == "success"
        assert data["data"]["role"] == "admin"
        assert data["data"]["session_id"] == edu_session.id

    def test_get_user_role_non_member_403(
        self,
        test_client: FlaskClient,
        auth_header: dict[str, str],
        edu_session: EducationSession,
        setup_account: Account,
    ):
        """
        Test IV2: Non-members receive 403 Forbidden when accessing session roles.

        Given:
            - Education session exists
            - User is NOT a member of the session
        When:
            - GET /console/api/edu/user/role?session_id=xxx
        Then:
            - 403 Forbidden
            - Error message: "You are not a member of this session"
        """
        # Arrange: User is NOT added as a member (intentionally)

        # Act: Call the API
        response = test_client.get(f"/console/api/edu/user/role?session_id={edu_session.id}", headers=auth_header)

        # Assert
        assert response.status_code == 403
        data = response.json
        assert data["result"] == "fail"
        assert "not a member" in data["message"].lower()


class TestMemberManagementAPI:
    """Test member management API endpoints (IV4)."""

    def test_add_member_api(
        self,
        test_client: FlaskClient,
        auth_header: dict[str, str],
        edu_session: EducationSession,
        member_account: Account,
    ):
        """
        Test IV4: Add member API works correctly.

        Given:
            - Admin user authenticated
            - Session exists
        When:
            - POST /console/api/edu/sessions/{session_id}/members
            - Request body: {"account_id": "user-uuid"}
        Then:
            - 201 Created
            - Member is added to the database with status='active'
        """
        # Act: Add member via API
        response = test_client.post(
            f"/console/api/edu/sessions/{edu_session.id}/members",
            headers=auth_header,
            json={"account_id": member_account.id},
        )

        # Debug: Print response if not 201
        if response.status_code != 201:
            print(f"\n=== DEBUG: Response Status: {response.status_code} ===")
            print(f"Response Data: {response.data.decode('utf-8')}")
            print(f"Response JSON: {response.json if response.is_json else 'Not JSON'}")

        # Assert
        assert response.status_code == 201
        data = response.json
        assert data["result"] == "success"
        assert data["data"]["member"]["account_id"] == member_account.id
        assert data["data"]["member"]["status"] == "active"

        # Verify in database
        member_in_db = (
            db.session.query(EducationSessionMember)
            .filter_by(session_id=edu_session.id, account_id=member_account.id)
            .first()
        )
        assert member_in_db is not None
        assert member_in_db.status == "active"

    def test_remove_member_api(
        self,
        test_client: FlaskClient,
        auth_header: dict[str, str],
        edu_session: EducationSession,
        member_account: Account,
    ):
        """
        Test IV4: Remove member API works correctly.

        Given:
            - Admin user authenticated
            - Active member exists
        When:
            - DELETE /console/api/edu/sessions/{session_id}/members/{account_id}
        Then:
            - 200 OK
            - Member status is changed to 'removed' (soft delete)
        """
        # Arrange: Add member first
        member = EducationSessionMember(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=member_account.id,
            status="active",
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add(member)
        db.session.commit()

        # Act: Remove member via API
        response = test_client.delete(
            f"/console/api/edu/sessions/{edu_session.id}/members/{member_account.id}",
            headers=auth_header,
        )

        # Assert
        assert response.status_code == 200
        data = response.json
        assert data["result"] == "success"
        assert "removed" in data["message"].lower()

        # Verify in database
        member_in_db = (
            db.session.query(EducationSessionMember)
            .filter_by(session_id=edu_session.id, account_id=member_account.id)
            .first()
        )
        assert member_in_db is not None
        assert member_in_db.status == "removed"

    def test_get_session_members_api(
        self,
        test_client: FlaskClient,
        auth_header: dict[str, str],
        edu_session: EducationSession,
        member_account: Account,
        non_member_account: Account,
    ):
        """
        Test: Get session members API returns correct list.

        Given:
            - Admin user authenticated
            - Session has 2 active members and 1 removed member
        When:
            - GET /console/api/edu/sessions/{session_id}/members?status=active
        Then:
            - 200 OK
            - Only active members are returned (2 members)
        """
        # Arrange: Add active members
        member1 = EducationSessionMember(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=member_account.id,
            status="active",
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        member2 = EducationSessionMember(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=non_member_account.id,
            status="active",
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        # Arrange: Add removed member
        member3 = EducationSessionMember(
            id=str(uuid.uuid4()),
            session_id=edu_session.id,
            account_id=str(uuid.uuid4()),  # Random account
            status="removed",
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.session.add_all([member1, member2, member3])
        db.session.commit()

        # Act: Get active members
        response = test_client.get(
            f"/console/api/edu/sessions/{edu_session.id}/members?status=active",
            headers=auth_header,
        )

        # Assert
        assert response.status_code == 200
        data = response.json
        assert data["result"] == "success"
        assert data["data"]["total"] == 2
        assert len(data["data"]["members"]) == 2
        # Verify all returned members are active
        for member in data["data"]["members"]:
            assert member["status"] == "active"
