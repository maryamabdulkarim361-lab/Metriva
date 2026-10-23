"""AI SQL Generator service."""

import logging
from typing import Optional

from apps.ai_assistant.providers import get_llm_provider
from apps.ai_assistant.schema_context import get_schema_context_prompt

logger = logging.getLogger(__name__)


class SQLGenerator:
    """Translates natural language questions into database queries for specified dialect."""

    def __init__(self, provider=None):
        self.provider = provider or get_llm_provider()

    def generate(
        self,
        question: str,
        schema_context: Optional[str] = None,
        dialect: str = "postgresql",
    ) -> str:
        ctx = schema_context if schema_context is not None else get_schema_context_prompt()
        return self.provider.generate_sql(question=question, schema_context=ctx, dialect=dialect)
