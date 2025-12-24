"""Add admin_price_configs table.

Revision ID: 2025_12_19_price_cfg
Revises: 2025_12_19_api_usage
Create Date: 2025-12-19

This migration creates the admin_price_configs table for storing
manually configured API prices by system owners.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2025_12_19_price_cfg"
down_revision = "2025_12_19_api_usage"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "admin_price_configs",
        sa.Column("id", sa.String(36), nullable=False, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        # Identification fields
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("usage_type", sa.String(20), nullable=False),
        # Multimodal/Image/Tool discrimination
        sa.Column("input_modality", sa.String(20), nullable=True),
        sa.Column("output_modality", sa.String(20), nullable=True),
        sa.Column("quality", sa.String(20), nullable=True),
        sa.Column("resolution", sa.String(20), nullable=True),
        sa.Column("tool_name", sa.String(100), nullable=True),
        # Pricing information
        sa.Column("price_unit", sa.String(20), nullable=False),
        sa.Column("unit_scale", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("input_price", sa.Numeric(10, 7), nullable=True),
        sa.Column("output_price", sa.Numeric(10, 7), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default=sa.text("'USD'")),
        # Status
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        # Timestamps
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        # Constraints
        sa.PrimaryKeyConstraint("id", name="admin_price_config_pkey"),
        sa.UniqueConstraint(
            "tenant_id",
            "provider",
            "model_id",
            "usage_type",
            "input_modality",
            "output_modality",
            "quality",
            "resolution",
            "tool_name",
            name="uq_admin_price_config",
        ),
    )

    # Create indexes
    op.create_index(
        "idx_price_config_lookup",
        "admin_price_configs",
        ["tenant_id", "provider", "model_id"],
    )
    op.create_index(
        "idx_price_config_type",
        "admin_price_configs",
        ["tenant_id", "usage_type"],
    )
    op.create_index(
        "idx_price_config_active",
        "admin_price_configs",
        ["is_active"],
    )


def downgrade():
    op.drop_index("idx_price_config_active", table_name="admin_price_configs")
    op.drop_index("idx_price_config_type", table_name="admin_price_configs")
    op.drop_index("idx_price_config_lookup", table_name="admin_price_configs")
    op.drop_table("admin_price_configs")
