"""Tests for EduSessionMemberService (AC6 - Backend Unit Tests)."""

import uuid
from datetime import datetime
from unittest.mock import MagicMock

from services.edu_session_member_service import EduSessionMemberService


class TestEduSessionMemberService:
    """Test EduSessionMemberService methods."""

    def test_add_member_success(self):
        """
        멤버 추가 성공 테스트.

        Given: 세션 ID와 계정 ID
        When: add_member() 호출
        Then: 새 멤버가 생성되고 status='active'로 설정됨
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = None  # No existing member

        # Act
        result = EduSessionMemberService.add_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result.session_id == session_id
        assert result.account_id == account_id
        assert result.status == "active"
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    def test_add_member_duplicate(self):
        """
        중복 멤버 추가 시 기존 멤버 반환 테스트.

        Given: 이미 존재하는 멤버
        When: 동일한 add_member() 재호출
        Then: 기존 멤버 반환, 중복 생성되지 않음
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        existing_member = MagicMock()
        existing_member.id = str(uuid.uuid4())
        existing_member.session_id = session_id
        existing_member.account_id = account_id
        existing_member.status = "active"

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = existing_member

        # Act
        result = EduSessionMemberService.add_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result == existing_member
        mock_db_session.add.assert_not_called()
        mock_db_session.commit.assert_not_called()

    def test_remove_member_success(self):
        """
        멤버 제거 성공 테스트 (soft delete).

        Given: 활성 멤버 존재
        When: remove_member() 호출
        Then: status='removed'로 변경, True 반환
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        existing_member = MagicMock()
        existing_member.id = str(uuid.uuid4())
        existing_member.session_id = session_id
        existing_member.account_id = account_id
        existing_member.status = "active"

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = existing_member

        # Act
        result = EduSessionMemberService.remove_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result is True
        assert existing_member.status == "removed"
        assert isinstance(existing_member.updated_at, datetime)
        mock_db_session.commit.assert_called_once()

    def test_remove_member_not_found(self):
        """
        존재하지 않는 멤버 제거 시 False 반환 테스트.

        Given: 멤버가 존재하지 않음
        When: remove_member() 호출
        Then: False 반환
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = None

        # Act
        result = EduSessionMemberService.remove_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result is False
        mock_db_session.commit.assert_not_called()

    def test_get_session_members_with_status_filter(self):
        """
        세션 멤버 목록 조회 테스트 (status 필터링).

        Given: 세션에 3명의 멤버 (2 active, 1 removed)
        When: get_session_members(status='active') 호출
        Then: 2명의 active 멤버만 반환, joined_at 순으로 정렬
        """
        # Arrange
        session_id = str(uuid.uuid4())

        member1 = MagicMock()
        member1.id = str(uuid.uuid4())
        member1.session_id = session_id
        member1.account_id = str(uuid.uuid4())
        member1.status = "active"
        member1.joined_at = datetime(2025, 10, 1, 10, 0, 0)

        member2 = MagicMock()
        member2.id = str(uuid.uuid4())
        member2.session_id = session_id
        member2.account_id = str(uuid.uuid4())
        member2.status = "active"
        member2.joined_at = datetime(2025, 10, 2, 10, 0, 0)

        member3 = MagicMock()
        member3.id = str(uuid.uuid4())
        member3.session_id = session_id
        member3.account_id = str(uuid.uuid4())
        member3.status = "removed"
        member3.joined_at = datetime(2025, 10, 3, 10, 0, 0)

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter2 = mock_filter.filter.return_value
        mock_order = mock_filter2.order_by.return_value
        mock_order.all.return_value = [member1, member2]

        # Act
        result = EduSessionMemberService.get_session_members(
            session_id=session_id, db_session=mock_db_session, status="active"
        )

        # Assert
        assert len(result) == 2
        assert result[0] == member1
        assert result[1] == member2

    def test_is_session_member_true(self):
        """
        활성 멤버 확인 테스트.

        Given: 활성 멤버 존재
        When: is_session_member() 호출
        Then: True 반환
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        # Mock Account
        mock_account = MagicMock()
        mock_account.id = account_id

        # Mock TenantAccountJoin (non-owner role)
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = "admin"  # Not owner, so membership check will proceed

        existing_member = MagicMock()
        existing_member.id = str(uuid.uuid4())
        existing_member.session_id = session_id
        existing_member.account_id = account_id
        existing_member.status = "active"

        mock_db_session = MagicMock()
        mock_db_session.get.return_value = mock_account  # Account lookup

        # Setup query chains for TenantAccountJoin and EducationSessionMember
        def query_side_effect(model):
            mock_query = MagicMock()
            if hasattr(model, "__name__") and model.__name__ == "TenantAccountJoin":
                mock_query.filter_by.return_value.first.return_value = mock_tenant_join
            else:
                mock_query.filter.return_value.first.return_value = existing_member
            return mock_query

        mock_db_session.query.side_effect = query_side_effect

        # Act
        result = EduSessionMemberService.is_session_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result is True

    def test_is_session_member_false(self):
        """
        비멤버 확인 테스트.

        Given: 멤버가 아님
        When: is_session_member() 호출
        Then: False 반환
        """
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        # Mock Account
        mock_account = MagicMock()
        mock_account.id = account_id

        # Mock TenantAccountJoin (non-owner role)
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = "admin"  # Not owner, so membership check will proceed

        mock_db_session = MagicMock()
        mock_db_session.get.return_value = mock_account  # Account lookup

        # Setup query chains for TenantAccountJoin and EducationSessionMember
        def query_side_effect(model):
            mock_query = MagicMock()
            if hasattr(model, "__name__") and model.__name__ == "TenantAccountJoin":
                mock_query.filter_by.return_value.first.return_value = mock_tenant_join
            else:
                mock_query.filter.return_value.first.return_value = None  # No membership
            return mock_query

        mock_db_session.query.side_effect = query_side_effect

        # Act
        result = EduSessionMemberService.is_session_member(
            session_id=session_id, account_id=account_id, db_session=mock_db_session
        )

        # Assert
        assert result is False
