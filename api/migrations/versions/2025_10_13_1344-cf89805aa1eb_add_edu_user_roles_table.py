"""add_edu_user_roles_table

Revision ID: cf89805aa1eb
Revises: 01360783c6a9
Create Date: 2025-10-13 13:44:09.547052

"""
from alembic import op
import models as models
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cf89805aa1eb'
down_revision = '01360783c6a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create edu_user_roles table
    op.create_table(
        'edu_user_roles',
        sa.Column('id', models.types.StringUUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('session_id', models.types.StringUUID(), nullable=False),
        sa.Column('account_id', models.types.StringUUID(), nullable=False),
        sa.Column('role', sa.String(length=16), server_default=sa.text("'normal'"), nullable=False),
        sa.Column('assigned_by', models.types.StringUUID(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name=op.f('edu_user_roles_account_id_fkey'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['education_sessions.id'], name=op.f('edu_user_roles_session_id_fkey'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['accounts.id'], name=op.f('edu_user_roles_assigned_by_fkey'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name='edu_user_roles_pkey'),
        sa.UniqueConstraint('session_id', 'account_id', name='unique_session_account_role')
    )

    # Create indexes
    with op.batch_alter_table('edu_user_roles', schema=None) as batch_op:
        batch_op.create_index('edu_user_roles_session_id_idx', ['session_id'], unique=False)
        batch_op.create_index('edu_user_roles_account_id_idx', ['account_id'], unique=False)
        batch_op.create_index('edu_user_roles_role_idx', ['role'], unique=False)


def downgrade() -> None:
    # Drop indexes
    with op.batch_alter_table('edu_user_roles', schema=None) as batch_op:
        batch_op.drop_index('edu_user_roles_role_idx')
        batch_op.drop_index('edu_user_roles_account_id_idx')
        batch_op.drop_index('edu_user_roles_session_id_idx')

    # Drop table
    op.drop_table('edu_user_roles')
