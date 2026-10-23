"""
Enterprise Business Metrics Layer.

Defines standardized, version-controlled definitions for business performance metrics.
Guarantees consistent calculation formulas, currency rules, filter assumptions,
and required database columns across Natural Language AI answers, dashboard KPIs,
saved reports, and period comparisons.
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(frozen=True)
class MetricDefinition:
    """Canonical specification of a business intelligence metric."""

    id: str
    name: str
    category: str  # "Financial", "Profitability", "Customer", "Operations", "Growth"
    formula: str
    unit: str  # "currency", "percentage", "count", "ratio"
    currency: Optional[str] = "USD"
    required_tables: list[str] = field(default_factory=list)
    required_columns: list[str] = field(default_factory=list)
    filter_criteria: str = ""
    assumptions: str = ""
    version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "formula": self.formula,
            "unit": self.unit,
            "currency": self.currency,
            "required_tables": self.required_tables,
            "required_columns": self.required_columns,
            "filter_criteria": self.filter_criteria,
            "assumptions": self.assumptions,
            "version": self.version,
        }


# Canonical Repository of Enterprise Business Metrics
METRICS_REGISTRY: dict[str, MetricDefinition] = {
    "revenue": MetricDefinition(
        id="revenue",
        name="Recognized Revenue",
        category="Financial",
        formula="SUM(orders.total_amount)",
        unit="currency",
        currency="USD",
        required_tables=["orders"],
        required_columns=["orders.total_amount", "orders.status", "orders.order_date"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Revenue is recognized only upon successful order completion. Pending, "
            "cancelled, and refunded orders are excluded. Value represents net total "
            "after customer line-item discounts; local sales taxes are included as collected."
        ),
    ),
    "gross_profit": MetricDefinition(
        id="gross_profit",
        name="Gross Profit",
        category="Profitability",
        formula="SUM((order_items.unit_price - products.cost) * order_items.quantity)",
        unit="currency",
        currency="USD",
        required_tables=["order_items", "products", "orders"],
        required_columns=[
            "order_items.unit_price",
            "order_items.quantity",
            "products.cost",
            "orders.status",
        ],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Gross profit is calculated at the item level by deducting current unit "
            "cost from the historical realized unit price. Shipping fees, payment processing "
            "charges, and overhead allocation are excluded from Cost of Goods Sold (COGS)."
        ),
    ),
    "gross_margin": MetricDefinition(
        id="gross_margin",
        name="Gross Margin Percentage",
        category="Profitability",
        formula="(gross_profit / revenue) * 100",
        unit="percentage",
        currency=None,
        required_tables=["order_items", "products", "orders"],
        required_columns=[
            "order_items.unit_price",
            "order_items.quantity",
            "products.cost",
            "orders.total_amount",
            "orders.status",
        ],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Percentage of total recognized revenue retained after accounting for direct "
            "inventory acquisition costs. Evaluated over identical time boundaries as revenue."
        ),
    ),
    "average_order_value": MetricDefinition(
        id="average_order_value",
        name="Average Order Value (AOV)",
        category="Financial",
        formula="SUM(orders.total_amount) / COUNT(DISTINCT orders.id)",
        unit="currency",
        currency="USD",
        required_tables=["orders"],
        required_columns=["orders.total_amount", "orders.id", "orders.status"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Mean basket size across completed transactions. Multiple orders placed by "
            "the same customer on the same calendar day are treated as distinct orders."
        ),
    ),
    "customer_lifetime_value": MetricDefinition(
        id="customer_lifetime_value",
        name="Customer Lifetime Value (Historical CLV)",
        category="Customer",
        formula="SUM(orders.total_amount) / COUNT(DISTINCT customers.id)",
        unit="currency",
        currency="USD",
        required_tables=["customers", "orders"],
        required_columns=["orders.total_amount", "orders.customer_id", "orders.status"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Cumulative historical spend per unique acquired customer with at least one "
            "completed transaction. Does not extrapolate future predictive retention curves."
        ),
    ),
    "customer_retention": MetricDefinition(
        id="customer_retention",
        name="Customer Retention Rate",
        category="Customer",
        formula="(COUNT(DISTINCT repeat_customers) / COUNT(DISTINCT all_customers)) * 100",
        unit="percentage",
        currency=None,
        required_tables=["customers", "orders"],
        required_columns=["orders.customer_id", "orders.status"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Proportion of customers with two or more completed transactions over their "
            "entire account lifetime compared to the total active transacting customer base."
        ),
    ),
    "order_cancellation_rate": MetricDefinition(
        id="order_cancellation_rate",
        name="Order Cancellation Rate",
        category="Operations",
        formula="(COUNT(cancelled_orders) / COUNT(total_orders)) * 100",
        unit="percentage",
        currency=None,
        required_tables=["orders"],
        required_columns=["orders.status", "orders.id"],
        filter_criteria="None (aggregates across all initiated orders)",
        assumptions=(
            "Measures drop-off and stock/payment friction by comparing orders with status "
            "'CANCELLED' against all order entries regardless of settlement status."
        ),
    ),
    "month_over_month_growth": MetricDefinition(
        id="month_over_month_growth",
        name="Month-over-Month Revenue Growth",
        category="Growth",
        formula="((current_month_revenue - prior_month_revenue) / prior_month_revenue) * 100",
        unit="percentage",
        currency=None,
        required_tables=["orders"],
        required_columns=["orders.total_amount", "orders.order_date", "orders.status"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Relative percentage growth in completed sales revenue from the immediately "
            "preceding calendar month. Incomplete ongoing months are flagged as partial."
        ),
    ),
    "year_over_year_growth": MetricDefinition(
        id="year_over_year_growth",
        name="Year-over-Year Revenue Growth",
        category="Growth",
        formula="((current_year_revenue - prior_year_revenue) / prior_year_revenue) * 100",
        unit="percentage",
        currency=None,
        required_tables=["orders"],
        required_columns=["orders.total_amount", "orders.order_date", "orders.status"],
        filter_criteria="orders.status = 'COMPLETED'",
        assumptions=(
            "Compares revenue over identical seasonal spans across consecutive calendar years."
        ),
    ),
}


def get_all_metrics() -> list[dict[str, Any]]:
    """Return list of all registered business metric definitions."""
    return [m.to_dict() for m in METRICS_REGISTRY.values()]


def get_metric(metric_id: str) -> Optional[MetricDefinition]:
    """Retrieve specific metric definition by ID."""
    return METRICS_REGISTRY.get(metric_id.lower().strip())
