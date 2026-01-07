"""add_session_default_user_quota_table

Revision ID: 5b3f4g21f762
Revises: 4a2f3f10e651
Create Date: 2025-01-06 00:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

import models as models

# revision identifiers, used by Alembic.
revision = "5b3f4g21f762"
down_revision = "4a2f3f10e651"
branch_labels = None
depends_on = None


def upgrade():
    # Create session_default_user_quotas table (default quota settings for new members)
    op.create_table(
        "session_default_user_quotas",
        sa.Column("id", models.types.StringUUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("tenant_id", models.types.StringUUID(), nullable=False),
        sa.Column("session_id", models.types.StringUUID(), nullable=False),
        sa.Column("model_provider", sa.String(50), nullable=False),
        sa.Column("quota_limit", sa.Numeric(15, 4), nullable=False),
        sa.Column("warning_threshold", sa.Integer(), nullable=False, server_default=sa.text("70")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name="session_default_user_quota_pkey"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["education_sessions.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "idx_session_default_quota_session_provider",
        "session_default_user_quotas",
        ["session_id", "model_provider"],
        unique=True,
    )


def downgrade():
    op.drop_index("idx_session_default_quota_session_provider", table_name="session_default_user_quotas")
    op.drop_table("session_default_user_quotas")
