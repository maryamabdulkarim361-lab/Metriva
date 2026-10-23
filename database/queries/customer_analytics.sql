-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: customer_analytics.sql
-- Concepts: INNER JOIN, LEFT JOIN, GROUP BY, HAVING, Window Functions (DENSE_RANK, NTILE)
-- ==============================================================================

-- 1. Top 10 Customers Ranked by Total Lifetime Revenue
-- Uses INNER JOIN between customers and orders, filtering on COMPLETED status,
-- calculating aggregate spend and ranking using DENSE_RANK().
SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    c.email,
    c.country,
    c.customer_segment,
    COUNT(o.id) AS total_orders,
    ROUND(SUM(o.total_amount)::numeric, 2) AS total_revenue,
    ROUND(AVG(o.total_amount)::numeric, 2) AS avg_order_value,
    DENSE_RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS revenue_rank
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.id, c.name, c.email, c.country, c.customer_segment
HAVING COUNT(o.id) >= 1
ORDER BY total_revenue DESC
LIMIT 10;


-- 2. Customer Inactivity and Churn Risk (No Orders in Last 90 Days)
-- Uses LEFT JOIN to include customers with or without orders, filtering on max order date.
SELECT
    c.id AS customer_id,
    c.name,
    c.email,
    c.country,
    c.customer_segment,
    MAX(o.order_date) AS last_order_date,
    CURRENT_DATE - MAX(o.order_date)::date AS days_since_last_order,
    COALESCE(COUNT(o.id), 0) AS historical_orders,
    ROUND(COALESCE(SUM(o.total_amount), 0)::numeric, 2) AS lifetime_value
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'COMPLETED'
GROUP BY c.id, c.name, c.email, c.country, c.customer_segment
HAVING MAX(o.order_date) < (CURRENT_DATE - INTERVAL '90 days')
    OR MAX(o.order_date) IS NULL
ORDER BY days_since_last_order DESC NULLS FIRST
LIMIT 25;


-- 3. Customer Quartile Spend Analysis (NTILE Window Function)
-- Segments active customers into 4 spending quartiles (Q1 = Top 25% spenders).
WITH CustomerSpend AS (
    SELECT
        c.id AS customer_id,
        c.name,
        c.customer_segment,
        ROUND(SUM(o.total_amount)::numeric, 2) AS total_spend,
        COUNT(o.id) AS order_count
    FROM customers c
    INNER JOIN orders o ON c.id = o.customer_id
    WHERE o.status = 'COMPLETED'
    GROUP BY c.id, c.name, c.customer_segment
)
SELECT
    customer_id,
    name,
    customer_segment,
    total_spend,
    order_count,
    NTILE(4) OVER (ORDER BY total_spend DESC) AS spend_quartile,
    CASE NTILE(4) OVER (ORDER BY total_spend DESC)
        WHEN 1 THEN 'VIP Spender (Top 25%)'
        WHEN 2 THEN 'High Value'
        WHEN 3 THEN 'Mid Value'
        WHEN 4 THEN 'Developing'
    END AS tier_label
FROM CustomerSpend
ORDER BY total_spend DESC;

