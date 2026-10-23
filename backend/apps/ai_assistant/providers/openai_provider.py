"""OpenAI-compatible LLM Provider implementation."""

import json
import logging
import re
from typing import Any, Optional

import requests
from django.conf import settings

from apps.ai_assistant.prompts.result_explanation import (
    RESULT_EXPLANATION_SYSTEM_PROMPT,
    RESULT_EXPLANATION_USER_PROMPT,
)
from apps.ai_assistant.prompts.sql_generation import (
    get_system_prompt_for_dialect,
    get_user_prompt_for_dialect,
)
from apps.ai_assistant.providers.base import LLMProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """
    Provider implementation for OpenAI and OpenAI-compatible APIs
    (e.g., Azure OpenAI, vLLM, Ollama, Groq, Together).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 30,
    ):
        self.api_key = api_key or getattr(settings, "OPENAI_API_KEY", "")
        self.model = model or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
        self.base_url = (
            base_url
            or getattr(settings, "OPENAI_BASE_URL", "https://api.openai.com/v1")
        ).rstrip("/")
        self.timeout = timeout

        if not self.api_key:
            raise ValueError(
                "OPENAI_API_KEY is not configured. Please supply an API key or use MockProvider."
            )

    def _call_chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 1000,
    ) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            response = requests.post(
                url, headers=headers, json=payload, timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenAI API request failed: {e}")
            raise RuntimeError(f"LLM API request failed: {str(e)}") from e

    def _strip_markdown_code_fences(self, text: str) -> str:
        """Strip ```sql ... ``` fences if the LLM wrapped its output."""
        cleaned = text.strip()
        fenced_match = re.search(r"```(?:sql)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
        if fenced_match:
            return fenced_match.group(1).strip()
        return cleaned

    def generate_sql(self, question: str, schema_context: str, dialect: str = "postgresql") -> str:
        system_content = get_system_prompt_for_dialect(schema_context=schema_context, dialect=dialect)
        user_content = get_user_prompt_for_dialect(question=question, dialect=dialect)

        raw_output = self._call_chat_completion(
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ],
            temperature=0.0,
        )
        return self._strip_markdown_code_fences(raw_output)

    def explain_result(
        self,
        question: str,
        sql: str,
        columns: list[str],
        rows: list[list[Any]],
        row_count: int,
    ) -> str:
        sample_rows = rows[:10]
        sample_data_str = json.dumps(sample_rows, default=str, indent=2)

        user_content = RESULT_EXPLANATION_USER_PROMPT.format(
            question=question,
            sql=sql,
            row_count=row_count,
            columns=", ".join(columns),
            sample_data=sample_data_str,
        )

        return self._call_chat_completion(
            messages=[
                {"role": "system", "content": RESULT_EXPLANATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
            max_tokens=600,
        )
