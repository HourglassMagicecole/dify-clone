"""Add default image generation prices and make tenant_id nullable.

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2025-12-22

This migration:
1. Makes tenant_id nullable in admin_price_configs to support default prices
2. Adds default prices for DALL-E 2 and DALL-E 3 image generation
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f67740d3b36a"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Make tenant_id nullable
    op.alter_column(
        "admin_price_configs",
        "tenant_id",
        existing_type=postgresql.UUID(),
        nullable=True,
    )

    # 2. Insert default prices for DALL-E image generation
    # These prices are based on OpenAI's official pricing (as of 2024)
    # Note: Image generation costs are output_price (input is text prompt, output is image)
    # input_modality='text', output_modality='image' for proper matching
    op.execute(
        """
        INSERT INTO admin_price_configs (
            id, tenant_id, provider, model_id, usage_type,
            input_modality, output_modality, quality, resolution,
            price_unit, unit_scale, input_price, output_price, currency, is_active
        ) VALUES
        -- DALL-E 3 prices (per image) - output_price because we generate images
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'standard', '1024x1024', 'image', 1, NULL, 0.040, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'standard', '1024x1792', 'image', 1, NULL, 0.080, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'standard', '1792x1024', 'image', 1, NULL, 0.080, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'hd', '1024x1024', 'image', 1, NULL, 0.080, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'hd', '1024x1792', 'image', 1, NULL, 0.120, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-3', 'image_gen',
         'text', 'image', 'hd', '1792x1024', 'image', 1, NULL, 0.120, 'USD', true),
        -- DALL-E 2 prices (per image)
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-2', 'image_gen',
         'text', 'image', 'standard', '1024x1024', 'image', 1, NULL, 0.020, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-2', 'image_gen',
         'text', 'image', 'standard', '512x512', 'image', 1, NULL, 0.018, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'dall-e-2', 'image_gen',
         'text', 'image', 'standard', '256x256', 'image', 1, NULL, 0.016, 'USD', true)
        ON CONFLICT DO NOTHING
        """
    )


def downgrade():
    # 1. Delete default prices (tenant_id IS NULL)
    op.execute(
        """
        DELETE FROM admin_price_configs
        WHERE tenant_id IS NULL
        AND provider = 'openai'
        AND model_id IN ('dall-e-2', 'dall-e-3')
        AND usage_type = 'image_gen'
        """
    )

    # 2. Make tenant_id not nullable again (only if no NULL values remain)
    op.alter_column(
        "admin_price_configs",
        "tenant_id",
        existing_type=postgresql.UUID(),
        nullable=False,
    )
