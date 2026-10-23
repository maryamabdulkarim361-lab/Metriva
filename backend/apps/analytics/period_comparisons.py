"""
Deterministic Period Comparison and Business Performance Analyzer.

Computes exact period-over-period differences (Month-over-Month, Quarter-over-Quarter,
Year-over-Year) using window aggregations on completed order transactions.
Produces structured business summaries separating observed facts, statistical associations,
and investigation hypotheses.
"""

from typing import Any, Optional

from django.db import connection


def calculate_period_comparison(
    period_type: str = "mom",
    dimension: Optional[str] = None,
    limit_periods: int = 6,
) -> dict[str, Any]:
    """
    Execute deterministic SQL period comparisons over historical transactions.

    Args:
        period_type: "mom" (Month-over-Month), "qoq" (Quarter-over-Quarter), or "yoy" (Year-over-Year).
        dimension: Optional dimension to group by ("category", "customer_segment", "country").
        limit_periods: Number of recent time periods to analyze.
    """
    is_postgres = connection.vendor == "postgresql"

    # Dialect-appropriate date truncation & formatting
    if period_type == "qoq":
        date_trunc_expr = "DATE_TRUNC('quarter', order_date)::date" if is_postgres else "strftime('%Y-Q', order_date)"
        period_label = "Quarter"
    elif period_type == "yoy":
        date_trunc_expr = "DATE_TRUNC('year', order_date)::date" if is_postgres else "strftime('%Y', order_date)"
        period_label = "Year"
    else:  # mom default
        date_trunc_expr = "DATE_TRUNC('month', order_date)::date" if is_postgres else "strftime('%Y-%m-01', order_date)"
        period_label = "Month"

    dimension_select = ""
    dimension_group = ""
    if dimension in ("category", "customer_segment", "country"):
        if dimension == "category":
            dimension_select = "p.category AS dimension_value,"
            dimension_group = ", p.category"
        elif dimension == "customer_segment":
            dimension_select = "c.customer_segment AS dimension_value,"
            dimension_group = ", c.customer_segment"
        elif dimension == "country":
            dimension_select = "c.country AS dimension_value,"
            dimension_group = ", c.country"

    # 1. Period Aggregation Query
    if dimension == "category":
        sql = f"""
        WITH BasePeriodData AS (
            SELECT
                {date_trunc_expr} AS period_date,
                {dimension_select}
                COUNT(DISTINCT o.id) AS order_count,
                ROUND(SUM(oi.subtotal)::numeric, 2) AS revenue,
                ROUND(SUM((oi.unit_price - p.cost) * oi.quantity)::numeric, 2) AS gross_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'COMPLETED'
            GROUP BY {date_trunc_expr} {dimension_group}
        )
        SELECT
            period_date,
            dimension_value,
            order_count,
            revenue,
            gross_profit,
            LAG(revenue, 1) OVER (PARTITION BY dimension_value ORDER BY period_date) AS prev_revenue,
            LAG(order_count, 1) OVER (PARTITION BY dimension_value ORDER BY period_date) AS prev_order_count
        FROM BasePeriodData
        ORDER BY period_date DESC, revenue DESC;
        """
    else:
        dim_join = ""
        if dimension in ("customer_segment", "country"):
            dim_join = "JOIN customers c ON o.customer_id = c.id"

        sql = f"""
        WITH BasePeriodData AS (
            SELECT
                {date_trunc_expr} AS period_date,
                {dimension_select}
                COUNT(DISTINCT o.id) AS order_count,
                ROUND(SUM(o.total_amount)::numeric, 2) AS revenue,
                ROUND(AVG(o.total_amount)::numeric, 2) AS avg_order_value
            FROM orders o
            {dim_join}
            WHERE o.status = 'COMPLETED'
            GROUP BY {date_trunc_expr} {dimension_group}
        )
        SELECT
            period_date,
            {'dimension_value,' if dimension_select else ''}
            order_count,
            revenue,
            avg_order_value,
            LAG(revenue, 1) OVER ({'PARTITION BY dimension_value' if dimension_select else ''} ORDER BY period_date) AS prev_revenue,
            LAG(order_count, 1) OVER ({'PARTITION BY dimension_value' if dimension_select else ''} ORDER BY period_date) AS prev_order_count
        FROM BasePeriodData
        ORDER BY period_date DESC {' , revenue DESC' if dimension_select else ''};
        """

    # If executing under SQLite test environment, sanitize PostgreSQL casts
    exec_sql = sql
    if not is_postgres:
        import re
        exec_sql = re.sub(r"::\s*numeric\b", "", exec_sql, flags=re.IGNORECASE)
        exec_sql = re.sub(r"::\s*date\b", "", exec_sql, flags=re.IGNORECASE)

    with connection.cursor() as cursor:
        cursor.execute(exec_sql)
        cols = [col[0] for col in cursor.description]
        raw_rows = cursor.fetchall()

    results = []
    for row in raw_rows:
        row_dict = dict(zip(cols, row))
        rev = float(row_dict.get("revenue") or 0.0)
        prev_rev = float(row_dict.get("prev_revenue") or 0.0) if row_dict.get("prev_revenue") is not None else None

        abs_diff = round(rev - prev_rev, 2) if prev_rev is not None else None
        pct_diff = round(((rev - prev_rev) / prev_rev) * 100.0, 2) if prev_rev and prev_rev > 0 else None

        row_dict["absolute_change"] = abs_diff
        row_dict["percentage_change"] = pct_diff
        results.append(row_dict)

    # 2. Synthesize Deterministic Business Summary
    summary = _synthesize_business_summary(results, period_label, dimension)

    return {
        "period_type": period_type,
        "period_label": period_label,
        "dimension": dimension,
        "periods_analyzed": len(results),
        "data": results[:limit_periods * (10 if dimension else 1)],
        "summary": summary,
    }


