"""Unit tests for EducationSession model."""

from datetime import datetime

from models.education.session import EducationSession


def test_education_session_repr():
    """Test __repr__ method of EducationSession."""
    # Arrange
    session = EducationSession(
        id="test-session-id",
        session_name="2025 Spring AI Course",
        session_tag="2025-spring-ai",
    )

    # Act
    repr_str = repr(session)

    # Assert
    assert "EducationSession" in repr_str
    assert "test-session-id" in repr_str
    assert "2025 Spring AI Course" in repr_str
    assert "2025-spring-ai" in repr_str


def test_education_session_attributes():
    """Test EducationSession model attributes."""
    # Arrange
    session_id = "session-123"
    session_name = "Test Course"
    session_tag = "test-course-2025"
    tenant_id = "tenant-456"
    instructor_id = "instructor-789"
    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 6, 30)
    max_students = 30
    force_status = True
    description = "Test description"

    # Act
    session = EducationSession(
        id=session_id,
        session_name=session_name,
        session_tag=session_tag,
        tenant_id=tenant_id,
        instructor_account_id=instructor_id,
        start_date=start_date,
        end_date=end_date,
        max_students=max_students,
        force_status=force_status,
        description=description,
    )

    # Assert
    assert session.id == session_id
    assert session.session_name == session_name
    assert session.session_tag == session_tag
    assert session.tenant_id == tenant_id
    assert session.instructor_account_id == instructor_id
    assert session.start_date == start_date
    assert session.end_date == end_date
    assert session.max_students == max_students
    assert session.force_status == force_status
    assert session.description == description


def test_education_session_tablename():
    """Test EducationSession table name."""
    # Assert
    assert EducationSession.__tablename__ == "education_sessions"


def test_education_session_nullable_end_date():
    """Test EducationSession with nullable end_date."""
    # Arrange & Act
    session = EducationSession(
        id="test-id",
        session_name="Ongoing Course",
        session_tag="ongoing-2025",
        tenant_id="tenant-1",
        instructor_account_id="instructor-1",
        start_date=datetime(2025, 1, 1),
        end_date=None,  # Nullable
        max_students=50,
    )

    # Assert
    assert session.end_date is None
    assert session.description is None
    assert session.force_status is None  # Default is None (auto date-based)
