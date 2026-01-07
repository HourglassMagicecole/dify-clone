"""add_session_and_user_quota_tables

Revision ID: 4a2f3f10e651
Revises: 909f415eeef9
Create Date: 2025-01-05 00:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

import models as models

# revision identifiers, used by Alembic.
revision = "4a2f3f10e651"
down_revision = "909f415eeef9"
branch_labels = None
depends_on = None


def upgrade():
    # Create session_quotas table (session-wide limits - safety net)
    op.create_table(
        "session_quotas",
        sa.Column("id", models.types.StringUUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("tenant_id", models.types.StringUUID(), nullable=False),
        sa.Column("session_id", models.types.StringUUID(), nullable=False),
        sa.Column("model_provider", sa.String(50), nullable=False, server_default=sa.text("'all'")),
        sa.Column("quota_limit", sa.Numeric(15, 4), nullable=False),
        sa.Column("period", sa.String(20), nullable=False, server_default=sa.text("'monthly'")),
        sa.Column("current_usage", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("warning_threshold", sa.Integer(), nullable=False, server_default=sa.text("70")),
        sa.Column("last_reset_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name="session_quota_pkey"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["education_sessions.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_session_quota_session_provider", "session_quotas", ["session_id", "model_provider"])

    # Create user_usage_quotas table (per-user limits - fairness)
    op.create_table(
        "user_usage_quotas",
        sa.Column("id", models.types.StringUUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("tenant_id", models.types.StringUUID(), nullable=False),
        sa.Column("session_id", models.types.StringUUID(), nullable=False),
        sa.Column("account_id", models.types.StringUUID(), nullable=False),
        sa.Column("model_provider", sa.String(50), nullable=False, server_default=sa.text("'all'")),
        sa.Column("quota_limit", sa.Numeric(15, 4), nullable=False),
        sa.Column("period", sa.String(20), nullable=False, server_default=sa.text("'monthly'")),
        sa.Column("current_usage", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("warning_threshold", sa.Integer(), nullable=False, server_default=sa.text("70")),
        sa.Column("last_reset_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("override_until", sa.DateTime(), nullable=True),
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", models.types.StringUUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name="user_usage_quota_pkey"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["education_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["accounts.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_user_quota_session_account", "user_usage_quotas", ["session_id", "account_id"])
    op.create_index("idx_user_quota_account_provider", "user_usage_quotas", ["account_id", "model_provider"])


def downgrade():
    op.drop_index("idx_user_quota_account_provider", table_name="user_usage_quotas")
    op.drop_index("idx_user_quota_session_account", table_name="user_usage_quotas")
    op.drop_table("user_usage_quotas")
    op.drop_index("idx_session_quota_session_provider", table_name="session_quotas")
    op.drop_table("session_quotas")
