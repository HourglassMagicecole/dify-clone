"""Add default audio model prices (STT and TTS).

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-22

This migration adds default prices for:
- STT models: whisper-1, gpt-4o-transcribe, gpt-4o-transcribe-diarize, gpt-4o-mini-transcribe
- TTS models: tts-1, tts-1-hd, gpt-4o-mini-tts
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    # Insert default prices for STT (Speech-to-Text) models
    # Pricing: input_price per minute of audio
    op.execute(
        """
        INSERT INTO admin_price_configs (
            id, tenant_id, provider, model_id, usage_type,
            input_modality, output_modality,
            price_unit, unit_scale, input_price, output_price, currency, is_active
        ) VALUES
        -- STT models (input = audio minutes, output = text)
        (uuid_generate_v4(), NULL, 'openai', 'whisper-1', 'stt',
         'audio', 'text', 'minute', 1, 0.006, NULL, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'gpt-4o-transcribe', 'stt',
         'audio', 'text', 'minute', 1, 0.006, NULL, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'gpt-4o-transcribe-diarize', 'stt',
         'audio', 'text', 'minute', 1, 0.006, NULL, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'gpt-4o-mini-transcribe', 'stt',
         'audio', 'text', 'minute', 1, 0.003, NULL, 'USD', true),

        -- TTS models (input = text characters, output = audio)
        -- tts-1, tts-1-hd: $15/$30 per 1M characters (input_price)
        (uuid_generate_v4(), NULL, 'openai', 'tts-1', 'tts',
         'text', 'audio', 'character', 1000000, 15.0, NULL, 'USD', true),
        (uuid_generate_v4(), NULL, 'openai', 'tts-1-hd', 'tts',
         'text', 'audio', 'character', 1000000, 30.0, NULL, 'USD', true),
        -- gpt-4o-mini-tts: $0.015 per minute of output audio (output_price)
        (uuid_generate_v4(), NULL, 'openai', 'gpt-4o-mini-tts', 'tts',
         'text', 'audio', 'minute', 1, NULL, 0.015, 'USD', true)
        ON CONFLICT DO NOTHING
        """
    )


def downgrade():
    # Delete STT prices
    op.execute(
        """
        DELETE FROM admin_price_configs
        WHERE tenant_id IS NULL
        AND provider = 'openai'
        AND model_id IN ('whisper-1', 'gpt-4o-transcribe', 'gpt-4o-transcribe-diarize', 'gpt-4o-mini-transcribe')
        AND usage_type = 'stt'
        """
    )

    # Delete TTS prices
    op.execute(
        """
        DELETE FROM admin_price_configs
        WHERE tenant_id IS NULL
        AND provider = 'openai'
        AND model_id IN ('tts-1', 'tts-1-hd', 'gpt-4o-mini-tts')
        AND usage_type = 'tts'
        """
    )
