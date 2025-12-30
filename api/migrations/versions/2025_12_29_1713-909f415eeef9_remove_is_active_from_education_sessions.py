"""remove is_active from education_sessions

Revision ID: 909f415eeef9
Revises: c3d4e5f6g7h8
Create Date: 2025-12-29 17:13:47.913654

"""
from alembic import op
import models as models
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '909f415eeef9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # Remove is_active column from education_sessions
    # Active status is now determined solely by force_status and date conditions
    with op.batch_alter_table('education_sessions', schema=None) as batch_op:
        batch_op.drop_column('is_active')


def downgrade():
    with op.batch_alter_table('education_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), autoincrement=False, nullable=False))
