-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: advanced_sql.sql
-- Concepts: Multi-stage CTEs, Window Framing, Funnel Conversion, Percentiles
-- ==============================================================================

-- 1. Full E-Commerce Conversion Funnel with Drop-off Percentages
-- Evaluates user progression from Page View -> Product View -> Add to Cart -> Checkout -> Purchase.
WITH EventCounts AS (
    SELECT
        COUNT(DISTINCT CASE WHEN event_type = 'PAGE_VIEW' THEN customer_id END) AS stage_1_page_view,
        COUNT(DISTINCT CASE WHEN event_type = 'PRODUCT_VIEW' THEN customer_id END) AS stage_2_product_view,
        COUNT(DISTINCT CASE WHEN event_type = 'ADD_TO_CART' THEN customer_id END) AS stage_3_add_to_cart,
        COUNT(DISTINCT CASE WHEN event_type = 'CHECKOUT_START' THEN customer_id END) AS stage_4_checkout,
        COUNT(DISTINCT CASE WHEN event_type = 'PURCHASE' THEN customer_id END) AS stage_5_purchase
    FROM website_events
    WHERE customer_id IS NOT NULL
)
SELECT
    stage_1_page_view AS top_funnel_visitors,
    stage_2_product_view AS product_viewers,
    ROUND((stage_2_product_view * 100.0 / NULLIF(stage_1_page_view, 0))::numeric, 2) AS view_to_product_pct,
    stage_3_add_to_cart AS cart_adders,
    ROUND((stage_3_add_to_cart * 100.0 / NULLIF(stage_2_product_view, 0))::numeric, 2) AS product_to_cart_pct,
    stage_4_checkout AS checkout_initiators,
    ROUND((stage_4_checkout * 100.0 / NULLIF(stage_3_add_to_cart, 0))::numeric, 2) AS cart_to_checkout_pct,
    stage_5_purchase AS purchasers,
    ROUND((stage_5_purchase * 100.0 / NULLIF(stage_4_checkout, 0))::numeric, 2) AS checkout_to_purchase_pct,
    ROUND((stage_5_purchase * 100.0 / NULLIF(stage_1_page_view, 0))::numeric, 2) AS overall_funnel_conversion_pct
FROM EventCounts;


-- 2. Rolling 7-Day Moving Aggregate with Window Framing
-- Uses RANGE / ROWS BETWEEN 6 PRECEDING AND CURRENT ROW to analyze sales momentum.
WITH DailySales AS (
    SELECT
        order_date::date AS sale_date,
        COUNT(id) AS daily_order_count,
        ROUND(SUM(total_amount)::numeric, 2) AS daily_revenue
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY order_date::date
)
SELECT
    sale_date,
    daily_order_count,
    daily_revenue,
    ROUND(
        AVG(daily_revenue) OVER (
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )::numeric, 2
    ) AS rolling_7day_avg_revenue,
    SUM(daily_order_count) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_7day_order_count
FROM DailySales
ORDER BY sale_date DESC
LIMIT 30;


-- 3. Median and Percentile Distribution of Order Values by Country
-- Demonstrates PERCENTILE_CONT statistical function.
SELECT
    c.country,
    COUNT(o.id) AS total_orders,
    ROUND(AVG(o.total_amount)::numeric, 2) AS mean_order_value,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY o.total_amount)::numeric, 2) AS median_p50,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY o.total_amount)::numeric, 2) AS p90_high_tier,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY o.total_amount)::numeric, 2) AS p99_whale_order
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.country
HAVING COUNT(o.id) >= 10
ORDER BY total_orders DESC
LIMIT 15;

