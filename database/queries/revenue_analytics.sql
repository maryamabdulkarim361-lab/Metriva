-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: revenue_analytics.sql
-- Concepts: Date Aggregations, CTEs, Window Functions (LAG, SUM OVER), Running Totals
-- ==============================================================================

-- 1. Cumulative Running Total Revenue Across All Completed Orders
-- Uses window function SUM(...) OVER (ORDER BY ...) to compute historical cumulative revenue.
SELECT
    DATE_TRUNC('month', order_date)::date AS sales_month,
    COUNT(id) AS monthly_orders,
    ROUND(SUM(total_amount)::numeric, 2) AS monthly_revenue,
    ROUND(
        SUM(SUM(total_amount)) OVER (
            ORDER BY DATE_TRUNC('month', order_date)
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )::numeric, 2
    ) AS cumulative_running_revenue
FROM orders
WHERE status = 'COMPLETED'
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY sales_month ASC;


-- 2. Month-over-Month (MoM) Revenue Growth Rate Using LAG()
-- Demonstrates multi-step analytics with a Common Table Expression.
WITH MonthlyAggregates AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS sales_month,
        COUNT(id) AS order_volume,
        ROUND(SUM(total_amount)::numeric, 2) AS current_month_revenue
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    sales_month,
    order_volume,
    current_month_revenue,
    LAG(current_month_revenue, 1) OVER (ORDER BY sales_month) AS prev_month_revenue,
    ROUND(
        (current_month_revenue - LAG(current_month_revenue, 1) OVER (ORDER BY sales_month))
        / NULLIF(LAG(current_month_revenue, 1) OVER (ORDER BY sales_month), 0) * 100,
        2
    ) AS mom_growth_percentage,
    CASE
        WHEN current_month_revenue > LAG(current_month_revenue, 1) OVER (ORDER BY sales_month) THEN 'GROWTH'
        WHEN current_month_revenue < LAG(current_month_revenue, 1) OVER (ORDER BY sales_month) THEN 'DECLINE'
        ELSE 'FLAT'
    END AS trajectory
FROM MonthlyAggregates
ORDER BY sales_month ASC;


-- 3. 3-Month Trailing Moving Average Revenue
-- Smooths seasonal spikes using moving average window framing.
WITH MonthlyRevenue AS (
    SELECT
        DATE_TRUNC('month', order_date)::date AS sales_month,
        ROUND(SUM(total_amount)::numeric, 2) AS monthly_revenue
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    sales_month,
    monthly_revenue,
    ROUND(
        AVG(monthly_revenue) OVER (
            ORDER BY sales_month
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        )::numeric, 2
    ) AS trailing_3m_moving_avg
FROM MonthlyRevenue
ORDER BY sales_month ASC;

