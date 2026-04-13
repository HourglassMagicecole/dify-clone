"""Regression tests for LLMGenerator.generate_dataset_description.

Covers the hotfix that replaces get_default_model_instance (which raises
ValueError when the stored default model is disabled) with a direct lookup
of the tenant's currently active LLM models via ProviderManager.
"""

from unittest.mock import MagicMock, patch

from core.llm_generator.llm_generator import LLMGenerator
from core.model_runtime.entities.model_entities import ModelType


def _make_model_entry(provider: str, model: str):
    entry = MagicMock()
    entry.provider.provider = provider
    entry.model = model
    return entry


def _make_llm_response(text: str):
    response = MagicMock()
    response.message.get_text_content.return_value = text
    return response


@patch("core.model_manager.ModelManager.get_model_instance")
@patch("core.provider_manager.ProviderManager.get_configurations")
def test_generate_dataset_description_uses_first_active_llm(mock_get_configurations, mock_get_model_instance):
    """active LLM 존재 시 첫 번째 활성 모델로 description 생성."""
    configurations = MagicMock()
    configurations.get_models.return_value = [
        _make_model_entry("openai", "gpt-4o-mini"),
        _make_model_entry("anthropic", "claude-3-5-sonnet"),
    ]
    mock_get_configurations.return_value = configurations

    model_instance = MagicMock()
    model_instance.invoke_llm.return_value = _make_llm_response("A concise KB description.")
    mock_get_model_instance.return_value = model_instance

    result = LLMGenerator.generate_dataset_description(tenant_id="tenant-1", chunk_contents=["chunk one", "chunk two"])

    assert result == "A concise KB description."
    configurations.get_models.assert_called_once_with(model_type=ModelType.LLM, only_active=True)
    mock_get_model_instance.assert_called_once_with(
        tenant_id="tenant-1",
        provider="openai",
        model_type=ModelType.LLM,
        model="gpt-4o-mini",
    )


@patch("core.model_manager.ModelManager.get_model_instance")
@patch("core.provider_manager.ProviderManager.get_configurations")
def test_generate_dataset_description_returns_empty_when_no_active_llm(
    mock_get_configurations, mock_get_model_instance, caplog
):
    """활성 LLM이 없으면 빈 문자열 반환 + WARNING 로그, 예외 전파 X."""
    configurations = MagicMock()
    configurations.get_models.return_value = []
    mock_get_configurations.return_value = configurations

    with caplog.at_level("WARNING", logger="core.llm_generator.llm_generator"):
        result = LLMGenerator.generate_dataset_description(tenant_id="tenant-missing", chunk_contents=["content"])

    assert result == ""
    mock_get_model_instance.assert_not_called()
    warnings = [r for r in caplog.records if r.levelname == "WARNING" and "no active LLM" in r.getMessage()]
    assert len(warnings) == 1


@patch("core.model_manager.ModelManager.get_default_model_instance")
@patch("core.model_manager.ModelManager.get_model_instance")
@patch("core.provider_manager.ProviderManager.get_configurations")
def test_generate_dataset_description_does_not_use_default_model_path(
    mock_get_configurations, mock_get_model_instance, mock_get_default
):
    """stale default model 경로는 사용하지 않는다."""
    configurations = MagicMock()
    configurations.get_models.return_value = [_make_model_entry("openai", "gpt-4o-mini")]
    mock_get_configurations.return_value = configurations

    model_instance = MagicMock()
    model_instance.invoke_llm.return_value = _make_llm_response("desc")
    mock_get_model_instance.return_value = model_instance

    LLMGenerator.generate_dataset_description(tenant_id="tenant-1", chunk_contents=["x"])

    mock_get_default.assert_not_called()
