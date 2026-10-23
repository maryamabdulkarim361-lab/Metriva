-- ==============================================================================
-- AI Database Assistant - SQL Demonstration Layer
-- File: product_analytics.sql
-- Concepts: Multi-table JOINs, Profit Margin Calculation, Window PARTITION BY
-- ==============================================================================

-- 1. Top 5 Products by Revenue Within Each Category
-- Uses DENSE_RANK() with PARTITION BY to compare products fairly within their own sector.
WITH ProductPerformance AS (
    SELECT
        p.category,
        p.id AS product_id,
        p.name AS product_name,
        p.price,
        p.cost,
        SUM(oi.quantity) AS total_units_sold,
        ROUND(SUM(oi.subtotal)::numeric, 2) AS total_revenue,
        ROUND(SUM(oi.subtotal - (oi.quantity * p.cost))::numeric, 2) AS total_gross_profit,
        DENSE_RANK() OVER (
            PARTITION BY p.category
            ORDER BY SUM(oi.subtotal) DESC
        ) AS category_rank
    FROM products p
    INNER JOIN order_items oi ON p.id = oi.product_id
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'COMPLETED'
    GROUP BY p.category, p.id, p.name, p.price, p.cost
)
SELECT
    category,
    category_rank,
    product_name,
    total_units_sold,
    total_revenue,
    total_gross_profit,
    ROUND((total_gross_profit / NULLIF(total_revenue, 0) * 100)::numeric, 2) AS gross_margin_percentage
FROM ProductPerformance
WHERE category_rank <= 5
ORDER BY category, category_rank;


-- 2. Category Revenue Share and Performance Contribution
-- Uses window SUM() OVER () to compute percentage of total catalog sales.
WITH CategoryTotals AS (
    SELECT
        p.category,
        COUNT(DISTINCT p.id) AS active_products_count,
        SUM(oi.quantity) AS units_sold,
        ROUND(SUM(oi.subtotal)::numeric, 2) AS category_revenue
    FROM products p
    INNER JOIN order_items oi ON p.id = oi.product_id
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'COMPLETED'
    GROUP BY p.category
)
SELECT
    category,
    active_products_count,
    units_sold,
    category_revenue,
    ROUND(
        (category_revenue / SUM(category_revenue) OVER () * 100)::numeric, 2
    ) AS percentage_of_total_revenue
FROM CategoryTotals
ORDER BY category_revenue DESC;


-- 3. Inventory Velocity & Restock Alert
-- Identifies fast-selling products with low on-hand inventory relative to sales velocity.
SELECT
    p.id AS product_id,
    p.name,
    p.category,
    p.stock_quantity,
    COALESCE(SUM(oi.quantity), 0) AS units_sold_all_time,
    CASE
        WHEN p.stock_quantity = 0 THEN 'OUT_OF_STOCK'
        WHEN p.stock_quantity < 20 THEN 'CRITICAL_LOW'
        WHEN p.stock_quantity < 50 THEN 'WARNING_LOW'
        ELSE 'OPTIMAL'
    END AS inventory_health_status
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.category, p.stock_quantity
ORDER BY p.stock_quantity ASC
LIMIT 20;

