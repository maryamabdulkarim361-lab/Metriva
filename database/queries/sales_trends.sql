-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: sales_trends.sql
-- Concepts: Date Extractions, Payment Reconciliation, Status Distributions
-- ==============================================================================

-- 1. Order Lifecycle Status Distribution & Conversion Funnel
-- Calculates absolute counts and share of total orders using Window aggregation.
SELECT
    status AS order_status,
    COUNT(id) AS order_count,
    ROUND(SUM(total_amount)::numeric, 2) AS aggregate_value,
    ROUND(
        (COUNT(id) * 100.0 / SUM(COUNT(id)) OVER ())::numeric, 2
    ) AS percentage_of_total_orders
FROM orders
GROUP BY status
ORDER BY order_count DESC;


-- 2. Payment Gateway Success & Failure Rates
-- Audits payment settlement health across payment methods.
SELECT
    payment_method,
    COUNT(id) AS total_attempts,
    COUNT(CASE WHEN payment_status = 'SUCCESS' THEN 1 END) AS successful_payments,
    COUNT(CASE WHEN payment_status = 'FAILED' THEN 1 END) AS failed_payments,
    COUNT(CASE WHEN payment_status = 'PENDING' THEN 1 END) AS pending_payments,
    ROUND(
        (COUNT(CASE WHEN payment_status = 'SUCCESS' THEN 1 END) * 100.0 / COUNT(id))::numeric, 2
    ) AS success_rate_pct,
    ROUND(
        SUM(CASE WHEN payment_status = 'SUCCESS' THEN amount ELSE 0 END)::numeric, 2
    ) AS settled_volume
FROM payments
GROUP BY payment_method
ORDER BY settled_volume DESC;


-- 3. Day of Week Sales Velocity
-- Discovers customer purchasing patterns by day of week.
SELECT
    TO_CHAR(order_date, 'Day') AS day_of_week,
    EXTRACT(DOW FROM order_date) AS day_number,
    COUNT(id) AS total_orders,
    ROUND(SUM(total_amount)::numeric, 2) AS total_revenue,
    ROUND(AVG(total_amount)::numeric, 2) AS avg_order_size
FROM orders
WHERE status = 'COMPLETED'
GROUP BY TO_CHAR(order_date, 'Day'), EXTRACT(DOW FROM order_date)
ORDER BY day_number ASC;

