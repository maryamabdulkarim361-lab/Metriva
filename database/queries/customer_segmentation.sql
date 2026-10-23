-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: customer_segmentation.sql
-- Concepts: RFM Analysis (Recency, Frequency, Monetary), Multi-stage CTEs, NTILE
-- ==============================================================================

-- 1. Full RFM (Recency, Frequency, Monetary) Customer Segmentation Matrix
WITH CustomerMetrics AS (
    SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.email,
        c.customer_segment,
        CURRENT_DATE - MAX(o.order_date)::date AS recency_days,
        COUNT(o.id) AS frequency,
        ROUND(COALESCE(SUM(o.total_amount), 0)::numeric, 2) AS monetary_value
    FROM customers c
    INNER JOIN orders o ON c.id = o.customer_id
    WHERE o.status = 'COMPLETED'
    GROUP BY c.id, c.name, c.email, c.customer_segment
),
RFMScores AS (
    SELECT
        customer_id,
        customer_name,
        email,
        customer_segment,
        recency_days,
        frequency,
        monetary_value,
        -- Higher recency score = ordered more recently (lower recency_days)
        NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
        NTILE(5) OVER (ORDER BY frequency ASC) AS f_score,
        NTILE(5) OVER (ORDER BY monetary_value ASC) AS m_score
    FROM CustomerMetrics
)
SELECT
    customer_id,
    customer_name,
    customer_segment,
    recency_days,
    frequency,
    monetary_value,
    r_score,
    f_score,
    m_score,
    (r_score + f_score + m_score) AS composite_rfm,
    CASE
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Champions / VIP'
        WHEN r_score >= 3 AND f_score >= 3 THEN 'Loyal Customers'
        WHEN r_score >= 4 AND f_score <= 2 THEN 'Recent Promising'
        WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk / Need Attention'
        ELSE 'Hibernating / Dormant'
    END AS rfm_segment
FROM RFMScores
ORDER BY composite_rfm DESC, monetary_value DESC
LIMIT 50;


-- 2. Segment Revenue and Average Order Value Comparison
SELECT
    c.customer_segment,
    COUNT(DISTINCT c.id) AS customer_count,
    COUNT(o.id) AS completed_orders,
    ROUND(SUM(o.total_amount)::numeric, 2) AS total_revenue,
    ROUND(AVG(o.total_amount)::numeric, 2) AS average_order_value,
    ROUND(
        (SUM(o.total_amount) / COUNT(DISTINCT c.id))::numeric, 2
    ) AS revenue_per_customer
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.customer_segment
ORDER BY total_revenue DESC;

