"""Add output_format column to app_model_configs

Revision ID: d52092a7623e
Revises: 5b3f4g21f762
Create Date: 2026-01-16 16:47:22.292897

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd52092a7623e'
down_revision = '5b3f4g21f762'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('app_model_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('output_format', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('app_model_configs', schema=None) as batch_op:
        batch_op.drop_column('output_format')
