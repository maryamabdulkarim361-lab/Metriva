"""AI Query Result Explainer service."""

import logging
from typing import Any

from apps.ai_assistant.providers import get_llm_provider

logger = logging.getLogger(__name__)


class ResultExplainer:
    """Explains query execution results using LLM summarization."""

    def __init__(self, provider=None):
        self.provider = provider or get_llm_provider()

    def explain(
        self,
        question: str,
        sql: str,
        columns: list[str],
        rows: list[list[Any]],
        row_count: int,
    ) -> str:
        return self.provider.explain_result(
            question=question,
            sql=sql,
            columns=columns,
            rows=rows,
            row_count=row_count,
        )
