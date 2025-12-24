"""Add invoke_source column to api_usage_logs table.

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2025-12-24 16:06:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade():
    """Add invoke_source column to api_usage_logs table."""
    op.add_column(
        "api_usage_logs",
        sa.Column(
            "invoke_source",
            sa.String(50),
            nullable=True,
            comment="Source of invocation: agent, tool_test, hit_testing, indexing, etc.",
        ),
    )

    # Add index for filtering by invoke_source
    op.create_index(
        "idx_api_usage_invoke_source",
        "api_usage_logs",
        ["tenant_id", "invoke_source", "created_at"],
    )


def downgrade():
    """Remove invoke_source column from api_usage_logs table."""
    op.drop_index("idx_api_usage_invoke_source", table_name="api_usage_logs")
    op.drop_column("api_usage_logs", "invoke_source")
