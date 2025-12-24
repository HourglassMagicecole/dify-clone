"""Add api_usage_summaries table.

Revision ID: 2025_12_19_summary
Revises: 2025_12_19_price_cfg
Create Date: 2025-12-19

This migration creates the api_usage_summaries table for storing
pre-aggregated usage statistics for efficient dashboard queries.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2025_12_19_summary"
down_revision = "2025_12_19_price_cfg"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "api_usage_summaries",
        sa.Column("id", sa.String(36), nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        # Summary period
        sa.Column("summary_date", sa.Date, nullable=False),
        sa.Column("summary_type", sa.String(10), nullable=False),  # daily, monthly
        # Aggregation dimensions
        sa.Column("account_id", sa.String(36), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=True),
        sa.Column("usage_type", sa.String(20), nullable=False),
        sa.Column("model_provider", sa.String(255), nullable=True),
        sa.Column("model_id", sa.String(255), nullable=True),
        # Aggregated values
        sa.Column("request_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("total_input_tokens", sa.BigInteger, nullable=False, server_default=sa.text("0")),
        sa.Column("total_output_tokens", sa.BigInteger, nullable=False, server_default=sa.text("0")),
        sa.Column("total_tokens", sa.BigInteger, nullable=False, server_default=sa.text("0")),
        sa.Column("total_input_units", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_output_units", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_price", sa.Numeric(12, 7), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(10), nullable=False, server_default=sa.text("'USD'")),
        # Timestamps
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        # Constraints
        sa.PrimaryKeyConstraint("id", name="api_usage_summary_pkey"),
    )

    # Create indexes for efficient querying
    op.create_index(
        "idx_summary_tenant_type_date",
        "api_usage_summaries",
        ["tenant_id", "summary_type", "summary_date"],
    )
    op.create_index(
        "idx_summary_account_date",
        "api_usage_summaries",
        ["tenant_id", "account_id", "summary_date"],
    )
    op.create_index(
        "idx_summary_session_date",
        "api_usage_summaries",
        ["tenant_id", "session_id", "summary_date"],
    )


def downgrade():
    op.drop_index("idx_summary_session_date", table_name="api_usage_summaries")
    op.drop_index("idx_summary_account_date", table_name="api_usage_summaries")
    op.drop_index("idx_summary_tenant_type_date", table_name="api_usage_summaries")
    op.drop_table("api_usage_summaries")
