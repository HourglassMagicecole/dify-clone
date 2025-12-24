"""Rename llm_usage_logs to api_usage_logs and add new fields.

Revision ID: 2025_12_19_api_usage
Revises:
Create Date: 2025-12-19

This migration:
1. Renames llm_usage_logs table to api_usage_logs
2. Adds new fields for multi-API type tracking (embedding, rerank, tts, stt, image_gen, tool)
3. Adds new indexes for efficient querying
4. Supports rollback to original state
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2025_12_19_api_usage"
down_revision = "05812e69a297"
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Rename table
    op.rename_table("llm_usage_logs", "api_usage_logs")

    # Step 2: Rename existing indexes (llm -> api)
    # Note: Some databases require dropping and recreating indexes
    op.drop_index("idx_llm_usage_tenant_created", table_name="api_usage_logs")
    op.drop_index("idx_llm_usage_session_created", table_name="api_usage_logs")
    op.drop_index("idx_llm_usage_app_created", table_name="api_usage_logs")
    op.drop_index("idx_llm_usage_account_created", table_name="api_usage_logs")

    op.create_index(
        "idx_api_usage_tenant_created",
        "api_usage_logs",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "idx_api_usage_session_created",
        "api_usage_logs",
        ["session_id", "created_at"],
    )
    op.create_index(
        "idx_api_usage_app_created",
        "api_usage_logs",
        ["app_id", "created_at"],
    )
    op.create_index(
        "idx_api_usage_account_created",
        "api_usage_logs",
        ["account_id", "created_at"],
    )

    # Step 3: Add new columns for multi-API type support
    op.add_column(
        "api_usage_logs",
        sa.Column(
            "usage_type",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'llm'"),
        ),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column(
            "input_modality",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column(
            "output_modality",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("tool_name", sa.String(100), nullable=True),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("quality", sa.String(20), nullable=True),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("resolution", sa.String(20), nullable=True),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("input_unit_count", sa.Numeric(15, 4), nullable=True),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("output_unit_count", sa.Numeric(15, 4), nullable=True),
    )
    op.add_column(
        "api_usage_logs",
        sa.Column("retention_until", sa.Date, nullable=True),
    )

    # Step 4: Add new indexes for efficient querying
    op.create_index(
        "idx_api_usage_type_created",
        "api_usage_logs",
        ["tenant_id", "usage_type", "created_at"],
    )
    op.create_index(
        "idx_api_usage_provider_created",
        "api_usage_logs",
        ["tenant_id", "model_provider", "created_at"],
    )
    op.create_index(
        "idx_api_usage_account_type_created",
        "api_usage_logs",
        ["tenant_id", "account_id", "usage_type", "created_at"],
    )
    op.create_index(
        "idx_api_usage_retention",
        "api_usage_logs",
        ["retention_until"],
    )

    # Step 5: Rename primary key constraint
    op.drop_constraint("llm_usage_log_pkey", "api_usage_logs", type_="primary")
    op.create_primary_key("api_usage_log_pkey", "api_usage_logs", ["id"])


def downgrade():
    # Step 1: Drop new indexes
    op.drop_index("idx_api_usage_retention", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_account_type_created", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_provider_created", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_type_created", table_name="api_usage_logs")

    # Step 2: Remove new columns
    op.drop_column("api_usage_logs", "retention_until")
    op.drop_column("api_usage_logs", "output_unit_count")
    op.drop_column("api_usage_logs", "input_unit_count")
    op.drop_column("api_usage_logs", "resolution")
    op.drop_column("api_usage_logs", "quality")
    op.drop_column("api_usage_logs", "tool_name")
    op.drop_column("api_usage_logs", "output_modality")
    op.drop_column("api_usage_logs", "input_modality")
    op.drop_column("api_usage_logs", "usage_type")

    # Step 3: Rename primary key constraint back
    op.drop_constraint("api_usage_log_pkey", "api_usage_logs", type_="primary")
    op.create_primary_key("llm_usage_log_pkey", "api_usage_logs", ["id"])

    # Step 4: Rename indexes back (api -> llm)
    op.drop_index("idx_api_usage_tenant_created", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_session_created", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_app_created", table_name="api_usage_logs")
    op.drop_index("idx_api_usage_account_created", table_name="api_usage_logs")

    op.create_index(
        "idx_llm_usage_tenant_created",
        "api_usage_logs",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "idx_llm_usage_session_created",
        "api_usage_logs",
        ["session_id", "created_at"],
    )
    op.create_index(
        "idx_llm_usage_app_created",
        "api_usage_logs",
        ["app_id", "created_at"],
    )
    op.create_index(
        "idx_llm_usage_account_created",
        "api_usage_logs",
        ["account_id", "created_at"],
    )

    # Step 5: Rename table back
    op.rename_table("api_usage_logs", "llm_usage_logs")
