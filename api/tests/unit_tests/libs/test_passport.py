from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
import pytest
from werkzeug.exceptions import Unauthorized

from libs.passport import PassportService


class TestPassportService:
    """Test PassportService JWT operations"""

    @pytest.fixture
    def passport_service(self):
        """Create PassportService instance with test secret key"""
        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = "test-secret-key-for-testing"
            return PassportService()

    @pytest.fixture
    def another_passport_service(self):
        """Create another PassportService instance with different secret key"""
        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = "another-secret-key-for-testing"
            return PassportService()

    @pytest.fixture
    def future_exp(self):
        """Return a future expiration timestamp"""
        return int((datetime.now(UTC) + timedelta(hours=1)).timestamp())

    # Core functionality tests
    def test_should_reject_issue_without_exp(self, passport_service):
        """Test that issuing a token without exp claim raises ValueError"""
        payload = {"user_id": "123", "app_code": "test-app"}
        with pytest.raises(ValueError, match="exp claim is required"):
            passport_service.issue(payload)

    def test_should_issue_and_verify_token(self, passport_service, future_exp):
        """Test complete JWT lifecycle: issue and verify"""
        payload = {"user_id": "123", "app_code": "test-app", "exp": future_exp}
        token = passport_service.issue(payload)

        # Verify token format
        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # JWT format: header.payload.signature

        # Verify token content
        decoded = passport_service.verify(token)
        assert decoded == payload

    def test_should_handle_different_payload_types(self, passport_service, future_exp):
        """Test issuing and verifying tokens with different payload types"""
        test_cases = [
            {"string": "value"},
            {"number": 42},
            {"float": 3.14},
            {"boolean": True},
            {"null": None},
            {"array": [1, 2, 3]},
            {"nested": {"key": "value"}},
            {"unicode": "中文测试"},
            {"emoji": "🔐"},
        ]

        for payload in test_cases:
            payload["exp"] = future_exp
            token = passport_service.issue(payload)
            decoded = passport_service.verify(token)
            assert decoded == payload

    # Security tests
    def test_should_reject_modified_token(self, passport_service, future_exp):
        """Test that any modification to token invalidates it"""
        token = passport_service.issue({"user": "test", "exp": future_exp})

        # Test multiple modification points
        test_positions = [0, len(token) // 3, len(token) // 2, len(token) - 1]

        for pos in test_positions:
            if pos < len(token) and token[pos] != ".":
                # Change one character
                tampered = token[:pos] + ("X" if token[pos] != "X" else "Y") + token[pos + 1 :]
                with pytest.raises(Unauthorized):
                    passport_service.verify(tampered)

    def test_should_reject_token_with_different_secret_key(
        self, passport_service, another_passport_service, future_exp
    ):
        """Test key isolation - token from one service should not work with another"""
        payload = {"user_id": "123", "app_code": "test-app", "exp": future_exp}
        token = passport_service.issue(payload)

        with pytest.raises(Unauthorized) as exc_info:
            another_passport_service.verify(token)
        assert str(exc_info.value) == "401 Unauthorized: Invalid token signature."

    def test_should_use_hs256_algorithm(self, passport_service, future_exp):
        """Test that HS256 algorithm is used for signing"""
        payload = {"test": "data", "exp": future_exp}
        token = passport_service.issue(payload)

        # Decode header without relying on JWT internals
        # Use jwt.get_unverified_header which is a public API
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"

    def test_should_reject_token_with_wrong_algorithm(self, passport_service):
        """Test rejection of token signed with different algorithm"""
        payload = {"user_id": "123"}

        # Create token with different algorithm
        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = "test-secret-key-for-testing"
            # Create token with HS512 instead of HS256
            wrong_alg_token = jwt.encode(payload, mock_config.SECRET_KEY, algorithm="HS512")

        # Should fail because service expects HS256
        # InvalidAlgorithmError is now caught by PyJWTError handler
        with pytest.raises(Unauthorized) as exc_info:
            passport_service.verify(wrong_alg_token)
        assert str(exc_info.value) == "401 Unauthorized: Invalid token."

    # Exception handling tests
    def test_should_handle_invalid_tokens(self, passport_service):
        """Test handling of various invalid token formats"""
        invalid_tokens = [
            ("not.a.token", "Invalid token."),
            ("invalid-jwt-format", "Invalid token."),
            ("xxx.yyy.zzz", "Invalid token."),
            ("a.b", "Invalid token."),  # Missing signature
            ("", "Invalid token."),  # Empty string
            ("   ", "Invalid token."),  # Whitespace
            (None, "Invalid token."),  # None value
            # Malformed base64
            ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_BASE64!@#$.signature", "Invalid token."),
        ]

        for invalid_token, expected_message in invalid_tokens:
            with pytest.raises(Unauthorized) as exc_info:
                passport_service.verify(invalid_token)
            assert expected_message in str(exc_info.value)

    def test_should_reject_expired_token(self, passport_service):
        """Test rejection of expired token"""
        past_time = datetime.now(UTC) - timedelta(hours=1)
        payload = {"user_id": "123", "exp": past_time.timestamp()}

        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = "test-secret-key-for-testing"
            token = jwt.encode(payload, mock_config.SECRET_KEY, algorithm="HS256")

        with pytest.raises(Unauthorized) as exc_info:
            passport_service.verify(token)
        assert str(exc_info.value) == "401 Unauthorized: Token has expired."

    # Configuration tests
    def test_should_handle_empty_secret_key(self, future_exp):
        """Test behavior when SECRET_KEY is empty"""
        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = ""
            service = PassportService()

            # Empty secret key should still work but is insecure
            payload = {"test": "data", "exp": future_exp}
            token = service.issue(payload)
            decoded = service.verify(token)
            assert decoded == payload

    def test_should_handle_none_secret_key(self, future_exp):
        """Test behavior when SECRET_KEY is None"""
        with patch("libs.passport.dify_config") as mock_config:
            mock_config.SECRET_KEY = None
            service = PassportService()

            payload = {"test": "data", "exp": future_exp}
            # JWT library will raise TypeError when secret is None
            with pytest.raises((TypeError, jwt.exceptions.InvalidKeyError)):
                service.issue(payload)

    # Boundary condition tests
    def test_should_handle_large_payload(self, passport_service, future_exp):
        """Test handling of large payload"""
        # Test with 100KB instead of 1MB for faster tests
        large_data = "x" * (100 * 1024)
        payload = {"data": large_data, "exp": future_exp}

        token = passport_service.issue(payload)
        decoded = passport_service.verify(token)

        assert decoded["data"] == large_data

    def test_should_handle_special_characters_in_payload(self, passport_service, future_exp):
        """Test handling of special characters in payload"""
        special_payloads = [
            {"special": "!@#$%^&*()"},
            {"quotes": 'He said "Hello"'},
            {"backslash": "path\\to\\file"},
            {"newline": "line1\nline2"},
            {"unicode": "🔐🔑🛡️"},
            {"mixed": "Test123!@#中文🔐"},
        ]

        for payload in special_payloads:
            payload["exp"] = future_exp
            token = passport_service.issue(payload)
            decoded = passport_service.verify(token)
            assert decoded == payload

    def test_should_catch_generic_pyjwt_errors(self, passport_service):
        """Test that generic PyJWTError exceptions are caught and converted to Unauthorized"""
        # Mock jwt.decode to raise a generic PyJWTError
        with patch("libs.passport.jwt.decode") as mock_decode:
            mock_decode.side_effect = jwt.exceptions.PyJWTError("Generic JWT error")

            with pytest.raises(Unauthorized) as exc_info:
                passport_service.verify("some-token")
            assert str(exc_info.value) == "401 Unauthorized: Invalid token."
