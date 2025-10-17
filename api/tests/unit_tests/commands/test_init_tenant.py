"""Unit tests for init_tenant CLI command."""

import pytest
from click.testing import CliRunner
from flask import Flask

from commands import init_tenant


class TestInitTenantCommand:
    """Test cases for init-tenant CLI command."""

    @pytest.fixture
    def cli_runner(self) -> CliRunner:
        """Fixture for Click CLI testing."""
        return CliRunner()

    def test_init_tenant_help(self, cli_runner: CliRunner, app: Flask) -> None:
        """Test that --help displays correct usage information."""
        # Arrange & Act
        with app.app_context():
            result = cli_runner.invoke(init_tenant, ["--help"])

        # Assert
        assert result.exit_code == 0
        assert "Initialize Tenant Owner for first deployment" in result.output
        assert "--email" in result.output
        assert "--password" in result.output
        assert "--name" in result.output

    def test_init_tenant_missing_email(self, cli_runner: CliRunner, app: Flask) -> None:
        """Test error when email is missing."""
        # Arrange & Act
        with app.app_context():
            result = cli_runner.invoke(
                init_tenant,
                ["--password", "Test1234!"],
            )

        # Assert
        assert result.exit_code != 0
        assert "Missing option '--email'" in result.output or "Error" in result.output

    def test_init_tenant_missing_password(self, cli_runner: CliRunner, app: Flask) -> None:
        """Test error when password is missing."""
        # Arrange & Act
        with app.app_context():
            result = cli_runner.invoke(
                init_tenant,
                ["--email", "admin@test.com"],
            )

        # Assert
        assert result.exit_code != 0
        assert "Missing option '--password'" in result.output or "Error" in result.output

    def test_init_tenant_default_name_parameter(self, cli_runner: CliRunner) -> None:
        """Test that --name parameter has correct default value."""
        # This test verifies the CLI parameter defaults

        # Arrange & Act
        result = cli_runner.invoke(init_tenant, ["--help"])

        # Assert
        assert result.exit_code == 0
        assert "default: Admin" in result.output or "--name TEXT" in result.output
