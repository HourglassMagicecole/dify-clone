"""Unit tests for bulk_user_task CSV parsing (delimiter auto-detection)."""

from unittest.mock import MagicMock, patch


def _run_task(csv_content: str, mock_service_instance: MagicMock) -> dict:
    """Helper: invoke the task's underlying function with DB/service mocks.

    We call the task function directly (bypassing Celery) by using `.run` and
    providing a fake `self` via bind semantics when needed. The @shared_task
    wrapper still exposes the function under `.run`, which receives `self`
    as the bound Task instance; we substitute a MagicMock.
    """
    from tasks.education import bulk_user_task as mod

    # Patch db.session.query(...).filter_by(...).first() to return a fake creator
    fake_creator = MagicMock(spec=[])
    fake_creator.id = "creator-1"

    with (
        patch.object(mod, "db") as mock_db,
        patch.object(mod, "UserManagementService", return_value=mock_service_instance),
    ):
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = fake_creator

        # shared_task(bind=True) exposes .run which already has `self` bound to
        # the Task instance. Call .run directly with the remaining kwargs.
        return mod.bulk_create_users_task.run(csv_content=csv_content, session_id=None, created_by="creator-1")


def _make_service_mock() -> MagicMock:
    service = MagicMock()
    service.create_user.side_effect = lambda email, name, password, role, creator_account: {
        "id": f"user-{email}",
        "email": email,
    }
    return service


class TestBulkUserCsvDelimiterDetection:
    def test_comma_delimited_csv_parses_successfully(self):
        """기존 동작 유지: 콤마 구분자 CSV는 그대로 파싱되어야 한다."""
        csv_content = (
            "email,name,password,role\na@example.com,Alice,pw123456,student\nb@example.com,Bob,pw234567,admin\n"
        )
        service = _make_service_mock()

        result = _run_task(csv_content, service)

        assert result["total"] == 2
        assert result["created"] == 2
        assert result["failed"] == 0
        assert service.create_user.call_count == 2
        first_call = service.create_user.call_args_list[0].kwargs
        assert first_call["email"] == "a@example.com"
        assert first_call["name"] == "Alice"
        assert first_call["role"] == "student"

    def test_tab_delimited_csv_parses_successfully(self):
        """Regression: 탭 구분(TSV) 파일도 정상 파싱되어야 한다."""
        csv_content = (
            "email\tname\tpassword\trole\n"
            "a@example.com\tAlice\tpw123456\tstudent\n"
            "b@example.com\tBob\tpw234567\tadmin\n"
        )
        service = _make_service_mock()

        result = _run_task(csv_content, service)

        assert result["total"] == 2, f"expected 2, got {result}"
        assert result["created"] == 2, f"errors: {result.get('errors')}"
        assert result["failed"] == 0
        assert service.create_user.call_count == 2
        kwargs = service.create_user.call_args_list[0].kwargs
        assert kwargs["email"] == "a@example.com"
        assert kwargs["name"] == "Alice"
        assert kwargs["password"] == "pw123456"
        assert kwargs["role"] == "student"

    def test_bom_prefixed_header_is_handled(self):
        """BOM(\\ufeff)이 헤더 앞에 있어도 email 컬럼을 정상 인식해야 한다."""
        csv_content = "\ufeffemail,name,password,role\na@example.com,Alice,pw123456,student\n"
        service = _make_service_mock()

        result = _run_task(csv_content, service)

        assert result["created"] == 1, f"errors: {result.get('errors')}"
        assert result["failed"] == 0
        kwargs = service.create_user.call_args_list[0].kwargs
        assert kwargs["email"] == "a@example.com"

    def test_semicolon_delimited_csv_parses_successfully(self):
        """세미콜론 구분자도 허용 목록에 포함되어 정상 파싱되어야 한다."""
        csv_content = "email;name;password;role\na@example.com;Alice;pw123456;student\n"
        service = _make_service_mock()

        result = _run_task(csv_content, service)

        assert result["created"] == 1, f"errors: {result.get('errors')}"
        kwargs = service.create_user.call_args_list[0].kwargs
        assert kwargs["email"] == "a@example.com"
