# Database Performance & Query Optimization Benchmarks

> **Engine**: SQLite (Local Engine)  
> **Methodology**: Real execution telemetry measured across multiple isolated test runs.  
> *Note: Timings are measured in milliseconds (ms) on actual database data.*

## Summary Performance Table

| Benchmark Query | Key Index Utilized | Avg Latency | Min Latency | Max Latency |
| :--- | :--- | :---: | :---: | :---: |
| **Customer Lifetime Value Join** | `idx_order_customer_date (orders.customer_id)` | **2.44 ms** | 2.37 ms | 2.48 ms |
| **Monthly Revenue Timeseries** | `idx_order_date_status (orders.order_date, orders.status)` | **2.33 ms** | 2.22 ms | 2.44 ms |
| **Top Products per Category with Window Function** | `idx_item_order_product (order_items.order_id, order_items.product_id)` | **7.82 ms** | 7.45 ms | 8.16 ms |
| **High-Velocity Telemetry Funnel** | `idx_event_type_timestamp (website_events.event_type)` | **2.47 ms** | 2.41 ms | 2.53 ms |
| **90-Day Churn Inactivity Analysis** | `idx_order_customer_date` | **1.42 ms** | 1.21 ms | 1.88 ms |

## Query Execution Plans & Engineering Analysis

### Customer Lifetime Value Join
*JOIN between customers and orders with aggregation and descending order.*

- **Target Index**: `idx_order_customer_date (orders.customer_id)`
- **Average Duration**: `2.44 ms`

```text
(10, 0, 63, 'SEARCH o USING INDEX orders_status_17b834eb (status=?)')
(15, 0, 45, 'SEARCH c USING INTEGER PRIMARY KEY (rowid=?)')
(18, 0, 0, 'USE TEMP B-TREE FOR GROUP BY')
(75, 0, 0, 'USE TEMP B-TREE FOR ORDER BY')
```

### Monthly Revenue Timeseries
*Date truncation and monthly aggregation across transactions.*

- **Target Index**: `idx_order_date_status (orders.order_date, orders.status)`
- **Average Duration**: `2.33 ms`

```text
(8, 0, 63, 'SEARCH orders USING INDEX orders_status_17b834eb (status=?)')
(13, 0, 0, 'USE TEMP B-TREE FOR GROUP BY')
```

### Top Products per Category with Window Function
*Multi-table join with DENSE_RANK() partitioning by category.*

- **Target Index**: `idx_item_order_product (order_items.order_id, order_items.product_id)`
- **Average Duration**: `7.82 ms`

```text
(2, 0, 0, 'CO-ROUTINE CategoryRanks')
(5, 2, 0, 'CO-ROUTINE (subquery-3)')
(16, 5, 56, 'SEARCH o USING COVERING INDEX orders_status_17b834eb (status=?)')
(20, 5, 61, 'SEARCH oi USING INDEX order_items_order_id_412ad78b (order_id=?)')
(25, 5, 45, 'SEARCH p USING INTEGER PRIMARY KEY (rowid=?)')
(28, 5, 0, 'USE TEMP B-TREE FOR GROUP BY')
(77, 5, 0, 'USE TEMP B-TREE FOR ORDER BY')
(96, 2, 82, 'SCAN (subquery-3)')
(173, 0, 82, 'SCAN CategoryRanks')
(186, 0, 0, 'USE TEMP B-TREE FOR ORDER BY')
```

### High-Velocity Telemetry Funnel
*Event aggregation across clickstream dataset with customer mapping.*

- **Target Index**: `idx_event_type_timestamp (website_events.event_type)`
- **Average Duration**: `2.47 ms`

```text
(8, 0, 225, 'SCAN website_events USING INDEX website_events_event_type_ecb43693')
(45, 0, 0, 'USE TEMP B-TREE FOR count(DISTINCT)')
(48, 0, 0, 'USE TEMP B-TREE FOR ORDER BY')
```

### 90-Day Churn Inactivity Analysis
*LEFT JOIN detecting customers with no orders in past 90 days.*

- **Target Index**: `idx_order_customer_date`
- **Average Duration**: `1.42 ms`

```text
(10, 0, 211, 'SCAN c USING INDEX customers_customer_segment_3f86c1e8')
(13, 0, 53, 'SEARCH o USING COVERING INDEX idx_order_customer_date (customer_id=?) LEFT-JOIN')
(69, 0, 0, 'USE TEMP B-TREE FOR ORDER BY')
```
