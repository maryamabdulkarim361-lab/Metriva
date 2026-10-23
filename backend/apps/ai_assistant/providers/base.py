"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Abstract interface for pluggable AI/LLM backends."""

    @abstractmethod
    def generate_sql(self, question: str, schema_context: str, dialect: str = "postgresql") -> str:
        """
        Generate a SQL query from a natural language question for specified dialect.

        Args:
            question: The natural language question asked by the user.
            schema_context: Formatted schema definitions and relationships.
            dialect: Database dialect ('postgresql', 'mysql', 'sqlite').

        Returns:
            Raw SQL query string.
        """
        pass

    @abstractmethod
    def explain_result(
        self,
        question: str,
        sql: str,
        columns: list[str],
        rows: list[list[Any]],
        row_count: int,
    ) -> str:
        """
        Provide a concise natural-language business explanation of query results.

        Args:
            question: The original user question.
            sql: The executed SQL query.
            columns: List of column names in the result.
            rows: Sample data rows.
            row_count: Total rows returned.

        Returns:
            Markdown-formatted natural-language summary.
        """
        pass
