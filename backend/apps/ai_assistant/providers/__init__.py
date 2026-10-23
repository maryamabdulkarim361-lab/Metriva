"""LLM Provider factory."""

import logging

from django.conf import settings

from apps.ai_assistant.providers.base import LLMProvider
from apps.ai_assistant.providers.mock_provider import MockProvider
from apps.ai_assistant.providers.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


def get_llm_provider(force_mock: bool = False) -> LLMProvider:
    """
    Factory function returning configured LLMProvider.
    Defaults to OpenAIProvider if OPENAI_API_KEY is present;
    otherwise falls back smoothly to MockProvider for zero-cost demo operation.
    """
    if force_mock:
        return MockProvider()

    api_key = getattr(settings, "OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            return OpenAIProvider(api_key=api_key)
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAIProvider ({e}), falling back to MockProvider.")
            return MockProvider()

    return MockProvider()