def _synthesize_business_summary(
    data: list[dict[str, Any]],
    period_label: str,
    dimension: Optional[str] = None,
) -> dict[str, Any]:
    """
    Distinguish observed facts, statistical associations, and investigation hypotheses.
    """
    if not data:
        return {
            "observed_facts": ["No historical completed orders were found for comparison."],
            "statistical_associations": [],
            "investigation_hypotheses": [],
        }

    latest = data[0]
    period_date_str = str(latest.get("period_date", ""))
    curr_rev = float(latest.get("revenue") or 0.0)
    abs_change = latest.get("absolute_change")
    pct_change = latest.get("percentage_change")

    facts = []
    associations = []
    hypotheses = []

    # 1. Observed Facts
    if abs_change is not None and pct_change is not None:
        direction = "increased" if abs_change >= 0 else "decreased"
        sign = "+" if abs_change >= 0 else ""
        facts.append(
            f"For {period_label} starting {period_date_str}, recognized revenue was ${curr_rev:,.2f}, "
            f"which {direction} by ${abs(abs_change):,.2f} ({sign}{pct_change:.1f}%) compared to the prior {period_label.lower()}."
        )
        orders_curr = latest.get("order_count", 0)
        facts.append(f"Total completed order transactions volume was {orders_curr:,}.")
    else:
        facts.append(f"Latest {period_label.lower()} revenue is ${curr_rev:,.2f}.")

    # 2. Statistical Associations
    if dimension and len(data) > 1:
        # Find top gainer and top decliner in latest period
        period_cohort = [d for d in data if d.get("period_date") == latest.get("period_date")]
        valid_movers = [d for d in period_cohort if d.get("absolute_change") is not None]

        if valid_movers:
            valid_movers.sort(key=lambda x: x.get("absolute_change", 0.0), reverse=True)
            top_gainer = valid_movers[0]
            top_decliner = valid_movers[-1]

            if top_gainer.get("absolute_change", 0) > 0:
                associations.append(
                    f"Strongest performing {dimension}: '{top_gainer.get('dimension_value')}' "
                    f"contributed +${top_gainer['absolute_change']:,.2f} ({top_gainer.get('percentage_change', 0):+.1f}%)."
                )
            if top_decliner.get("absolute_change", 0) < 0:
                associations.append(
                    f"Largest contraction in {dimension}: '{top_decliner.get('dimension_value')}' "
                    f"declined by -${abs(top_decliner['absolute_change']):,.2f} ({top_decliner.get('percentage_change', 0):.1f}%)."
                )

    # 3. Investigation Hypotheses (Non-causal suggestions for deeper inspection)
    if abs_change is not None and abs_change < 0:
        hypotheses.append(
            f"Investigate potential stockouts, seasonal demand cycles, or cart abandonment on declining {dimension or 'product lines'}."
        )
        hypotheses.append(
            "Review customer segmentation retention rates to verify if drop is isolated to consumer accounts or enterprise renewals."
        )
    elif abs_change is not None and abs_change > 0:
        hypotheses.append(
            "Evaluate marketing attribution campaigns launched in this period to establish repeatable acquisition channels."
        )

    return {
        "observed_facts": facts,
        "statistical_associations": associations,
        "investigation_hypotheses": hypotheses,
    }
